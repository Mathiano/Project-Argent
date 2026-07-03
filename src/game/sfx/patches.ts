// SFX patch table (docs/sfx-build-decisions.md — "patches as a simple params
// table; extract-to-data is a banked future step"). Each cue is a Patch = a set of
// layered VOICES (a voice = one oscillator + an ADSR envelope, optionally pitch-
// swept/delayed). Times in seconds, frequencies in Hz. Enhanced-retro register.

import type { ReleaseKind } from '../../engine';

export interface Voice {
  readonly wave: OscillatorType; // 'sine' | 'triangle' | 'square' | 'sawtooth'
  readonly freq: number;
  readonly freqTo?: number; // sweep/glide target over `dur`
  readonly curve?: 'lin' | 'exp';
  readonly delay?: number; // start offset (layered taps/chords)
  readonly attack: number;
  readonly decay: number;
  readonly sustain: number; // 0..1 of peak
  readonly release: number;
  readonly peak: number; // 0..1
  readonly dur: number; // time to the release phase
}
export interface Patch {
  readonly gain: number; // patch-level trim
  readonly voices: readonly Voice[];
}

// ── UI — the Celeste-blip register (retro in spirit, clean in production) ────
export const PATCHES: Readonly<Record<string, Patch>> = {
  // cursor move — a soft, short high tick.
  cursor: { gain: 0.5, voices: [{ wave: 'triangle', freq: 660, attack: 0.004, decay: 0.04, sustain: 0, release: 0.02, peak: 0.5, dur: 0.045 }] },
  // confirm — a brighter rising blip (commitment).
  confirm: { gain: 0.55, voices: [{ wave: 'triangle', freq: 540, freqTo: 810, curve: 'lin', attack: 0.004, decay: 0.06, sustain: 0.15, release: 0.05, peak: 0.6, dur: 0.08 }] },
  // cancel — a short falling blip (backing out).
  cancel: { gain: 0.5, voices: [{ wave: 'triangle', freq: 500, freqTo: 320, curve: 'lin', attack: 0.004, decay: 0.05, sustain: 0, release: 0.03, peak: 0.55, dur: 0.07 }] },
  // text blip — a very short, quiet tick per page.
  textBlip: { gain: 0.35, voices: [{ wave: 'square', freq: 900, attack: 0.002, decay: 0.02, sustain: 0, release: 0.012, peak: 0.4, dur: 0.028 }] },

  // ── Combat feedback ───────────────────────────────────────────────────────
  // read-win — the ★ chime (paired with starPop): a bright two-note lift.
  readWin: { gain: 0.5, voices: [
    { wave: 'sine', freq: 880, attack: 0.004, decay: 0.08, sustain: 0.2, release: 0.06, peak: 0.55, dur: 0.09 },
    { wave: 'sine', freq: 1320, delay: 0.07, attack: 0.004, decay: 0.1, sustain: 0.15, release: 0.08, peak: 0.5, dur: 0.11 },
  ] },
  // battle-start — a rising sweep (paired with the enter wipe).
  battleStart: { gain: 0.5, voices: [{ wave: 'sine', freq: 220, freqTo: 660, curve: 'exp', attack: 0.02, decay: 0.3, sustain: 0.35, release: 0.12, peak: 0.6, dur: 0.34 }] },
  // ko — a slow falling resolve (defeat).
  ko: { gain: 0.55, voices: [{ wave: 'triangle', freq: 440, freqTo: 110, curve: 'exp', attack: 0.01, decay: 0.4, sustain: 0.25, release: 0.18, peak: 0.7, dur: 0.45 }] },

  // ── THESIS cue #1 — the FOCUS wind-up telegraph ───────────────────────────
  // Unmistakable + part of the read: a TENSE rising sawtooth with a slow amplitude
  // SWELL (energy gathering) — its own timbre (buzzy saw), not shared with any hit.
  focusWindup: { gain: 0.42, voices: [
    { wave: 'sawtooth', freq: 240, freqTo: 560, curve: 'lin', attack: 0.18, decay: 0.16, sustain: 0.7, release: 0.1, peak: 0.5, dur: 0.4 },
    { wave: 'triangle', freq: 360, freqTo: 840, curve: 'lin', attack: 0.2, decay: 0.14, sustain: 0.6, release: 0.1, peak: 0.28, dur: 0.4 },
  ] },
};

