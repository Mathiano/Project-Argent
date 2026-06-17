// risks/gaps #2 — the overworld encounter roll now runs through an
// injectable SEEDED rng (was raw Math.random). A fixed seed must produce a
// reproducible encounter sequence (deterministic + testable, consistent
// with the combat engine) — while still feeling random to the player.

import { describe, expect, test } from 'vitest';
import { mulberry32 } from '../../engine';
import { createOverworldScene } from './overworld';
import type { InputKey } from '../scene';

function mockFlags() {
  const set = new Set<string>();
  return { has: (f: string) => set.has(f), set: (f: string) => set.add(f), unset: (f: string) => set.delete(f) };
}
function mockInput() {
  const held = new Set<InputKey>();
  return { pressed: (k: InputKey) => held.has(k), press: (k: InputKey) => held.add(k), release: (k: InputKey) => held.delete(k), releaseAll: () => held.clear() };
}
type Scene = ReturnType<typeof createOverworldScene>;
function walkOne(scene: Scene, input: ReturnType<typeof mockInput>, dir: 'up' | 'down'): void {
  const start = scene.currentPosition();
  input.press(dir);
  for (let i = 0; i < 30; i += 1) {
    scene.update?.(0.02);
    const p = scene.currentPosition();
    if (p.x !== start.x || p.y !== start.y) break;
  }
  input.release(dir);
  for (let i = 0; i < 12; i += 1) scene.update?.(0.02);
}

// Walk a fixed bounce pattern inside ROUTE31's left grass encounter zone
// (cols 2-3, rows 5-9 — FLITPECK @ rate 0.18) and record the per-step
// encounter outcome. Same seed → same record.
function runWalk(seed: number): string[] {
  const rng = mulberry32(seed);
  const input = mockInput();
  const seq: string[] = [];
  let lastLen = 0;
  const scene = createOverworldScene({
    map: 'ROUTE31',
    spawn: 'default',
    spawnAt: { x: 2, y: 5, facing: 'down' },
    inputState: input,
    flags: mockFlags(),
    random: () => rng.next(),
    onWarp: () => {},
    onEncounter: (sp) => seq.push(sp),
    onTrainerBattle: () => {},
    onBossBattle: () => {},
  });
  // 16 steps, bouncing between rows 5 and 9 (all in-zone, all walkable).
  const pattern: Array<'up' | 'down'> = [];
  for (let b = 0; b < 2; b += 1) { for (let i = 0; i < 4; i += 1) pattern.push('down'); for (let i = 0; i < 4; i += 1) pattern.push('up'); }
  const record: string[] = [];
  for (const dir of pattern) {
    walkOne(scene, input, dir);
    record.push(seq.length > lastLen ? seq[seq.length - 1]! : '-');
    lastLen = seq.length;
  }
  return record;
}

describe('overworld encounter RNG is seeded (reproducible)', () => {
  test('the same seed yields the identical encounter sequence', () => {
    const a = runWalk(0x1234);
    const b = runWalk(0x1234);
    expect(a).toEqual(b); // deterministic
    expect(a.some((x) => x !== '-')).toBe(true); // the walk actually rolled some encounters
  });

  test('different seeds yield different sequences (it is actually seeded, not constant)', () => {
    const a = runWalk(0x1111);
    const b = runWalk(0x9999);
    expect(a).not.toEqual(b);
  });

  test('every rolled encounter is the zone species (FLITPECK)', () => {
    const rolled = runWalk(0x1234).filter((x) => x !== '-');
    for (const sp of rolled) expect(sp).toBe('FLITPECK');
  });
});
