import { COMBAT, FOCUS, TIERS } from './config';
import { typeMult } from './data';
import type { BattleEvent, CommitDescriptor, SideSnapshot } from './events';
import type { RNG } from './rng';
import { lookupMove, setActiveMember, validateActionTeam } from './state';
import {
  applyPendingEffect,
  buffDamageTakenMult,
  durationForStatus,
  effectDamageFactor,
  tickStatuses,
} from './status';
import type { PendingEffect } from './status';
import type {
  Action,
  ArenaSchedule,
  BattleState,
  CallKind,
  ReleaseKind,
  Side,
  SideState,
  Stance,
  Team,
  TraitTable,
  TypeChart,
} from './types';
import {
  activeMon,
  defaultReleaseForStance,
  firstSurvivor,
  flipBeats,
  isRhythmRound,
  releaseVsStance,
  traitMods,
} from './types';

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

// Raw pre-stance damage (the shared damage core, no triangle/mitigation).
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
  // Technique chip-damage reduction (1.0 for the 43 damage moves → bit-identical).
  // Keeps a technique's damage reduced in EVERY path; note this increment only
  // APPLIES statuses in the single-step triangle (there is no stance-read to win
  // against a focusing opponent), so a technique vs a focuser chips only.
  d *= effectDamageFactor(move);
  return { d, eff };
}

function stripFocus(side: SideState): SideState {
  if (side.focus === undefined) return side;
  const { focus: _drop, ...rest } = side;
  return rest;
}

