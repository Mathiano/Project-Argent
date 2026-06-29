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
  // Placement-independent invariants (robust to forest/cluster re-layouts):
  // every prop's trunk (bottom row of its cells) is solid; canopy is above it;
  // and walk-behind exists somewhere (a canopy cell over walkable ground).
  function assertProps(map: any) {
    expect(map.props && map.props.length).toBeGreaterThanOrEqual(1);
    expect(map.fringe).toBeDefined();
    for (const p of map.props) {
      const maxTy = Math.max(...p.cells.map((c: { ty: number }) => c.ty));
      const trunk = p.cells.filter((c: { ty: number }) => c.ty === maxTy);
      for (const c of trunk) expect(isWalkable(map, c.tx, c.ty)).toBe(false); // trunk blocks
      expect(p.cells.some((c: { ty: number }) => c.ty < maxTy)).toBe(true); // has canopy above
    }
    const walkBehind = map.props.some((p: { cells: { tx: number; ty: number }[] }) => {
      const maxTy = Math.max(...p.cells.map((c) => c.ty));
      return p.cells.some((c) => c.ty < maxTy && isWalkable(map, c.tx, c.ty));
    });
    expect(walkBehind).toBe(true); // at least one canopy is over walkable ground
  }
  test('Route 31 (Tiled) walk-behind: an Overhead layer draws over the player', async () => {
    // The Tiled-built Route 31 does walk-behind via an `overhead`-flagged imported
    // tile layer (tree-tops drawn AFTER the player), not the prefab `props` model.
    const { getMap } = await import('./maps');
    const r = getMap('ROUTE31');
    expect(r.props).toBeUndefined(); // not the prefab-prop format
    expect(r.importedLayers!.some((l) => l.overhead)).toBe(true); // a walk-behind layer exists
  });
  test('Violet props: trunks block, canopies walk-behind; spine anchors intact', async () => {
    const { getMap } = await import('./maps');
    const v = getMap('VIOLET');
    assertProps(v);
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
