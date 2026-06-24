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

  // ── P0 wire-up (slice 3) — events that already emit, now given voices ────────
  // battle-start: a snappy high→low two-note "engage" alert — a transition, not music.
  battleStart: [
    { type: 'square', freq: 660, dur: 0.07, attack: 0.002, release: 0.04, gain: 0.18 },
    { type: 'square', freq: 440, dur: 0.1, attack: 0.002, release: 0.07, gain: 0.18, delay: 0.07 },
  ],
  // victory (player win only): a BRIEF earned rising C-E-G + a top-octave sparkle —
  // a sting, not a long fanfare (~0.35s).
  victory: [
    { type: 'triangle', freq: 523, dur: 0.1, attack: 0.004, release: 0.06, gain: 0.2 },
    { type: 'triangle', freq: 659, dur: 0.1, attack: 0.004, release: 0.06, gain: 0.2, delay: 0.08 },
    { type: 'triangle', freq: 784, dur: 0.16, attack: 0.004, release: 0.12, gain: 0.22, delay: 0.16 },
    { type: 'square', freq: 1046, dur: 0.1, attack: 0.003, release: 0.08, gain: 0.09, delay: 0.16 },
  ],
  // move-resolved: a quiet low tick UNDER the impact (gain ≪ impact) so it never
  // competes with hit-feedback — just "an action happened". Fires often → very soft.
  moveResolved: [{ type: 'sine', freq: 160, sweepTo: 110, dur: 0.06, attack: 0.002, release: 0.05, gain: 0.08 }],
  // catch-attempt: a quick rising whoosh (the ball's arc) + a light landing tick.
  ballThrow: [
    { type: 'sine', freq: 300, sweepTo: 700, dur: 0.12, attack: 0.004, release: 0.06, gain: 0.16 },
    { type: 'square', freq: 200, dur: 0.03, attack: 0.001, release: 0.02, gain: 0.1, delay: 0.1 },
  ],
  // catch-success: the iconic double "click" of a caught mon + a warm "got it" lift.
  catchClick: [
    { type: 'square', freq: 880, dur: 0.04, attack: 0.001, release: 0.03, gain: 0.16 },
    { type: 'square', freq: 880, dur: 0.04, attack: 0.001, release: 0.03, gain: 0.16, delay: 0.1 },
    { type: 'triangle', freq: 587, sweepTo: 784, dur: 0.12, attack: 0.004, release: 0.09, gain: 0.14, delay: 0.18 },
  ],
  // evolve: a rising transformation sweep + a shimmer octave + a bright resolve cap —
  // distinct and meaningful, "something changed".
  evolve: [
    { type: 'triangle', freq: 392, sweepTo: 784, dur: 0.3, attack: 0.01, release: 0.18, gain: 0.18 },
    { type: 'sine', freq: 784, sweepTo: 1568, dur: 0.3, attack: 0.02, release: 0.2, gain: 0.1, delay: 0.04 },
    { type: 'square', freq: 1046, dur: 0.14, attack: 0.004, release: 0.1, gain: 0.1, delay: 0.3 },
  ],
  // bond-stage-cross: a WARM, rewarding rising chime (root → fifth → octave bloom),
  // pure sine/triangle (no square bite), soft slow attacks — the bond thesis's
  // positive feedback. This one is meant to feel GOOD.
  bondCross: [
    { type: 'sine', freq: 523, dur: 0.16, attack: 0.008, release: 0.12, gain: 0.18 },
    { type: 'sine', freq: 784, dur: 0.2, attack: 0.008, release: 0.16, gain: 0.16, delay: 0.1 },
    { type: 'triangle', freq: 1046, dur: 0.22, attack: 0.01, release: 0.18, gain: 0.1, delay: 0.2 },
  ],
} as const satisfies Record<string, readonly ToneSpec[]>;

export type SoundName = keyof typeof SOUNDS;
