// Wires the shipped battle animation JSONs (assets/anim/) into a runtime. The
// event→id map is DATA (_eventMap.json), not code — a new proof/choreography
// animation is a JSON drop + a map line, never a battle.ts edit. Validation runs
// at module load (buildDefs → parseAnimationDef throws on a bad schema/easing).
//
// These are the SAME files the preview harness (tools/anim_preview) plays — the
// approval artifact and the shipped artifact are one file, by construction.

import { AnimRuntime, buildDefs, type AnimationDef } from './timeline';
import hitFlash from '../../../assets/anim/battle.hitFlash.json';
import hpDrain from '../../../assets/anim/battle.hpDrain.json';
import starPop from '../../../assets/anim/battle.starPop.json';
import enterWipe from '../../../assets/anim/battle.enterWipe.json';
import eventMap from '../../../assets/anim/_eventMap.json';

export const BATTLE_ANIM_DEFS: ReadonlyMap<string, AnimationDef> = buildDefs([
  hitFlash,
  hpDrain,
  starPop,
  enterWipe,
]);

export const BATTLE_ANIM_EVENT_MAP: Readonly<Record<string, readonly string[]>> =
  eventMap as Record<string, readonly string[]>;

export function createBattleAnimRuntime(): AnimRuntime {
  return new AnimRuntime(BATTLE_ANIM_DEFS, BATTLE_ANIM_EVENT_MAP);
}
