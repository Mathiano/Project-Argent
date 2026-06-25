// Game-event SEAM (reserve-now, per docs/design-risks-and-gaps.md gap #1
// "audio, zero plan"). A lightweight typed bus that battle / UI / overworld
// EMIT into at natural moments. Nothing subscribes yet — this exists so a
// future AUDIO layer (and other reactive systems) can attach WITHOUT
// re-plumbing the battle/UI flow. No sound is played here; emitting is a
// no-op until something calls onGameEvent.
//
// Game-layer only — the engine stays pure/headless and emits nothing, so
// the sim/ladders never touch this. Pure addition; no logic reads events.

import type { Side, Stance } from '../engine';

export type GameEvent =
  | { readonly kind: 'battle-start' }
  | { readonly kind: 'battle-end'; readonly winner: Side }
  | { readonly kind: 'menu-move' }
  // Menu back / cancel (B-press out of a menu). Presentation-only — emitted at the
  // pause-menu back this slice; the sound was already built (slice 1), now wired.
  | { readonly kind: 'ui-cancel' }
  | { readonly kind: 'stance-selected'; readonly stance: Stance }
  | { readonly kind: 'move-resolved'; readonly side: Side; readonly move: string }
  // Overworld presence (SFX slice 2). door-enter = warping through a building door;
  // dialogue-open = a textbox opened (NPC / sign); dialogue-advance = the player
  // pressed to page a conversation forward. Presentation-only emits.
  | { readonly kind: 'door-enter' }
  | { readonly kind: 'dialogue-open' }
  | { readonly kind: 'dialogue-advance' }
  | { readonly kind: 'hit-landed'; readonly side: Side; readonly effectiveness: number }
  | { readonly kind: 'ko'; readonly side: Side }
  | { readonly kind: 'catch-attempt' }
  // Reserved: the ball-wiggle animation isn't built yet (catch resolves in
  // text today). The emit site lands with the catch-sequence visual pass.
  | { readonly kind: 'catch-wiggle'; readonly index: number }
  | { readonly kind: 'catch-success' }
  // Reserved: the status system is Phase 8 (combat-depth-types-status.md).
  // No emit site exists yet; the type is here so audio reserves the cue.
  | { readonly kind: 'status-applied'; readonly side: Side; readonly status: string }
  | { readonly kind: 'evolve'; readonly species: string }
  // A mon crossed into a new bond stage (e.g. Wary → Warming) — the
  // relationship-milestone beat. Emitted post-battle by the bond award; the
  // game shows a prompted message, and audio can chime the milestone later.
  | { readonly kind: 'bond-stage-cross'; readonly species: string; readonly fromStage: number; readonly toStage: number }
  // A read-win banked the player a ★ this round (Lane A surface ③ — the felt
  // spark behind the meter ticking up). Emitted in-battle the moment the
  // PLAYER's momentum event lands; a soft ping / mon reaction can ride it.
  // Presentation-only; the foe's read-wins stay silent (hidden ★).
  | { readonly kind: 'read-win'; readonly side: Side }
  // Reserved: there is no leveling system (stats are species-static). Kept
  // for completeness so a future XP/level beat has a cue.
  | { readonly kind: 'level' };

export type GameEventKind = GameEvent['kind'];
export type GameEventListener = (event: GameEvent) => void;

const listeners = new Set<GameEventListener>();

// Subscribe. Returns an unsubscribe fn. (No subscribers today — the audio
// layer will be the first.)
export function onGameEvent(listener: GameEventListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// Fire-and-forget. A throwing listener must never break the emitter (or the
// battle/UI flow that emitted), so each listener is isolated.
export function emitGameEvent(event: GameEvent): void {
  for (const listener of listeners) {
    try {
      listener(event);
    } catch (err) {
      console.warn('gameEvents: listener threw', err);
    }
  }
}

// Test/teardown helper — drop all subscribers.
export function clearGameEventListeners(): void {
  listeners.clear();
}
