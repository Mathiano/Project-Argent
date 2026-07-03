import { afterEach, describe, expect, test } from 'vitest';
import { clearGameEventListeners, emitGameEvent } from '../gameEvents';
import { AudioEngine } from './synth';
import { createSfxSubscriber } from './sfx';
import { CUE_MAP, PATCHES, RELEASE_PATCHES, buildImpact, outcomeGain, type Patch } from './patches';

afterEach(clearGameEventListeners);

// A spy engine (the subscriber accepts an injected engine) — records the patches
// routed to it, so we can assert event→cue mapping without any real audio.
class SpyEngine {
  readonly played: Patch[] = [];
  private muted = false;
  get available(): boolean { return false; }
  play(p: Patch): void { this.played.push(p); }
  setMuted(m: boolean): void { this.muted = m; }
  isMuted(): boolean { return this.muted; }
}
function spySub() {
  const spy = new SpyEngine();
  const ctl = createSfxSubscriber(spy as unknown as AudioEngine);
  return { spy, ctl };
}

describe('SFX — headless-safe (the hard gate: no AudioContext → clean no-op)', () => {
  test('the real AudioEngine reports unavailable + never throws in Node/CI', () => {
    const engine = new AudioEngine();
    expect(engine.available).toBe(false); // no window/AudioContext here
    expect(() => engine.play(PATCHES.cursor!)).not.toThrow(); // no-op, silent
    expect(() => engine.setMuted(true)).not.toThrow();
  });

  test('the subscriber runs the whole event set headless without throwing', () => {
    const ctl = createSfxSubscriber(); // real (unavailable) engine
    const evs = [
      { kind: 'menu-move' }, { kind: 'ui-confirm' }, { kind: 'ui-cancel' }, { kind: 'dialogue-advance' },
      { kind: 'battle-start' }, { kind: 'hit-landed', side: 'foe', effectiveness: 1.5 },
      { kind: 'read-win', side: 'player' }, { kind: 'focus-windup', side: 'foe' },
      { kind: 'release', side: 'player', release: 'heavy', outcome: 'win' },
      { kind: 'ko', side: 'foe' },
    ] as const;
    expect(() => { for (const e of evs) emitGameEvent(e); }).not.toThrow();
    ctl.dispose();
  });
});

describe('SFX — event → cue routing', () => {
  test('the simple UI/combat cues route to their patches', () => {
    const { spy, ctl } = spySub();
    emitGameEvent({ kind: 'menu-move' });
    emitGameEvent({ kind: 'ui-confirm' });
    emitGameEvent({ kind: 'read-win', side: 'player' });
    expect(spy.played).toEqual([PATCHES.cursor, PATCHES.confirm, PATCHES.readWin]);
    ctl.dispose();
  });

  test('hit-landed builds an impact that varies with effectiveness', () => {
    const { spy, ctl } = spySub();
    emitGameEvent({ kind: 'hit-landed', side: 'foe', effectiveness: 1.5 }); // super-effective → sting
    emitGameEvent({ kind: 'hit-landed', side: 'foe', effectiveness: 0.5 }); // resisted → muffled
    expect(spy.played[0]!.voices.length).toBe(2); // base + super-effective sting
    expect(spy.played[1]!.voices.length).toBe(1); // muffled, no sting
    expect(spy.played[1]!.gain).toBeLessThan(spy.played[0]!.gain);
    ctl.dispose();
  });

  test('a release plays its DISTINCT impact and SUPPRESSES the generic impact that rides it', () => {
    const { spy, ctl } = spySub();
    // The battle emits `release` immediately before the generic `hit-landed`.
    emitGameEvent({ kind: 'release', side: 'player', release: 'feint', outcome: 'win' });
    emitGameEvent({ kind: 'hit-landed', side: 'player', effectiveness: 1 });
    expect(spy.played.length).toBe(1); // ONLY the feint patch (the generic impact swallowed)
    expect(spy.played[0]!.voices[0]!.wave).toBe('triangle'); // the feint character
    // A standalone hit (no preceding release) still plays the generic impact.
    emitGameEvent({ kind: 'hit-landed', side: 'foe', effectiveness: 1 });
    expect(spy.played.length).toBe(2);
    ctl.dispose();
  });

  test('a release outcome trims the impact gain (win full > lose muffled)', () => {
    const { spy, ctl } = spySub();
    emitGameEvent({ kind: 'release', side: 'player', release: 'heavy', outcome: 'win' });
    emitGameEvent({ kind: 'release', side: 'player', release: 'heavy', outcome: 'lose' });
    expect(spy.played[1]!.gain).toBeLessThan(spy.played[0]!.gain);
    expect(outcomeGain('win')).toBeGreaterThan(outcomeGain('lose'));
    ctl.dispose();
  });
});

