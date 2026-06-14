// Loader contract for tileset + prefab + data-driven map JSON.
// The schema lives in docs/tileset-format.md — these tests pin the
// loud-failure cases (typos in tile ids, wrong row sizes, missing
// prefabs) so a bad asset trips at load time, not at render.

import { describe, expect, test } from 'vitest';
import {
  PALETTE_KEYS,
  loadPrefab,
  loadTileset,
  stampPrefab,
} from './tileset';
import type { PrefabJson, TilesetJson } from './tileset';
import { loadMap } from './mapLoader';
import type { DataDrivenMapJson, GrayboxMapJson } from './mapLoader';
import {
  _resetCatalogs,
  registerPrefab,
  registerTileset,
} from './tilesetCatalog';
import { isWalkable } from './types';

// A tiny 4×4 tileset is plenty for the loader tests — keeps fixtures
// readable.
const TINY: TilesetJson = {
  name: 'tiny',
  tilesize: 4,
  palette: ['#000', '#fff', '#0f0', '#f00'],
  tiles: {
    floor: {
      label: 'floor',
      solid: false,
      rows: ['0000', '0110', '0110', '0000'],
    },
    wall: {
      label: 'wall',
      solid: true,
      rows: ['3333', '3333', '3333', '3333'],
    },
    door: {
      label: 'door',
      solid: false,
      rows: ['2222', '2002', '2002', '2222'],
    },
  },
};

const HOUSE: PrefabJson = {
  name: 'tiny_house',
  width: 3,
  height: 2,
  anchor: { x: 1, y: 1 },
  tiles: [
    ['wall', 'wall', 'wall'],
    ['wall', 'door', 'wall'],
  ],
  collision: [
    [null, null, null],
    [null, false, null],
  ],
};

describe('tileset loader', () => {
  test('decodes rows into a pixel grid with palette colors and transparent slots', () => {
    const t = loadTileset(TINY);
    expect(t.tiles.floor!.pixels.length).toBe(16);
    expect(t.tiles.wall!.solid).toBe(true);
    expect(t.tiles.floor!.solid).toBe(false);
    // floor row 1 ('0110') maps to [black, white, white, black]
    expect(t.tiles.floor!.pixels.slice(4, 8)).toEqual(['#000', '#fff', '#fff', '#000']);
  });

  test('palette index keys cover at least 0-9 + a-z (lower-cased)', () => {
    // Designers will use the longer alphabet for tilesets with bigger palettes.
    expect(PALETTE_KEYS.length).toBeGreaterThanOrEqual(36);
    expect(PALETTE_KEYS).toMatch(/^0123456789/);
  });

  test('throws on a wrong row count', () => {
    expect(() =>
      loadTileset({
        ...TINY,
        tiles: { bad: { rows: ['0000', '0000', '0000'] } },
      }),
    ).toThrow(/rows=3/);
  });

  test('throws on a wrong row length', () => {
    expect(() =>
      loadTileset({
        ...TINY,
        tiles: { bad: { rows: ['00000', '0000', '0000', '0000'] } },
      }),
    ).toThrow(/length=5/);
  });

  test('throws on a palette index out of range', () => {
    expect(() =>
      loadTileset({
        ...TINY,
        tiles: { bad: { rows: ['0009', '0000', '0000', '0000'] } },
      }),
    ).toThrow(/not in palette/);
  });

  test('"." and " " are transparent (skip the pixel at render)', () => {
    const t = loadTileset({
      ...TINY,
      tiles: { mix: { rows: ['0.0.', ' 1 1', '0000', '0000'] } },
    });
    expect(t.tiles.mix!.pixels.slice(0, 4)).toEqual(['#000', null, '#000', null]);
    expect(t.tiles.mix!.pixels.slice(4, 8)).toEqual([null, '#fff', null, '#fff']);
  });
});

