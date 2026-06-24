// The audio subscriber — the first listener on the gameEvents.ts bus. It plays a
// sound per emitted event. PURE mapping (eventToSound) is unit-tested; installAudio
// just wires it to the bus. The audio layer reads events and plays sounds — it
// writes NOTHING back to game state (pure presentation), so it cannot perturb
// combat or any ladder.
//
// Wired to the REAL emitting events only (verified against gameEvents.ts emit
// sites): this slice is UI + combat hit-feedback. Other emitting events
// (battle-start/end, move-resolved, catch-attempt/success, evolve, bond-stage-cross)
// are intentionally unwired this slice → null. Reserved-not-emitting events
// (catch-wiggle, status-applied, level) have no emit site at all. There is NO
// charge/wind-up or ★-award event on the bus to wire (the doc asked to verify — they
// don't exist yet), so they're skipped, not fabricated.

import { onGameEvent } from '../gameEvents';
import type { GameEvent } from '../gameEvents';
import type { SoundName } from './sounds';
import type { AudioEngine } from './synth';

export function eventToSound(event: GameEvent): SoundName | null {
  switch (event.kind) {
    // UI
    case 'menu-move':
      return 'cursorMove';
    case 'stance-selected':
      return 'confirm'; // committing a stance is the player's confirm
    // Combat hit-feedback — the effectiveness carries the type-read.
    case 'hit-landed':
      return event.effectiveness > 1 ? 'superEffective' : event.effectiveness < 1 ? 'impactResisted' : 'impact';
    case 'ko':
      return 'ko';
    default:
      return null; // out of this slice (or reserved-not-emitting)
  }
}

// Attach the engine to the bus. Returns an unsubscribe fn.
export function installAudio(engine: AudioEngine): () => void {
  return onGameEvent((event) => {
    const name = eventToSound(event);
    if (name) engine.play(name);
  });
}
