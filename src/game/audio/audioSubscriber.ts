// The audio subscriber — the first listener on the gameEvents.ts bus. It plays a
// sound per emitted event. PURE mapping (eventToSound) is unit-tested; installAudio
// just wires it to the bus. The audio layer reads events and plays sounds — it
// writes NOTHING back to game state (pure presentation), so it cannot perturb
// combat or any ladder.
//
// Wired to the REAL emitting events: UI (menu/stance/cancel) + combat hit-feedback +
// overworld presence (door/dialogue) + (slice 3) battle framing + the core pillars
// (battle-start/end → victory on a win, move-resolved, catch-attempt/success, evolve,
// bond-stage-cross). `ui-cancel` is the one new emit this slice (pause-menu back).
// Reserved-not-emitting events (catch-wiggle — waits for the catch-visual pass —
// status-applied, level) have no emit site, so they map to null. There is NO
// charge/wind-up or ★-award event on the bus (verified — they don't exist), so
// they're skipped, not fabricated.

import { onGameEvent } from '../gameEvents';
import type { GameEvent } from '../gameEvents';
import type { SoundName } from './sounds';
import type { AudioEngine } from './synth';

export function eventToSound(event: GameEvent): SoundName | null {
  switch (event.kind) {
    // UI
    case 'menu-move':
      return 'cursorMove';
    case 'ui-cancel':
      return 'cancel'; // built in slice 1, now wired (pause-menu back)
    case 'stance-selected':
      return 'confirm'; // committing a stance is the player's confirm
    // Battle framing + core pillars (slice 3 — events already emitted, now voiced)
    case 'battle-start':
      return 'battleStart';
    case 'battle-end':
      return event.winner === 'player' ? 'victory' : null; // an earned sting on player win only
    case 'move-resolved':
      return 'moveResolved'; // subtle, sits UNDER the impact
    case 'catch-attempt':
      return 'ballThrow';
    case 'catch-success':
      return 'catchClick';
    case 'evolve':
      return 'evolve';
    case 'bond-stage-cross':
      return 'bondCross'; // the warm, rewarding bond-thesis chime
    // Overworld presence (slice 2)
    case 'door-enter':
      return 'doorEnter';
    case 'dialogue-open':
      return 'dialogueOpen';
    case 'dialogue-advance':
      return 'textBlip'; // the built-but-unwired text-blip, now tuned + wired
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
