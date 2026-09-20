// The music layer: note parsing, track validation, the event→track mapping, and
// the headless contract (no Web Audio → nothing sounds, nothing throws).
import { describe, expect, test } from 'vitest';
import { buildTracks, createMusicPlayer, noteToFreq, parseTrack } from './music';
import { MUSIC_TRACKS, createMusic } from './tracks';
import { eventToTrack } from './musicSubscriber';

describe('noteToFreq', () => {
  test('A4 is the 440 anchor, and octaves double', () => {
    expect(noteToFreq('A4')).toBeCloseTo(440, 6);
    expect(noteToFreq('A5')).toBeCloseTo(880, 6);
    expect(noteToFreq('A3')).toBeCloseTo(220, 6);
  });
  test('accidentals move a semitone either way', () => {
    expect(noteToFreq('A#4')).toBeCloseTo(466.164, 2);
    expect(noteToFreq('Ab4')).toBeCloseTo(415.305, 2);
    expect(noteToFreq('Bb4')).toBeCloseTo(noteToFreq('A#4'), 6); // enharmonic
  });
  test('C4 is middle C', () => {
    expect(noteToFreq('C4')).toBeCloseTo(261.626, 2);
  });
  test('a typo throws rather than playing a wrong note nobody can place', () => {
    expect(() => noteToFreq('H4')).toThrow(/not a note/);
    expect(() => noteToFreq('C')).toThrow(/not a note/);
  });
});

describe('parseTrack', () => {
  const base = { id: 'music.t', bpm: 120, stepsPerBeat: 4, voices: [{ name: 'v', wave: 'square', gain: 0.1, steps: 'C4 - C4 -' }] };

  test('a rest is a step with no pitch, and timing is preserved', () => {
    const t = parseTrack(base);
    expect(t.voices[0]!.steps).toHaveLength(4);
    expect(t.voices[0]!.steps[1]!.freq).toBeNull();
    expect(t.totalSteps).toBe(4);
  });

  test("a RUN of '.' all reach back to the same note (not to each other)", () => {
    const t = parseTrack({ ...base, voices: [{ ...base.voices[0]!, steps: 'C4 . . -' }] });
    const s = t.voices[0]!.steps;
    expect(s[0]!.steps).toBe(3); // held across three steps
    expect(s[1]!.steps).toBe(0); // placeholders keep the grid aligned
    expect(s[2]!.steps).toBe(0);
    expect(s).toHaveLength(4); // still four steps of time
  });

  test('loop defaults on; a one-shot must say so', () => {
    expect(parseTrack(base).loop).toBe(true);
    expect(parseTrack({ ...base, loop: false }).loop).toBe(false);
  });

  test('bad data fails at LOAD, not at play time', () => {
    expect(() => parseTrack({ ...base, id: 'battle' })).toThrow(/dot-namespaced/);
    expect(() => parseTrack({ ...base, bpm: 0 })).toThrow(/bpm/);
    expect(() => parseTrack({ ...base, voices: [] })).toThrow(/voices/);
    expect(() => parseTrack({ ...base, voices: [{ ...base.voices[0]!, steps: '. C4' }] })).toThrow(/sustain/);
    expect(() => parseTrack({ ...base, voices: [{ ...base.voices[0]!, steps: 'C4 - .' }] })).toThrow(/sustain/); // a rest ends the phrase
    expect(() => parseTrack({ ...base, voices: [{ ...base.voices[0]!, steps: 'C4 X9' }] })).toThrow(/not a note/);
  });

  test('duplicate ids are rejected', () => {
    expect(() => buildTracks([base, base])).toThrow(/duplicate/);
  });
});

describe('the shipped tracks', () => {
  test('all three load and carry their ids', () => {
    expect([...MUSIC_TRACKS.keys()].sort()).toEqual(['music.battle', 'music.title', 'music.victory']);
  });
  test('victory is a BRIEF one-shot; the others loop', () => {
    expect(MUSIC_TRACKS.get('music.victory')!.loop).toBe(false);
    expect(MUSIC_TRACKS.get('music.battle')!.loop).toBe(true);
    expect(MUSIC_TRACKS.get('music.title')!.loop).toBe(true);
  });
  test('battle is faster than title — the mood map, in numbers', () => {
    expect(MUSIC_TRACKS.get('music.battle')!.bpm).toBeGreaterThan(MUSIC_TRACKS.get('music.title')!.bpm);
  });
});

describe('eventToTrack', () => {
  test('a battle starts the battle theme', () => {
    expect(eventToTrack({ kind: 'battle-start' })).toEqual({ kind: 'play', id: 'music.battle' });
  });
  test('a win earns the victory sting; a loss goes silent', () => {
    expect(eventToTrack({ kind: 'battle-end', winner: 'player' })).toEqual({ kind: 'play', id: 'music.victory' });
    expect(eventToTrack({ kind: 'battle-end', winner: 'foe' })).toEqual({ kind: 'stop' });
  });
  test('events that are not about framing leave the music alone', () => {
    expect(eventToTrack({ kind: 'menu-move' })).toBeNull();
    expect(eventToTrack({ kind: 'hit-landed', side: 'player', effectiveness: 1 })).toBeNull();
  });
});

describe('the player, headless (no Web Audio — the vitest path)', () => {
  test('play/stop track state without throwing or sounding', () => {
    const p = createMusic();
    expect(p.current()).toBeNull();
    p.play('music.battle');
    expect(p.current()).toBe('music.battle');
    p.stop();
    expect(p.current()).toBeNull();
  });
  test('replaying the CURRENT track is a no-op — an event that fires twice must not restart the phrase', () => {
    const p = createMusic();
    p.play('music.title');
    const before = p.current();
    p.play('music.title');
    expect(p.current()).toBe(before);
  });
  test('an unknown track id throws rather than failing silently', () => {
    expect(() => createMusicPlayer(MUSIC_TRACKS).play('music.nope')).toThrow(/unknown track/);
  });
});