// ── THESIS cue #2 — release impacts DISTINCT per Heavy / Feint / Hide ────────
// Three GENUINELY different patches (waveform × gesture × envelope), not one patch
// at three pitches — a player with eyes closed should know which release landed:
//   HEAVY  — a low, blunt SLAM: square + sub-sine, hard attack, downward pitch drop.
//   FEINT  — a sharp, bright DOUBLE-TAP: two staccato triangle jabs (the bait).
//   HIDE   — a smooth, airy GLIDE-UP: soft sine sweep, long-ish tail (slipping in).
export const RELEASE_PATCHES: Readonly<Record<ReleaseKind, Patch>> = {
  heavy: { gain: 0.7, voices: [
    { wave: 'square', freq: 150, freqTo: 68, curve: 'exp', attack: 0.002, decay: 0.12, sustain: 0, release: 0.05, peak: 0.85, dur: 0.13 },
    { wave: 'sine', freq: 90, freqTo: 50, curve: 'exp', attack: 0.002, decay: 0.14, sustain: 0, release: 0.06, peak: 0.7, dur: 0.15 },
  ] },
  feint: { gain: 0.6, voices: [
    { wave: 'triangle', freq: 760, attack: 0.002, decay: 0.02, sustain: 0, release: 0.015, peak: 0.7, dur: 0.03 },
    { wave: 'triangle', freq: 940, delay: 0.06, attack: 0.002, decay: 0.03, sustain: 0, release: 0.02, peak: 0.8, dur: 0.045 },
  ] },
  hide: { gain: 0.55, voices: [
    { wave: 'sine', freq: 380, freqTo: 880, curve: 'exp', attack: 0.05, decay: 0.18, sustain: 0.3, release: 0.12, peak: 0.6, dur: 0.26 },
  ] },
};

// A release's OUTCOME trims its impact — a landed read hits full, a whiff is muffled.
export function outcomeGain(outcome: 'win' | 'lose' | 'neutral'): number {
  return outcome === 'win' ? 1 : outcome === 'lose' ? 0.55 : 0.8;
}

// hit-landed impact — BUILT from effectiveness (an INFORMATION cue: the type-read is
// audible). Base thud + a bright super-effective STING, or a duller resisted thud.
export function buildImpact(effectiveness: number): Patch {
  const base: Voice = { wave: 'sine', freq: 200, freqTo: 90, curve: 'exp', attack: 0.002, decay: 0.09, sustain: 0, release: 0.04, peak: 0.85, dur: 0.11 };
  if (effectiveness >= 1.3) {
    // super-effective — a bright high sting rides the thud (the "it's strong" read).
    return { gain: 0.6, voices: [base, { wave: 'square', freq: 1200, freqTo: 1600, curve: 'lin', attack: 0.002, decay: 0.05, sustain: 0, release: 0.03, peak: 0.4, dur: 0.06 }] };
  }
  if (effectiveness <= 0.7) {
    // resisted — a muffled, low thud, no sting (the "it barely worked" read).
    return { gain: 0.4, voices: [{ ...base, freq: 150, freqTo: 80, peak: 0.6 }] };
  }
  return { gain: 0.55, voices: [base] };
}

// The static event→cue map for the SIMPLE (non-parameterized) cues. hit-landed +
// release are handled specially (they read event fields) in the subscriber.
export const CUE_MAP: Readonly<Record<string, string>> = {
  'menu-move': 'cursor',
  'ui-confirm': 'confirm',
  'ui-cancel': 'cancel',
  'dialogue-advance': 'textBlip',
  'dialogue-open': 'textBlip',
  'read-win': 'readWin',
  'battle-start': 'battleStart',
  ko: 'ko',
  'focus-windup': 'focusWindup',
};
