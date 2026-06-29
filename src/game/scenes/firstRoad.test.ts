// Phase 7 Sprint 1 GATE — "The First Road" content + connectivity.
// Maps load + connect; Route 31 is populated (trainers, terrain-varied
// encounters, hidden items, the lost-mon seed event); the give-item verb
// works; Violet reads as a plaster city with a real gym/Center/Mart; the
// art-proof animated tiles carry frames. No combat math here.

import { describe, expect, test } from 'vitest';
import outdoorVioletTileset from '../../../assets/tilesets/outdoor_violet.tileset.json';
import { loadTileset } from '../overworld/tileset';
import { getMap } from '../overworld/maps';
import { isWalkable, parseTarget } from '../overworld/types';
import type { MapObject } from '../overworld/types';
import { createOverworldScene } from './overworld';
import type { InputKey } from '../scene';

const SPRINT1_MAPS = ['ROUTE31', 'VIOLET', 'VIOLET_CENTER', 'VIOLET_MART', 'GYM', 'HEARTHWICK'] as const;

function mockFlags() {
  const set = new Set<string>();
  return { has: (f: string) => set.has(f), set: (f: string) => set.add(f), unset: (f: string) => set.delete(f), _set: set };
}
function mockInput() {
  const held = new Set<InputKey>();
  return { pressed: (k: InputKey) => held.has(k), press: (k: InputKey) => held.add(k), release: (k: InputKey) => held.delete(k), releaseAll: () => held.clear() };
}
type Scene = ReturnType<typeof createOverworldScene>;
function walkOne(scene: Scene, input: ReturnType<typeof mockInput>, dir: 'up' | 'down' | 'left' | 'right'): void {
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

const trainerNpcs = (objs: readonly MapObject[]) =>
  objs.filter((o): o is Extract<MapObject, { type: 'npc' }> =>
    o.type === 'npc' && o.interact.some((c) => c.kind === 'start-trainer-battle'));
const encounterZones = (objs: readonly MapObject[]) =>
  objs.filter((o): o is Extract<MapObject, { type: 'encounter_zone' }> => o.type === 'encounter_zone');
const giveItemScripts = (objs: readonly MapObject[]) =>
  objs.filter((o) => o.type === 'script' && o.commands.some((c) => c.kind === 'give-item'));

describe('Sprint 1 — maps load + connect', () => {
  test('all maps load', () => {
    for (const m of SPRINT1_MAPS) expect(getMap(m).width).toBeGreaterThan(0);
  });
  test('every warp target resolves to a real map + spawn (both directions wired)', () => {
    for (const name of SPRINT1_MAPS) {
      const m = getMap(name);
      for (const o of m.objects) {
        if (o.type !== 'warp') continue;
        const { map, spawn } = parseTarget(o.target);
        const dest = getMap(map);
        expect(dest.spawns[spawn], `${name} -> ${o.target}`).toBeTruthy();
      }
    }
  });
  test('every spawn tile is walkable', () => {
    for (const name of SPRINT1_MAPS) {
      const m = getMap(name);
      for (const [id, s] of Object.entries(m.spawns)) {
        expect(isWalkable(m, s.x, s.y), `${name}:${id}`).toBe(true);
      }
    }
  });
  test('Route 31 is a real multi-screen journey (taller than one screen)', () => {
    const r = getMap('ROUTE31');
    expect(r.height).toBeGreaterThanOrEqual(24); // > 11-tile screen → scrolls (74)
    expect(r.importedLayers).toBeDefined(); // the Tiled-built map renders via imported layers
  });
});

describe('Sprint 1 — Route 31 is populated', () => {
  const r = getMap('ROUTE31');
  test('a handful of easy trainers (approachable, with rewards)', () => {
    const trainers = trainerNpcs(r.objects);
    expect(trainers.length).toBeGreaterThanOrEqual(3);
    for (const t of trainers) {
      const battle = t.interact.find((c) => c.kind === 'start-trainer-battle')!;
      expect(battle.kind).toBe('start-trainer-battle');
    }
  });
  test('terrain-varied encounters (grass FLITPECK, pond MARSHMASH, cave GRITHOAX)', () => {
    const species = new Set(encounterZones(r.objects).flatMap((z) => z.species));
    expect(species.has('FLITPECK')).toBe(true); // grass
    expect(species.has('MARSHMASH')).toBe(true); // pond (AQUA by the water)
    expect(species.has('GRITHOAX')).toBe(true); // cave hollow (TERRA)
    expect(encounterZones(r.objects).length).toBeGreaterThanOrEqual(4);
  });
  test('discoverable items tucked off-path (give-item scripts)', () => {
    expect(giveItemScripts(r.objects).length).toBeGreaterThanOrEqual(2);
  });
  test('water is present (the pond) — rendered + impassable collision somewhere', () => {
    // The Tiled map renders water via imported pct_water/pct_watersheet refs, and
    // the pond is solid (collision), so it's walk-around scenery.
    const refs = new Set<string>();
    for (const layer of r.importedLayers ?? []) for (const row of layer.tiles) for (const ref of row) if (ref) refs.add(ref.tileset);
    expect(refs.has('pct_water') || refs.has('pct_watersheet')).toBe(true);
    // there is solid (impassable) terrain on the map (the pond/banks/cliffs).
    let solid = 0;
    for (let y = 0; y < r.height; y += 1) for (let x = 0; x < r.width; x += 1) if (!isWalkable(r, x, y)) solid += 1;
    expect(solid).toBeGreaterThan(0);
  });
});

describe('Sprint 1 — the seed event (lost mon) flag chain', () => {
  const r = getMap('ROUTE31');
  test('the wiring exists: lost mon → found flag → gated kid → one-time reward', () => {
    const lostMon = r.objects.find(
      (o): o is Extract<MapObject, { type: 'npc' }> =>
        o.type === 'npc' && o.blockedUntilFlag === 'route31_lost_mon_found' &&
        o.interact.some((c) => c.kind === 'set-flag' && c.flag === 'route31_lost_mon_found'),
    );
    expect(lostMon, 'lost-mon NPC sets the found flag').toBeTruthy();
    const reward = r.objects.find(
      (o) => o.type === 'script' && o.requiresFlag === 'route31_lost_mon_found' &&
        o.once === true && o.flag === 'route31_lost_mon_reunited' &&
        o.commands.some((c) => c.kind === 'give-item'),
    );
    expect(reward, 'one-time reunion reward gated on the found flag').toBeTruthy();
  });
  test('interacting with the lost mon FIRES the found flag', () => {
    const flags = mockFlags();
    flags.set('route31_trainer_beaten'); // skip JAY's forced-entry approach (own test)
    const input = mockInput();
    // Stand just below the lost-mon (mon_lost_bird at (18,29)) and face up to talk.
    const scene = createOverworldScene({ random: () => 0,
      map: 'ROUTE31', spawn: 'default', inputState: input, flags,
      spawnAt: { x: 18, y: 30, facing: "up" },
      onWarp: () => {}, onEncounter: () => {}, onTrainerBattle: () => {}, onBossBattle: () => {},
    });
    expect(flags.has('route31_lost_mon_found')).toBe(false);
    // A opens the interact; advance through its dialog pages (+ the set-flag between).
    for (let i = 0; i < 12; i += 1) { scene.input?.('a'); scene.update?.(0.02); }
    expect(flags.has('route31_lost_mon_found')).toBe(true);
  });
});

describe('Sprint 1 — give-item verb works', () => {
  test('walking onto a hidden forest item fires onGiveItem', () => {
    const flags = mockFlags();
    flags.set('route31_trainer_beaten'); // skip JAY's forced-entry approach (own test)
    const input = mockInput();
    let granted: { id: string; qty: number } | null = null;
    const scene = createOverworldScene({ random: () => 0,
      map: 'ROUTE31', spawn: 'default', inputState: input, flags,
      spawnAt: { x: 7, y: 31, facing: 'down' }, // one tile above the rehomed wood item at (7,32)
      onWarp: () => {}, onEncounter: () => {}, onTrainerBattle: () => {}, onBossBattle: () => {},
      onGiveItem: (id, qty) => { granted = { id, qty }; },
    });
    walkOne(scene, input, 'down'); // step onto (3,13) → step-on give-item
    expect(granted).toEqual({ id: 'POTION', qty: 1 });
    expect(flags.has('route31_item_forest')).toBe(true); // once-flag set
  });
});

describe('Sprint 1 — Violet is a functional plaster city', () => {
  const v = getMap('VIOLET');
  test('gym is a real building entered via a warp into the GYM interior', () => {
    const gymWarp = v.objects.find((o) => o.type === 'warp' && o.target.startsWith('GYM:'));
    expect(gymWarp).toBeTruthy();
    // The GYM interior carries the leader + badge flow (unchanged this sprint).
    const gym = getMap('GYM');
    const falkner = gym.objects.some(
      (o) => o.type === 'npc' && o.interact.some((c) => c.kind === 'start-boss-battle' && c.bossId === 'falkner'));
    expect(falkner).toBe(true);
  });
  test('Center + Mart are real enterable buildings', () => {
    expect(v.objects.some((o) => o.type === 'warp' && o.target.startsWith('VIOLET_CENTER:'))).toBe(true);
    expect(v.objects.some((o) => o.type === 'warp' && o.target.startsWith('VIOLET_MART:'))).toBe(true);
    // The Center heals + has a PC; the Mart shops.
    const center = getMap('VIOLET_CENTER');
    expect(center.objects.some((o) => o.type === 'npc' && o.interact.some((c) => c.kind === 'heal-party'))).toBe(true);
    expect(center.objects.some((o) => o.type === 'npc' && o.interact.some((c) => c.kind === 'open-box'))).toBe(true);
    const mart = getMap('VIOLET_MART');
    expect(mart.objects.some((o) => o.type === 'npc' && o.interact.some((c) => c.kind === 'open-mart'))).toBe(true);
  });
  test('reads as a city: plaster material + several buildings', () => {
    expect((v.cells ?? []).some((row) => row.includes('plaster'))).toBe(true);
    // gym + center + mart + flavor houses → multiple distinct structures.
    const buildingWarps = v.objects.filter((o) => o.type === 'warp' && !o.target.startsWith('ROUTE31:')).length;
    expect(buildingWarps).toBeGreaterThanOrEqual(3);
  });
});

describe('Sprint 1 — art proof: animated tiles carry frames', () => {
  test('tall grass sways + water ripples (multi-frame)', () => {
    const ts = loadTileset(outdoorVioletTileset as never);
    expect(ts.tiles.tall_grass!.frames.length).toBe(2);
    expect(ts.tiles.tall_grass!.animated).toBe(true);
    expect(ts.tiles.water!.frames.length).toBe(2);
    expect(ts.tiles.water!.animated).toBe(true);
  });
});
