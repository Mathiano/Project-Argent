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
  createBattleState,
  createSide,
  isTeamWiped,
  mulberry32,
  resolveRound,
  trainerPolicy,
  TRAINER_PROFILES,
} from '../engine';
import type { Action, BattleState, RNG, Side, TrainerProfile } from '../engine';
import { POLICIES } from './focusBalance';
import type { ActionPolicy } from './focusBalance';
import { reader } from './archetypes';

// The fair-fight yardstick is the shared `reader` bot (docs/sim-archetypes.md) —
// a competent Layer-2-aware player. A profile a reader can't beat ~half the time
// is unfair; one a reader stomps is trivial. Adapter to the ActionPolicy shape.
export const readingPlayer: ActionPolicy = (state, side, rng) => reader.chooseAction(state, side, rng);

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
  foeProfile: TrainerProfile,
  speciesName: string,
  rng: RNG,
  usage: Record<UsageKey, number>,
  maxRounds = 80,
): number {
  const foePol = trainerPolicy(foeProfile);
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
  profiles: { readonly [id: string]: TrainerProfile } = TRAINER_PROFILES,
): TrainerProfileResult[] {
  const playerPol: ActionPolicy = playerPolicyName === 'reading' ? readingPlayer : POLICIES[playerPolicyName]!;
  const ids = Object.keys(profiles);
  const out: TrainerProfileResult[] = [];
  let s = seed;
  for (const id of ids) {
    let foeWins = 0;
    const usage: Record<UsageKey, number> = {
      A: 0, G: 0, F: 0, focus: 0, heavy: 0, feint: 0, hide: 0, other: 0,
    };
    for (let i = 0; i < nPerProfile; i += 1) {
      foeWins += battle(playerPol, profiles[id]!, speciesName, mulberry32(s), usage);
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
