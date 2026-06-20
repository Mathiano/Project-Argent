// Canonical sim archetypes — see docs/sim-archetypes.md.
// These are measurement instruments; do not "improve" without a design ruling.

import { activeMon, affordableMoves, forcedAction, lookupMove, trainerPolicy, TRAINER_PROFILES } from '../engine';
import type { Action, BattleState, RNG, Side, SideState, Stance } from '../engine';

export interface BotArchetype {
  readonly name: string;
  chooseAction(state: BattleState, side: Side, rng: RNG, telegraph?: Action): Action;
}

const STANCES: readonly Stance[] = ['A', 'G', 'F'];

function pickMidOrLight(side: SideState): string {
  const aff = affordableMoves(side);
  if (aff.length === 0) throw new Error('pickMidOrLight: no affordable moves');
  const mid = aff.find((n) => lookupMove(n).tier === 'mid');
  if (mid) return mid;
  const light = aff.find((n) => lookupMove(n).tier === 'light');
  if (light) return light;
  return aff[0]!;
}

function pickHeaviest(side: SideState): string {
  const aff = affordableMoves(side);
  if (aff.length === 0) throw new Error('pickHeaviest: no affordable moves');
  const heavy = aff.find((n) => lookupMove(n).tier === 'heavy');
  if (heavy) return heavy;
  const mid = aff.find((n) => lookupMove(n).tier === 'mid');
  if (mid) return mid;
  return aff[0]!;
}

function triangleCounter(stance: Stance): Stance {
  if (stance === 'A') return 'G';
  if (stance === 'G') return 'F';
  return 'A';
}

function telegraphStance(telegraph?: Action): Stance | null {
  if (!telegraph) return null;
  if (telegraph.kind === 'move') return telegraph.stance;
  return null;
}

function pickRandomStance(rng: RNG): Stance {
  return STANCES[Math.floor(rng.next() * 3)]!;
}

// Button-masher: uniform-random move + uniform-random stance. Models the
// player who isn't reading anything. Per the Falkner card's 25–35% target.
export const buttonMasher: BotArchetype = {
  name: 'button-masher',
  chooseAction(state, side, rng) {
    const me = activeMon(state[side]);
    const forced = forcedAction(me);
    if (forced) return forced;
    const aff = affordableMoves(me);
    const move = aff[Math.floor(rng.next() * aff.length)]!;
    return { kind: 'move', move, stance: pickRandomStance(rng) };
  },
};

export const staticGuard: BotArchetype = {
  name: 'static-guard',
  chooseAction(state, side) {
    const me = activeMon(state[side]);
    const forced = forcedAction(me);
    if (forced) return forced;
    return { kind: 'move', move: pickMidOrLight(me), stance: 'G' };
  },
};

export const brute: BotArchetype = {
  name: 'brute',
  chooseAction(state, side) {
    const me = activeMon(state[side]);
    const forced = forcedAction(me);
    if (forced) return forced;
    return { kind: 'move', move: pickHeaviest(me), stance: 'A' };
  },
};

export const naiveTriangle: BotArchetype = {
  name: 'naive-triangle',
  chooseAction(state, side, _rng, telegraph) {
    const me = activeMon(state[side]);
    const forced = forcedAction(me);
    if (forced) return forced;
    const foeStance = telegraphStance(telegraph);
    const stance: Stance = foeStance === null ? 'G' : triangleCounter(foeStance);
    return { kind: 'move', move: pickMidOrLight(me), stance };
  },
};

function staminaReaderPolicy(
  state: BattleState,
  side: Side,
  telegraph?: Action,
): Action {
  const me = activeMon(state[side]);

  const forced = forcedAction(me);
  if (forced) return forced;

  if (me.momentum >= 1 && me.st < 30) return { kind: 'catchBreath' };

  const foeStance = telegraphStance(telegraph);

  // Read the foe's telegraph and counter it on the CURRENT triangle
  // (Combat Layer 1: AGGRESSIVE > FLUID > GUARD > AGGRESSIVE). This bot is a
  // "competent reader" measurement instrument, so it must read the live
  // triangle — pre-Layer-1 it countered Aggressive with Fluid (the old
  // dodge); now Aggressive is countered with GUARD. Stamina-aware: it falls
  // back to Guard when too drained to afford the Fluid surcharge.
  let stance: Stance;
  if (foeStance === null) stance = 'G';
  else stance = triangleCounter(foeStance); // A→G, G→F, F→A
  if (stance === 'F' && me.st < 40) stance = 'G'; // can't afford Fluid → brace

  return { kind: 'move', move: pickMidOrLight(me), stance };
}

export const staminaReader: BotArchetype = {
  name: 'stamina-reader',
  chooseAction(state, side, _rng, telegraph) {
    return staminaReaderPolicy(state, side, telegraph);
  },
};

export const humanIsh: BotArchetype = {
  name: 'human-ish',
  chooseAction(state, side, rng, telegraph) {
    const me = activeMon(state[side]);
    const forced = forcedAction(me);
    if (forced) return forced;
    if (rng.next() < 0.3) {
      return { kind: 'move', move: pickMidOrLight(me), stance: pickRandomStance(rng) };
    }
    return staminaReaderPolicy(state, side, telegraph);
  },
};

