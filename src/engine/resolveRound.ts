import { COMBAT, TIERS } from './config';
import { typeMult } from './data';
import type { BattleEvent, CommitDescriptor, SideSnapshot } from './events';
import type { RNG } from './rng';
import { lookupMove, setActiveMember, validateActionTeam } from './state';
import type {
  Action,
  ArenaSchedule,
  BattleState,
  Side,
  SideState,
  Stance,
  Team,
  TraitTable,
  TypeChart,
} from './types';
import { activeMon, firstSurvivor, isRhythmRound, traitMods } from './types';

export interface RoundResult {
  readonly state: BattleState;
  readonly events: BattleEvent[];
}

function opposite(side: Side): Side {
  return side === 'player' ? 'foe' : 'player';
}

// Phase 6b — Catch Breath restore = 50% of the 100-ST cap (a percentage,
// not a flat trickle). Computed once from config.
const CATCH_BREATH_RESTORE = Math.round(100 * COMBAT.catchBreathRestorePct);

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
  if (action.kind === 'move') return action.stance;
  // Throwing leaves you EXPOSED — treated as Aggressive on defense so the
  // thrower takes the foe's hit cleanly: no Guard counter, no Fluid dodge
  // (you didn't guard or dodge, you threw a ball). rest/catchBreath/switch
  // keep the legacy Guard default.
  if (action.kind === 'throwBall') return 'A';
  return 'G';
}

function actionMove(action: Action): string | null {
  return action.kind === 'move' ? action.move : null;
}

function describeAction(action: Action, side: SideState): CommitDescriptor {
  if (action.kind === 'move') return { kind: 'move', move: action.move, stance: action.stance };
  if (action.kind === 'catchBreath') return { kind: 'catchBreath' };
  if (action.kind === 'throwBall') return { kind: 'throwBall' };
  if (action.kind === 'switch') return { kind: 'rest', reason: 'softlock' };
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
  const jump = side.jumpstartArmed === true;
  if (side.momentum >= COMBAT.momentumCap) {
    // Already at cap: a normal read-win is inert. A jumpstart still "fires"
    // (it's a once-per-battle perk) but the free ★ can't bank — disarm it
    // so it doesn't linger to a later read-win.
    return jump ? { ...side, jumpstartArmed: false } : side;
  }
  // Jumpstart (game arms it for a Familiar-tier mon): the FIRST read-win
  // banks one EXTRA ★ on top of the normal one, capped. Then it disarms.
  const bonus = jump ? 1 : 0;
  const total = Math.min(COMBAT.momentumCap, side.momentum + 1 + bonus);
  events.push({ kind: 'momentum', side: sideKey, total });
  if (jump) {
    events.push({ kind: 'bondJumpstart', side: sideKey });
    return { ...side, momentum: total, jumpstartArmed: false };
  }
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
    return { ...side, st: Math.min(100, side.st + CATCH_BREATH_RESTORE) };
  }
  if (action.kind === 'switch') {
    // Switching is the turn — no stamina change for the side that switched.
    return side;
  }
  if (action.kind === 'throwBall') {
    // Throwing is the turn — the thrower forgoes its strike, no stamina
    // change (catch resolution is entirely game-side).
    return side;
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
  validateActionTeam(state.player, playerAction);
  validateActionTeam(state.foe, foeAction);

  const events: BattleEvent[] = [];

  // Team copies for write-back at the end.
  let playerTeam: Team = state.player;
  let foeTeam: Team = state.foe;

  // Working active-mon variables. The rest of this function reads/writes
  // pl/foe exactly as the legacy 1v1 path did. At teamSize 1 there's no
  // switching, no bench, no faint flow — so RNG draws and event order
  // match the pre-team lock byte-for-byte.
  let pl: SideState = activeMon(playerTeam);
  let foe: SideState = activeMon(foeTeam);

  events.push({
    kind: 'roundStart',
    round: state.round,
    player: snapshot(pl),
    foe: snapshot(foe),
  });
  events.push({ kind: 'commit', side: 'player', action: describeAction(playerAction, pl) });
  events.push({ kind: 'commit', side: 'foe', action: describeAction(foeAction, foe) });

  // Switch action — voluntary. Resolves before strikes; the switched-in
  // mon takes any hit this round (handled naturally: actionMove is null
  // for switch, so the switching side does not strike; the other side's
  // strike targets the new active because pl/foe are reassigned here).
  if (playerAction.kind === 'switch') {
    const fromIndex = playerTeam.active;
    events.push({
      kind: 'switchOut',
      side: 'player',
      fromIndex,
      species: pl.species.name,
    });
    playerTeam = { ...playerTeam, active: playerAction.toIndex };
    pl = activeMon(playerTeam);
    events.push({
      kind: 'switchIn',
      side: 'player',
      toIndex: playerAction.toIndex,
      species: pl.species.name,
    });
  }
  if (foeAction.kind === 'switch') {
    const fromIndex = foeTeam.active;
    events.push({
      kind: 'switchOut',
      side: 'foe',
      fromIndex,
      species: foe.species.name,
    });
    foeTeam = { ...foeTeam, active: foeAction.toIndex };
    foe = activeMon(foeTeam);
    events.push({
      kind: 'switchIn',
      side: 'foe',
      toIndex: foeAction.toIndex,
      species: foe.species.name,
    });
  }

  if (playerAction.kind === 'catchBreath') {
    events.push({ kind: 'catchBreath', side: 'player', restored: CATCH_BREATH_RESTORE });
    pl = { ...pl, momentum: pl.momentum - 1 };
  }
  if (foeAction.kind === 'catchBreath') {
    events.push({ kind: 'catchBreath', side: 'foe', restored: CATCH_BREATH_RESTORE });
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

  // Per-side settle. KO-stamina memo: the survivor settles stamina normally;
  // the side whose active mon fainted forfeits its remaining action and does
  // not settle. At teamSize 1 the battle ends here either way, so the
  // observable difference vs. the legacy "skip both on any KO" is inert.
  const plFainted = pl.hp <= 0;
  const foeFainted = foe.hp <= 0;

  if (!plFainted) {
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
  }
  if (!foeFainted) {
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

  // Write the post-strike active mons back into their teams BEFORE
  // resolving faints — firstSurvivor needs to see the current hp values.
  playerTeam = setActiveMember(playerTeam, pl);
  foeTeam = setActiveMember(foeTeam, foe);

  // Faint flow: if a side's active mon hit 0 hp this round, emit 'faint'
  // and (if the bench has a survivor) automatically forced-switch to the
  // first surviving member. If no survivor, the team is wiped — the
  // caller observes via isTeamWiped and ends the battle.
  if (plFainted) {
    events.push({ kind: 'faint', side: 'player', species: pl.species.name });
    const next = firstSurvivor(playerTeam);
    if (next !== null) {
      playerTeam = { ...playerTeam, active: next };
      const newActive = activeMon(playerTeam);
      events.push({
        kind: 'forcedSwitch',
        side: 'player',
        toIndex: next,
        species: newActive.species.name,
      });
    }
  }
  if (foeFainted) {
    events.push({ kind: 'faint', side: 'foe', species: foe.species.name });
    const next = firstSurvivor(foeTeam);
    if (next !== null) {
      foeTeam = { ...foeTeam, active: next };
      const newActive = activeMon(foeTeam);
      events.push({
        kind: 'forcedSwitch',
        side: 'foe',
        toIndex: next,
        species: newActive.species.name,
      });
    }
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
      player: playerTeam,
      foe: foeTeam,
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
