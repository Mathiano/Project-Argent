// Synthesized SFX recipes — the "enhanced-retro" palette (Gen-2 soul at modern
// fidelity; the Undertale / Celeste / Stardew zone, per docs/sfx-build-decisions.md).
// PURE DATA: each sound is one or more shaped oscillator tones. No Web Audio here —
// synth.ts schedules these — so the palette + its design intent are unit-testable.
//
// Register discipline: clean sine / triangle / pulse(square) only (NO sawtooth — too
// harsh), fast attacks + gentle releases (a Celeste menu blip, not a Game Boy beep),
// modest per-tone gain with headroom for layering.

export interface ToneSpec {
  // Waveform — sine (soft), triangle (warm body), square (pulse bite). No sawtooth.
  readonly type: 'sine' | 'triangle' | 'square';
  readonly freq: number; // start frequency, Hz
  readonly sweepTo?: number; // optional end frequency → a linear pitch glide
  readonly dur: number; // tone length, seconds (envelope peak→near-zero spans this)
  readonly attack: number; // seconds to peak — small = snappy
  readonly release: number; // seconds of tail after dur (lets it ring out, not click)
  readonly gain: number; // peak level 0..1 (mixed under the master gain)
  readonly delay?: number; // start offset, seconds — for layered / sequenced tones
}

// The palette. Each entry is a layered tone stack designed to be DISTINGUISHABLE
// (combat cues carry information, not decoration — a player should read hit vs
// super-effective vs resisted vs KO by ear).
export const SOUNDS = {
  // ── UI — snappy, pleasant, clean ──────────────────────────────────────────
  // cursor: a tiny high triangle tick (the Celeste menu blip).
  cursorMove: [{ type: 'triangle', freq: 660, dur: 0.05, attack: 0.004, release: 0.04, gain: 0.18 }],
  // confirm: a bright rising fifth + a soft high accent — "yes / committed".
  confirm: [
    { type: 'triangle', freq: 660, sweepTo: 990, dur: 0.1, attack: 0.004, release: 0.07, gain: 0.22 },
    { type: 'sine', freq: 1320, dur: 0.06, attack: 0.002, release: 0.05, gain: 0.1, delay: 0.02 },
  ],
  // cancel: a gentle falling tone — "back / no".
  cancel: [{ type: 'triangle', freq: 520, sweepTo: 330, dur: 0.1, attack: 0.004, release: 0.08, gain: 0.2 }],
  // text-blip: a very short pulse tick for dialog advance.
  textBlip: [{ type: 'square', freq: 480, dur: 0.03, attack: 0.002, release: 0.02, gain: 0.1 }],

  // ── Combat hit-feedback — information-bearing ─────────────────────────────
  // impact (neutral): a low triangle thud + a square click — body, a hit landed.
  impact: [
    { type: 'triangle', freq: 200, sweepTo: 120, dur: 0.12, attack: 0.002, release: 0.1, gain: 0.3 },
    { type: 'square', freq: 140, dur: 0.05, attack: 0.001, release: 0.04, gain: 0.12 },
  ],
  // resisted (eff < 1): the SAME thud, softer + duller (sine, lower, quieter) —
  // reads as "that barely connected".
  impactResisted: [{ type: 'sine', freq: 150, sweepTo: 110, dur: 0.1, attack: 0.004, release: 0.09, gain: 0.16 }],
  // super-effective (eff > 1): the thud PLUS a bright rising sting + a crisp high
  // accent — the unmistakable "it's super effective!" read (carries the type-read).
  superEffective: [
    { type: 'triangle', freq: 200, sweepTo: 120, dur: 0.1, attack: 0.002, release: 0.09, gain: 0.26 },
    { type: 'square', freq: 740, sweepTo: 1480, dur: 0.16, attack: 0.003, release: 0.12, gain: 0.16, delay: 0.02 },
    { type: 'sine', freq: 1760, dur: 0.1, attack: 0.002, release: 0.09, gain: 0.1, delay: 0.06 },
  ],
  // KO: a long descending fall — final, a mon went down (not harsh).
  ko: [
    { type: 'triangle', freq: 440, sweepTo: 110, dur: 0.3, attack: 0.004, release: 0.26, gain: 0.26 },
    { type: 'sine', freq: 220, sweepTo: 80, dur: 0.34, attack: 0.01, release: 0.3, gain: 0.12, delay: 0.02 },
  ],
} as const satisfies Record<string, readonly ToneSpec[]>;

export type SoundName = keyof typeof SOUNDS;
