// Boss-card-driven AI policies. Each boss has a small policy function
// that reads BattleState + the boss card and returns the boss's Action.
// Falkner's policy implements the v2 card verbatim (phase 1 metronome,
// phase 2 syncopation with 15% reads).

import type { RNG } from './rng';
import { affordableMoves, forcedAction, lookupMove } from './state';
import type { Action, BattleState, Side, Stance } from './types';
import { activeMon, isRhythmRound } from './types';

export type BossPolicy = (state: BattleState, side: Side, rng: RNG) => Action;

function pickFalknerMove(state: BattleState, side: Side, rhythm: boolean, rng: RNG): string {
  const me = activeMon(state[side]);
  const aff = affordableMoves(me);
  if (aff.length === 0) return me.species.moves[0]!;
  const phase = state.phase ?? 1;

  if (rhythm) {
    // Phase 1: DIVE BOMB only on gust rounds; intended kill window.
    if (phase === 1 && aff.includes('DIVE BOMB')) return 'DIVE BOMB';
    // Phase 2: 50% bait with WING CUT, otherwise DIVE BOMB.
    if (phase >= 2) {
      if (aff.includes('WING CUT') && aff.includes('DIVE BOMB')) {
        return rng.next() < 0.5 ? 'WING CUT' : 'DIVE BOMB';
      }
      if (aff.includes('DIVE BOMB')) return 'DIVE BOMB';
    }
  }

  // Off-rhythm: prefer mid, then light. Heavy stays parked for gusts.
  const mid = aff.find((n) => lookupMove(n).tier === 'mid');
  if (mid) return mid;
  const light = aff.find((n) => lookupMove(n).tier === 'light');
  if (light) return light;
  return aff[0]!;
}

function triangleCounter(stance: Stance): Stance {
  if (stance === 'A') return 'G';
  if (stance === 'G') return 'F';
  return 'A';
}

function modalPlayerStance(state: BattleState): Stance | null {
  const recent = state.history
    .map((h) => h.player)
    .filter((s): s is Stance => s !== null)
    .slice(-3);
  if (recent.length < 3) return null;
  const cnt: Record<Stance, number> = { A: 0, G: 0, F: 0 };
  for (const s of recent) cnt[s] += 1;
  let modal: Stance = 'A';
  for (const s of ['A', 'G', 'F'] as Stance[]) if (cnt[s] > cnt[modal]) modal = s;
  return modal;
}

export const falknerBossAI: BossPolicy = (state, side, rng) => {
  const me = activeMon(state[side]);
  const forced = forcedAction(me);
  if (forced) return forced;

  // Catch-breath if low ST and have momentum (the gym spec's tempo play).
  // Leader Calls deferred to Bugsy slice per design ruling; Falkner AI
  // intentionally Call-less. Phase-2 swing carried by gust-round DIVE BOMB.
  if (me.momentum >= 1 && me.st < 25 && (state.phase ?? 1) === 1) {
    return { kind: 'catchBreath' };
  }

  const phase = state.phase ?? 1;
  const arena = state.bossCard?.arenaSchedule;
  const rhythm = arena
    ? isRhythmRound(arena, state.round, state.rhythmAnchor ?? 0)
    : false;

  const move = pickFalknerMove(state, side, rhythm, rng);

  let stance: Stance;
  if (phase >= 2 && rng.next() < 0.15) {
    // 15% triangle read of player's modal stance from the last 3 rounds.
    const modal = modalPlayerStance(state);
    stance = modal ? triangleCounter(modal) : pickRandomFalknerStance(rng, rhythm);
  } else {
    stance = pickRandomFalknerStance(rng, rhythm);
  }

  return { kind: 'move', move, stance };
};

function pickRandomFalknerStance(rng: RNG, rhythm: boolean): Stance {
  if (rhythm) {
    // On gust rounds, attack hard.
    return 'A';
  }
  // Off-rhythm: Fluid-leaning (the gym lesson — Falkner dances).
  const r = rng.next();
  if (r < 0.5) return 'F';
  if (r < 0.8) return 'G';
  return 'A';
}
