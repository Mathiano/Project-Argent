// The MUSIC layer: looping BGM synthesized in code, on the SAME Web Audio bus as
// the SFX (one context, one master gain, one mute). No audio files, nothing to
// license, headless-safe — with no Web Audio this is a silent no-op, which is
// the normal case under vitest.
//
// A track is DATA (assets/music/*.track.json), the same call the tilesets and
// the animation defs make: a new theme is a JSON drop plus a map line, never a
// code edit. Tracks are validated at load, so a malformed note fails loudly at
// startup rather than playing silence.
//
// Scheduling uses the standard Web Audio lookahead: a timer wakes every
// SCHEDULE_TICK_MS and schedules every step falling inside the next
// LOOKAHEAD_SEC against ctx.currentTime. The timer only decides WHAT to queue;
// the audio clock decides WHEN it sounds, so tempo never drifts with frame rate.

import { getAudioBus } from './synth';

export interface VoiceJson {
  // A label for the part ("lead", "bass"). Documentation only.
  readonly name: string;
  readonly wave: OscillatorType;
  readonly gain: number;
  // Space-separated steps. A note is scientific pitch (C4, F#3, Bb5); '-' is a
  // rest, and '.' sustains the previous note through this step.
  readonly steps: string;
}

export interface TrackJson {
  readonly id: string; // dot-namespaced, e.g. "music.battle"
  readonly bpm: number;
  readonly stepsPerBeat: number;
  readonly voices: readonly VoiceJson[];
  // false → play once and stop (a victory sting). Default true.
  readonly loop?: boolean;
}

export interface Step {
  readonly freq: number | null; // null = rest
  readonly steps: number; // how many steps this note is held for (sustain '.')
}
export interface Voice {
  readonly name: string;
  readonly wave: OscillatorType;
  readonly gain: number;
  readonly steps: readonly Step[];
}
export interface Track {
  readonly id: string;
  readonly bpm: number;
  readonly stepsPerBeat: number;
  readonly loop: boolean;
  readonly voices: readonly Voice[];
  readonly totalSteps: number; // the longest voice — the loop length
}

