// Wild encounters must fire on grass, NOT on the path/road carved through a zone.
//
// Bug (playtest): the encounter check fired for any tile inside an encounter_zone
// RECTANGLE. The generator stamps grass then carves the winding path over it, so
// path cells bleed into the rect (e.g. zone (10,19 4x4): 12 tall_grass + 4 path) and
// triggered encounters as the player crossed the road between grass patches.
// Fix: gate the roll on the actual tile — skip path/road, keep grass + cave.

import { describe, expect, test } from 'vitest';
import { createOverworldScene } from './overworld';
import { getMap } from '../overworld/maps';
import type { InputKey } from '../scene';

// Pre-mark the §1 forced-entry robber (JAY, approachOnEnter) + the warning step-on
// so neither hijacks the encounter walk; matches encounterRng.test's setup.
function mockFlags() {
  const set = new Set<string>(['route31_trainer_beaten', 'route31_warning']);
  return { has: (f: string) => set.has(f), set: (f: string) => set.add(f), unset: (f: string) => set.delete(f) };
}
function mockInput() {
  const held = new Set<InputKey>();
  return { pressed: (k: InputKey) => held.has(k), press: (k: InputKey) => held.add(k), release: (k: InputKey) => held.delete(k), releaseAll: () => held.clear() };
}
type Scene = ReturnType<typeof createOverworldScene>;
function walkDown(scene: Scene, input: ReturnType<typeof mockInput>): void {
  const start = scene.currentPosition();
  input.press('down');
  for (let i = 0; i < 30; i += 1) {
    scene.update?.(0.02);
    const p = scene.currentPosition();
    if (p.x !== start.x || p.y !== start.y) break;
  }
  input.release('down');
  for (let i = 0; i < 12; i += 1) scene.update?.(0.02);
}

// Walk straight down `steps` tiles from (startX,startY), random pinned to 0 so any
// in-zone GRASS step is a guaranteed encounter (rate>0); count encounters fired.
function countEncounters(startX: number, startY: number, steps: number): number {
  const input = mockInput();
  let n = 0;
  const scene = createOverworldScene({
    map: 'ROUTE31',
    spawn: 'default',
    spawnAt: { x: startX, y: startY, facing: 'down' },
    inputState: input,
    flags: mockFlags(),
    random: () => 0, // always below any zone rate ⇒ grass always rolls a hit
    onWarp: () => {},
    onEncounter: () => { n += 1; },
    onTrainerBattle: () => {},
    onBossBattle: () => {},
  });
  for (let i = 0; i < steps; i += 1) walkDown(scene, input);
  return n;
}

describe('Route 31 encounters — fire on grass, not on the path between patches', () => {
  const map = getMap('ROUTE31');
  const idAt = (x: number, y: number) => map.cells![y]![x];

  test('the zone (10,19 4x4) genuinely straddles grass AND path (the bug surface)', () => {
    // col 11 = tall_grass, col 10 = the carved path band — both inside the zone rect.
    expect(idAt(11, 20)).toBe('tall_grass');
    expect(idAt(10, 20)).toBe('path');
    const zone = map.objects.find(
      (o) => o.type === 'encounter_zone' && o.x === 10 && o.y === 19,
    );
    expect(zone).toBeDefined();
  });

  test('GRASS column (11): encounters fire every step', () => {
    // (11,19)→(11,22): three landings, all tall_grass, all in-zone.
    expect(countEncounters(11, 19, 3)).toBe(3);
  });

  test('PATH column (10): the road through the zone is encounter-free', () => {
    // (10,19)→(10,22): three landings, all the carved path inside the SAME rect.
    expect(countEncounters(10, 19, 3)).toBe(0);
  });

  test('the cave-mouth zone still fires (fix excludes only path, not all non-grass)', () => {
    // zone (17,24 2x3) is pure cave_mouth — an intended non-grass encounter.
    expect(idAt(17, 24)).toBe('cave_mouth');
    expect(countEncounters(17, 24, 2)).toBeGreaterThan(0);
  });
});
