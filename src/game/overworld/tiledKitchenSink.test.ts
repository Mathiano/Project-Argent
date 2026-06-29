// Kitchen-sink map: EVERY pipeline feature at once (collision + 3 NPCs incl. a
// trainer + 2 warps + 2 spawns + 4 encounter zones) imports + wires with all
// features resolving and no unexpected warnings — the full-pipeline proof before
// the Route 31 migration.
import { describe, expect, test } from 'vitest';
import { importTiledMap, defaultResolveSheet } from './tiledImport';
import type { TiledMapJson } from './tiledImport';
import { wireImportedMap } from './tiledWiring';
import { isWalkable, findObjectAt } from './types';
import type { MapObject } from './types';
import kitchenTmj from '../maps/tiled/test-map-kitchen-sink.tmj.json';
import pctGrass from '../../../assets/tilesets/pct_grass.tileset.json';
import pctPath02 from '../../../assets/tilesets/pct_path02.tileset.json';
import pctHills from '../../../assets/tilesets/pct_hills.tileset.json';
import pctBushanim from '../../../assets/tilesets/pct_bushanim.tileset.json';
import pctTrees from '../../../assets/tilesets/pct_trees.tileset.json';

const RAW: Record<string, { tiles: Record<string, unknown> }> = {
  pct_grass: pctGrass as never, pct_path02: pctPath02 as never, pct_hills: pctHills as never,
  pct_bushanim: pctBushanim as never, pct_trees: pctTrees as never,
};
const imported = importTiledMap(kitchenTmj as unknown as TiledMapJson, {
  name: 'KITCHEN SINK',
  resolveSheet: defaultResolveSheet,
  tileExists: (pct, key) => RAW[pct]?.tiles[key] !== undefined,
});
const wired = wireImportedMap(imported.map);
const objs = wired.map.objects;
const byType = (t: MapObject['type']) => objs.filter((o) => o.type === t);

describe('kitchen-sink map — full pipeline, all features coexist', () => {
  test('imports + wires with NO unexpected warnings', () => {
    expect(imported.warnings).toEqual([]); // every visual GID resolves
    expect(wired.warnings).toEqual([]); // every marker has a def
  });

  test('COLLISION: the Collision layer (capital C) is read and blocks movement', () => {
    expect(imported.stats.collisionLayers).toBe(1); // "Collision" detected (case-insensitive)
    expect(imported.stats.collisionCells).toBeGreaterThan(0);
    // at least one in-bounds cell is solid (a wall), and at least one is walkable.
    let solid = 0, open = 0;
    for (let y = 0; y < wired.map.height; y += 1)
      for (let x = 0; x < wired.map.width; x += 1) (isWalkable(wired.map, x, y) ? open++ : solid++);
    expect(solid).toBeGreaterThan(0);
    expect(open).toBeGreaterThan(0);
  });

  test('LAYERS: 2 visual layers preserved (Collision excluded from render)', () => {
    expect(imported.stats.tileLayers).toBe(2); // Floor + Over-props
  });

  test('NPCs: all 3 wire; npc_trainer_1 carries a real trainer battle', () => {
    const npcs = byType('npc') as Array<Extract<MapObject, { type: 'npc' }>>;
    expect(npcs).toHaveLength(3);
    const trainer = npcs.find((n) => n.interact.some((c) => c.kind === 'start-trainer-battle'));
    expect(trainer).toBeDefined();
    const battle = trainer!.interact.find((c) => c.kind === 'start-trainer-battle') as
      | { foeSpecies: unknown; winFlag: unknown }
      | undefined;
    expect(battle?.foeSpecies).toBeTruthy();
    expect(battle?.winFlag).toBeTruthy();
    // the other two are dialogue NPCs (no battle)
    expect(npcs.filter((n) => n.interact.every((c) => c.kind !== 'start-trainer-battle'))).toHaveLength(2);
  });

  test('WARPS: both resolve to their (def-supplied) targets', () => {
    const warps = byType('warp') as Array<Extract<MapObject, { type: 'warp' }>>;
    expect(warps).toHaveLength(2);
    const targets = warps.map((w) => w.target).sort();
    expect(targets).toEqual(['HEARTHWICK:fromRoute', 'VIOLET:fromRoute']);
  });

  test('ENCOUNTERS: 4 zones, route31a/route31b get DISTINCT species/rate', () => {
    const zones = byType('encounter_zone') as Array<Extract<MapObject, { type: 'encounter_zone' }>>;
    expect(zones).toHaveLength(4); // 3× route31a + 1× route31b
    const a = zones.filter((z) => z.species.includes('FLITPECK') && z.rate === 0.18);
    const b = zones.filter((z) => z.species.includes('GRITHOAX') && z.rate === 0.45);
    expect(a).toHaveLength(3);
    expect(b).toHaveLength(1);
    // each zone is findable by the engine's lookup at its own rectangle origin.
    for (const z of zones) expect(findObjectAt(wired.map, z.x, z.y, 'encounter_zone')).toBeTruthy();
  });

  test('SPAWNS: spawn_player and spawn_alt become named spawns', () => {
    expect(wired.map.spawns.player).toBeDefined();
    expect(wired.map.spawns.alt).toBeDefined();
  });
});
