// Layered renderer (Phase 7) — fringe overlay, Y-sorted multi-tile props with
// split collision, and the depth-sort order. Loads the PROPTEST demo fixture
// (its own demo_layers tileset + tree_big prefab) so nothing live is touched.
import { describe, expect, test } from 'vitest';
import demoTileset from '../../../assets/tilesets/demo_layers.tileset.json';
import treePrefab from '../../../assets/prefabs/tree_big.prefab.json';
import proptest from '../maps/proptest.json';
import { loadMap } from './mapLoader';
import type { DataDrivenMapJson } from './mapLoader';
import { registerPrefab, registerTileset } from './tilesetCatalog';
import type { PrefabJson, TilesetJson } from './tileset';
import { isWalkable } from './types';
import { ySortOrder } from './ysort';

registerTileset(demoTileset as TilesetJson);
registerPrefab(treePrefab as PrefabJson);
const map = loadMap(proptest as DataDrivenMapJson);

describe('layered map — fringe overlay (layer 1)', () => {
  test('fringe grid parses with tiles placed and gaps left null (transparent)', () => {
    expect(map.fringe).toBeDefined();
    expect(map.fringe![1]![2]).toBe('flower'); // "..f......f.." at row 1
    expect(map.fringe![7]![1]).toBe('flower'); // ".f........f." at row 7
    expect(map.fringe![0]![0]).toBeNull(); // empty cell -> transparent
    expect(map.fringe![1]![0]).toBeNull();
  });
});

describe('layered map — Y-sorted prop (layer 2)', () => {
  test('prop is placed with its draw cells + sortY (anchor = feet row)', () => {
    expect(map.props).toHaveLength(1);
    const tree = map.props![0]!;
    expect(tree.sortY).toBe((5 + 1) * 16); // anchor y=5 -> bottom edge 96px
    expect(tree.cells).toHaveLength(6); // 2x2 canopy + 2 trunk
    // trunk feet at the placement row; canopy stamped above it
    expect(tree.cells).toContainEqual({ tx: 5, ty: 5, tile: 'trunk_l' });
    expect(tree.cells).toContainEqual({ tx: 6, ty: 5, tile: 'trunk_r' });
    expect(tree.cells).toContainEqual({ tx: 5, ty: 3, tile: 'canopy' });
    expect(tree.cells).toContainEqual({ tx: 6, ty: 4, tile: 'canopy' });
  });

  test('split collision: trunk blocks, canopy is walkable (stand behind it)', () => {
    expect(isWalkable(map, 5, 5)).toBe(false); // trunk_l — solid
    expect(isWalkable(map, 6, 5)).toBe(false); // trunk_r — solid
    expect(isWalkable(map, 5, 4)).toBe(true); // canopy — non-solid overlay
    expect(isWalkable(map, 6, 3)).toBe(true); // canopy — non-solid overlay
    expect(isWalkable(map, 5, 6)).toBe(true); // open grass south of the tree
  });
});

describe('Y-sort order (depth occlusion)', () => {
  const tree = { sortY: 96, who: 'tree' };
  test('player NORTH of the tree base draws first -> occluded (walk-behind)', () => {
    const player = { sortY: 80, who: 'player' }; // feet above the tree base (96)
    expect(ySortOrder([tree, player]).map((d) => d.who)).toEqual(['player', 'tree']);
  });
  test('player SOUTH of the tree base draws last -> in front', () => {
    const player = { sortY: 112, who: 'player' }; // feet below the tree base
    expect(ySortOrder([tree, player]).map((d) => d.who)).toEqual(['tree', 'player']);
  });
});

describe('live migration — Route 31 + Violet use the layered format', () => {
  // getMap registers outdoor_violet + the tree_big prefab at module load.
  test('Route 31 has tree props; trunk blocks, canopy is walkable (walk-behind)', async () => {
    const { getMap } = await import('./maps');
    const r = getMap('ROUTE31');
    expect(r.props && r.props.length).toBeGreaterThanOrEqual(1);
    expect(r.fringe).toBeDefined();
    expect(isWalkable(r, 16, 4)).toBe(false); // trunk_l — blocks
    expect(isWalkable(r, 17, 4)).toBe(false); // trunk_r — blocks
    expect(isWalkable(r, 16, 2)).toBe(true); // canopy — walk behind it
    expect(isWalkable(r, 16, 3)).toBe(true);
  });

  test('Violet has tree props; trunk blocks, canopy walkable; spine anchors intact', async () => {
    const { getMap } = await import('./maps');
    const v = getMap('VIOLET');
    expect(v.props && v.props.length).toBeGreaterThanOrEqual(1);
    expect(v.fringe).toBeDefined();
    expect(isWalkable(v, 21, 9)).toBe(false); // trunk — blocks
    expect(isWalkable(v, 22, 9)).toBe(false);
    expect(isWalkable(v, 21, 7)).toBe(true); // canopy — walk behind it
    // spine anchors must remain clear (no tree dropped on the route)
    expect(isWalkable(v, 9, 1)).toBe(true); // north entry
    expect(isWalkable(v, 9, 11)).toBe(true); // fromGym (above the gym door)
  });
});

describe('back-compat — maps without layers are unaffected', () => {
  test('a map with no fringe/props leaves both undefined', () => {
    const plain = loadMap({
      name: 'PLAIN',
      width: 2,
      height: 2,
      tilesize: 16,
      tilesetRef: 'demo_layers',
      baseTile: 'grass',
      spawns: { default: { x: 0, y: 0, facing: 'down' } },
    } as DataDrivenMapJson);
    expect(plain.fringe).toBeUndefined();
    expect(plain.props).toBeUndefined();
  });
});
