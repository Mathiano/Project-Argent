// Trainer intent/info PRESENTATION derived from a profile — the single source used by
// BOTH the generic trainer path (pushTrainerFight) and the bespoke rival path (KAMON),
// so a profiled foe's intent matches its profile rather than the battle-scene default.
//
// Presentation ONLY — this never touches action selection (chooseFoeAction). Unified
// legibility: one infoLevel drives both tells (per-axis override = the Bluffer hook);
// the FOCUS tell narrows over the profile's possible release SET (1 for fixed-Heavy,
// 2 for variable). Inert for a single-only profile (KAMON today): he never Focuses, so
// the focus tell is never consulted, and 'open' → 'honest' equals the scene default —
// correct wiring for when his profile climbs to two-step / Reactive in CH2+.

import { possibleReleases } from '../engine';
import type { TrainerProfile } from '../engine';
import { infoLevelToReliability } from './scenes/battle';
import type { FocusIntentInfo, IntentReliability } from './scenes/battle';

export function profileIntentInfo(profile: TrainerProfile): {
  readonly intentReliability: IntentReliability;
  readonly foeFocusInfo: FocusIntentInfo;
} {
  const level = profile.infoLevel ?? 'open';
  return {
    intentReliability: infoLevelToReliability(profile.infoOverride?.stance ?? level),
    foeFocusInfo: {
      discipline: profile.infoOverride?.focus ?? level,
      releases: possibleReleases(profile.release),
      salt: profile.name,
    },
  };
}
