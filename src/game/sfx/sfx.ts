// The SFX subscriber (subscriber #2 on gameEvents, mirroring the anim runtime's
// pattern on the same bus). Maps events → synthesized patches. Presentation-only:
// the engine + sim never touch this (they never subscribe). Headless-safe via
// AudioEngine (a clean no-op wherever no AudioContext exists).

import { onGameEvent, type GameEvent } from '../gameEvents';
import { AudioEngine } from './synth';
import { CUE_MAP, PATCHES, RELEASE_PATCHES, buildImpact, outcomeGain, type Patch } from './patches';

export interface SfxController {
  readonly setMuted: (m: boolean) => void;
  readonly toggleMuted: () => boolean;
  readonly isMuted: () => boolean;
  readonly dispose: () => void;
}

// Create the app-wide SFX subscriber. Call ONCE (main.ts). Returns the mute
// controller + a dispose. Constructing it headless is safe (the engine no-ops).
export function createSfxSubscriber(engine: AudioEngine = new AudioEngine()): SfxController {
  // A FOCUS release emits `release` immediately before its generic `hit-landed`
  // (synchronous). The release's DISTINCT impact is the one we want, so swallow the
  // very next generic impact after a release.
  let suppressNextImpact = false;

  const handle = (ev: GameEvent): void => {
    switch (ev.kind) {
      case 'release': {
        engine.play(scale(RELEASE_PATCHES[ev.release]!, outcomeGain(ev.outcome)));
        suppressNextImpact = true;
        return;
      }
      case 'hit-landed': {
        if (suppressNextImpact) { suppressNextImpact = false; return; } // the release patch already sounded
        engine.play(buildImpact(ev.effectiveness));
        return;
      }
      default: {
        const cue = CUE_MAP[ev.kind];
        if (cue && PATCHES[cue]) engine.play(PATCHES[cue]!);
      }
    }
  };

  const unsub = onGameEvent(handle);
  return {
    setMuted: (m) => engine.setMuted(m),
    toggleMuted: () => { engine.setMuted(!engine.isMuted()); return engine.isMuted(); },
    isMuted: () => engine.isMuted(),
    dispose: unsub,
  };
}

function scale(patch: Patch, g: number): Patch {
  return { gain: patch.gain * g, voices: patch.voices };
}
