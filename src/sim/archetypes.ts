import { MOVES, affordableMoves, forcedAction } from '../engine';
import type { Action, BattleState, RNG, Side, SideState, Stance } from '../engine';

export interface BotArchetype {
  readonly name: string;
  chooseAction(state: BattleState, side: Side, rng: RNG): Action;
}

const STANCES: readonly Stance[] = ['A', 'G', 'F'];

function pickMove(side: SideState): string {
  const aff = affordableMoves(side);
  if (aff.length === 0) throw new Error('pickMove: no affordable moves (caller should rest first)');
  const tiered = aff.map((name) => ({ name, tier: MOVES[name]!.tier }));
  if (side.st > 70) {
    const heavy = tiered.find((t) => t.tier === 'heavy');
    if (heavy) return heavy.name;
  }
  const mid = tiered.find((t) => t.tier === 'mid');
  if (mid) return mid.name;
  return tiered[0]!.name;
}

function enemyStancesFromHistory(state: BattleState, side: Side): Stance[] {
  const enemyKey: Side = side === 'player' ? 'foe' : 'player';
  return state.history
    .map((h) => h[enemyKey])
    .filter((s): s is Stance => s !== null);
}

function triangleCounter(stance: Stance): Stance {
  if (stance === 'A') return 'G';
  if (stance === 'G') return 'F';
  return 'A';
}

function modalCounter(history: readonly Stance[]): Stance | null {
  if (history.length === 0) return null;
  const cnt: Record<Stance, number> = { A: 0, G: 0, F: 0 };
  for (const s of history) cnt[s] += 1;
  let modal: Stance = 'A';
  for (const s of STANCES) if (cnt[s] > cnt[modal]) modal = s;
  return triangleCounter(modal);
}

function pickRandomStance(rng: RNG): Stance {
  return STANCES[Math.floor(rng.next() * 3)]!;
}

function weightedRivalStance(rng: RNG): Stance {
  const r = rng.next();
  if (r < 0.55) return 'A';
  if (r < 0.9) return 'G';
  return 'F';
}

export const staticGuard: BotArchetype = {
  name: 'static-guard',
  chooseAction(state, side) {
    const me = state[side];
    const forced = forcedAction(me);
    if (forced) return forced;
    return { kind: 'move', move: pickMove(me), stance: 'G' };
  },
};

export const naiveTriangle: BotArchetype = {
  name: 'naive-triangle',
  chooseAction(state, side, rng) {
    const me = state[side];
    const forced = forcedAction(me);
    if (forced) return forced;
    const enemy = enemyStancesFromHistory(state, side);
    const stance = modalCounter(enemy.slice(-3)) ?? pickRandomStance(rng);
    return { kind: 'move', move: pickMove(me), stance };
  },
};

export const staminaReader: BotArchetype = {
  name: 'stamina-reader',
  chooseAction(state, side, rng) {
    const me = state[side];
    const forced = forcedAction(me);
    if (forced) return forced;
    if (me.momentum >= 1 && me.st <= 30) return { kind: 'catchBreath' };
    return naiveTriangle.chooseAction(state, side, rng);
  },
};

export const humanIsh: BotArchetype = {
  name: 'human-ish',
  chooseAction(state, side, rng) {
    const me = state[side];
    const forced = forcedAction(me);
    if (forced) return forced;
    if (rng.next() < 0.3) {
      return { kind: 'move', move: pickMove(me), stance: pickRandomStance(rng) };
    }
    return naiveTriangle.chooseAction(state, side, rng);
  },
};

// Replicates the demo's rival AI (KAMON).
export const rivalAI: BotArchetype = {
  name: 'rival',
  chooseAction(state, side, rng) {
    const me = state[side];
    const forced = forcedAction(me);
    if (forced) return forced;
    const enemy = enemyStancesFromHistory(state, side);
    let stance: Stance;
    if (enemy.length >= 3 && rng.next() < 0.1) {
      stance = modalCounter(enemy.slice(-3))!;
    } else {
      stance = weightedRivalStance(rng);
    }
    return { kind: 'move', move: pickMove(me), stance };
  },
};

export const PLAYER_ARCHETYPES: readonly BotArchetype[] = [
  staticGuard,
  naiveTriangle,
  staminaReader,
  humanIsh,
];
