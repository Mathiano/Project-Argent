// Canonical sim archetypes — see docs/sim-archetypes.md.
// These are measurement instruments; do not "improve" without a design ruling.

import { MOVES, affordableMoves, forcedAction } from '../engine';
import type { Action, BattleState, RNG, Side, SideState, Stance } from '../engine';

export interface BotArchetype {
  readonly name: string;
  chooseAction(state: BattleState, side: Side, rng: RNG, telegraph?: Action): Action;
}

const STANCES: readonly Stance[] = ['A', 'G', 'F'];

function pickMidOrLight(side: SideState): string {
  const aff = affordableMoves(side);
  if (aff.length === 0) throw new Error('pickMidOrLight: no affordable moves');
  const mid = aff.find((n) => MOVES[n]!.tier === 'mid');
  if (mid) return mid;
  const light = aff.find((n) => MOVES[n]!.tier === 'light');
  if (light) return light;
  return aff[0]!;
}

function pickHeaviest(side: SideState): string {
  const aff = affordableMoves(side);
  if (aff.length === 0) throw new Error('pickHeaviest: no affordable moves');
  const heavy = aff.find((n) => MOVES[n]!.tier === 'heavy');
  if (heavy) return heavy;
  const mid = aff.find((n) => MOVES[n]!.tier === 'mid');
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

export const staticGuard: BotArchetype = {
  name: 'static-guard',
  chooseAction(state, side) {
    const me = state[side];
    const forced = forcedAction(me);
    if (forced) return forced;
    return { kind: 'move', move: pickMidOrLight(me), stance: 'G' };
  },
};

export const brute: BotArchetype = {
  name: 'brute',
  chooseAction(state, side) {
    const me = state[side];
    const forced = forcedAction(me);
    if (forced) return forced;
    return { kind: 'move', move: pickHeaviest(me), stance: 'A' };
  },
};

export const naiveTriangle: BotArchetype = {
  name: 'naive-triangle',
  chooseAction(state, side, _rng, telegraph) {
    const me = state[side];
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
  const me = state[side];
  const foeKey: Side = side === 'player' ? 'foe' : 'player';
  const foe = state[foeKey];

  const forced = forcedAction(me);
  if (forced) return forced;

  if (me.momentum >= 1 && me.st < 30) return { kind: 'catchBreath' };

  const foeStance = telegraphStance(telegraph);
  const mySpd = me.species.spd;
  const foeSpd = foe.species.spd;

  let stance: Stance;
  if (foeStance === 'A') stance = mySpd > foeSpd && me.st >= 40 ? 'F' : 'G';
  else if (foeStance === 'G') stance = me.st >= 40 ? 'F' : 'G';
  else if (foeStance === 'F') stance = mySpd > foeSpd ? 'A' : 'G';
  else stance = 'A';

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
    const me = state[side];
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
    const heavy = aff.find((n) => MOVES[n]!.tier === 'heavy');
    if (heavy) return heavy;
  }
  const mid = aff.find((n) => MOVES[n]!.tier === 'mid');
  if (mid) return mid;
  return aff[0]!;
}

export const rivalAI: BotArchetype = {
  name: 'rival',
  chooseAction(state, side, rng) {
    const me = state[side];
    const forced = forcedAction(me);
    if (forced) return forced;
    const enemy = enemyStancesFromHistory(state, side);
    let stance: Stance;
    if (enemy.length >= 3 && rng.next() < 0.1) stance = modalCounter(enemy.slice(-3))!;
    else stance = weightedRivalStance(rng);
    return { kind: 'move', move: rivalMovePick(me), stance };
  },
};

export const PLAYER_ARCHETYPES: readonly BotArchetype[] = [
  staticGuard,
  brute,
  naiveTriangle,
  staminaReader,
  humanIsh,
];
