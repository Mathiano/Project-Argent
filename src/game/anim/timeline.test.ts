import { describe, expect, test } from 'vitest';
import {
  AnimRuntime,
  EASINGS,
  EASING_NAMES,
  buildDefs,
  parseAnimationDef,
  type AnimBinding,
} from './timeline';
import { BATTLE_ANIM_DEFS, BATTLE_ANIM_EVENT_MAP } from './battleAnim';

// A capturing binding — records every value set, for determinism/assertions.
function recorder(): AnimBinding & { readonly values: number[]; last(): number } {
  const values: number[] = [];
  return { values, set: (v) => values.push(v), last: () => values[values.length - 1] ?? NaN };
}

const OK_TRACK = { target: 'sprite', property: 'flashAlpha', from: 0, to: 1, durationFrames: 4, easing: 'easeOut' };

describe('timeline schema — validate + reject at load', () => {
  test('a valid def parses; totalFrames = the last frame any track ends', () => {
    const def = parseAnimationDef({
      id: 'battle.test',
      tracks: [
        { ...OK_TRACK, durationFrames: 4, delayFrames: 0 },
        { ...OK_TRACK, durationFrames: 9, delayFrames: 3 },
      ],
    });
    expect(def.id).toBe('battle.test');
    expect(def.tracks[0]!.channel).toBe('sprite.flashAlpha');
    expect(def.tracks[0]!.delayFrames).toBe(0); // default filled
    expect(def.totalFrames).toBe(12); // max(0+4, 3+9)
  });

  test('the FIVE-easing whitelist is exactly [linear, easeIn, easeOut, easeInOut, hold]', () => {
    expect([...EASING_NAMES].sort()).toEqual(['easeIn', 'easeInOut', 'easeOut', 'hold', 'linear']);
  });

  test('an easing outside the whitelist is REJECTED at load', () => {
    expect(() => parseAnimationDef({ id: 'battle.x', tracks: [{ ...OK_TRACK, easing: 'bounce' }] })).toThrow(/easing/);
    expect(() => parseAnimationDef({ id: 'battle.x', tracks: [{ ...OK_TRACK, easing: 'cubic-bezier' }] })).toThrow(/easing/);
  });

  test('a non-dot-namespaced id is rejected', () => {
    expect(() => parseAnimationDef({ id: 'hitFlash', tracks: [OK_TRACK] })).toThrow(/dot-namespaced/);
  });

  test('the optional side is validated: player/foe accepted, anything else rejected', () => {
    expect(parseAnimationDef({ id: 'battle.x', tracks: [{ ...OK_TRACK, side: 'foe' }] }).tracks[0]!.side).toBe('foe');
    expect(parseAnimationDef({ id: 'battle.x', tracks: [OK_TRACK] }).tracks[0]!.side).toBeUndefined(); // absent → subject
    expect(() => parseAnimationDef({ id: 'battle.x', tracks: [{ ...OK_TRACK, side: 'both' }] })).toThrow(/side/);
  });

  test('bad durations / delays are rejected', () => {
    expect(() => parseAnimationDef({ id: 'battle.x', tracks: [{ ...OK_TRACK, durationFrames: 0 }] })).toThrow(/durationFrames/);
    expect(() => parseAnimationDef({ id: 'battle.x', tracks: [{ ...OK_TRACK, durationFrames: 3.5 }] })).toThrow(/durationFrames/);
    expect(() => parseAnimationDef({ id: 'battle.x', tracks: [{ ...OK_TRACK, delayFrames: -1 }] })).toThrow(/delayFrames/);
  });

  test('empty tracks / duplicate ids are rejected', () => {
    expect(() => parseAnimationDef({ id: 'battle.x', tracks: [] })).toThrow(/tracks/);
    expect(() => buildDefs([{ id: 'battle.x', tracks: [OK_TRACK] }, { id: 'battle.x', tracks: [OK_TRACK] }])).toThrow(/duplicate/);
  });
});

describe('easing functions — endpoints + monotonicity', () => {
  test('all interpolating easings run 0→0 and 1→1', () => {
    for (const name of ['linear', 'easeIn', 'easeOut', 'easeInOut'] as const) {
      expect(EASINGS[name](0)).toBeCloseTo(0);
      expect(EASINGS[name](1)).toBeCloseTo(1);
    }
  });
  test('hold is a STEP: 0 until the end, 1 at completion', () => {
    expect(EASINGS.hold(0)).toBe(0);
    expect(EASINGS.hold(0.99)).toBe(0);
    expect(EASINGS.hold(1)).toBe(1);
  });
});