describe('prefab loader and stampPrefab', () => {
  test('captures cells + collision in row-major order', () => {
    const p = loadPrefab(HOUSE);
    expect(p.width).toBe(3);
    expect(p.height).toBe(2);
    expect(p.cells[1]![1]).toEqual({ tile: 'door', solid: false });
    expect(p.cells[0]![0]).toEqual({ tile: 'wall', solid: null });
  });

  test('throws if the row count or width mismatches the declared size', () => {
    expect(() =>
      loadPrefab({ ...HOUSE, width: 4 }),
    ).toThrow(/width/);
  });

  test('stampPrefab places cells with anchor offset and forwards collision', () => {
    const p = loadPrefab(HOUSE);
    const placed: Array<{ x: number; y: number; tile: string; solid: boolean | null }> = [];
    stampPrefab(p, 10, 5, (x, y, tile, solid) => {
      placed.push({ x, y, tile, solid });
    });
    // anchor (1,1) → place at (10,5) means top-left lands at (10-1,5-1)=(9,4).
    expect(placed.find((c) => c.tile === 'door')).toEqual({ x: 10, y: 5, tile: 'door', solid: false });
    expect(placed.find((c) => c.x === 9 && c.y === 4)).toEqual({ x: 9, y: 4, tile: 'wall', solid: null });
  });
});

describe('mapLoader — data-driven map', () => {
  test('builds cells from baseTile + prefab placement, with collision cutouts', () => {
    _resetCatalogs();
    registerTileset(TINY);
    registerPrefab(HOUSE);

    const mapJson: DataDrivenMapJson = {
      name: 'TEST',
      width: 6,
      height: 4,
      tilesize: 4,
      tilesetRef: 'tiny',
      baseTile: 'floor',
      prefabs: [{ name: 'tiny_house', x: 3, y: 2 }],
      spawns: { default: { x: 0, y: 0, facing: 'down' } },
    };
    const map = loadMap(mapJson);

    // baseTile fills cells unless overwritten by prefab
    expect(map.cells![0]![0]).toBe('floor');
    // House anchor (1,1) at (3,2) → top-left lands at (2,1)
    expect(map.cells![1]![2]).toBe('wall');
    expect(map.cells![2]![3]).toBe('door');
    // Door cell is force-walkable via prefab collision override
    expect(isWalkable(map, 3, 2)).toBe(true);
    // A wall cell stays solid
    expect(isWalkable(map, 2, 1)).toBe(false);
  });

  test('expands tileMap shorthand on string rows', () => {
    _resetCatalogs();
    registerTileset(TINY);

    const mapJson: DataDrivenMapJson = {
      name: 'TEST',
      width: 4,
      height: 2,
      tilesize: 4,
      tilesetRef: 'tiny',
      baseTile: 'floor',
      tileMap: { W: 'wall' },
      cells: ['WWWW', 'W..W'],
      spawns: { default: { x: 1, y: 1, facing: 'down' } },
    };
    const map = loadMap(mapJson);
    expect(map.cells![0]).toEqual(['wall', 'wall', 'wall', 'wall']);
    expect(map.cells![1]).toEqual(['wall', 'floor', 'floor', 'wall']);
  });

  test('throws on an unregistered prefab name', () => {
    _resetCatalogs();
    registerTileset(TINY);
    expect(() =>
      loadMap({
        name: 'BAD',
        width: 4,
        height: 4,
        tilesize: 4,
        tilesetRef: 'tiny',
        baseTile: 'floor',
        prefabs: [{ name: 'no_such_prefab', x: 1, y: 1 }],
        spawns: { default: { x: 0, y: 0, facing: 'down' } },
      }),
    ).toThrow(/unknown "no_such_prefab"/);
  });

  test('throws on a tile id typo (validates after prefab stamping)', () => {
    _resetCatalogs();
    registerTileset(TINY);
    expect(() =>
      loadMap({
        name: 'BAD',
        width: 4,
        height: 1,
        tilesize: 4,
        tilesetRef: 'tiny',
        baseTile: 'flooor',
        spawns: { default: { x: 0, y: 0, facing: 'down' } },
      }),
    ).toThrow(/tile id "flooor" not in tileset/);
  });

  test('legacy graybox JSON still loads through loadMap (back-compat)', () => {
    const grayboxJson: GrayboxMapJson = {
      name: 'GRAY',
      width: 4,
      height: 2,
      tilesize: 16,
      tiles: 'WWWW\nW..W',
      tileset: {
        W: { color: '#000', solid: true },
        '.': { color: '#fff', solid: false },
      },
      spawns: { default: { x: 1, y: 1, facing: 'down' } },
    };
    const map = loadMap(grayboxJson);
    expect(map.cells).toBeUndefined();
    expect(map.tilesetRef).toBeUndefined();
    expect(isWalkable(map, 1, 1)).toBe(true);
    expect(isWalkable(map, 0, 0)).toBe(false);
  });
});
