// The Web Audio synth layer: turns a ToneSpec into a shaped oscillator, mixes
// every voice under a single MASTER GAIN (the mute toggle), and lazily builds the
// AudioContext on first use (inside a user gesture, so browser autoplay policy is
// satisfied). Code-synthesized — no external files, no libraries, nothing to
// license. Headless-safe: with no Web Audio (node/tests) it is a silent no-op.

import { SOUNDS } from './sounds';
import type { SoundName, ToneSpec } from './sounds';

// Schedules one tone. Injectable so the engine's mapping + mute gating are testable
// without Web Audio (tests pass a recording stub).
export type ToneFn = (spec: ToneSpec) => void;

export interface AudioEngine {
  // Play a named sound (all its layered tones). Silent while muted.
  play(name: SoundName): void;
  setMuted(muted: boolean): void;
  isMuted(): boolean;
}

// The real Web Audio backend. Returns a `tone` scheduler + a `setMuted` that drives
// the MASTER GAIN (so in-flight tails are silenced too). No-op without Web Audio.
function createWebAudioBackend(): { tone: ToneFn; setMuted: (m: boolean) => void } {
  const AC: typeof AudioContext | undefined =
    typeof AudioContext !== 'undefined'
      ? AudioContext
      : (globalThis as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return { tone: () => {}, setMuted: () => {} }; // headless / unsupported

  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  let muted = false;
  const LEVEL = 0.55; // master headroom (mute = 0)

  const ensure = (): AudioContext | null => {
    if (!ctx) {
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : LEVEL;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') void ctx.resume(); // a user gesture is on the stack
    return ctx;
  };

  return {
    tone: (spec) => {
      const c = ensure();
      if (!c || !master) return;
      const t0 = c.currentTime + (spec.delay ?? 0);
      const osc = c.createOscillator();
      const g = c.createGain();
      osc.type = spec.type;
      osc.frequency.setValueAtTime(spec.freq, t0);
      if (spec.sweepTo !== undefined) osc.frequency.linearRampToValueAtTime(spec.sweepTo, t0 + spec.dur);
      // Shaped envelope: fast attack to peak, then ring down (exponential, never to
      // exactly 0 — Web Audio forbids 0 in an exponential ramp).
      const peak = Math.max(0.0001, spec.gain);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(peak, t0 + spec.attack);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + spec.dur);
      osc.connect(g);
      g.connect(master);
      osc.start(t0);
      osc.stop(t0 + spec.dur + spec.release);
    },
    setMuted: (m) => {
      muted = m;
      if (master) master.gain.value = m ? 0 : LEVEL;
    },
  };
}

// Build the engine. Tests inject `tone` (+ optional `setMuted`) to verify the
// event→sound mapping and the mute gating without Web Audio.
export function createAudioEngine(opts: { tone?: ToneFn; setMuted?: (m: boolean) => void; muted?: boolean } = {}): AudioEngine {
  let muted = opts.muted ?? false;
  let tone: ToneFn;
  let backendSetMuted: (m: boolean) => void;
  if (opts.tone) {
    tone = opts.tone;
    backendSetMuted = opts.setMuted ?? (() => {});
  } else {
    const backend = createWebAudioBackend();
    tone = backend.tone;
    backendSetMuted = backend.setMuted;
  }
  backendSetMuted(muted);
  return {
    play(name) {
      if (muted) return; // mute gating — no voices scheduled
      for (const spec of SOUNDS[name]) tone(spec);
    },
    setMuted(m) {
      muted = m;
      backendSetMuted(m); // also drop the master gain (silence in-flight tails)
    },
    isMuted() {
      return muted;
    },
  };
}

// ── mute persistence (a device preference, not run/save state) ───────────────
const MUTE_KEY = 'argent.audio.muted';
export function loadMutedPref(): boolean {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}
export function saveMutedPref(muted: boolean): void {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
  } catch {
    /* storage unavailable — preference just won't persist */
  }
}
