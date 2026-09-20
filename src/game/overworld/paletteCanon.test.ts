// The master-palette canon guard.
//
// visual-ceiling-rse-2d.md says the palette grows "toward ~48–64, ADDITIVELY",
// and assigns curating that ramp to an art-direction pass. This test protects
// that pass mechanically: the danger is not growth, it is a curator INSERTING
// or REORDERING a colour instead of appending one. Tileset pixels are palette
// INDICES, so a single insertion silently remaps every tile that indexes the
// master — the art would change everywhere, quietly, and no other test would
// notice. Appending is always safe; these assertions make the difference visible.
import { describe, expect, it } from 'vitest';
import { PALETTE_KEYS } from './tileset';
import master from '../../../assets/palettes/argent-master.palette.json';

import pctGrass from '../../../assets/tilesets/pct_grass.tileset.json';
import pctPath from '../../../assets/tilesets/pct_path.tileset.json';
import pctWater from '../../../assets/tilesets/pct_water.tileset.json';
import pctTrees from '../../../assets/tilesets/pct_trees.tileset.json';
import pctBush from '../../../assets/tilesets/pct_bush.tileset.json';
import pctBushanim from '../../../assets/tilesets/pct_bushanim.tileset.json';
import pctDecor from '../../../assets/tilesets/pct_decor.tileset.json';
import pctFences from '../../../assets/tilesets/pct_fences.tileset.json';
import pctFlowers from '../../../assets/tilesets/pct_flowers.tileset.json';
import pctHills from '../../../assets/tilesets/pct_hills.tileset.json';
import pctPath02 from '../../../assets/tilesets/pct_path02.tileset.json';
import pctBuildings from '../../../assets/tilesets/pct_buildings.tileset.json';
import pctWatersheet from '../../../assets/tilesets/pct_watersheet.tileset.json';
import interiorProps from '../../../assets/tilesets/interior_props.tileset.json';

const COLORS = master.colors as ReadonlyArray<{ key: string; hex: string }>;
const HEXES = COLORS.map((c) => c.hex);

// Every tileset re-seeded onto the master (the PCT set + the interior
// placeholders). The legacy pre-reseed sheets (heartwick_*_test, violet_*,
// demo_layers, outdoor_violet) carry their OWN older palettes and are
// deliberately not listed — they do not index the master.
const MASTER_INDEXED: ReadonlyArray<{ name: string; palette: readonly string[] }> = [
  pctGrass, pctPath, pctWater, pctTrees, pctBush, pctBushanim, pctDecor, pctFences,
  pctFlowers, pctHills, pctPath02, pctBuildings, pctWatersheet, interiorProps,
] as ReadonlyArray<{ name: string; palette: readonly string[] }>;

describe('the master palette', () => {
  it('keys are the first N of PALETTE_KEYS, in order — an index IS its key', () => {
    expect(COLORS.map((c) => c.key).join('')).toBe(PALETTE_KEYS.slice(0, COLORS.length));
  });

  it('declares its own size honestly', () => {
    expect(master.size).toBe(COLORS.length);
  });

  it('every colour is a distinct 6-digit hex — a duplicate wastes an index', () => {
    for (const hex of HEXES) expect(hex).toMatch(/^#[0-9a-f]{6}$/);
    expect(new Set(HEXES).size).toBe(HEXES.length);
  });

  it('fits single-char indexing, with room to grow toward ~48-64', () => {
    expect(COLORS.length).toBeLessThanOrEqual(PALETTE_KEYS.length); // 62-key cap
    expect(COLORS.length).toBeGreaterThanOrEqual(41); // additive: it may grow, never shrink
  });
});

describe('master-indexed tilesets stay in lockstep with the master', () => {
  for (const ts of MASTER_INDEXED) {
    it(`${ts.name}: its palette is an exact PREFIX of the master`, () => {
      // Not merely "same length" — same colours, same order. This is what makes
      // growth safe: append and every existing index still means what it meant.
      expect(ts.palette).toEqual(HEXES.slice(0, ts.palette.length));
    });
  }

  it('a curated ramp must APPEND — inserting or reordering remaps every tile', () => {
    // Documents the failure mode in executable form: had a colour been inserted
    // at the front, index 5 would now point at a different colour in all 14
    // sheets, and the prefix assertions above would be the thing that caught it.
    const inserted = ['#ff0000', ...HEXES];
    expect(inserted.slice(0, HEXES.length)).not.toEqual(HEXES);
    const appended = [...HEXES, '#ff0000'];
    expect(appended.slice(0, HEXES.length)).toEqual(HEXES); // safe
  });
});
