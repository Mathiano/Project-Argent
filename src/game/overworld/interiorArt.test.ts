// Every graybox interior draws real (placeholder) art: each TileDef points at a
// registered tile, every grid char is defined, and a transparent-backed prop
// declares the floor it stands on — so no interior can regress to flat colour
// or draw last frame's pixels through a bed.
import { describe, expect, it } from 'vitest';
import './maps'; // registers every shipped tileset (side effect)
import { getTileset, hasTileset } from './tilesetCatalog';
import { makeCenter, makeMart } from './interiorGen';
import type { GrayboxMapJson } from './mapLoader';
import bedroom from '../maps/bedroom.json';
import house from '../maps/house.json';
import kamonHouse from '../maps/kamon_house.json';
import lab from '../maps/lab.json';
import gym from '../maps/gym.json';

const INTERIORS: { readonly [name: string]: GrayboxMapJson } = {
  BEDROOM: bedroom as GrayboxMapJson,
  HOUSE: house as GrayboxMapJson,
  KAMON_HOUSE: kamonHouse as GrayboxMapJson,
  LAB: lab as GrayboxMapJson,
  GYM: gym as GrayboxMapJson,
  CENTER: makeCenter('HEARTHWICK'),
  MART: makeMart('HEARTHWICK', ['POTION']),
};

describe('interior placeholder art', () => {
  for (const [name, map] of Object.entries(INTERIORS)) {
    it(`${name}: every tile def has art that resolves, and every grid char is defined`, () => {
      for (const [ch, def] of Object.entries(map.tileset)) {
        expect(def.tileRef, `${name} '${ch}' (${def.label ?? ''}) has no tileRef`).toBeDefined();
        const ref = def.tileRef!;
        expect(hasTileset(ref.tileset), `tileset ${ref.tileset}`).toBe(true);
        expect(getTileset(ref.tileset).tiles[ref.tile], `${ref.tileset}/${ref.tile}`).toBeDefined();
        if (def.under !== undefined) {
          expect(map.tileset[def.under], `${name} '${ch}' under '${def.under}'`).toBeDefined();
        }
      }
      for (const row of map.tiles.split('\n')) {
        for (const ch of row) expect(map.tileset[ch], `${name} grid char '${ch}'`).toBeDefined();
      }
    });
  }

  it('a transparent-backed prop always declares an `under` floor', () => {
    const props = getTileset('interior_props');
    for (const [name, map] of Object.entries(INTERIORS)) {
      for (const [ch, def] of Object.entries(map.tileset)) {
        const ref = def.tileRef!;
        if (ref.tileset !== 'interior_props') continue;
        const tile = props.tiles[ref.tile]!;
        if (tile.pixels.some((p) => p === null)) {
          expect(def.under, `${name} '${ch}' → ${ref.tile} has transparent pixels`).toBeDefined();
        }
      }
    }
  });

  it('every interior_props tile stays within the 16-colour per-tile ceiling', () => {
    const props = getTileset('interior_props');
    for (const [id, tile] of Object.entries(props.tiles)) {
      const colours = new Set(tile.pixels.filter((p): p is string => p !== null));
      expect(colours.size, id).toBeLessThanOrEqual(16);
    }
  });
});
