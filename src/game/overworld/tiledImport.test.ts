// Tiled → Argent importer: GID translation, object snapping, robustness warnings,
// and the real test-map.tmj snapshot (full coverage).
import { describe, expect, test } from 'vitest';
import { importTiledMap, defaultResolveSheet, basename, isCollisionLayerName } from './tiledImport';
import type { TiledMapJson, SheetResolver } from './tiledImport';
import { isWalkable } from './types';
import testMapTmj from '../maps/tiled/test-map.tmj.json';
import pctGrass from '../../../assets/tilesets/pct_grass.tileset.json';
import pctPath02 from '../../../assets/tilesets/pct_path02.tileset.json';
import pctHills from '../../../assets/tilesets/pct_hills.tileset.json';
import pctBushanim from '../../../assets/tilesets/pct_bushanim.tileset.json';
import pctTrees from '../../../assets/tilesets/pct_trees.tileset.json';

// One grass tileset (firstgid 1, 12 cols) — enough to assert the GID rule.
const grassResolver: SheetResolver = (s) => (basename(s) === 'g.tsx' ? { pct: 'pct_grass', cols: 12 } : null);
function oneLayer(data: number[], w: number, h: number): TiledMapJson {
  return {
    width: w, height: h, tilewidth: 16, tileheight: 16,
    tilesets: [{ firstgid: 1, source: 'x/g.tsx' }],
    layers: [{ type: 'tilelayer', name: 'L', width: w, height: h, data }],
  };
}

describe('importTiledMap — GID → registry-key translation', () => {
  test('local_id = gid-firstgid; row=⌊l/cols⌋, col=l%cols; gid 0 = empty', () => {
    const { map, stats } = importTiledMap(oneLayer([1, 16, 73, 0], 4, 1), { name: 'M', resolveSheet: grassResolver });
    const row = map.importedLayers![0]!.tiles[0]!;
    expect(row[0]).toEqual({ tileset: 'pct_grass', tile: 'r0c0' }); // gid1 → local0
    expect(row[1]).toEqual({ tileset: 'pct_grass', tile: 'r1c3' }); // gid16 → local15 → 15/12=1 r,3 c
    expect(row[2]).toEqual({ tileset: 'pct_grass', tile: 'r6c0' }); // gid73 → local72 → 72/12=6 r,0 c
    expect(row[3]).toBeNull(); // gid 0
    expect(stats.gidsResolved).toBe(3);
    expect(stats.gidsEmpty).toBe(1);
  });

  test('flip bits (high 3 bits) are masked before resolution', () => {
    const flipped = (0x80000000 | 16) >>> 0; // H-flip flag + gid 16
    const { map } = importTiledMap(oneLayer([flipped], 1, 1), { name: 'M', resolveSheet: grassResolver });
    expect(map.importedLayers![0]!.tiles[0]![0]).toEqual({ tileset: 'pct_grass', tile: 'r1c3' });
  });

  test('layer order + structure preserved (each tile layer → one ImportedTileLayer)', () => {
    const tmj: TiledMapJson = {
      width: 1, height: 1, tilewidth: 16, tileheight: 16,
      tilesets: [{ firstgid: 1, source: 'x/g.tsx' }],
      layers: [
        { type: 'tilelayer', name: 'ground', width: 1, height: 1, data: [1] },
        { type: 'objectgroup', name: 'obj', objects: [] },
        { type: 'tilelayer', name: 'top', width: 1, height: 1, data: [2] },
      ],
    };
    const { map } = importTiledMap(tmj, { name: 'M', resolveSheet: grassResolver });
    expect(map.importedLayers!.map((l) => l.name)).toEqual(['ground', 'top']); // object layer not a tile layer
  });
});

