// Web Audio synth layer (SFX subscriber #2, per docs/sfx-build-decisions.md).
// Enhanced-retro register — clean sine/triangle/pulse tones with shaped envelopes,
// synthesized (zero external audio files → the licensing discipline held).
//
// HEADLESS-SAFE is a hard gate: lazy-init, and a clean no-op wherever no AudioContext
// exists (Node/CI tests never touch audio). Nothing here throws off the audio path.

import type { Patch, Voice } from './patches';

type Ctor = new () => AudioContext;
function audioCtor(): Ctor | null {
  if (typeof window === 'undefined') return null; // Node / CI → no audio
  const w = window as unknown as { AudioContext?: Ctor; webkitAudioContext?: Ctor };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

// The engine owns ONE AudioContext + a master gain (the mute lever). Created lazily
// on first play (after a user gesture the context can resume), never at import.
export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private muted = false;
  private readonly volume: number;
  private failed = false;

  constructor(volume = 0.32) {
    this.volume = volume;
  }

  // True only where audio can actually run (a browser with Web Audio). Tests read
  // this to prove the no-op path is taken headless.
  get available(): boolean {
    return audioCtor() !== null;
  }

  private ensure(): boolean {
    if (this.failed) return false;
    if (this.ctx && this.master) return true;
    const Ctor = audioCtor();
    if (!Ctor) return false;
    try {
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : this.volume;
      this.master.connect(this.ctx.destination);
      return true;
    } catch {
      this.failed = true; // a construction failure disables audio permanently, silently
      return false;
    }
  }

  setMuted(m: boolean): void {
    this.muted = m;
    if (this.master && this.ctx) this.master.gain.setValueAtTime(m ? 0 : this.volume, this.ctx.currentTime);
  }
  isMuted(): boolean {
    return this.muted;
  }

  // Play a patch (a set of layered voices). No-op headless / when muted / on any
  // scheduling error — the caller never has to guard.
  play(patch: Patch): void {
    if (this.muted) return;
    if (!this.ensure() || !this.ctx || !this.master) return;
    try {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      const now = this.ctx.currentTime;
      for (const v of patch.voices) this.voice(v, patch.gain, now);
    } catch {
      /* never let an audio hiccup reach gameplay */
    }
  }

  private voice(v: Voice, patchGain: number, now: number): void {
    const ctx = this.ctx!;
    const start = now + (v.delay ?? 0);
    const osc = ctx.createOscillator();
    osc.type = v.wave;
    osc.frequency.setValueAtTime(v.freq, start);
    if (v.freqTo !== undefined) {
      const end = start + v.dur;
      if (v.curve === 'exp') osc.frequency.exponentialRampToValueAtTime(Math.max(1, v.freqTo), end);
      else osc.frequency.linearRampToValueAtTime(v.freqTo, end);
    }
    const g = ctx.createGain();
    const peak = v.peak * patchGain;
    const sustain = peak * v.sustain;
    // ADSR: silent → peak (attack) → sustain (decay) → hold → 0 (release).
    g.gain.setValueAtTime(0.0001, start);
    g.gain.linearRampToValueAtTime(peak, start + v.attack);
    g.gain.linearRampToValueAtTime(Math.max(0.0001, sustain), start + v.attack + v.decay);
    const relStart = start + v.dur;
    g.gain.setValueAtTime(Math.max(0.0001, sustain), relStart);
    g.gain.exponentialRampToValueAtTime(0.0001, relStart + v.release);
    osc.connect(g).connect(this.master!);
    osc.start(start);
    osc.stop(relStart + v.release + 0.02);
  }
}