// --- Rival AI (KAMON, demo replication) ----------------------------------

function weightedRivalStance(rng: RNG): Stance {
  const r = rng.next();
  if (r < 0.55) return 'A';
  if (r < 0.9) return 'G';
  return 'F';
}

function enemyStancesFromHistory(state: BattleState, side: Side): Stance[] {
  const enemyKey: Side = side === 'player' ? 'foe' : 'player';
  return state.history.map((h) => h[enemyKey]).filter((s): s is Stance => s !== null);
}

function modalCounter(history: readonly Stance[]): Stance | null {
  if (history.length === 0) return null;
  const cnt: Record<Stance, number> = { A: 0, G: 0, F: 0 };
  for (const s of history) cnt[s] += 1;
  let modal: Stance = 'A';
  for (const s of STANCES) if (cnt[s] > cnt[modal]) modal = s;
  return triangleCounter(modal);
}

function rivalMovePick(side: SideState): string {
  const aff = affordableMoves(side);
  if (aff.length === 0) throw new Error('rivalMovePick: no affordable moves');
  if (side.st > 70) {
    const heavy = aff.find((n) => lookupMove(n).tier === 'heavy');
    if (heavy) return heavy;
  }
  const mid = aff.find((n) => lookupMove(n).tier === 'mid');
  if (mid) return mid;
  return aff[0]!;
}

export const rivalAI: BotArchetype = {
  name: 'rival',
  chooseAction(state, side, rng) {
    const me = activeMon(state[side]);
    const forced = forcedAction(me);
    if (forced) return forced;
    const enemy = enemyStancesFromHistory(state, side);
    let stance: Stance;
    if (enemy.length >= 3 && rng.next() < 0.1) stance = modalCounter(enemy.slice(-3))!;
    else stance = weightedRivalStance(rng);
    return { kind: 'move', move: rivalMovePick(me), stance };
  },
};

// --- READER (the Layer-4 fair-fight yardstick) ----------------------------
// The canonical "competent player" every trainer profile is gated against
// ("fair-but-distinct"). UNLIKE the v1 single-step archetypes above, the reader
// is Layer-2-aware: it reads the foe's modal recent stance and counters it on
// the live triangle (A>F>G>A), avoids its OWN thrice-repeat daze, ESCAPES a
// feared focus with a ★-Call (Get Away), and RELEASES if caught mid-focus. It
// reads PATTERNS from history (not a per-round telegraph), so it judges a
// FIXED-policy trainer fairly. Graduated from the in-line reader that lived in
// sim/trainerProfiles.ts (KICKOFF-trainer-archetype-engine.md). See
// docs/sim-archetypes.md. A measurement instrument — don't "improve" it.
export const reader: BotArchetype = {
  name: 'reader',
  chooseAction(state, side) {
    const me = activeMon(state[side]);
    const forced = forcedAction(me);
    if (forced) return forced;
    // Caught mid-focus → release (locked in). The yardstick doesn't itself
    // open Focuses; it only resolves one if forced into it.
    if (me.focus !== undefined) return { kind: 'release', release: 'heavy' };
    const foe = activeMon(state[side === 'player' ? 'foe' : 'player']);
    // Escape a feared focus: the foe is winding up → ★-Call to dodge the release.
    if (foe.focus !== undefined && me.momentum >= 1) return { kind: 'call', call: 'getAway' };
    const aff = affordableMoves(me);
    if (aff.length === 0) return { kind: 'rest' };
    // Read the foe's pattern and counter; no pattern yet → Guard (safe default).
    let stance: Stance = modalCounter(enemyStancesFromHistory(state, side).slice(-3)) ?? 'G';
    if (stance === 'F' && me.st < 40) stance = 'G'; // can't afford Fluid → brace
    // Avoid our OWN thrice-repeat self-daze.
    const mine = state.history.map((h) => h[side]).filter((s): s is Stance => s !== null).slice(-2);
    if (mine.length === 2 && mine[0] === stance && mine[1] === stance) {
      stance = stance === 'A' ? 'G' : stance === 'G' ? 'F' : 'A';
    }
    return { kind: 'move', move: pickMidOrLight(me), stance };
  },
};

// KAMON v2 (rival fight 1) as a ladder foe — the RIVAL profile's earliest rung
// (Aggressor/Single-only/Fixed/no-Calls) via the shared trainer tree. This is
// the rival ladder's foe AI as of the v2 card (docs/kamon-rival-card-v2.md);
// it replaced the bespoke `rivalAI` there (an INTENDED re-baseline). `rivalAI`
// stays the documented reference rival used by the bond ladders (unchanged).
export const kamonRivalBot: BotArchetype = {
  name: 'kamon',
  chooseAction(state, side, rng) {
    return trainerPolicy(TRAINER_PROFILES.kamon!)(state, side, rng);
  },
};

export const PLAYER_ARCHETYPES: readonly BotArchetype[] = [
  staticGuard,
  brute,
  naiveTriangle,
  staminaReader,
  humanIsh,
];

// Falkner-ladder archetypes per the card's targets.
export const FALKNER_LADDER_ARCHETYPES: readonly BotArchetype[] = [
  buttonMasher,
  brute,
  naiveTriangle,
  staminaReader,
  humanIsh,
];