describe('importTiledMap — object snapping + carry-through', () => {
  test('sub-pixel object x/y rounds to tile coords; name carried, w/h in tiles', () => {
    const tmj: TiledMapJson = {
      width: 10, height: 10, tilewidth: 16, tileheight: 16,
      tilesets: [{ firstgid: 1, source: 'x/g.tsx' }],
      layers: [{ type: 'objectgroup', name: 'obj', objects: [
        { name: 'npc_test', x: 96.5, y: 32.3, width: 16, height: 16 },
        { name: 'warp_test', x: 64.5, y: 0.8, width: 32, height: 16 },
      ] }],
    };
    const { map } = importTiledMap(tmj, { name: 'M', resolveSheet: grassResolver });
    expect(map.importedObjects).toEqual([
      { name: 'npc_test', x: 6, y: 2, w: 1, h: 1 }, // round(96.5/16)=6, round(32.3/16)=2
      { name: 'warp_test', x: 4, y: 0, w: 2, h: 1 }, // round(64.5/16)=4, round(0.8/16)=0, 32/16=2
    ]);
  });
});

describe('importTiledMap — robustness warnings (degrade, never throw)', () => {
  test('duplicate tileset (same source, two firstgids) → warn', () => {
    const tmj: TiledMapJson = {
      width: 1, height: 1, tilewidth: 16, tileheight: 16,
      tilesets: [{ firstgid: 1, source: 'a/foo.tsx' }, { firstgid: 50, source: 'b/foo.tsx' }],
      layers: [{ type: 'tilelayer', name: 'L', width: 1, height: 1, data: [1] }],
    };
    const { warnings } = importTiledMap(tmj, { name: 'M', resolveSheet: () => ({ pct: 'pct_grass', cols: 12 }) });
    expect(warnings.some((w) => w.includes('duplicate tileset "foo.tsx"'))).toBe(true);
  });

  test('unnamed object → warn + skipped', () => {
    const tmj: TiledMapJson = {
      width: 1, height: 1, tilewidth: 16, tileheight: 16, tilesets: [{ firstgid: 1, source: 'x/g.tsx' }],
      layers: [{ type: 'objectgroup', name: 'obj', objects: [{ name: '', x: 0, y: 0, width: 16, height: 16 }] }],
    };
    const { map, warnings } = importTiledMap(tmj, { name: 'M', resolveSheet: grassResolver });
    expect(map.importedObjects).toHaveLength(0);
    expect(warnings.some((w) => w.includes('unnamed object'))).toBe(true);
  });

  test('unresolvable sheet (no pct_* counterpart) → warn once + cells empty', () => {
    const { map, warnings, stats } = importTiledMap(oneLayer([1, 1], 2, 1), {
      name: 'M', resolveSheet: () => null, // nothing ingested
    });
    expect(map.importedLayers![0]!.tiles[0]).toEqual([null, null]);
    expect(stats.gidsDropped).toBe(2);
    expect(warnings.filter((w) => w.includes('no pct_* registry counterpart'))).toHaveLength(1); // deduped
  });

  test('GID resolving to a missing/blank registry cell → warn + empty (tileExists)', () => {
    const { map, warnings, stats } = importTiledMap(oneLayer([16], 1, 1), {
      name: 'M', resolveSheet: grassResolver, tileExists: () => false,
    });
    expect(map.importedLayers![0]!.tiles[0]![0]).toBeNull();
    expect(stats.gidsDropped).toBe(1);
    expect(warnings.some((w) => w.includes('not in the registry'))).toBe(true);
  });
});