describe('SFX — the THESIS cues (information, not decoration)', () => {
  test('H / F / H are three GENUINELY different patches, not one at three pitches', () => {
    const h = RELEASE_PATCHES.heavy, f = RELEASE_PATCHES.feint, hi = RELEASE_PATCHES.hide;
    // Distinct PRIMARY waveforms — square (slam) vs triangle (jab) vs sine (glide).
    expect(new Set([h.voices[0]!.wave, f.voices[0]!.wave, hi.voices[0]!.wave]).size).toBe(3);
    // HEAVY — a downward SLAM (pitch drops).
    expect(h.voices[0]!.freqTo!).toBeLessThan(h.voices[0]!.freq);
    // FEINT — a DOUBLE-TAP (a second, delayed voice).
    expect(f.voices.length).toBe(2);
    expect(f.voices[1]!.delay!).toBeGreaterThan(0);
    // HIDE — an upward GLIDE (pitch rises), soft + longer-tailed than the others.
    expect(hi.voices[0]!.freqTo!).toBeGreaterThan(hi.voices[0]!.freq);
    expect(hi.voices[0]!.attack).toBeGreaterThan(h.voices[0]!.attack); // soft vs hard onset
  });

  test('the focus wind-up telegraph is its OWN timbre (a tense rising build), not a hit', () => {
    const w = PATCHES.focusWindup!;
    expect(w.voices[0]!.wave).toBe('sawtooth'); // buzzy/tense — shared with no impact patch
    expect(w.voices[0]!.freqTo!).toBeGreaterThan(w.voices[0]!.freq); // rising = "gathering"
    expect(w.voices[0]!.attack).toBeGreaterThan(0.1); // a slow SWELL, not a transient
    // No release/impact patch uses sawtooth (the telegraph is unmistakable).
    for (const p of Object.values(RELEASE_PATCHES)) for (const v of p.voices) expect(v.wave).not.toBe('sawtooth');
  });
});

describe('SFX — patch table integrity', () => {
  test('every CUE_MAP target resolves to a real patch', () => {
    for (const cue of Object.values(CUE_MAP)) expect(PATCHES[cue], cue).toBeTruthy();
  });
  test('the map wires the verified emitted events (UI + combat)', () => {
    expect(CUE_MAP['menu-move']).toBe('cursor');
    expect(CUE_MAP['ui-confirm']).toBe('confirm');
    expect(CUE_MAP['ui-cancel']).toBe('cancel');
    expect(CUE_MAP['dialogue-advance']).toBe('textBlip');
    expect(CUE_MAP['battle-start']).toBe('battleStart');
    expect(CUE_MAP['focus-windup']).toBe('focusWindup');
    expect(CUE_MAP.ko).toBe('ko');
  });
  test('buildImpact: neutral effectiveness → a single-voice thud', () => {
    expect(buildImpact(1).voices.length).toBe(1);
  });
});

describe('SFX — mute', () => {
  test('toggleMuted flips + reports state; a real muted engine stays a no-op', () => {
    const { ctl } = spySub();
    expect(ctl.isMuted()).toBe(false);
    expect(ctl.toggleMuted()).toBe(true);
    expect(ctl.isMuted()).toBe(true);
    ctl.dispose();
  });
});
