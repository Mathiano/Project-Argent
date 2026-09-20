// The music subscriber — the second listener on the gameEvents bus, after the
// SFX one. PURE mapping (eventToTrack) is unit-tested; installMusic wires it.
// Presentation only: it reads events and starts tracks, and writes nothing back
// to game state, so it cannot perturb combat or any ladder.
//
// Wired to the events that actually exist and actually emit. There is no
// map-change event on the bus, so per-area town/route themes are NOT faked here
// — main.ts drives the field track directly at the scene boundary it owns
// (audio-north-star's taxonomy lists per-biome BGM as Phase-7 throughput).

import { onGameEvent } from '../gameEvents';
import type { GameEvent } from '../gameEvents';
import type { MusicPlayer } from './music';

// null = this event does not change the music. 'stop' = silence.
export type MusicCue = { readonly kind: 'play'; readonly id: string } | { readonly kind: 'stop' } | null;

export function eventToTrack(event: GameEvent): MusicCue {
  switch (event.kind) {
    case 'battle-start':
      return { kind: 'play', id: 'music.battle' };
    case 'battle-end':
      // A win earns the brief victory sting (it does not loop — it plays out and
      // goes quiet). A loss just stops: the black-out beat should land in silence.
      return event.winner === 'player' ? { kind: 'play', id: 'music.victory' } : { kind: 'stop' };
    default:
      return null;
  }
}

export function installMusic(player: MusicPlayer): () => void {
  return onGameEvent((event) => {
    const cue = eventToTrack(event);
    if (!cue) return;
    if (cue.kind === 'stop') player.stop();
    else player.play(cue.id);
  });
}
