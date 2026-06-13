import { COMBAT, TIERS } from './config';
import { typeMult } from './data';
import type { BattleEvent, CommitDescriptor, SideSnapshot } from './events';
import type { RNG } from './rng';
import { lookupMove, validateAction } from './state';
import type {
  Action,
  ArenaSchedule,
  BattleState,
  Side,
  SideState,
  Stance,
  TraitTable,
  TypeChart,
} from './types';
import { isRhythmRound, traitMods } from './types';

export interface RoundResult {
  readonly state: BattleState;
  readonly events: BattleEvent[];
}

function opposite(side: Side): Side {
  return side === 'player' ? 'foe' : 'player';
}

function snapshot(side: SideState): SideSnapshot {
  return {
    hp: side.hp,
    maxHp: side.maxHp,
    st: side.st,
    momentum: side.momentum,
    exhausted: side.exhausted,
    staggered: side.staggered,
  };
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function stanceOutMult(stance: Stance): number {
  if (stance === 'A') return COMBAT.aggrDmg;
  if (stance === 'G') return COMBAT.guardDmg;
  return 1;
}

function actionStance(action: Action): Stance {
  return action.kind === 'move' ? action.stance : 'G';
}

function actionMove(action: Action): string | null {
  return action.kind === 'move' ? action.move : null;
}

function describeAction(action: Action, side: SideState): CommitDescriptor {
  if (action.kind === 'move') return { kind: 'move', move: action.move, stance: action.stance };
  if (action.kind === 'catchBreath') return { kind: 'catchBreath' };
  return { kind: 'rest', reason: side.exhausted ? 'exhaustion' : 'softlock' };
}

function initiative(
  side: SideState,
  moveName: string | null,
  rhythm: boolean,
  arena: ArenaSchedule | undefined,
  traits: TraitTable,
): number {
  if (moveName === null) return COMBAT.restInitiative;
  const tier = TIERS[lookupMove(moveName).tier];
  let weight = tier.weight;
  if (rhythm && arena && tier.name === 'heavy') {
    weight *= arena.heavyExtraInitWeight;
  }
  let base = side.species.spd / weight;
  const trait = traitMods(side, rhythm, traits);
  base *= trait.initMult;
  return side.staggered ? base * COMBAT.staggerInitMult : base;
}

function gainMomentum(side: SideState, sideKey: Side, events: BattleEvent[]): SideState {
  if (side.momentum >= COMBAT.momentumCap) return side;
  const total = side.momentum + 1;
  events.push({ kind: 'momentum', side: sideKey, total });
  return { ...side, momentum: total };
}

interface StrikeResult {
  readonly attacker: SideState;
  readonly defender: SideState;
}

function resolveStrike(
  attacker: SideState,
  defender: SideState,
  moveName: string,
  attStance: Stance,
  defStance: Stance,
  attSide: Side,
  rng: RNG,
  events: BattleEvent[],
  typeChart: TypeChart,
  traits: TraitTable,
  rhythm: boolean,
): StrikeResult {
  const move = lookupMove(moveName);
  const tier = TIERS[move.tier];
  const defSide = opposite(attSide);
  const eff = typeMult(typeChart, move.type, defender.species.types);

  const variance = COMBAT.damageVarianceMin + rng.next() * COMBAT.damageVarianceSpan;
  let d =
    (tier.power * attacker.species.atk) / defender.species.dfn * COMBAT.dmgScale * variance;
  d *= eff;
  d *= stanceOutMult(attStance);
  // Trait damage modifier (e.g., GUSTBORNE x1.3 on rhythm rounds).
  d *= traitMods(attacker, rhythm, traits).dmgMult;

  // A vs F — dodge check
  if (attStance === 'A' && defStance === 'F') {
    const p = clamp(
      (defender.species.spd / attacker.species.spd - 1) * COMBAT.dodgeSlope,
      0,
      COMBAT.dodgeCap,
    );
    if (rng.next() < p) {
      events.push({ kind: 'dodge', side: defSide });
      const dodged = gainMomentum(defender, defSide, events);
      return { attacker, defender: dodged };
    }
  }

  // F vs G — opening (no counter possible)
  if (attStance === 'F' && defStance === 'G') {
    const mit = defender.exhausted ? COMBAT.openTaken * COMBAT.exhTaken : COMBAT.openTaken;
    const dd = d * COMBAT.openDmg * mit;
    const newDef: SideState = { ...defender, hp: Math.max(0, defender.hp - dd) };
    events.push({ kind: 'opening', side: attSide, damage: dd, effectiveness: eff });
    const newAtt = gainMomentum(attacker, attSide, events);
    if (newDef.hp <= 0) events.push({ kind: 'ko', side: defSide });
    return { attacker: newAtt, defender: newDef };
  }

  // Normal hit (with defender mitigation)
  const preMit = d;
  if (defStance === 'A') d *= COMBAT.aggrTaken;
  if (defStance === 'G') d *= COMBAT.guardTaken;
  if (defender.exhausted) d *= COMBAT.exhTaken;

  let newDef: SideState = { ...defender, hp: Math.max(0, defender.hp - d) };
  let newAtt: SideState = attacker;
  events.push({ kind: 'strike', side: attSide, move: moveName, damage: d, effectiveness: eff });

  if (newDef.hp <= 0) {
    events.push({ kind: 'ko', side: defSide });
    return { attacker: newAtt, defender: newDef };
  }

  // G vs A — counter, only because defender survived
  if (defStance === 'G' && attStance === 'A') {
    const reflect = preMit * COMBAT.reflect;
    newAtt = {
      ...newAtt,
      hp: Math.max(0, newAtt.hp - reflect),
      staggered: true,
    };
    events.push({ kind: 'counter', side: defSide, damage: reflect });
    events.push({ kind: 'staggered', side: attSide });
    newDef = gainMomentum(newDef, defSide, events);
    if (newAtt.hp <= 0) events.push({ kind: 'ko', side: attSide });
  }

  return { attacker: newAtt, defender: newDef };
}

function paySide(
  side: SideState,
  action: Action,
  rhythm: boolean,
  arena: ArenaSchedule | undefined,
): SideState {
  if (action.kind === 'rest') {
    return {
      ...side,
      st: Math.min(100, side.st + COMBAT.restRegen),
      exhausted: false,
    };
  }
  if (action.kind === 'catchBreath') {
    return { ...side, st: Math.min(100, side.st + COMBAT.catchBreathRestore) };
  }
  const move = lookupMove(action.move);
  const tier = TIERS[move.tier];
  let cost = tier.cost;
  if (action.stance === 'A') cost *= COMBAT.aggrCostMult;
  if (action.stance === 'F') cost += COMBAT.fluidCost;
  if (rhythm && arena && tier.name === 'heavy') cost += arena.heavyExtraCost;
  let st = side.st - cost + COMBAT.regen + (action.stance === 'G' ? COMBAT.guardRegen : 0);
  const exhausted = st <= 0;
  st = exhausted ? 0 : Math.min(100, st);
  return { ...side, st, exhausted };
}

function emitFatigueTransitions(
  before: SideState,
  after: SideState,
  sideKey: Side,
  events: BattleEvent[],
): void {
  if (!before.exhausted && after.exhausted) {
    events.push({ kind: 'exhausted', side: sideKey });
    return;
  }
  const wasWinded = before.st <= COMBAT.winded;
  const isWinded = after.st <= COMBAT.winded;
  if (!wasWinded && isWinded && !after.exhausted) {
    events.push({ kind: 'winded', side: sideKey });
  }
}

export function resolveRound(
  state: BattleState,
  playerAction: Action,
  foeAction: Action,
  rng: RNG,
): RoundResult {
  validateAction(state.player, playerAction);
  validateAction(state.foe, foeAction);

  const events: BattleEvent[] = [];
  events.push({
    kind: 'roundStart',
    round: state.round,
    player: snapshot(state.player),
    foe: snapshot(state.foe),
  });
  events.push({ kind: 'commit', side: 'player', action: describeAction(playerAction, state.player) });
  events.push({ kind: 'commit', side: 'foe', action: describeAction(foeAction, state.foe) });

  let pl = state.player;
  let foe = state.foe;

  if (playerAction.kind === 'catchBreath') {
    events.push({ kind: 'catchBreath', side: 'player', restored: COMBAT.catchBreathRestore });
    pl = { ...pl, momentum: pl.momentum - 1 };
  }
  if (foeAction.kind === 'catchBreath') {
    events.push({ kind: 'catchBreath', side: 'foe', restored: COMBAT.catchBreathRestore });
    foe = { ...foe, momentum: foe.momentum - 1 };
  }

  const plStance = actionStance(playerAction);
  const foeStance = actionStance(foeAction);
  const plMove = actionMove(playerAction);
  const foeMove = actionMove(foeAction);

  const arena = state.bossCard?.arenaSchedule;
  const rhythm = isRhythmRound(arena, state.round, state.rhythmAnchor ?? 0);

  const plInit = initiative(pl, plMove, rhythm, arena, state.traits);
  const foeInit = initiative(foe, foeMove, rhythm, arena, state.traits);

  let order: Side[];
  if (plInit < 0 && foeInit < 0) order = [];
  else if (plInit < 0) order = ['foe'];
  else if (foeInit < 0) order = ['player'];
  else if (plStance === 'F' && foeStance === 'G') order = ['player', 'foe'];
  else if (foeStance === 'F' && plStance === 'G') order = ['foe', 'player'];
  else if (plInit > foeInit) order = ['player', 'foe'];
  else if (foeInit > plInit) order = ['foe', 'player'];
  else order = rng.next() < 0.5 ? ['player', 'foe'] : ['foe', 'player'];

  events.push({
    kind: 'initiative',
    playerInit: plInit,
    foeInit: foeInit,
    first: order.length > 0 ? order[0]! : null,
  });

  // Stagger is consumed for initiative this round, then cleared.
  pl = { ...pl, staggered: false };
  foe = { ...foe, staggered: false };

  const isClash = plMove !== null && foeMove !== null && plStance === 'A' && foeStance === 'A';

  if (isClash) {
    const psc = pl.st * pl.species.spd;
    const fsc = foe.st * foe.species.spd;
    const total = psc + fsc;
    const plWins = total > 0 ? rng.next() < psc / total : rng.next() < 0.5;
    if (plWins) {
      events.push({ kind: 'clash', winner: 'player' });
      pl = gainMomentum(pl, 'player', events);
      const r = resolveStrike(pl, foe, plMove!, "A", "A", "player", rng, events, state.typeChart, state.traits, rhythm);
      pl = r.attacker;
      foe = r.defender;
      if (foe.hp > 0) {
        foe = { ...foe, staggered: true };
        events.push({ kind: 'staggered', side: 'foe' });
      }
    } else {
      events.push({ kind: 'clash', winner: 'foe' });
      foe = gainMomentum(foe, 'foe', events);
      const r = resolveStrike(foe, pl, foeMove!, "A", "A", "foe", rng, events, state.typeChart, state.traits, rhythm);
      foe = r.attacker;
      pl = r.defender;
      if (pl.hp > 0) {
        pl = { ...pl, staggered: true };
        events.push({ kind: 'staggered', side: 'player' });
      }
    }
  } else {
    for (const sideKey of order) {
      if (pl.hp <= 0 || foe.hp <= 0) break;
      if (sideKey === 'player' && plMove !== null) {
        const r = resolveStrike(pl, foe, plMove, plStance, foeStance, "player", rng, events, state.typeChart, state.traits, rhythm);
        pl = r.attacker;
        foe = r.defender;
      } else if (sideKey === 'foe' && foeMove !== null) {
        const r = resolveStrike(foe, pl, foeMove, foeStance, plStance, "foe", rng, events, state.typeChart, state.traits, rhythm);
        foe = r.attacker;
        pl = r.defender;
      }
    }
  }

  const koed = pl.hp <= 0 || foe.hp <= 0;

  // Matches demo: stamina settle is skipped on KO mid-round (battle is over).
  if (!koed) {
    const plBefore = pl;
    pl = paySide(pl, playerAction, rhythm, arena);
    if (pl.st !== plBefore.st) {
      events.push({
        kind: 'stamina',
        side: 'player',
        before: plBefore.st,
        after: pl.st,
        netDelta: pl.st - plBefore.st,
      });
    }
    emitFatigueTransitions(plBefore, pl, 'player', events);
    const foeBefore = foe;
    foe = paySide(foe, foeAction, rhythm, arena);
    if (foe.st !== foeBefore.st) {
      events.push({
        kind: 'stamina',
        side: 'foe',
        before: foeBefore.st,
        after: foe.st,
        netDelta: foe.st - foeBefore.st,
      });
    }
    emitFatigueTransitions(foeBefore, foe, 'foe', events);
  }

  // Break bar: count player read-wins from this round's events.
  // Read-wins per CLAUDE.md = counter landed, opening landed, dodge succeeded, clash won.
  let breakProgress = state.breakProgress ?? 0;
  let phase = state.phase ?? 1;
  let rhythmAnchor = state.rhythmAnchor ?? 0;
  const breakThreshold = state.bossCard?.breakBar ?? 0;
  if (breakThreshold > 0) {
    let gained = 0;
    for (const ev of events) {
      if (ev.kind === 'counter' && ev.side === 'player') gained += 1;
      else if (ev.kind === 'opening' && ev.side === 'player') gained += 1;
      else if (ev.kind === 'dodge' && ev.side === 'player') gained += 1;
      else if (ev.kind === 'clash' && ev.winner === 'player') gained += 1;
    }
    if (gained > 0) {
      breakProgress += gained;
      events.push({
        kind: 'breakProgress',
        progress: Math.min(breakProgress, breakThreshold),
        threshold: breakThreshold,
      });
    }
    if (breakProgress >= breakThreshold) {
      phase += 1;
      rhythmAnchor = state.round;
      events.push({ kind: 'break', newPhase: phase });
      breakProgress = 0;
    }
  }

  return {
    state: {
      player: pl,
      foe,
      round: state.round + 1,
      typeChart: state.typeChart,
      traits: state.traits,
      ...(state.bossCard !== undefined ? { bossCard: state.bossCard } : {}),
      ...(breakThreshold > 0 ? { breakProgress, phase, rhythmAnchor } : {}),
      history: [
        ...state.history,
        {
          player: playerAction.kind === 'move' ? playerAction.stance : null,
          foe: foeAction.kind === 'move' ? foeAction.stance : null,
        },
      ],
    },
    events,
  };
}