// Apply damage to a defender respecting an active ★-Call:
//   DODGE       = clean full evade (no-hit) — the later, stronger escape.
//   GET AWAY    = GRAZE: you jump away but the attack still clips you for
//                 getAwayGraze× the incoming damage (Fix 3 — the earlier,
//                 cheaper escape is now the weaker one, a real progression).
//                 SIM-GATED: this is the one Call a sim bot uses, so it moves
//                 the getAway-using ladder cells (intended nerf).
//   HANG IN THERE = floored at 1 hp.  RECOVER does NOT negate the hit (its heal
//                 is applied separately, before the strike) → normal damage.
function applyHp(defHp: number, dmg: number, call: CallKind | null): number {
  if (call === 'dodge') return defHp;
  if (call === 'getAway') return Math.max(0, defHp - dmg * COMBAT.getAwayGraze);
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

// RECOVER Call (Lane B) — heal recoverPct of maxHp, clamped, and emit the
// heal so the game raises the hp bar. Applied at call-resolution time (before
// the round's strikes), so the caller recovers and THEN takes any incoming hit
// this round. No-op for any non-recover call → other Calls are untouched.
function applyRecover(
  side: SideState,
  call: CallKind,
  sideKey: Side,
  events: BattleEvent[],
): SideState {
  if (call !== 'recover') return side;
  const healed = Math.min(side.maxHp, side.hp + Math.round(side.maxHp * COMBAT.recoverPct));
  events.push({ kind: 'recover', side: sideKey, healed: healed - side.hp });
  return { ...side, hp: healed };
}

function actionStance(action: Action): Stance {
  if (action.kind === 'move') return action.stance;
  // Throwing OR switching leaves you EXPOSED — treated as Aggressive on defense so
  // the side takes the foe's hit cleanly: no Guard counter, no Fluid dodge (you
  // didn't guard or dodge — you threw a ball / swapped a mon in). Fixes the
  // switch-out phantom faint (#7): a switched-in mon used to default to Guard and
  // COUNTER the incoming Aggressive strike, reflecting damage that KO'd a low-HP
  // foe across the switch. rest/catchBreath keep the legacy Guard default (you're
  // hunkered down, not exposed).
  if (action.kind === 'throwBall' || action.kind === 'switch') return 'A';
  return 'G';
}

function actionMove(action: Action): string | null {
  return action.kind === 'move' ? action.move : null;
}

function describeAction(action: Action, side: SideState): CommitDescriptor {
  // FOCUS model — a focusing mon RELEASES this round (its chosen release, or
  // the focus's default if none was passed).
  if (side.focus !== undefined) {
    const release = action.kind === 'release' ? action.release : defaultReleaseForStance(side.focus.stance);
    return { kind: 'release', release };
  }
  if (action.kind === 'move') {
    if (action.commit === true) return { kind: 'focus' };
    return { kind: 'move', move: action.move, stance: action.stance };
  }
  if (action.kind === 'release') return { kind: 'release', release: action.release };
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
  // Effect-move plumbing (Increment 1a): the status this strike will apply,
  // resolved by resolveRound AFTER the end-of-round tick (so a fresh status
  // does not tick on its cast round). Absent for the 43 damage moves.
  readonly effect?: PendingEffect;
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
  // FULL POWER (Lane B) — ×1.5 on a buffed attack, else 1. Applied to the raw
  // damage so it flows into EVERY branch (punish/opening/normal AND the
  // counter-reflect preMit) — Full Power amplifies whatever the attack does,
  // including the reflect it eats into a Guard. Defaults 1 → sim/legacy strikes
  // are bit-identical.
  attMult = 1,
): StrikeResult {
  const move = lookupMove(moveName);
  const tier = TIERS[move.tier];
  const defSide = opposite(attSide);
  const eff = typeMult(typeChart, move.type, defender.species.types);

  // ── Effect-move mechanism (Increment 1a) ──────────────────────────────────
  // `effect` is set only for a TECHNIQUE (the 43 damage moves omit it → every
  // factor below is 1.0 → bit-identical). A technique deals reduced chip
  // damage, and on a cast-stance READ-WIN its status replaces the ★ (no
  // double-win); a BUFF self-applies in every branch (exposure is the cost).
  const effect = move.effect;
  // The defender's active buffs (e.g. BULWARK) mitigate every incoming strike;
  // 1.0 when the defender has no buffs.
  const defTaken = buffDamageTakenMult(defender);
  const makeBuffPending = (): PendingEffect | undefined =>
    effect !== undefined && effect.polarity === 'buff'
      ? { target: attSide, status: effect.status, polarity: 'buff', duration: durationForStatus(effect.status) }
      : undefined;
  const makeDebuffPending = (): PendingEffect | undefined =>
    effect !== undefined && effect.polarity === 'debuff'
      ? { target: defSide, status: effect.status, polarity: 'debuff', duration: durationForStatus(effect.status) }
      : undefined;
  // On a read-win (punish / opening) a buff lands on self OR a debuff on the foe.
  const readWinPending = (): PendingEffect | undefined => makeBuffPending() ?? makeDebuffPending();

  const variance = COMBAT.damageVarianceMin + rng.next() * COMBAT.damageVarianceSpan;
  let d =
    (tier.power * attacker.species.atk) / defender.species.dfn * COMBAT.dmgScale * variance;
  d *= eff;
  d *= stanceOutMult(attStance);
  // Trait damage modifier (e.g., GUSTBORNE x1.3 on rhythm rounds).
  d *= traitMods(attacker, rhythm, traits).dmgMult;
  d *= attMult;
  // Technique chip-damage reduction (1.0 for a normal attack).
  d *= effectDamageFactor(move);

  // Extra damage a DAZED defender takes this round (thrice-repeat punish).
  // Applied to whichever damage branch lands below.
  const dazeMult = defDazed ? COMBAT.dazeTaken : 1;

  // A vs F — Layer 1: AGGRESSIVE BEATS FLUID. The aggressor catches the
  // committing dodger — a PUNISH (hard counter, was the Fluid dodge). Extra
  // damage + the AGGRESSOR charges ★ (the read-win flips with the edge).
  if (attStance === 'A' && defStance === 'F') {
    let dd = d * COMBAT.punishMult * dazeMult * defTaken;
    if (defender.exhausted) dd *= COMBAT.exhTaken;
    const newDef: SideState = { ...defender, hp: Math.max(0, defender.hp - dd) };
    events.push({ kind: 'punish', side: attSide, damage: dd, effectiveness: eff });
    // Effect move: the status REPLACES the read-win ★ (no double-win); a plain
    // attack banks ★ exactly as before.
    const newAtt = effect !== undefined ? attacker : gainMomentum(attacker, attSide, events);
    if (newDef.hp <= 0) events.push({ kind: 'ko', side: defSide });
    const pend = readWinPending();
    return { attacker: newAtt, defender: newDef, ...(pend !== undefined ? { effect: pend } : {}) };
  }

  // F vs G — opening (no counter possible)
  if (attStance === 'F' && defStance === 'G') {
    const baseMit = defender.exhausted ? COMBAT.openTaken * COMBAT.exhTaken : COMBAT.openTaken;
    const dd = d * COMBAT.openDmg * baseMit * dazeMult * defTaken;
    const newDef: SideState = { ...defender, hp: Math.max(0, defender.hp - dd) };
    events.push({ kind: 'opening', side: attSide, damage: dd, effectiveness: eff });
    // Effect move: status replaces the read-win ★ (see the punish branch).
    const newAtt = effect !== undefined ? attacker : gainMomentum(attacker, attSide, events);
    if (newDef.hp <= 0) events.push({ kind: 'ko', side: defSide });
    const pend = readWinPending();
    return { attacker: newAtt, defender: newDef, ...(pend !== undefined ? { effect: pend } : {}) };
  }

  // Normal hit (with defender mitigation). preMit stays PRE-daze so the
  // counter reflect isn't amplified by the defender's own daze (daze is a
  // vulnerability, never a buff).
  const preMit = d;
  if (defStance === 'A') d *= COMBAT.aggrTaken;
  if (defStance === 'G') d *= COMBAT.guardTaken;
  if (defender.exhausted) d *= COMBAT.exhTaken;
  d *= dazeMult;
  d *= defTaken;

  let newDef: SideState = { ...defender, hp: Math.max(0, defender.hp - d) };
  let newAtt: SideState = attacker;
  events.push({ kind: 'strike', side: attSide, move: moveName, damage: d, effectiveness: eff });

  // A DEBUFF cast in a non-read-win stance FIZZLES here (only chip landed); a
  // BUFF still self-applies (it never needed a read). No read-win ★ in this
  // branch regardless, so nothing to suppress.
  const buffPending = makeBuffPending();

  if (newDef.hp <= 0) {
    events.push({ kind: 'ko', side: defSide });
    return { attacker: newAtt, defender: newDef, ...(buffPending !== undefined ? { effect: buffPending } : {}) };
  }

  // G vs A — counter, only because defender survived
  if (defStance === 'G' && attStance === 'A') {
    const reflect = preMit * COMBAT.reflect * buffDamageTakenMult(attacker);
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

  return { attacker: newAtt, defender: newDef, ...(buffPending !== undefined ? { effect: buffPending } : {}) };
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
  if (action.kind === 'release') {
    // A release strike is free (energy was spent on the focus); a releasing
    // side is settled by the regen-only branch in resolveRound, not here. This
    // satisfies the type and is correct regardless.
    return side;
  }
  if (action.kind === 'call') {
    // A Call spends ★ (handled in the round), no stamina change.
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
  if (activeMon(state.player).focus === undefined) validateActionTeam(state.player, playerAction);
  if (activeMon(state.foe).focus === undefined) validateActionTeam(state.foe, foeAction);

  const events: BattleEvent[] = [];

  // Effect-move plumbing (Increment 1a): statuses a technique resolved THIS
  // round will apply, collected from resolveStrike and applied AFTER the
  // end-of-round status tick (so a fresh status does not tick on its cast
  // round). Empty for any round with no technique → bit-identical.
  const pendingEffects: PendingEffect[] = [];

  // Team copies for write-back at the end.
  let playerTeam: Team = state.player;
  let foeTeam: Team = state.foe;

  // Working active-mon variables. The rest of this function reads/writes
  // pl/foe exactly as the legacy 1v1 path did. At teamSize 1 there's no
  // switching, no bench, no faint flow — so RNG draws and event order
  // match the pre-team lock byte-for-byte.
  let pl: SideState = activeMon(playerTeam);
  let foe: SideState = activeMon(foeTeam);

  // FOCUS model — a mon carrying `focus` from last round RELEASES (R2) this
  // round (its chosen release). Captured before any mutation.
  const plReleasing = pl.focus !== undefined;
  const foeReleasing = foe.focus !== undefined;

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

  // FOCUS model — classify each side's mode this round (a releasing side is
  // locked from last round's focus; an initiating side starts a Focus now).
  const plInitiating = playerAction.kind === 'move' && playerAction.commit === true && !plReleasing;
  const foeInitiating = foeAction.kind === 'move' && foeAction.commit === true && !foeReleasing;
  const plCall: CallKind | null = !plReleasing && playerAction.kind === 'call' ? playerAction.call : null;
  const foeCall: CallKind | null = !foeReleasing && foeAction.kind === 'call' ? foeAction.call : null;
  const focusInvolved =
    plReleasing || foeReleasing || plInitiating || foeInitiating || plCall !== null || foeCall !== null;

  // The release a releasing side fires this round (its R2 choice; defaults from
  // the focus's base stance when no release was passed).
  const plRelease: ReleaseKind | null = plReleasing
    ? playerAction.kind === 'release'
      ? playerAction.release
      : defaultReleaseForStance(pl.focus!.stance)
    : null;
  const foeRelease: ReleaseKind | null = foeReleasing
    ? foeAction.kind === 'release'
      ? foeAction.release
      : defaultReleaseForStance(foe.focus!.stance)
    : null;
  // Focus + release rounds are commitments, not single-step stances → they
  // don't feed the single-step thrice-daze (recorded as null).

  // FULL POWER (Lane B) — a buffed attack spends ★ now (win or lose) and its
  // strike deals ×fullPowerMult in WHICHEVER path resolves it: the single-step
  // path, OR the focus path when the OPPONENT focuses/calls (the buffed attack
  // is still a single-step strike, just resolved over there). Hoisted so the ★
  // is spent exactly once and the multiplier is available to both branches.
  // Guarded to `fullPower: true` moves (never a releaser) → dead for sims.
  const plFullPower = !plReleasing && playerAction.kind === 'move' && playerAction.fullPower === true;
  const foeFullPower = !foeReleasing && foeAction.kind === 'move' && foeAction.fullPower === true;
  if (plFullPower) {
    pl = { ...pl, momentum: Math.max(0, pl.momentum - COMBAT.fullPowerCost) };
    events.push({ kind: 'fullPower', side: 'player' });
  }
  if (foeFullPower) {
    foe = { ...foe, momentum: Math.max(0, foe.momentum - COMBAT.fullPowerCost) };
    events.push({ kind: 'fullPower', side: 'foe' });
  }
  const plStrikeMult = plFullPower ? COMBAT.fullPowerMult : 1;
  const foeStrikeMult = foeFullPower ? COMBAT.fullPowerMult : 1;

  if (focusInvolved) {
    // ── Combat FOCUS resolution path ───────────────────────────────────────
    // Spend ★ for any Calls (validated ≥1) and announce the override.
    if (plCall !== null) {
      pl = { ...pl, momentum: Math.max(0, pl.momentum - 1) };
      events.push({ kind: 'call', side: 'player', call: plCall });
      pl = applyRecover(pl, plCall, 'player', events);
    }
    if (foeCall !== null) {
      foe = { ...foe, momentum: Math.max(0, foe.momentum - 1) };
      events.push({ kind: 'call', side: 'foe', call: foeCall });
      foe = applyRecover(foe, foeCall, 'foe', events);
    }
    // Stagger consumed this round.
    pl = { ...pl, staggered: false };
    foe = { ...foe, staggered: false };

    if (plReleasing && foeReleasing) {
      // CASE A — BOTH release → the FLIPPED triangle (HIDE>HEAVY>FEINT>HIDE).
      // The flip winner earns ★ (a genuine mutual read).
      const a = plRelease!;
      const b = foeRelease!;
      const plMv = pl.focus!.move;
      const foeMv = foe.focus!.move;
      const winner: Side | null = flipBeats(a, b) ? 'player' : flipBeats(b, a) ? 'foe' : null;
      const plI = initiative(pl, plMv, rhythm, arena, state.traits);
      const foeI = initiative(foe, foeMv, rhythm, arena, state.traits);
      const ord: Side[] = plI >= foeI ? ['player', 'foe'] : ['foe', 'player'];
      for (const sk of ord) {
        if (pl.hp <= 0 || foe.hp <= 0) break;
        if (sk === 'player') {
          const { d, eff } = rawHit(pl, foe, plMv, rng, state.typeChart, state.traits, rhythm);
          let dd = d * FOCUS.releaseBase * (winner === 'player' ? FOCUS.flipWin : winner === 'foe' ? FOCUS.flipLose : 1);
          if (foe.exhausted) dd *= COMBAT.exhTaken;
          const r = dealt(foe.hp, dd, foeCall); foe = { ...foe, hp: r.hp };
          events.push({ kind: 'release', side: 'player', release: a, outcome: winner === 'player' ? 'win' : winner === 'foe' ? 'lose' : 'neutral', damage: r.applied, effectiveness: eff });
          if (foe.hp <= 0) events.push({ kind: 'ko', side: 'foe' });
        } else {
          const { d, eff } = rawHit(foe, pl, foeMv, rng, state.typeChart, state.traits, rhythm);
          let dd = d * FOCUS.releaseBase * (winner === 'foe' ? FOCUS.flipWin : winner === 'player' ? FOCUS.flipLose : 1);
          if (pl.exhausted) dd *= COMBAT.exhTaken;
          const r = dealt(pl.hp, dd, plCall); pl = { ...pl, hp: r.hp };
          events.push({ kind: 'release', side: 'foe', release: b, outcome: winner === 'foe' ? 'win' : winner === 'player' ? 'lose' : 'neutral', damage: r.applied, effectiveness: eff });
          if (pl.hp <= 0) events.push({ kind: 'ko', side: 'player' });
        }
      }
      // Flip verdict AFTER the strikes so its callout lands; award the ★.
      events.push({
        kind: 'flipResolve',
        winner,
        ...(winner === 'player' ? { winnerRelease: a, loserRelease: b } : {}),
        ...(winner === 'foe' ? { winnerRelease: b, loserRelease: a } : {}),
      });
      if (winner === 'player' && pl.hp > 0) pl = gainMomentum(pl, 'player', events);
      else if (winner === 'foe' && foe.hp > 0) foe = gainMomentum(foe, 'foe', events);
    } else if (plReleasing || foeReleasing) {
      // CASE B — ONE releases (R2), the other responds. The release resolves
      // vs the opponent's SINGLE-STEP via the ROTATION triangle (win/lose/
      // neutral), or vs a FOCUSING opponent via the timing mismatch (F.4). The
      // read-winner earns ★ (win → releaser; lose → opponent; neutral → none).
      const relSide: Side = plReleasing ? 'player' : 'foe';
      const oppSide: Side = relSide === 'player' ? 'foe' : 'player';
      const rel = (relSide === 'player' ? plRelease : foeRelease)!;
      const relMv = (relSide === 'player' ? pl : foe).focus!.move;
      const oppAction = oppSide === 'player' ? playerAction : foeAction;
      const oppInit = oppSide === 'player' ? plInitiating : foeInitiating;
      const oppCall = oppSide === 'player' ? plCall : foeCall;
      const oppSingle = oppAction.kind === 'move' && oppAction.commit !== true;
      const oppStance: Stance | null = oppSingle ? oppAction.stance : null;
      const oppMove: string | null = oppSingle ? oppAction.move : null;

      // Determine the outcome + multipliers.
      let outcome: 'win' | 'lose' | 'neutral';
      let relMult: number;
      let foeMult: number; // multiplier on the opponent's single-step counter
      if (oppSingle) {
        outcome = releaseVsStance(rel, oppStance!);
        relMult = outcome === 'win' ? FOCUS.winDmg : outcome === 'lose' ? FOCUS.loseDmg : FOCUS.neutralDmg;
        foeMult = outcome === 'win' ? FOCUS.winFoe : outcome === 'lose' ? FOCUS.loseFoe : FOCUS.neutralFoe;
      } else if (oppInit) {
        // F.4 timing mismatch — release vs a focusing opponent (deals 0).
        relMult = FOCUS.mismatch[rel];
        outcome = relMult > 1.05 ? 'win' : relMult < 0.95 ? 'lose' : 'neutral';
        foeMult = 0;
      } else {
        // Opponent rests/calls — unopposed release.
        outcome = 'neutral';
        relMult = FOCUS.neutralDmg;
        foeMult = 0;
      }

      // Bind generic releaser/defender to pl/foe (avoids per-side duplication).
      const releaserFirst = (() => {
        const rI = initiative(relSide === 'player' ? pl : foe, relMv, rhythm, arena, state.traits);
        const oI = oppMove !== null ? initiative(oppSide === 'player' ? pl : foe, oppMove, rhythm, arena, state.traits) : COMBAT.restInitiative;
        return rI >= oI;
      })();

      const doRelease = (): void => {
        if ((relSide === 'player' ? pl.hp : foe.hp) <= 0 || (oppSide === 'player' ? pl.hp : foe.hp) <= 0) return;
        const att = relSide === 'player' ? pl : foe;
        const def = oppSide === 'player' ? pl : foe;
        const { d, eff } = rawHit(att, def, relMv, rng, state.typeChart, state.traits, rhythm);
        let dd = d * FOCUS.releaseBase * relMult;
        if (def.exhausted) dd *= COMBAT.exhTaken;
        const r = dealt(def.hp, dd, oppCall);
        if (oppSide === 'player') pl = { ...pl, hp: r.hp };
        else foe = { ...foe, hp: r.hp };
        events.push({ kind: 'release', side: relSide, release: rel, outcome, damage: r.applied, effectiveness: eff, ...(oppStance ? { vsStance: oppStance } : {}), ...(oppInit ? { vsFocus: true } : {}) });
        if ((oppSide === 'player' ? pl.hp : foe.hp) <= 0) events.push({ kind: 'ko', side: oppSide });
      };
      const doCounter = (): void => {
        if (!oppSingle || oppMove === null) return;
        if (pl.hp <= 0 || foe.hp <= 0) return;
        const att = oppSide === 'player' ? pl : foe;
        const def = relSide === 'player' ? pl : foe;
        const relCall = relSide === 'player' ? plCall : foeCall;
        const { d, eff } = rawHit(att, def, oppMove, rng, state.typeChart, state.traits, rhythm);
        // Full Power buffs the single-stepping opponent's strike (the buffed
        // attacker here is oppSide; the releaser is never a fullPower move).
        const oppStrikeMult = oppSide === 'player' ? plStrikeMult : foeStrikeMult;
        let dd = d * stanceOutMult(oppStance!) * foeMult * oppStrikeMult;
        if (def.exhausted) dd *= COMBAT.exhTaken;
        const r = dealt(def.hp, dd, relCall);
        if (relSide === 'player') pl = { ...pl, hp: r.hp };
        else foe = { ...foe, hp: r.hp };
        events.push({ kind: 'strike', side: oppSide, move: oppMove, damage: r.applied, effectiveness: eff });
        if ((relSide === 'player' ? pl.hp : foe.hp) <= 0) events.push({ kind: 'ko', side: relSide });
      };
      if (releaserFirst) { doRelease(); doCounter(); } else { doCounter(); doRelease(); }

      // ★ to the read-winner.
      if (outcome === 'win') {
        if (relSide === 'player' && pl.hp > 0) pl = gainMomentum(pl, 'player', events);
        else if (relSide === 'foe' && foe.hp > 0) foe = gainMomentum(foe, 'foe', events);
      } else if (outcome === 'lose') {
        if (oppSide === 'player' && pl.hp > 0) pl = gainMomentum(pl, 'player', events);
        else if (oppSide === 'foe' && foe.hp > 0) foe = gainMomentum(foe, 'foe', events);
      }
    } else {
      // CASE C — FOCUS round (no releasing side). An initiator DEALS 0 and is
      // exposed; a single-stepping opponent's strike hits it ×FOCUS_COST (the
      // guaranteed focus cost — generic, no read, no ★).
      const plStrikes = playerAction.kind === 'move' && !plInitiating && plMove !== null && plCall === null;
      const foeStrikes = foeAction.kind === 'move' && !foeInitiating && foeMove !== null && foeCall === null;
      const plI = plStrikes ? initiative(pl, plMove, rhythm, arena, state.traits) : COMBAT.restInitiative;
      const foeI = foeStrikes ? initiative(foe, foeMove, rhythm, arena, state.traits) : COMBAT.restInitiative;
      const ord: Side[] = plI >= foeI ? ['player', 'foe'] : ['foe', 'player'];
      let plFocusCost = 0;
      let foeFocusCost = 0;
      for (const sk of ord) {
        if (pl.hp <= 0 || foe.hp <= 0) break;
        if (sk === 'player' && plStrikes) {
          const { d, eff } = rawHit(pl, foe, plMove!, rng, state.typeChart, state.traits, rhythm);
          let dd = d * stanceOutMult(plStance) * plStrikeMult; // Full Power buffs this strike too
          if (foeInitiating) dd *= FOCUS.focusCost; // hitting a focuser → the focus cost
          if (foe.exhausted) dd *= COMBAT.exhTaken;
          const r = dealt(foe.hp, dd, foeCall); foe = { ...foe, hp: r.hp };
          if (foeInitiating) foeFocusCost = r.applied;
          else events.push({ kind: 'strike', side: 'player', move: plMove!, damage: r.applied, effectiveness: eff });
          if (foe.hp <= 0) events.push({ kind: 'ko', side: 'foe' });
        } else if (sk === 'foe' && foeStrikes) {
          const { d, eff } = rawHit(foe, pl, foeMove!, rng, state.typeChart, state.traits, rhythm);
          let dd = d * stanceOutMult(foeStance) * foeStrikeMult; // Full Power buffs this strike too
          if (plInitiating) dd *= FOCUS.focusCost;
          if (pl.exhausted) dd *= COMBAT.exhTaken;
          const r = dealt(pl.hp, dd, plCall); pl = { ...pl, hp: r.hp };
          if (plInitiating) plFocusCost = r.applied;
          else events.push({ kind: 'strike', side: 'foe', move: foeMove!, damage: r.applied, effectiveness: eff });
          if (pl.hp <= 0) events.push({ kind: 'ko', side: 'player' });
        }
      }
      // Announce the Focus (generic — release hidden) + its cost.
      if (plInitiating) events.push({ kind: 'focus', side: 'player', costDamage: plFocusCost });
      if (foeInitiating) events.push({ kind: 'focus', side: 'foe', costDamage: foeFocusCost });
    }

    // FOCUS state transitions: a releaser clears its focus; a fresh initiator
    // (that survived) carries `focus` into next round (R2 = the release).
    if (plReleasing) pl = stripFocus(pl);
    else if (plInitiating && pl.hp > 0) pl = { ...pl, focus: { stance: plStance, move: plMove! } };
    if (foeReleasing) foe = stripFocus(foe);
    else if (foeInitiating && foe.hp > 0) foe = { ...foe, focus: { stance: foeStance, move: foeMove! } };
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
        const r = resolveStrike(pl, foe, plMove!, "A", "A", "player", rng, events, state.typeChart, state.traits, rhythm, foeDazed, plStrikeMult);
        pl = r.attacker;
        foe = r.defender;
        if (r.effect !== undefined) pendingEffects.push(r.effect);
        if (foe.hp > 0) {
          foe = { ...foe, staggered: true };
          events.push({ kind: 'staggered', side: 'foe' });
        }
      } else {
        events.push({ kind: 'clash', winner: 'foe' });
        foe = gainMomentum(foe, 'foe', events);
        const r = resolveStrike(foe, pl, foeMove!, "A", "A", "foe", rng, events, state.typeChart, state.traits, rhythm, plDazed, foeStrikeMult);
        foe = r.attacker;
        pl = r.defender;
        if (r.effect !== undefined) pendingEffects.push(r.effect);
        if (pl.hp > 0) {
          pl = { ...pl, staggered: true };
          events.push({ kind: 'staggered', side: 'player' });
        }
      }
    } else {
      for (const sideKey of order) {
        if (pl.hp <= 0 || foe.hp <= 0) break;
        if (sideKey === 'player' && plMove !== null) {
          const r = resolveStrike(pl, foe, plMove, plStance, foeStance, "player", rng, events, state.typeChart, state.traits, rhythm, foeDazed, plStrikeMult);
          pl = r.attacker;
          foe = r.defender;
          if (r.effect !== undefined) pendingEffects.push(r.effect);
        } else if (sideKey === 'foe' && foeMove !== null) {
          const r = resolveStrike(foe, pl, foeMove, foeStance, plStance, "foe", rng, events, state.typeChart, state.traits, rhythm, plDazed, foeStrikeMult);
          foe = r.attacker;
          pl = r.defender;
          if (r.effect !== undefined) pendingEffects.push(r.effect);
        }
      }
    }
  }

  // ── Status lifecycle (Increment 1a) ──────────────────────────────────────
  // TICK the statuses carried INTO this round (Burn DoT + duration decrement +
  // expiry), THEN apply newly-cast statuses (so a fresh status does not tick on
  // its own cast round — exposure is the cost; the payoff lands next round). DoT
  // can KO → done before the faint computation below so the faint flow narrates
  // it. Inert (no events, hp unchanged) for any side without statuses → the
  // single-step path stays bit-identical.
  pl = tickStatuses(pl, 'player', events);
  foe = tickStatuses(foe, 'foe', events);
  for (const pe of pendingEffects) {
    if (pe.target === 'player') {
      if (pl.hp > 0) pl = applyPendingEffect(pl, pe, 'player', events);
    } else if (foe.hp > 0) {
      foe = applyPendingEffect(foe, pe, 'foe', events);
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
      else if (ev.kind === 'release' && ev.side === 'player' && ev.outcome === 'win') gained += 1; // FOCUS: won the release read
      else if (ev.kind === 'flipResolve' && ev.winner === 'player') gained += 1; // FOCUS: won the flip
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
          // FOCUS model — only SINGLE-STEP moves feed thrice-daze; a focus
          // initiation (commit) and a release are commitments, not single-step
          // stances → recorded as null (calls/rest also null).
          player: playerAction.kind === 'move' && playerAction.commit !== true ? playerAction.stance : null,
          foe: foeAction.kind === 'move' && foeAction.commit !== true ? foeAction.stance : null,
        },
      ],
    },
    events,
  };
}