describe('importTiledMap — real test-map.tmj snapshot (full coverage)', () => {
  const RAW: Record<string, { tiles: Record<string, unknown> }> = {
    pct_grass: pctGrass as never, pct_path02: pctPath02 as never, pct_hills: pctHills as never,
    pct_bushanim: pctBushanim as never, pct_trees: pctTrees as never,
  };
  const result = importTiledMap(testMapTmj as unknown as TiledMapJson, {
    name: 'TILED TEST',
    resolveSheet: defaultResolveSheet,
    tileExists: (pct, key) => RAW[pct]?.tiles[key] !== undefined,
  });

  test('imports with ZERO warnings — every painted GID resolves to an ingested tile', () => {
    expect(result.warnings).toEqual([]);
    expect(result.stats.gidsDropped).toBe(0);
    expect(result.stats.gidsResolved).toBeGreaterThan(0);
  });

  test('all 3 tile layers preserved + both named objects placed at the right tiles', () => {
    expect(result.stats.tileLayers).toBe(3);
    expect(result.map.importedObjects).toEqual([
      { name: 'npc_test', x: 6, y: 2, w: 1, h: 1 },
      { name: 'warp_test', x: 4, y: 0, w: 1, h: 1 },
    ]);
  });

  test('every distinct painted GID maps to a tile that exists in its pct tileset', () => {
    const tmj = testMapTmj as unknown as TiledMapJson;
    const gids = new Set<number>();
    for (const l of tmj.layers) {
      if (l.type !== 'tilelayer' || isCollisionLayerName((l as unknown as { name: string }).name)) continue;
      for (const g of (l as unknown as { data: number[] }).data) if (g) gids.add(g & 0x1fffffff);
    }
    expect(gids.size).toBe(19); // the documented 19 distinct GIDs
    // Reconstruct each ref from the imported layers and confirm it's a real tile.
    const seen = new Set<string>();
    for (const layer of result.map.importedLayers!) for (const row of layer.tiles) for (const ref of row) {
      if (ref) { expect(RAW[ref.tileset]?.tiles[ref.tile]).toBeDefined(); seen.add(`${ref.tileset}:${ref.tile}`); }
    }
    expect(seen.size).toBeGreaterThanOrEqual(15); // distinct tiles actually placed
  });

  test("the collision layer feeds isWalkable: walls block, open tiles + the warp don't", () => {
    expect(result.stats.collisionLayers).toBe(1);
    expect(result.stats.collisionCells).toBeGreaterThan(0);
    const m = result.map;
    // Interior wall (row 8, cols 6-14) is solid; the spawn row below it is walkable.
    expect(isWalkable(m, 10, 8)).toBe(false); // wall
    expect(isWalkable(m, 10, 9)).toBe(true); // spawn (open)
    // Border is solid; the warp tile (4,0) was excluded so it stays steppable.
    expect(isWalkable(m, 0, 5)).toBe(false); // left border
    expect(isWalkable(m, 4, 0)).toBe(true); // warp tile (excluded from collision)
    expect(isWalkable(m, 8, 12)).toBe(true); // open interior
  });
});

describe('importTiledMap — collision layer (unit)', () => {
  const withCollision: TiledMapJson = {
    width: 3, height: 1, tilewidth: 16, tileheight: 16,
    tilesets: [{ firstgid: 1, source: 'x/g.tsx' }],
    layers: [
      { type: 'tilelayer', name: 'ground', width: 3, height: 1, data: [1, 1, 1] },
      { type: 'tilelayer', name: 'Collision', width: 3, height: 1, data: [7, 0, 9] }, // any non-0 = solid; name case-insensitive
    ],
  };

  test('collision layer → solid cells (presence, any GID), excluded from visual layers', () => {
    const { map, stats } = importTiledMap(withCollision, { name: 'M', resolveSheet: grassResolver });
    expect(stats.tileLayers).toBe(1); // only the ground layer is visual
    expect(map.importedLayers!.map((l) => l.name)).toEqual(['ground']); // collision not rendered
    expect(stats.collisionLayers).toBe(1);
    expect(stats.collisionCells).toBe(2); // cells 0 and 2 painted
    expect(isWalkable(map, 0, 0)).toBe(false); // painted → solid
    expect(isWalkable(map, 1, 0)).toBe(true); // empty cell → walkable
    expect(isWalkable(map, 2, 0)).toBe(false); // painted → solid
  });

  test('NO collision layer → all-walkable (no regression)', () => {
    const { map, stats } = importTiledMap(oneLayer([1, 1], 2, 1), { name: 'M', resolveSheet: grassResolver });
    expect(stats.collisionLayers).toBe(0);
    expect(isWalkable(map, 0, 0)).toBe(true);
    expect(isWalkable(map, 1, 0)).toBe(true);
  });
});
