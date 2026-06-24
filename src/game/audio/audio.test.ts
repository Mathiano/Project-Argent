// First-audio-slice tests: the synth palette (validity + the information-bearing
// design intent), the event→sound mapping, the mute gating, and the bus wiring.
// Audio OUTPUT isn't headlessly testable (no Web Audio in node) — that needs a
// manual `npm run dev` ear-check; here we pin everything around the actual playback.

import { afterEach, describe, expect, test } from 'vitest';
import { SOUNDS } from './sounds';
import type { SoundName, ToneSpec } from './sounds';
import { createAudioEngine } from './synth';
import type { AudioEngine } from './synth';
import { eventToSound, installAudio } from './audioSubscriber';
import { clearGameEventListeners, emitGameEvent } from '../gameEvents';
import type { GameEvent } from '../gameEvents';

const NAMES = Object.keys(SOUNDS) as SoundName[];
const maxFreq = (specs: readonly ToneSpec[]) => Math.max(...specs.map((s) => Math.max(s.freq, s.sweepTo ?? s.freq)));
const peakGain = (specs: readonly ToneSpec[]) => Math.max(...specs.map((s) => s.gain));

describe('audio — the synth palette is well-formed + enhanced-retro', () => {
  test('every sound is a non-empty stack of valid tones (clean waveforms only — no sawtooth)', () => {
    for (const name of NAMES) {
      const specs = SOUNDS[name];
      expect(specs.length).toBeGreaterThan(0);
      for (const s of specs) {
        expect(['sine', 'triangle', 'square']).toContain(s.type); // register discipline
        expect(s.freq).toBeGreaterThan(0);
        expect(s.dur).toBeGreaterThan(0);
        expect(s.attack).toBeGreaterThanOrEqual(0);
        expect(s.release).toBeGreaterThanOrEqual(0);
        expect(s.gain).toBeGreaterThan(0);
        expect(s.gain).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe('audio — combat cues carry information (distinguishable by ear)', () => {
  test('super-effective is BRIGHTER + richer than a neutral impact (the type-read)', () => {
    expect(maxFreq(SOUNDS.superEffective)).toBeGreaterThan(maxFreq(SOUNDS.impact)); // bright sting on top
    expect(SOUNDS.superEffective.length).toBeGreaterThan(SOUNDS.impact.length); // extra accent layer
  });
  test('a resisted hit is DULLER (quieter) than a neutral impact', () => {
    expect(peakGain(SOUNDS.impactResisted)).toBeLessThan(peakGain(SOUNDS.impact));
  });
  test('the KO cue falls (descending sweep) — it reads as final', () => {
    expect(SOUNDS.ko.every((s) => s.sweepTo !== undefined && s.sweepTo < s.freq)).toBe(true);
  });
});

describe('audio — eventToSound maps the REAL emitting events', () => {
  test('UI: menu-move → cursor, stance-selected → confirm', () => {
    expect(eventToSound({ kind: 'menu-move' })).toBe('cursorMove');
    expect(eventToSound({ kind: 'stance-selected', stance: 'A' })).toBe('confirm');
  });
  test('combat: hit effectiveness picks impact / resisted / super-effective; ko → ko', () => {
    expect(eventToSound({ kind: 'hit-landed', side: 'foe', effectiveness: 1 })).toBe('impact');
    expect(eventToSound({ kind: 'hit-landed', side: 'foe', effectiveness: 0.7 })).toBe('impactResisted');
    expect(eventToSound({ kind: 'hit-landed', side: 'foe', effectiveness: 1.3 })).toBe('superEffective');
    expect(eventToSound({ kind: 'ko', side: 'foe' })).toBe('ko');
  });
  test('events out of this slice (or reserved-not-emitting) map to no sound', () => {
    const silent: GameEvent[] = [
      { kind: 'battle-start' },
      { kind: 'battle-end', winner: 'player' },
      { kind: 'move-resolved', side: 'player', move: 'TACKLE' },
      { kind: 'catch-attempt' },
      { kind: 'catch-success' },
      { kind: 'evolve', species: 'KINDRAKE' },
      { kind: 'bond-stage-cross', species: 'KINDRAKE', fromStage: 1, toStage: 2 },
      { kind: 'catch-wiggle', index: 0 }, // reserved-not-emitting
      { kind: 'status-applied', side: 'foe', status: 'burn' }, // reserved
      { kind: 'level' }, // reserved
    ];
    for (const e of silent) expect(eventToSound(e)).toBeNull();
  });
});

// A recording engine + a recording tone, so the mute gating + bus wiring are
// testable without Web Audio.
function recordingEngine(): AudioEngine & { played: SoundName[] } {
  const played: SoundName[] = [];
  let muted = false;
  return {
    played,
    play(n) {
      if (!muted) played.push(n);
    },
    setMuted(m) {
      muted = m;
    },
    isMuted() {
      return muted;
    },
  };
}

describe('audio — the mute toggle gates output', () => {
  test('createAudioEngine(): muted plays nothing; unmuted schedules every layered tone', () => {
    const calls: ToneSpec[] = [];
    let backendMuted = false;
    const engine = createAudioEngine({ tone: (s) => calls.push(s), setMuted: (m) => (backendMuted = m) });

    engine.play('superEffective'); // 3 layered tones
    expect(calls.length).toBe(SOUNDS.superEffective.length);

    engine.setMuted(true);
    expect(engine.isMuted()).toBe(true);
    expect(backendMuted).toBe(true); // mute also drives the (master-gain) backend
    const before = calls.length;
    engine.play('impact');
    expect(calls.length).toBe(before); // gated — nothing scheduled

    engine.setMuted(false);
    engine.play('cursorMove');
    expect(calls.length).toBe(before + SOUNDS.cursorMove.length); // resumes
  });

  test('createAudioEngine starts muted when asked', () => {
    const calls: ToneSpec[] = [];
    const engine = createAudioEngine({ tone: (s) => calls.push(s), muted: true });
    expect(engine.isMuted()).toBe(true);
    engine.play('ko');
    expect(calls.length).toBe(0);
  });
});

describe('audio — installAudio wires the bus to the engine', () => {
  afterEach(() => clearGameEventListeners());

  test('emitted events drive engine.play; non-wired events do not; unsubscribe stops it', () => {
    const engine = recordingEngine();
    const off = installAudio(engine);

    emitGameEvent({ kind: 'menu-move' });
    emitGameEvent({ kind: 'hit-landed', side: 'foe', effectiveness: 1.5 });
    emitGameEvent({ kind: 'battle-start' }); // out of slice → no sound
    expect(engine.played).toEqual(['cursorMove', 'superEffective']);

    off();
    emitGameEvent({ kind: 'ko', side: 'foe' });
    expect(engine.played).toEqual(['cursorMove', 'superEffective']); // unsubscribed
  });
});
