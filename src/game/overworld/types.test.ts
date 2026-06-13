// High-leverage tests for the overworld pure functions — these guard the
// map data + script system from silent breakage during the 6v6 sprint.

import { describe, expect, test } from 'vitest';
import { findObjectAt, isWalkable, parseTarget, tileAt } from './types';
import type { MapData, MapObject } from './types';

const MAP: MapData = {
  name: 'TEST',
  width: 5,
  height: 3,
  tilesize: 16,
  tiles: 'WWWWW\nW.G.W\nWWWWW',
  tileset: {
    W: { color: '#000', solid: true, label: 'wall' },
    '.': { color: '#fff', solid: false, label: 'floor' },
    G: { color: '#0f0', solid: false, label: 'grass' },
  },
  objects: [
    { type: 'sign', x: 1, y: 1, lines: ['hi'] },
    { type: 'warp', x: 2, y: 1, target: 'OTHER:fromHere' },
    {
      type: 'encounter_zone',
      x: 1,
      y: 1,
      width: 3,
      height: 1,
      species: ['FUZZLET'],
      rate: 0.5,
    },
  ] as readonly MapObject[],
  spawns: { default: { x: 1, y: 1, facing: 'down' } },
};

describe('overworld/types', () => {
  test('tileAt resolves to the tile def or null off-map', () => {
    expect(tileAt(MAP, 1, 1)?.label).toBe('floor');
    expect(tileAt(MAP, 2, 1)?.label).toBe('grass');
    expect(tileAt(MAP, 0, 0)?.label).toBe('wall');
    expect(tileAt(MAP, -1, 0)).toBe(null);
    expect(tileAt(MAP, 5, 0)).toBe(null);
    expect(tileAt(MAP, 0, 3)).toBe(null);
  });

  test('isWalkable respects tile.solid and map bounds', () => {
    expect(isWalkable(MAP, 1, 1)).toBe(true);
    expect(isWalkable(MAP, 0, 0)).toBe(false);
    expect(isWalkable(MAP, -1, 0)).toBe(false);
  });

  test('findObjectAt matches exact x/y for point objects', () => {
    expect(findObjectAt(MAP, 1, 1, 'sign')?.type).toBe('sign');
    expect(findObjectAt(MAP, 2, 1, 'warp')?.type).toBe('warp');
    expect(findObjectAt(MAP, 0, 0, 'sign')).toBe(null);
    // Type filter — looking for warp where sign lives returns null.
    expect(findObjectAt(MAP, 1, 1, 'warp')).toBe(null);
  });

  test('findObjectAt rect-hits encounter_zone tiles inside the zone', () => {
    expect(findObjectAt(MAP, 1, 1, 'encounter_zone')?.type).toBe('encounter_zone');
    expect(findObjectAt(MAP, 3, 1, 'encounter_zone')?.type).toBe('encounter_zone');
    // Outside the zone:
    expect(findObjectAt(MAP, 4, 1, 'encounter_zone')).toBe(null);
    expect(findObjectAt(MAP, 1, 2, 'encounter_zone')).toBe(null);
  });

  test('parseTarget splits "MAP:spawn" and throws on malformed targets', () => {
    expect(parseTarget('ROUTE31:fromLab')).toEqual({ map: 'ROUTE31', spawn: 'fromLab' });
    expect(() => parseTarget('NO_COLON')).toThrow();
    expect(() => parseTarget(':noMap')).toThrow();
    expect(() => parseTarget('noSpawn:')).toThrow();
  });
});
