// Falkner's prep screen — now the generic leader prep scene (leaderPrep.ts) with
// FALKNER's registry id and name filled in from his LeaderSpec (gym2-plan Step 6).
// Kept so existing callers keep their call shape; main.ts stages every leader
// through createLeaderPrepScene directly.

import { FALKNER_LEADER } from '../leaders';
import type { Scene } from '../scene';
import { createLeaderPrepScene } from './leaderPrep';
import type { LeaderPrepSceneOpts } from './leaderPrep';

export type FalknerPrepSceneOpts = Omit<LeaderPrepSceneOpts, 'bossId' | 'trainerName'>;

export function createFalknerPrepScene(opts: FalknerPrepSceneOpts): Scene {
  return createLeaderPrepScene({
    ...opts,
    bossId: FALKNER_LEADER.bossId,
    trainerName: FALKNER_LEADER.trainerName,
  });
}