describe('the SHIPPED battle animations — schema + duration pins', () => {
  test('all four proof animations load + carry their ids', () => {
    expect([...BATTLE_ANIM_DEFS.keys()].sort()).toEqual([
      'battle.enterWipe', 'battle.hitFlash', 'battle.hpDrain', 'battle.starPop',
    ]);
  });
  test('durations are PINNED (a re-time is a deliberate, visible diff)', () => {
    expect(BATTLE_ANIM_DEFS.get('battle.hitFlash')!.totalFrames).toBe(12);
    expect(BATTLE_ANIM_DEFS.get('battle.hpDrain')!.totalFrames).toBe(16);
    expect(BATTLE_ANIM_DEFS.get('battle.starPop')!.totalFrames).toBe(12);
    expect(BATTLE_ANIM_DEFS.get('battle.enterWipe')!.totalFrames).toBe(36); // v2 CD entrance choreography
  });
  test('the three untouched proofs carry NO per-track side (backward-compatible)', () => {
    for (const id of ['battle.hitFlash', 'battle.hpDrain', 'battle.starPop'] as const) {
      for (const t of BATTLE_ANIM_DEFS.get(id)!.tracks) expect(t.side).toBeUndefined();
    }
  });
  test('the enterWipe v2 uses track-level side to choreograph BOTH panels/sprites', () => {
    const wipe = BATTLE_ANIM_DEFS.get('battle.enterWipe')!;
    const sides = new Set(wipe.tracks.map((t) => t.side).filter(Boolean));
    expect(sides).toEqual(new Set(['player', 'foe'])); // both sides addressed from a subject-less event
    // wipe/stage-global tracks keep NO side (drive the whole-screen overlay).
    expect(wipe.tracks.filter((t) => t.target === 'wipe').every((t) => t.side === undefined)).toBe(true);
  });
  test('the event→id map is DATA (wires the real emitted events)', () => {
    expect(BATTLE_ANIM_EVENT_MAP['hit-landed']).toEqual(['battle.hitFlash', 'battle.hpDrain']);
    expect(BATTLE_ANIM_EVENT_MAP['read-win']).toEqual(['battle.starPop']);
    expect(BATTLE_ANIM_EVENT_MAP['battle-start']).toEqual(['battle.enterWipe']);
  });
});

describe('AnimRuntime — playback, subjects, completion', () => {
  const defs = buildDefs([
    { id: 'battle.hitFlash', tracks: [{ target: 'sprite', property: 'flashAlpha', from: 0, to: 1, durationFrames: 4, easing: 'linear' }] },
  ]);
  const eventMap = { 'hit-landed': ['battle.hitFlash'] };

  test('play → the bound channel is driven from `from` to `to` over the duration', () => {
    const rt = new AnimRuntime(defs, eventMap);
    const rec = recorder();
    rt.register('sprite.flashAlpha', rec);
    rt.play('battle.hitFlash', 'foe');
    expect(rec.last()).toBeCloseTo(0); // frame 0
    rt.update(2 / 60); // +2 frames → linear halfway
    expect(rec.last()).toBeCloseTo(0.5);
    rt.update(2 / 60); // +2 → frame 4, done
    expect(rec.last()).toBeCloseTo(1);
    rt.update(1 / 60); // past the end → instance removed
    expect(rt.activeCount()).toBe(0);
  });

  test('trigger routes an event to its mapped id(s), carrying the subject', () => {
    const rt = new AnimRuntime(defs, eventMap);
    let seen: string | null = 'none';
    rt.register('sprite.flashAlpha', { set: (_v, s) => { seen = s; } });
    rt.trigger('hit-landed', 'player');
    expect(seen).toBe('player');
    rt.trigger('nonexistent-event', 'foe'); // unmapped → ignored
    expect(rt.isActive('battle.hitFlash', 'player')).toBe(true);
  });

  test('onStart fires once per channel at trigger time (the HP-drain capture hook)', () => {
    const rt = new AnimRuntime(defs, eventMap);
    let starts = 0;
    rt.register('sprite.flashAlpha', { set: () => {}, onStart: () => { starts += 1; } });
    rt.play('battle.hitFlash', 'foe');
    expect(starts).toBe(1);
  });

  test('a track-level side OVERRIDES the event subject (drives a fixed side)', () => {
    const sideDefs = buildDefs([{
      id: 'battle.entrance',
      tracks: [{ target: 'panel', property: 'offsetY', from: -44, to: 0, durationFrames: 4, easing: 'linear', side: 'player' }],
    }]);
    const rt = new AnimRuntime(sideDefs, {});
    let seenSide: string | null = 'unset';
    rt.register('panel.offsetY', { set: (_v, s) => { seenSide = s; } });
    rt.play('battle.entrance', 'foe'); // subject is FOE, but the track says player
    expect(seenSide).toBe('player');
  });
});

describe('deterministic playback (no RNG — identical dt sequence → identical output)', () => {
  test('two runs of every shipped animation produce bit-identical channel traces', () => {
    const run = (): string => {
      const rt = new AnimRuntime(BATTLE_ANIM_DEFS, BATTLE_ANIM_EVENT_MAP);
      const trace: number[] = [];
      for (const ch of ['sprite.flashAlpha', 'stage.shakeX', 'bar.hpProgress', 'star.scale', 'star.flashAlpha', 'wipe.alpha']) {
        rt.register(ch, { set: (v) => trace.push(Math.round(v * 1e6)) });
      }
      for (const id of BATTLE_ANIM_DEFS.keys()) rt.play(id, 'foe');
      for (let i = 0; i < 40; i += 1) rt.update(1 / 60);
      return trace.join(',');
    };
    expect(run()).toBe(run());
  });
});
