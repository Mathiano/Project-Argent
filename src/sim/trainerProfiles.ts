// Trainer-profile sim-gate (Combat Layer 4 — Stage 1). Each profiled trainer
// is a PURE POLICY, so it's sim-checkable: pit each profile (as the foe)
// against a balanced PLAYER policy through the REAL engine and measure
//   - the foe's win-rate (a fair fight = a competitive band, not unbeatable
//     nor trivially exploitable), and
//   - the foe's ACTION DISTRIBUTION (profiles must be measurably DISTINCT —
//     an Aggressor leans Aggressive, a Bulwark leans Guard, a Charger Focuses
//     into HEAVY, a teaching baseline never Focuses).
// Mirror matchup (same species both sides) isolates the POLICY from stat luck;
// deterministic given the seed.

import {
  SPECIES,
  activeMon,
  affordableMoves,
  forcedAction,
  lookupMove,
  createBattleState,
  createSide,
  isTeamWiped,
  mulberry32,
  resolveRound,
  trainerPolicy,
  TRAINER_PROFILES,
} from '../engine';
import type { Action, BattleState, RNG, Side, Stance } from '../engine';
import { POLICIES } from './focusBalance';
import type { ActionPolicy } from './focusBalance';

// A COMPETENT reading player — the "balanced play" the fair-fight target means.
// It reads the foe's modal recent stance and counters it on the live triangle
// (A>F>G>A: counter A→G, G→F, F→A), avoids its OWN thrice-repeat daze, escapes
// a feared focus with a ★-Call, and picks a sustainable mid/light move. This is
// the yardstick: a profile a competent reader can't beat ~half the time would
// be unfair; one a reader stomps would be trivial.
function counter(stance: Stance): Stance {
  return stance === 'A' ? 'G' : stance === 'G' ? 'F' : 'A';
}
function modalStance(state: BattleState, side: Side): Stance | null {
  const recent = state.history.map((h) => h[side]).filter((s): s is Stance => s !== null).slice(-3);
  if (recent.length === 0) return null;
  const cnt: Record<Stance, number> = { A: 0, G: 0, F: 0 };
  for (const s of recent) cnt[s] += 1;
  let modal: Stance = 'A';
  for (const s of ['A', 'G', 'F'] as Stance[]) if (cnt[s] > cnt[modal]) modal = s;
  return modal;
}
function sustainableMove(side: ReturnType<typeof activeMon>): string {
  const aff = affordableMoves(side);
  return (
    aff.find((n) => lookupMove(n).tier === 'mid') ??
    aff.find((n) => lookupMove(n).tier === 'light') ??
    aff[0] ?? side.species.moves[0]!
  );
}
export const readingPlayer: ActionPolicy = (state, side, _rng) => {
  const me = activeMon(state[side]);
  const forced = forcedAction(me);
  if (forced) return forced;
  if (me.focus !== undefined) return { kind: 'release', release: 'heavy' };
  const foe = activeMon(state[side === 'player' ? 'foe' : 'player']);
  // Escape a feared focus: the foe is winding up → ★-Call to dodge the release.
  if (foe.focus !== undefined && me.momentum >= 1) return { kind: 'call', call: 'getAway' };
  const aff = affordableMoves(me);
  if (aff.length === 0) return { kind: 'rest' };
  // Read the foe's pattern and counter; no pattern yet → Guard (safe default).
  const modal = modalStance(state, side === 'player' ? 'foe' : 'player');
  let stance: Stance = modal ? counter(modal) : 'G';
  if (stance === 'F' && me.st < 40) stance = 'G'; // can't afford Fluid → brace
  // Avoid our OWN thrice-repeat self-daze.
  const mine = state.history.map((h) => h[side]).filter((s): s is Stance => s !== null).slice(-2);
  if (mine.length === 2 && mine[0] === stance && mine[1] === stance) {
    stance = stance === 'A' ? 'G' : stance === 'G' ? 'F' : 'A';
  }
  return { kind: 'move', move: sustainableMove(me), stance };
};

export type UsageKey = 'A' | 'G' | 'F' | 'focus' | 'heavy' | 'feint' | 'hide' | 'other';

export interface TrainerProfileResult {
  readonly id: string;
  readonly foeWinPct: number;
  readonly usagePct: { readonly [k in UsageKey]: number };
}

// What the foe DID this round: a release (mid-focus) → its release kind; a
// focus initiation → 'focus'; a single-step → its stance; else 'other'.
function classify(state: BattleState, side: Side, action: Action): UsageKey {
  const me = activeMon(state[side]);
  if (me.focus !== undefined) return action.kind === 'release' ? action.release : 'other';
  if (action.kind === 'move' && action.commit === true) return 'focus';
  if (action.kind === 'move') return action.stance;
  return 'other';
}

function battle(
  playerPol: ActionPolicy,
  foeProfileId: string,
  speciesName: string,
  rng: RNG,
  usage: Record<UsageKey, number>,
  maxRounds = 80,
): number {
  const foePol = trainerPolicy(TRAINER_PROFILES[foeProfileId]!);
  let state = createBattleState(
    createSide(SPECIES[speciesName]!),
    createSide(SPECIES[speciesName]!),
  );
  for (let i = 0; i < maxRounds; i += 1) {
    const pA = playerPol(state, 'player', rng);
    const fA = foePol(state, 'foe', rng);
    usage[classify(state, 'foe', fA)] += 1;
    const r = resolveRound(state, pA, fA, rng);
    state = r.state;
    const plDead = isTeamWiped(state.player);
    const foeDead = isTeamWiped(state.foe);
    if (plDead && foeDead) return 0.5;
    if (foeDead) return 0; // foe lost
    if (plDead) return 1; // foe won
  }
  const pl = activeMon(state.player).hp;
  const fo = activeMon(state.foe).hp;
  return fo > pl ? 1 : pl > fo ? 0 : 0.5; // foe-win score
}

// Run every Stage-1 profile (as the foe) vs a chosen player policy. The
// fair-fight yardstick is 'reading' (the competent reader above); the
// focusBalance POLICIES (BaseBalanced/Adaptive) are also selectable.
export function runTrainerProfiles(
  playerPolicyName = 'reading',
  speciesName = 'SPROUTLE',
  nPerProfile = 800,
  seed = 7,
): TrainerProfileResult[] {
  const playerPol: ActionPolicy = playerPolicyName === 'reading' ? readingPlayer : POLICIES[playerPolicyName]!;
  const ids = Object.keys(TRAINER_PROFILES);
  const out: TrainerProfileResult[] = [];
  let s = seed;
  for (const id of ids) {
    let foeWins = 0;
    const usage: Record<UsageKey, number> = {
      A: 0, G: 0, F: 0, focus: 0, heavy: 0, feint: 0, hide: 0, other: 0,
    };
    for (let i = 0; i < nPerProfile; i += 1) {
      foeWins += battle(playerPol, id, speciesName, mulberry32(s), usage);
      s += 1;
    }
    const totalUse = (Object.values(usage) as number[]).reduce((a, b) => a + b, 0) || 1;
    const usagePct = Object.fromEntries(
      (Object.keys(usage) as UsageKey[]).map((k) => [k, (usage[k] / totalUse) * 100]),
    ) as { [k in UsageKey]: number };
    out.push({ id, foeWinPct: (foeWins / nPerProfile) * 100, usagePct });
  }
  return out;
}
