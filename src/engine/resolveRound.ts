import { COMBAT, TIERS, TWO_STEP } from './config';
import { typeMult } from './data';
import type { BattleEvent, CommitDescriptor, SideSnapshot } from './events';
import type { RNG } from './rng';
import { lookupMove, setActiveMember, validateActionTeam } from './state';
import type {
  Action,
  ArenaSchedule,
  BattleState,
  CallKind,
  Side,
  SideState,
  Stance,
  Team,
  TraitTable,
  TwoStep,
  TypeChart,
} from './types';
import { activeMon, firstSurvivor, isRhythmRound, stanceForTwoStep, traitMods, twoStepForStance } from './types';

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

// Layer 1 — has `side` committed the SAME (non-null) move stance for the two
// most recent rounds, matching `stance` this round? Three running = a daze.
function thriceRepeat(
  history: readonly { readonly player: Stance | null; readonly foe: Stance | null }[],
  side: Side,
  stance: Stance | null,
): boolean {
  if (stance === null || history.length < 2) return false;
  const a = history[history.length - 1]![side];
  const b = history[history.length - 2]![side];
  return a === stance && b === stance;
}

function stanceOutMult(stance: Stance): number {
  if (stance === 'A') return COMBAT.aggrDmg;
  if (stance === 'G') return COMBAT.guardDmg;
  return 1;
}

// Layer 2 — raw pre-stance damage (the shared damage core, no triangle/mitigation).
function rawHit(
  att: SideState,
  def: SideState,
  moveName: string,
  rng: RNG,
  typeChart: TypeChart,
  traits: TraitTable,
  rhythm: boolean,
): { d: number; eff: number } {
  const move = lookupMove(moveName);
  const tier = TIERS[move.tier];
  const eff = typeMult(typeChart, move.type, def.species.types);
  const variance = COMBAT.damageVarianceMin + rng.next() * COMBAT.damageVarianceSpan;
  let d = (tier.power * att.species.atk) / def.species.dfn * COMBAT.dmgScale * variance;
  d *= eff;
  d *= traitMods(att, rhythm, traits).dmgMult;
  return { d, eff };
}

// Layer 2 — the FLIPPED triangle (both released two-steps): HIDE>CHARGE>FEINT>HIDE.
function flipBeats(a: TwoStep, b: TwoStep): boolean {
  return (
    (a === 'hide' && b === 'charge') ||
    (a === 'charge' && b === 'feint') ||
    (a === 'feint' && b === 'hide')
  );
}

function stripWinding(side: SideState): SideState {
  if (side.winding === undefined) return side;
  const { winding: _drop, ...rest } = side;
  return rest;
}

// Apply damage to a defender respecting an active ★-Call: GET AWAY = no-hit;
// HANG IN THERE = floored at 1 hp.
function applyHp(defHp: number, dmg: number, call: CallKind | null): number {
  if (call === 'getAway') return defHp;
  const hp = defHp - dmg;
  if (call === 'hangInThere') return Math.max(1, hp);
  return Math.max(0, hp);
}

