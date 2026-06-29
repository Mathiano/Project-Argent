// Wiring layer: imported markers → real Argent definitions (npc/warp/spawn), with
// the same warn-and-skip robustness as the importer, plus the real test map.
import { describe, expect, test } from 'vitest';
import { wireImportedMap } from './tiledWiring';
import type { WiringDefs } from './tiledWiring';
import { getMap } from './maps';
import type { ImportedObject, MapData } from './types';

function baseMap(importedObjects: ImportedObject[]): MapData {
  return {
    name: 'M', width: 10, height: 10, tilesize: 16,
    tiles: '', tileset: {}, objects: [], spawns: { default: { x: 5, y: 5, facing: 'down' } },
    importedLayers: [{ name: 'ground', tiles: [] }],
    importedObjects,
  };
}

const DEFS: WiringDefs = {
  npc: { npc_guide: { color: '#abc', interact: [{ kind: 'dialog', lines: ['hi'] }] } },
  warp: { warp_north: { target: 'ROUTE31:fromHearthwick' } },
};

describe('wireImportedMap — marker → definition', () => {
  test('npc marker resolves to an npc MapObject at its grid position, with its def', () => {
    const { map, warnings } = wireImportedMap(baseMap([{ name: 'npc_guide', x: 3, y: 4, w: 1, h: 1 }]), DEFS);
    expect(warnings).toEqual([]);
    expect(map.objects).toEqual([
      { type: 'npc', x: 3, y: 4, color: '#abc', interact: [{ kind: 'dialog', lines: ['hi'] }] },
    ]);
    expect(map.importedObjects).toBeUndefined(); // markers consumed
    expect(map.importedLayers).toBeDefined(); // tile layers preserved
  });

  test('warp marker resolves to a warp MapObject with the def target', () => {
    const { map } = wireImportedMap(baseMap([{ name: 'warp_north', x: 6, y: 0, w: 1, h: 1 }]), DEFS);
    expect(map.objects).toEqual([{ type: 'warp', x: 6, y: 0, target: 'ROUTE31:fromHearthwick' }]);
  });

  test('spawn_<name> marker becomes a named spawn point (no def needed)', () => {
    const { map, warnings } = wireImportedMap(baseMap([{ name: 'spawn_fromCave', x: 2, y: 9, w: 1, h: 1 }]), DEFS);
    expect(warnings).toEqual([]);
    expect(map.spawns.fromCave).toEqual({ x: 2, y: 9, facing: 'down' });
  });

  test('unresolved marker (no def) → warn + skip, no crash', () => {
    const { map, warnings } = wireImportedMap(baseMap([{ name: 'npc_missing', x: 1, y: 1, w: 1, h: 1 }]), DEFS);
    expect(map.objects).toEqual([]);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('npc_missing');
    expect(warnings[0]).toContain('no NPC definition');
  });

  test('unknown prefix → warn + skip', () => {
    const { warnings } = wireImportedMap(baseMap([{ name: 'door_test', x: 1, y: 1, w: 1, h: 1 }]), DEFS);
    expect(warnings[0]).toContain('unknown prefix');
  });

  test('existing objects/spawns are preserved alongside resolved markers', () => {
    const m = baseMap([{ name: 'npc_guide', x: 0, y: 0, w: 1, h: 1 }]);
    const withObj: MapData = { ...m, objects: [{ type: 'sign', x: 9, y: 9, lines: ['old'] }] };
    const { map } = wireImportedMap(withObj, DEFS);
    expect(map.objects).toHaveLength(2); // the pre-existing sign + the wired npc
    expect(map.spawns.default).toEqual({ x: 5, y: 5, facing: 'down' });
  });
});

describe('wireImportedMap — real __TILED_TEST__ map (full loop)', () => {
  const map = getMap('__TILED_TEST__');

  test('npc_test and warp_test are wired into real interactable objects', () => {
    const npc = map.objects.find((o) => o.type === 'npc');
    const warp = map.objects.find((o) => o.type === 'warp');
    expect(npc).toBeDefined();
    expect(warp).toBeDefined();
    // From the snapshot: npc_test → (6,2), warp_test → (4,0).
    expect({ x: npc!.x, y: npc!.y }).toEqual({ x: 6, y: 2 });
    expect({ x: warp!.x, y: warp!.y }).toEqual({ x: 4, y: 0 });
    expect((warp as { target: string }).target).toBe('HEARTHWICK:fromRoute');
    // The npc carries real interact behaviour (a dialog).
    expect((npc as { interact: readonly unknown[] }).interact.length).toBeGreaterThan(0);
  });

  test('markers are consumed (no leftover placeholders) and tile layers survive', () => {
    expect(map.importedObjects).toBeUndefined();
    expect(map.importedLayers!.length).toBe(3);
  });
});
