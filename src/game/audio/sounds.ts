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
  // text-blip: a very short, soft triangle tick for dialogue advance. Fires a LOT,
  // so tuned softer than slice 1 (triangle not square, lower gain) — non-fatiguing.
  textBlip: [{ type: 'triangle', freq: 440, dur: 0.028, attack: 0.002, release: 0.022, gain: 0.09 }],

  // ── Combat hit-feedback — information-bearing, GBA/Ruby character (slice 2) ──
  // Deliberately MORE Game-Boy than the UI: a chunky square-wave SMACK with body +
  // a short decay tail (the Gen-3 battle-hit punch), not a soft clean bob. The three
  // variants stay relative to this chunkier base so they remain distinguishable.
  //
  // impact (neutral): the full square smack — body + a low pulse under it + tail.
  impact: [
    { type: 'square', freq: 180, sweepTo: 90, dur: 0.18, attack: 0.001, release: 0.13, gain: 0.34 },
    { type: 'square', freq: 110, dur: 0.11, attack: 0.001, release: 0.09, gain: 0.2 },
  ],
  // resisted (eff < 1): the same smack, DULLER + QUIETER (triangle/sine, no square
  // bite, lower gain) — "that barely connected".
  impactResisted: [
    { type: 'triangle', freq: 150, sweepTo: 90, dur: 0.14, attack: 0.003, release: 0.1, gain: 0.18 },
    { type: 'sine', freq: 100, dur: 0.08, attack: 0.004, release: 0.07, gain: 0.1 },
  ],
  // super-effective (eff > 1): the chunky smack PLUS a bright rising sting + a crisp
  // high accent — the unmistakable "super effective!" (carries the type-read).
  superEffective: [
    { type: 'square', freq: 180, sweepTo: 90, dur: 0.14, attack: 0.001, release: 0.11, gain: 0.3 },
    { type: 'square', freq: 760, sweepTo: 1520, dur: 0.18, attack: 0.002, release: 0.14, gain: 0.16, delay: 0.02 },
    { type: 'sine', freq: 1980, dur: 0.12, attack: 0.002, release: 0.1, gain: 0.1, delay: 0.07 },
  ],
  // KO: a long, drawn-out descending WARBLE (two detuned falls beating against each
  // other) — the faint that takes its time. Final, distinct, not harsh.
  ko: [
    { type: 'triangle', freq: 420, sweepTo: 80, dur: 0.55, attack: 0.006, release: 0.4, gain: 0.26 },
    { type: 'square', freq: 320, sweepTo: 70, dur: 0.55, attack: 0.01, release: 0.4, gain: 0.11, delay: 0.03 },
    { type: 'sine', freq: 160, sweepTo: 50, dur: 0.6, attack: 0.02, release: 0.45, gain: 0.1, delay: 0.05 },
  ],

  // ── Overworld presence (slice 2) — short, soft, non-fatiguing (fire often) ──
  // door: a quick descending two-step GB door blip.
  doorEnter: [
    { type: 'square', freq: 330, dur: 0.06, attack: 0.002, release: 0.04, gain: 0.16 },
    { type: 'square', freq: 247, dur: 0.07, attack: 0.002, release: 0.05, gain: 0.16, delay: 0.06 },
  ],
  // talk: a soft, gentle "a textbox opened" blip (lower + softer than the cursor).
  dialogueOpen: [{ type: 'triangle', freq: 392, dur: 0.05, attack: 0.004, release: 0.04, gain: 0.13 }],
} as const satisfies Record<string, readonly ToneSpec[]>;

export type SoundName = keyof typeof SOUNDS;
