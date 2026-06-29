// Route 31 Phase 1: the full 22×74 map imports + wires with EVERY visual GID
// resolving (incl. water), collision read, and all warps/encounters/spawns wired.
import { describe, expect, test } from 'vitest';
import { importTiledMap, defaultResolveSheet } from './tiledImport';
import type { TiledMapJson } from './tiledImport';
import { wireImportedMap } from './tiledWiring';
import { isWalkable } from './types';
import type { MapObject } from './types';
import bigTmj from '../maps/tiled/test-map-kitchen-sink-big.tmj.json';
import pctGrass from '../../../assets/tilesets/pct_grass.tileset.json';
import pctPath02 from '../../../assets/tilesets/pct_path02.tileset.json';
import pctHills from '../../../assets/tilesets/pct_hills.tileset.json';
import pctBushanim from '../../../assets/tilesets/pct_bushanim.tileset.json';
import pctTrees from '../../../assets/tilesets/pct_trees.tileset.json';
import pctBush from '../../../assets/tilesets/pct_bush.tileset.json';
import pctWater from '../../../assets/tilesets/pct_water.tileset.json';
import pctWatersheet from '../../../assets/tilesets/pct_watersheet.tileset.json';

const RAW: Record<string, { tiles: Record<string, unknown> }> = {
  pct_grass: pctGrass as never, pct_path02: pctPath02 as never, pct_hills: pctHills as never,
  pct_bushanim: pctBushanim as never, pct_trees: pctTrees as never, pct_bush: pctBush as never,
  pct_water: pctWater as never, pct_watersheet: pctWatersheet as never,
};
const imported = importTiledMap(bigTmj as unknown as TiledMapJson, {
  name: 'ROUTE 31 (Phase 1)',
  resolveSheet: defaultResolveSheet,
  tileExists: (pct, key) => RAW[pct]?.tiles[key] !== undefined,
});
const wired = wireImportedMap(imported.map);
const objs = wired.map.objects;
const byType = (t: MapObject['type']) => objs.filter((o) => o.type === t);

describe('Route 31 Phase-1 big map — full import + wire', () => {
  test('22×74; ALL visual GIDs resolve (incl. water) — 0 unresolvable, 0 warnings', () => {
    expect(wired.map.width).toBe(22);
    expect(wired.map.height).toBe(74);
    expect(imported.stats.gidsDropped).toBe(0); // every painted GID resolves to a tile
    expect(imported.warnings).toEqual([]);
    expect(wired.warnings).toEqual([]);
  });

  test('3 visual layers (Floor/Props/Overhead); Collision read + excluded from render', () => {
    expect(imported.stats.tileLayers).toBe(3);
    expect(imported.stats.collisionLayers).toBe(1);
    expect(imported.stats.collisionCells).toBe(556); // the documented count
    // the Overhead layer (tree-tops drawn over the player for walk-behind) survives
    // and is flagged overhead → the renderer draws it AFTER the player.
    const overhead = wired.map.importedLayers!.find((l) => l.name === 'Overhead (4)');
    expect(overhead).toBeDefined();
    expect(overhead!.overhead).toBe(true);
    // a base layer is NOT overhead (drawn below the player).
    expect(wired.map.importedLayers!.find((l) => l.name === 'Floor (1)')!.overhead ?? false).toBe(false);
  });

  test('water renders — pct_water and pct_watersheet refs both present in the layers', () => {
    const tilesets = new Set<string>();
    for (const layer of wired.map.importedLayers!) for (const row of layer.tiles) for (const ref of row) if (ref) tilesets.add(ref.tileset);
    expect(tilesets.has('pct_water')).toBe(true);
    expect(tilesets.has('pct_watersheet')).toBe(true);
  });

  test('collision blocks somewhere and walkable elsewhere', () => {
    let solid = 0, open = 0;
    for (let y = 0; y < wired.map.height; y += 1)
      for (let x = 0; x < wired.map.width; x += 1) (isWalkable(wired.map, x, y) ? open++ : solid++);
    expect(solid).toBeGreaterThan(0);
    expect(open).toBeGreaterThan(0);
  });

  test('warps: north→HEARTHWICK, south→VIOLET', () => {
    const warps = byType('warp') as Array<Extract<MapObject, { type: 'warp' }>>;
    expect(warps.map((w) => w.target).sort()).toEqual(['HEARTHWICK:fromRoute', 'VIOLET:fromRoute']);
  });

  test('encounters: route31a (grass), route31b (cave), water1a (water) all wired', () => {
    const zones = byType('encounter_zone') as Array<Extract<MapObject, { type: 'encounter_zone' }>>;
    // 4× route31a + 2× route31b + 1× water1a = 7 zones on this map.
    expect(zones).toHaveLength(7);
    expect(zones.some((z) => z.species.includes('MARSHMASH'))).toBe(true); // water1a
    expect(zones.some((z) => z.species.includes('GRITHOAX'))).toBe(true); // route31b cave
    expect(zones.some((z) => z.species.includes('FLITPECK'))).toBe(true); // route31a grass
  });

  test('spawns: default/player/fromHearthwick(down)/fromViolet(up)', () => {
    const s = wired.map.spawns;
    expect(s.default).toBeDefined();
    expect(s.player).toBeDefined();
    expect(s.fromHearthwick).toMatchObject({ facing: 'down' });
    expect(s.fromViolet).toMatchObject({ facing: 'up' }); // the facing-property fix
  });
});
