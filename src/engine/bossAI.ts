// Boss-card-driven AI policies. Each boss has a small policy function
// that reads BattleState + the boss card and returns the boss's Action.
// Falkner's policy implements the v2 card verbatim (phase 1 metronome,
// phase 2 syncopation with 15% reads).

import { typeMult } from './data';
import type { RNG } from './rng';
import { affordableMoves, forcedAction, lookupMove } from './state';
import type { Action, BattleState, Side, SideState, Stance, Team } from './types';
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

// Minimal "type-disadvantage" switch policy: if the boss's active mon is
// taking ≥1.5× from the player's species types and a bench mon would take
// <1×, switch to the best bench mon. Falkner's 2-mon FLITPECK/GALEHAWK
// team rarely triggers this (both GALE); the policy is infrastructure
// for later gyms with type-spread rosters.
const SWITCH_DISADVANTAGE_THRESHOLD = 1.5;

function bestSwitchTarget(
  team: Team,
  attackerTypes: readonly string[],
  chart: BattleState['typeChart'],
): number | null {
  const currentMult = worstIncoming(activeMon(team), attackerTypes, chart);
  if (currentMult < SWITCH_DISADVANTAGE_THRESHOLD) return null;
  let bestIdx: number | null = null;
  let bestMult = currentMult;
  for (let i = 0; i < team.members.length; i += 1) {
    if (i === team.active) continue;
    const m = team.members[i]!;
    if (m.hp <= 0) continue;
    const mult = worstIncoming(m, attackerTypes, chart);
    if (mult < bestMult) {
      bestIdx = i;
      bestMult = mult;
    }
  }
  if (bestIdx === null) return null;
  // Only switch if the bench mon is meaningfully better — not just <1.5x
  // but strictly resistant (<1x) so we don't churn switches mid-tempo.
  return bestMult < 1 ? bestIdx : null;
}

function worstIncoming(
  side: SideState,
  attackerTypes: readonly string[],
  chart: BattleState['typeChart'],
): number {
  let worst = 0;
  for (const at of attackerTypes) {
    const mult = typeMult(chart, at, side.species.types);
    if (mult > worst) worst = mult;
  }
  return worst;
}

// Combat Layer 4 (Stage 1) — Falkner's SIGNATURE two-step: his "gust" is a
// telegraphed FOCUS→HEAVY (a CHARGED GUST). His 3/6/9 rhythm beat is a forced
// COMMITMENT — either a charged gust (FOCUS→HEAVY) or a hard AGGRESSIVE
// single-step (DIVE BOMB). The player reads "every 3rd round he commits hard";
// the commitment now ADMITS the Focus on his signature beats (KICKOFF-falkner-
// tune-+-focus-intent.md Item 1 — previously his Focus could only fire on a
// gust round via a 50/50 that, with stamina drain locking the heavy on later
// gusts, often left his signature absent for a whole fight).
//
// He CHARGES at this rate on a gust round when a heavy is affordable, else
// DIVE BOMBs. Tuned UP from 0.5 so the charged gust reliably appears (most
// battles, on the first gust beat while he has stamina) WITHOUT every gust
// feeding an aggressive masher a free wind-up hit (a pure always-charge spiked
// no-read brute to ~85% on type-favored paths — "mashing punished" wants it
// lower). When winded the heavy is locked → he single-steps → natural variety.
const FALKNER_GUST_FOCUS_RATE = 0.7;

export const falknerBossAI: BossPolicy = (state, side, rng) => {
  const myTeam = state[side];
  const me = activeMon(myTeam);
  const forced = forcedAction(me);
  if (forced) return forced;

  // RELEASE CHECK — mid-gust (winding) → release the gust HEAVY (locked in).
  if (me.focus !== undefined) return { kind: 'release', release: 'heavy' };

  // Switch on hard type disadvantage. Skips when team is single-mon
  // (bestSwitchTarget returns null) so 1-mon bosses are unaffected.
  const enemySide: Side = side === 'player' ? 'foe' : 'player';
  const enemyActive = activeMon(state[enemySide]);
  const switchTo = bestSwitchTarget(myTeam, enemyActive.species.types, state.typeChart);
  if (switchTo !== null) return { kind: 'switch', toIndex: switchTo };

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

  // GUST BEAT (3/6/9) — the forced COMMITMENT: charge the gust (FOCUS→HEAVY)
  // when a heavy is affordable, else fall through to the hard AGGRESSIVE
  // single-step (DIVE BOMB) below. (Pure policy; the engine math is untouched,
  // so the ladder shift here is an intended re-baseline, not a regression.)
  if (rhythm && rng.next() < FALKNER_GUST_FOCUS_RATE) {
    const aff = affordableMoves(me);
    const heavy = aff.find((n) => lookupMove(n).tier === 'heavy');
    if (heavy) return { kind: 'move', move: heavy, stance: 'A', commit: true };
  }

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