// Apply damage and report the ACTUAL amount dealt (0 if a Call negated it), so
// two-step events carry what truly landed — the game replays event.damage to
// animate hp, and a negated Call hit must read as 0.
function dealt(defHp: number, dmg: number, call: CallKind | null): { hp: number; applied: number } {
  const hp = applyHp(defHp, dmg, call);
  return { hp, applied: defHp - hp };
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
  // Layer 2 — a mon mid-wind-up RELEASES this round regardless of the passed
  // action (it's committed): describe the phase-2 release.
  if (side.winding !== undefined) {
    return { kind: 'twoStep', step: side.winding.step, phase: 2, move: side.winding.move };
  }
  if (action.kind === 'move') {
    if (action.commit === true) {
      return { kind: 'twoStep', step: twoStepForStance(action.stance), phase: 1, move: action.move };
    }
    return { kind: 'move', move: action.move, stance: action.stance };
  }
  if (action.kind === 'call') return { kind: 'call', call: action.call };
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
  defDazed: boolean,
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

  // Extra damage a DAZED defender takes this round (thrice-repeat punish).
  // Applied to whichever damage branch lands below.
  const dazeMult = defDazed ? COMBAT.dazeTaken : 1;

  // A vs F — Layer 1: AGGRESSIVE BEATS FLUID. The aggressor catches the
  // committing dodger — a PUNISH (hard counter, was the Fluid dodge). Extra
  // damage + the AGGRESSOR charges ★ (the read-win flips with the edge).
  if (attStance === 'A' && defStance === 'F') {
    let dd = d * COMBAT.punishMult * dazeMult;
    if (defender.exhausted) dd *= COMBAT.exhTaken;
    const newDef: SideState = { ...defender, hp: Math.max(0, defender.hp - dd) };
    events.push({ kind: 'punish', side: attSide, damage: dd, effectiveness: eff });
    const newAtt = gainMomentum(attacker, attSide, events);
    if (newDef.hp <= 0) events.push({ kind: 'ko', side: defSide });
    return { attacker: newAtt, defender: newDef };
  }

  // F vs G — opening (no counter possible)
  if (attStance === 'F' && defStance === 'G') {
    const baseMit = defender.exhausted ? COMBAT.openTaken * COMBAT.exhTaken : COMBAT.openTaken;
    const dd = d * COMBAT.openDmg * baseMit * dazeMult;
    const newDef: SideState = { ...defender, hp: Math.max(0, defender.hp - dd) };
    events.push({ kind: 'opening', side: attSide, damage: dd, effectiveness: eff });
    const newAtt = gainMomentum(attacker, attSide, events);
    if (newDef.hp <= 0) events.push({ kind: 'ko', side: defSide });
    return { attacker: newAtt, defender: newDef };
  }

  // Normal hit (with defender mitigation). preMit stays PRE-daze so the
  // counter reflect isn't amplified by the defender's own daze (daze is a
  // vulnerability, never a buff).
  const preMit = d;
  if (defStance === 'A') d *= COMBAT.aggrTaken;
  if (defStance === 'G') d *= COMBAT.guardTaken;
  if (defender.exhausted) d *= COMBAT.exhTaken;
  d *= dazeMult;

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
  if (action.kind === 'call') {
    // Layer 2 — a Call spends ★ (handled in the round), no stamina change.
    // (resolveRound never routes a call through paySide; this satisfies the
    // type and is correct regardless.)
    return side;
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
  // A mon mid-wind-up is LOCKED into releasing this round — its passed action
  // is overridden, so skip validation for it (the release is legal by
  // construction). Single-step sides validate exactly as before.
  if (activeMon(state.player).winding === undefined) validateActionTeam(state.player, playerAction);
  if (activeMon(state.foe).winding === undefined) validateActionTeam(state.foe, foeAction);

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

  // Layer 2 — a mon carrying `winding` from last round RELEASES (phase 2) this
  // round; its passed action is ignored. Captured before any mutation.
  const plReleasing = pl.winding !== undefined;
  const foeReleasing = foe.winding !== undefined;

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
  if (!plReleasing && playerAction.kind === 'switch') {
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
  if (!foeReleasing && foeAction.kind === 'switch') {
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

  if (!plReleasing && playerAction.kind === 'catchBreath') {
    events.push({ kind: 'catchBreath', side: 'player', restored: CATCH_BREATH_RESTORE });
    pl = { ...pl, momentum: pl.momentum - 1 };
  }
  if (!foeReleasing && foeAction.kind === 'catchBreath') {
    events.push({ kind: 'catchBreath', side: 'foe', restored: CATCH_BREATH_RESTORE });
    foe = { ...foe, momentum: foe.momentum - 1 };
  }

  const plStance = actionStance(playerAction);
  const foeStance = actionStance(foeAction);
  const plMove = actionMove(playerAction);
  const foeMove = actionMove(foeAction);

  const arena = state.bossCard?.arenaSchedule;
  const rhythm = isRhythmRound(arena, state.round, state.rhythmAnchor ?? 0);

  // Layer 2 — classify each side's mode this round (a releasing side is locked
  // from last round's wind-up; a committing side initiates a two-step now).
  const plCommitting = playerAction.kind === 'move' && playerAction.commit === true && !plReleasing;
  const foeCommitting = foeAction.kind === 'move' && foeAction.commit === true && !foeReleasing;
  const plCall: CallKind | null = !plReleasing && playerAction.kind === 'call' ? playerAction.call : null;
  const foeCall: CallKind | null = !foeReleasing && foeAction.kind === 'call' ? foeAction.call : null;
  const twoStepInvolved =
    plReleasing || foeReleasing || plCommitting || foeCommitting || plCall !== null || foeCall !== null;

  // History stance recorded for thrice-daze continuity: a release round
  // contributes the wound-up step's BASE stance (captured before strip).
  const plReleaseBase: Stance | null = plReleasing ? stanceForTwoStep(pl.winding!.step) : null;
  const foeReleaseBase: Stance | null = foeReleasing ? stanceForTwoStep(foe.winding!.step) : null;

  if (twoStepInvolved) {
    // ── Combat Layer 2 — two-step resolution path ──────────────────────────
    // Spend ★ for any Calls (validated ≥1) and announce the override.
    if (plCall !== null) {
      pl = { ...pl, momentum: Math.max(0, pl.momentum - 1) };
      events.push({ kind: 'call', side: 'player', call: plCall });
    }
    if (foeCall !== null) {
      foe = { ...foe, momentum: Math.max(0, foe.momentum - 1) };
      events.push({ kind: 'call', side: 'foe', call: foeCall });
    }
    // Stagger consumed this round.
    pl = { ...pl, staggered: false };
    foe = { ...foe, staggered: false };

    if (plReleasing && foeReleasing) {
      // CASE A — BOTH release: the FLIPPED triangle (HIDE>CHARGE>FEINT>HIDE,
      // soft tilt). The flip winner earns ★ (a genuine mutual read — L2.7).
      const plStep = pl.winding!.step;
      const foeStep = foe.winding!.step;
      const plRel = pl.winding!.move;
      const foeRel = foe.winding!.move;
      const winner: Side | null = flipBeats(plStep, foeStep)
        ? 'player'
        : flipBeats(foeStep, plStep)
          ? 'foe'
          : null;
      const plI = initiative(pl, plRel, rhythm, arena, state.traits);
      const foeI = initiative(foe, foeRel, rhythm, arena, state.traits);
      const ord: Side[] = plI >= foeI ? ['player', 'foe'] : ['foe', 'player'];
      for (const sk of ord) {
        if (pl.hp <= 0 || foe.hp <= 0) break;
        if (sk === 'player') {
          const { d, eff } = rawHit(pl, foe, plRel, rng, state.typeChart, state.traits, rhythm);
          let dd = d * TWO_STEP.releaseMult[plStep];
          if (winner === 'player') dd *= TWO_STEP.flipWinMult;
          else if (winner === 'foe') dd *= TWO_STEP.flipLoseMult;
          dd *= TWO_STEP.releaseIncomingMult[foeStep]; // foe's follow-through blunts the counter
          if (foe.exhausted) dd *= COMBAT.exhTaken;
          { const r = dealt(foe.hp, dd, foeCall); foe = { ...foe, hp: r.hp };
          events.push({ kind: 'release', side: 'player', step: plStep, damage: r.applied, effectiveness: eff, ...(plStep === 'charge' ? { pierced: true } : {}), ...(plStep === 'hide' ? { concealed: true } : {}) }); }
          if (foe.hp <= 0) events.push({ kind: 'ko', side: 'foe' });
        } else {
          const { d, eff } = rawHit(foe, pl, foeRel, rng, state.typeChart, state.traits, rhythm);
          let dd = d * TWO_STEP.releaseMult[foeStep];
          if (winner === 'foe') dd *= TWO_STEP.flipWinMult;
          else if (winner === 'player') dd *= TWO_STEP.flipLoseMult;
          dd *= TWO_STEP.releaseIncomingMult[plStep];
          if (pl.exhausted) dd *= COMBAT.exhTaken;
          { const r = dealt(pl.hp, dd, plCall); pl = { ...pl, hp: r.hp };
          events.push({ kind: 'release', side: 'foe', step: foeStep, damage: r.applied, effectiveness: eff, ...(foeStep === 'charge' ? { pierced: true } : {}), ...(foeStep === 'hide' ? { concealed: true } : {}) }); }
          if (pl.hp <= 0) events.push({ kind: 'ko', side: 'player' });
        }
      }
      // Emit the flip verdict AFTER the strikes so its callout is the one that
      // lands (names the winner + both steps), and award the winner's ★.
      const winnerStep = winner === 'player' ? plStep : winner === 'foe' ? foeStep : undefined;
      const loserStep = winner === 'player' ? foeStep : winner === 'foe' ? plStep : undefined;
      events.push({
        kind: 'flipResolve',
        winner,
        ...(winnerStep ? { winnerStep } : {}),
        ...(loserStep ? { loserStep } : {}),
      });
      if (winner === 'player' && pl.hp > 0) pl = gainMomentum(pl, 'player', events);
      else if (winner === 'foe' && foe.hp > 0) foe = gainMomentum(foe, 'foe', events);
    } else if (plReleasing) {
      // CASE B — player releases, foe responds (the wind-up is SEEN → a foe
      // single-step SOFT-counters: tilts, never negates). No ★ either way
      // (the phase-1 read already happened last round — surviving isn't a read).
      const step = pl.winding!.step;
      const relMove = pl.winding!.move;
      const foeSingle = foeAction.kind === 'move' && foeAction.commit !== true;
      const foeStanceS: Stance | null = foeSingle ? foeAction.stance : null;
      const foeMoveS: string | null = foeSingle ? foeAction.move : null;
      const soft = foeSingle && foeStanceS === TWO_STEP.softCounterStance[step];
      const plI = initiative(pl, relMove, rhythm, arena, state.traits);
      const foeI = foeMoveS !== null ? initiative(foe, foeMoveS, rhythm, arena, state.traits) : COMBAT.restInitiative;
      const ord: Side[] = plI >= foeI ? ['player', 'foe'] : ['foe', 'player'];
      for (const sk of ord) {
        if (pl.hp <= 0 || foe.hp <= 0) break;
        if (sk === 'player') {
          const { d, eff } = rawHit(pl, foe, relMove, rng, state.typeChart, state.traits, rhythm);
          let dd = d * TWO_STEP.releaseMult[step];
          if (soft) dd *= TWO_STEP.softCounterMult;
          const pierce = step === 'charge';
          // Guard mitigates a release EXCEPT vs Charge (pierces) or Feint (the
          // feint punishes the brace — no mitigation, then dazes).
          if (foeSingle && foeStanceS === 'G' && !pierce && step !== 'feint') dd *= COMBAT.guardTaken;
          if (foeSingle && foeStanceS === 'A') dd *= COMBAT.aggrTaken;
          if (step === 'feint' && foeSingle && foeStanceS === 'G') dd *= COMBAT.dazeTaken; // FEINT punishes the brace
          if (foe.exhausted) dd *= COMBAT.exhTaken;
          { const r = dealt(foe.hp, dd, foeCall); foe = { ...foe, hp: r.hp };
          events.push({ kind: 'release', side: 'player', step, damage: r.applied, effectiveness: eff, ...(pierce ? { pierced: true } : {}), ...(step === 'hide' ? { concealed: true } : {}) }); }
          if (foe.hp <= 0) events.push({ kind: 'ko', side: 'foe' });
        } else if (foeSingle && foeMoveS !== null) {
          const { d, eff } = rawHit(foe, pl, foeMoveS, rng, state.typeChart, state.traits, rhythm);
          let dd = d * stanceOutMult(foeStanceS!);
          dd *= TWO_STEP.releaseIncomingMult[step]; // releaser's follow-through blunts the counter
          if (pl.exhausted) dd *= COMBAT.exhTaken;
          { const r = dealt(pl.hp, dd, plCall); pl = { ...pl, hp: r.hp };
          events.push({ kind: 'strike', side: 'foe', move: foeMoveS, damage: r.applied, effectiveness: eff }); }
          if (pl.hp <= 0) events.push({ kind: 'ko', side: 'player' });
        }
      }
    } else if (foeReleasing) {
      // CASE B mirror — foe releases, player responds.
      const step = foe.winding!.step;
      const relMove = foe.winding!.move;
      const plSingle = playerAction.kind === 'move' && playerAction.commit !== true;
      const plStanceS: Stance | null = plSingle ? playerAction.stance : null;
      const plMoveS: string | null = plSingle ? playerAction.move : null;
      const soft = plSingle && plStanceS === TWO_STEP.softCounterStance[step];
      const foeI = initiative(foe, relMove, rhythm, arena, state.traits);
      const plI = plMoveS !== null ? initiative(pl, plMoveS, rhythm, arena, state.traits) : COMBAT.restInitiative;
      const ord: Side[] = foeI >= plI ? ['foe', 'player'] : ['player', 'foe'];
      for (const sk of ord) {
        if (pl.hp <= 0 || foe.hp <= 0) break;
        if (sk === 'foe') {
          const { d, eff } = rawHit(foe, pl, relMove, rng, state.typeChart, state.traits, rhythm);
          let dd = d * TWO_STEP.releaseMult[step];
          if (soft) dd *= TWO_STEP.softCounterMult;
          const pierce = step === 'charge';
          if (plSingle && plStanceS === 'G' && !pierce && step !== 'feint') dd *= COMBAT.guardTaken;
          if (plSingle && plStanceS === 'A') dd *= COMBAT.aggrTaken;
          if (step === 'feint' && plSingle && plStanceS === 'G') dd *= COMBAT.dazeTaken;
          if (pl.exhausted) dd *= COMBAT.exhTaken;
          { const r = dealt(pl.hp, dd, plCall); pl = { ...pl, hp: r.hp };
          events.push({ kind: 'release', side: 'foe', step, damage: r.applied, effectiveness: eff, ...(pierce ? { pierced: true } : {}), ...(step === 'hide' ? { concealed: true } : {}) }); }
          if (pl.hp <= 0) events.push({ kind: 'ko', side: 'player' });
        } else if (plSingle && plMoveS !== null) {
          const { d, eff } = rawHit(pl, foe, plMoveS, rng, state.typeChart, state.traits, rhythm);
          let dd = d * stanceOutMult(plStanceS!);
          dd *= TWO_STEP.releaseIncomingMult[step];
          if (foe.exhausted) dd *= COMBAT.exhTaken;
          { const r = dealt(foe.hp, dd, foeCall); foe = { ...foe, hp: r.hp };
          events.push({ kind: 'strike', side: 'player', move: plMoveS, damage: r.applied, effectiveness: eff }); }
          if (foe.hp <= 0) events.push({ kind: 'ko', side: 'foe' });
        }
      }
    } else {
      // CASE C — WIND-UP / Call round (no releases yet). A single-step striker
      // catches a winding mon: phase-1 vulnerability (HARSH). If the striker's
      // stance is a PUNISHER it earns ★ (read the wind-up — L2.7); a stance
      // that only "survives" the wind-up grants no ★.
      if (plCommitting) events.push({ kind: 'windUp', side: 'player', step: twoStepForStance(plStance) });
      if (foeCommitting) events.push({ kind: 'windUp', side: 'foe', step: twoStepForStance(foeStance) });
      const plStrikes = playerAction.kind === 'move' && playerAction.commit !== true && plMove !== null && plCall === null;
      const foeStrikes = foeAction.kind === 'move' && foeAction.commit !== true && foeMove !== null && foeCall === null;
      const plI = plStrikes ? initiative(pl, plMove, rhythm, arena, state.traits) : COMBAT.restInitiative;
      const foeI = foeStrikes ? initiative(foe, foeMove, rhythm, arena, state.traits) : COMBAT.restInitiative;
      const ord: Side[] = plI >= foeI ? ['player', 'foe'] : ['foe', 'player'];
      // Track whether each committer's wind-up got READ (punished) — drives the
      // "finishes charging" (survived) vs "wind-up punished" legibility beat.
      let plWindUpPunished = false;
      let foeWindUpPunished = false;
      for (const sk of ord) {
        if (pl.hp <= 0 || foe.hp <= 0) break;
        if (sk === 'player' && plStrikes) {
          const { d, eff } = rawHit(pl, foe, plMove!, rng, state.typeChart, state.traits, rhythm);
          let dd = d * stanceOutMult(plStance);
          let tStep: TwoStep | null = null;
          if (foeCommitting) {
            tStep = twoStepForStance(foeStance);
            dd *= TWO_STEP.phase1Vuln[tStep][plStance];
          }
          if (foe.exhausted) dd *= COMBAT.exhTaken;
          const r = dealt(foe.hp, dd, foeCall); foe = { ...foe, hp: r.hp };
          if (tStep !== null && TWO_STEP.punishedBy[tStep].includes(plStance)) {
            events.push({ kind: 'phase1Punish', side: 'player', step: tStep, damage: r.applied });
            foeWindUpPunished = true; // foe was the winder that got read
            pl = gainMomentum(pl, 'player', events);
          } else {
            events.push({ kind: 'strike', side: 'player', move: plMove!, damage: r.applied, effectiveness: eff });
          }
          if (foe.hp <= 0) events.push({ kind: 'ko', side: 'foe' });
        } else if (sk === 'foe' && foeStrikes) {
          const { d, eff } = rawHit(foe, pl, foeMove!, rng, state.typeChart, state.traits, rhythm);
          let dd = d * stanceOutMult(foeStance);
          let tStep: TwoStep | null = null;
          if (plCommitting) {
            tStep = twoStepForStance(plStance);
            dd *= TWO_STEP.phase1Vuln[tStep][foeStance];
          }
          if (pl.exhausted) dd *= COMBAT.exhTaken;
          const r = dealt(pl.hp, dd, plCall); pl = { ...pl, hp: r.hp };
          if (tStep !== null && TWO_STEP.punishedBy[tStep].includes(foeStance)) {
            events.push({ kind: 'phase1Punish', side: 'foe', step: tStep, damage: r.applied });
            plWindUpPunished = true; // player was the winder that got read
            foe = gainMomentum(foe, 'foe', events);
          } else {
            events.push({ kind: 'strike', side: 'foe', move: foeMove!, damage: r.applied, effectiveness: eff });
          }
          if (pl.hp <= 0) events.push({ kind: 'ko', side: 'player' });
        }
      }
      // Wind-up chip: a winding mon lands a glancing poke (no read/★/effect),
      // softening the tempo cost of committing. It already ate the phase-1
      // punish above, so the gamble holds.
      if (plCommitting && plMove !== null && pl.hp > 0 && foe.hp > 0) {
        const { d, eff } = rawHit(pl, foe, plMove, rng, state.typeChart, state.traits, rhythm);
        let dd = d * stanceOutMult(plStance) * TWO_STEP.windUpChipMult;
        if (foe.exhausted) dd *= COMBAT.exhTaken;
        const r = dealt(foe.hp, dd, foeCall); foe = { ...foe, hp: r.hp };
        events.push({ kind: 'strike', side: 'player', move: plMove, damage: r.applied, effectiveness: eff });
        if (foe.hp <= 0) events.push({ kind: 'ko', side: 'foe' });
      }
      if (foeCommitting && foeMove !== null && pl.hp > 0 && foe.hp > 0) {
        const { d, eff } = rawHit(foe, pl, foeMove, rng, state.typeChart, state.traits, rhythm);
        let dd = d * stanceOutMult(foeStance) * TWO_STEP.windUpChipMult;
        if (pl.exhausted) dd *= COMBAT.exhTaken;
        const r = dealt(pl.hp, dd, plCall); pl = { ...pl, hp: r.hp };
        events.push({ kind: 'strike', side: 'foe', move: foeMove, damage: r.applied, effectiveness: eff });
        if (pl.hp <= 0) events.push({ kind: 'ko', side: 'player' });
      }
      // A surviving, UNPUNISHED wind-up "finishes charging" — it'll release
      // next round. (A punished one already got its phase1Punish beat.)
      if (plCommitting && pl.hp > 0 && !plWindUpPunished) {
        events.push({ kind: 'windUpResolved', side: 'player', step: twoStepForStance(plStance) });
      }
      if (foeCommitting && foe.hp > 0 && !foeWindUpPunished) {
        events.push({ kind: 'windUpResolved', side: 'foe', step: twoStepForStance(foeStance) });
      }
    }

    // Two-step state transitions: a releaser clears its pending step; a fresh
    // committer (that survived) carries `winding` into next round.
    if (plReleasing) pl = stripWinding(pl);
    else if (plCommitting && pl.hp > 0) pl = { ...pl, winding: { step: twoStepForStance(plStance), move: plMove! } };
    if (foeReleasing) foe = stripWinding(foe);
    else if (foeCommitting && foe.hp > 0) foe = { ...foe, winding: { step: twoStepForStance(foeStance), move: foeMove! } };
  } else {
    // ── Single-step path (Layer 1 / legacy) — RNG- and event-identical ──────
    // Layer 1 — THRICE-REPEAT SELF-DAZE. The same MOVE stance 3 rounds running
    // (this round + the two prior committed stances) dazes the repeater: it
    // takes extra damage this round (predictability punished). Symmetric.
    const plMoveStance = plMove !== null ? plStance : null;
    const foeMoveStance = foeMove !== null ? foeStance : null;
    const plDazed = thriceRepeat(state.history, 'player', plMoveStance);
    const foeDazed = thriceRepeat(state.history, 'foe', foeMoveStance);

    const plInit = initiative(pl, plMove, rhythm, arena, state.traits);
    const foeInit = initiative(foe, foeMove, rhythm, arena, state.traits);

    // Layer 1 — FLUID = INITIATIVE. A Fluid move ACTS FIRST vs any non-Fluid
    // stance (even when slower in raw speed); it gets its hit in before the
    // opponent but loses the exchange on net (Aggressive punishes it). If both
    // are Fluid, the faster (initiative) strikes first; otherwise by initiative.
    const plFluid = plMove !== null && plStance === 'F';
    const foeFluid = foeMove !== null && foeStance === 'F';
    let order: Side[];
    if (plInit < 0 && foeInit < 0) order = [];
    else if (plInit < 0) order = ['foe'];
    else if (foeInit < 0) order = ['player'];
    else if (plFluid && !foeFluid) order = ['player', 'foe'];
    else if (foeFluid && !plFluid) order = ['foe', 'player'];
    else if (plInit > foeInit) order = ['player', 'foe'];
    else if (foeInit > plInit) order = ['foe', 'player'];
    else order = rng.next() < 0.5 ? ['player', 'foe'] : ['foe', 'player'];

    events.push({
      kind: 'initiative',
      playerInit: plInit,
      foeInit: foeInit,
      first: order.length > 0 ? order[0]! : null,
    });
    if (plDazed) events.push({ kind: 'dazed', side: 'player' });
    if (foeDazed) events.push({ kind: 'dazed', side: 'foe' });

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
        const r = resolveStrike(pl, foe, plMove!, "A", "A", "player", rng, events, state.typeChart, state.traits, rhythm, foeDazed);
        pl = r.attacker;
        foe = r.defender;
        if (foe.hp > 0) {
          foe = { ...foe, staggered: true };
          events.push({ kind: 'staggered', side: 'foe' });
        }
      } else {
        events.push({ kind: 'clash', winner: 'foe' });
        foe = gainMomentum(foe, 'foe', events);
        const r = resolveStrike(foe, pl, foeMove!, "A", "A", "foe", rng, events, state.typeChart, state.traits, rhythm, plDazed);
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
          const r = resolveStrike(pl, foe, plMove, plStance, foeStance, "player", rng, events, state.typeChart, state.traits, rhythm, foeDazed);
          pl = r.attacker;
          foe = r.defender;
        } else if (sideKey === 'foe' && foeMove !== null) {
          const r = resolveStrike(foe, pl, foeMove, foeStance, plStance, "foe", rng, events, state.typeChart, state.traits, rhythm, plDazed);
          foe = r.attacker;
          pl = r.defender;
        }
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
    // Layer 2 — a RELEASE strike is free (energy was spent on the wind-up):
    // just regen. A Call spends ★ (no stamina change). A wind-up (commit move)
    // pays its move cost via the normal paySide path.
    if (plReleasing) pl = { ...pl, st: Math.min(100, pl.st + COMBAT.regen) };
    else if (playerAction.kind === 'call') { /* ★ already spent; no stamina */ }
    else pl = paySide(pl, playerAction, rhythm, arena);
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
    if (foeReleasing) foe = { ...foe, st: Math.min(100, foe.st + COMBAT.regen) };
    else if (foeAction.kind === 'call') { /* ★ already spent; no stamina */ }
    else foe = paySide(foe, foeAction, rhythm, arena);
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
      else if (ev.kind === 'punish' && ev.side === 'player') gained += 1; // A>F read-win (was 'dodge')
      else if (ev.kind === 'clash' && ev.winner === 'player') gained += 1;
      else if (ev.kind === 'phase1Punish' && ev.side === 'player') gained += 1; // L2: read a wind-up
      else if (ev.kind === 'flipResolve' && ev.winner === 'player') gained += 1; // L2: won the flip
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
          // Layer 2 — a release round records the wound-up step's BASE stance
          // (a commit move already records its stance via the 'move' branch),
          // so thrice-daze sees two-steps as their base stance. Calls/rest → null.
          player: plReleaseBase ?? (playerAction.kind === 'move' ? playerAction.stance : null),
          foe: foeReleaseBase ?? (foeAction.kind === 'move' ? foeAction.stance : null),
        },
      ],
    },
    events,
  };
}