const ID_RE = /^[a-z][a-zA-Z0-9]*(\.[a-zA-Z0-9]+)+$/;
const NOTE_RE = /^([A-G])([#b]?)(-?\d)$/;
const SEMITONE: Readonly<Record<string, number>> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

// Scientific pitch → Hz (A4 = 440). Throws on anything unparseable so a typo in
// a track surfaces at load rather than as a wrong note nobody can place.
export function noteToFreq(note: string): number {
  const m = NOTE_RE.exec(note);
  if (!m) throw new Error(`music: "${note}" is not a note (expected e.g. C4, F#3, Bb5)`);
  const [, letter, accidental, octave] = m;
  const semis = SEMITONE[letter!]! + (accidental === '#' ? 1 : accidental === 'b' ? -1 : 0);
  const midi = (Number(octave) + 1) * 12 + semis;
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export function parseTrack(raw: unknown): Track {
  const o = raw as Record<string, unknown>;
  const req = (cond: boolean, msg: string): void => {
    if (!cond) throw new Error(`music track: ${msg}`);
  };
  req(typeof o === 'object' && o !== null, 'must be an object');
  req(typeof o.id === 'string' && ID_RE.test(o.id as string), `id "${String(o.id)}" must be dot-namespaced (e.g. music.battle)`);
  const id = o.id as string;
  req(typeof o.bpm === 'number' && (o.bpm as number) > 0, `${id}: bpm must be positive`);
  req(Number.isInteger(o.stepsPerBeat) && (o.stepsPerBeat as number) > 0, `${id}: stepsPerBeat must be a positive integer`);
  req(Array.isArray(o.voices) && (o.voices as unknown[]).length > 0, `${id}: voices must be a non-empty array`);

  let totalSteps = 0;
  const voices: Voice[] = (o.voices as VoiceJson[]).map((v, i) => {
    req(typeof v.steps === 'string' && v.steps.trim().length > 0, `${id}: voice ${i} steps must be a non-empty string`);
    req(typeof v.gain === 'number' && v.gain > 0, `${id}: voice ${i} gain must be positive`);
    const tokens = v.steps.trim().split(/\s+/);
    const steps: Step[] = [];
    // The index of the note a '.' extends. Tracked separately from the end of
    // the array because a sustain pushes a silent placeholder to keep the grid
    // aligned — so with 'C4 . .' the SECOND dot must still reach back to the
    // C4, not to the placeholder the first dot left behind.
    let holding = -1;
    for (const tok of tokens) {
      if (tok === '.') {
        req(holding >= 0, `${id}: voice ${i} has a sustain '.' with no note to hold`);
        const held = steps[holding]!;
        steps[holding] = { freq: held.freq, steps: held.steps + 1 };
        steps.push({ freq: null, steps: 0 }); // a placeholder so indices stay in time
      } else if (tok === '-') {
        steps.push({ freq: null, steps: 1 });
        holding = -1; // a rest ends the phrase; a later '.' has nothing to hold
      } else {
        holding = steps.length;
        steps.push({ freq: noteToFreq(tok), steps: 1 });
      }
    }
    totalSteps = Math.max(totalSteps, steps.length);
    return { name: v.name, wave: v.wave, gain: v.gain, steps };
  });
  return { id, bpm: o.bpm as number, stepsPerBeat: o.stepsPerBeat as number, loop: (o.loop as boolean) ?? true, voices, totalSteps };
}

export function buildTracks(raws: readonly unknown[]): Map<string, Track> {
  const map = new Map<string, Track>();
  for (const raw of raws) {
    const t = parseTrack(raw);
    if (map.has(t.id)) throw new Error(`music: duplicate track id "${t.id}"`);
    map.set(t.id, t);
  }
  return map;
}

// How far ahead to queue notes, and how often to wake and do it. The lookahead
// has to exceed the tick so a slow frame can never leave a gap.
const LOOKAHEAD_SEC = 0.25;
const SCHEDULE_TICK_MS = 60;
const FADE_SEC = 0.35; // the crossfade when one track replaces another

export interface MusicPlayer {
  // Start a track by id, crossfading out whatever is playing. Re-playing the
  // track already playing is a no-op, so an event that fires twice will not
  // restart the theme mid-phrase.
  play(id: string): void;
  stop(): void;
  current(): string | null;
}

export function createMusicPlayer(tracks: ReadonlyMap<string, Track>): MusicPlayer {
  let currentId: string | null = null;
  let timer: ReturnType<typeof setInterval> | null = null;
  let voiceGain: GainNode | null = null;
  let nextStep = 0; // the next step index to schedule
  let nextTime = 0; // the audio-clock time that step falls on
  let track: Track | null = null;

  const clear = (): void => {
    if (timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  };

  // Queue every step that starts inside the lookahead window.
  const schedule = (): void => {
    const bus = getAudioBus();
    if (!bus || !track || !voiceGain) return;
    const stepSec = 60 / track.bpm / track.stepsPerBeat;
    while (nextTime < bus.ctx.currentTime + LOOKAHEAD_SEC) {
      const step = nextStep;
      for (const v of track.voices) {
        const s = v.steps[step % Math.max(1, v.steps.length)];
        if (!s || s.freq === null || s.steps === 0) continue;
        const dur = s.steps * stepSec;
        const osc = bus.ctx.createOscillator();
        const g = bus.ctx.createGain();
        osc.type = v.wave;
        osc.frequency.setValueAtTime(s.freq, nextTime);
        // A short attack and a release inside the step, so repeated notes
        // articulate instead of fusing into one held tone.
        const peak = Math.max(0.0001, v.gain);
        g.gain.setValueAtTime(0.0001, nextTime);
        g.gain.exponentialRampToValueAtTime(peak, nextTime + Math.min(0.02, dur * 0.25));
        g.gain.exponentialRampToValueAtTime(0.0001, nextTime + dur * 0.92);
        osc.connect(g);
        g.connect(voiceGain);
        osc.start(nextTime);
        osc.stop(nextTime + dur);
      }
      nextTime += stepSec;
      nextStep += 1;
      if (nextStep >= track.totalSteps) {
        if (!track.loop) {
          // A one-shot (the victory sting): let the tail ring, then go quiet.
          const endId = currentId;
          setTimeout(() => {
            if (currentId === endId) stopNow();
          }, Math.ceil(stepSec * 1000) + 200);
          clear();
          return;
        }
        nextStep = 0;
      }
    }
  };

  const stopNow = (): void => {
    clear();
    if (voiceGain) {
      const bus = getAudioBus();
      if (bus) {
        // Ramp down rather than cutting, so stopping never clicks.
        voiceGain.gain.setValueAtTime(voiceGain.gain.value, bus.ctx.currentTime);
        voiceGain.gain.linearRampToValueAtTime(0.0001, bus.ctx.currentTime + FADE_SEC);
        const dying = voiceGain;
        setTimeout(() => dying.disconnect(), FADE_SEC * 1000 + 120);
      } else {
        voiceGain.disconnect();
      }
      voiceGain = null;
    }
    track = null;
    currentId = null;
  };

  return {
    play(id) {
      if (currentId === id) return; // already playing — do not restart the phrase
      const next = tracks.get(id);
      if (!next) throw new Error(`music: unknown track "${id}"`);
      stopNow();
      currentId = id;
      const bus = getAudioBus();
      if (!bus) return; // headless: the id is recorded, nothing sounds
      track = next;
      voiceGain = bus.ctx.createGain();
      voiceGain.gain.setValueAtTime(0.0001, bus.ctx.currentTime);
      voiceGain.gain.linearRampToValueAtTime(1, bus.ctx.currentTime + FADE_SEC);
      voiceGain.connect(bus.master);
      nextStep = 0;
      nextTime = bus.ctx.currentTime + 0.06;
      schedule();
      timer = setInterval(schedule, SCHEDULE_TICK_MS);
    },
    stop: stopNow,
    current: () => currentId,
  };
}
