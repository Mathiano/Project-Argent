// Proof-of-integration (registry → engine, DATA-DRIVEN path): the authored
// heartwick_grass_test tile now renders across Route 31's open meadow at scale.
//
// Route 31 (route31.violet.json) is data-driven (tilesetRef: outdoor_violet), so the
// graybox TileDef.tileRef bridge didn't reach it — the bridge was extended to the
// data-driven base layer via map.tileRefs (a per-tile-id render override). This pins
// that bridge end-to-end, mirroring hearthwickGrass.test: the map carries the override
// on the `grass` base tile, and driving the real overworld scene draws the authored
// tile's pixels across the meadow. (No DOM in tests → drawTilePixels per-pixel fallback,
// which is what lets us see the authored colours hit the canvas.)

import { describe, expect, test } from 'vitest';
import { createOverworldScene } from './overworld';
import { getMap } from '../overworld/maps';
import { getTileset } from '../overworld/tilesetCatalog';
import type { InputKey } from '../scene';

const GRASS_SET = 'heartwick_grass_test';
const GRASS_TILE = 'heartwick_grass_test_027';

function mockFlags() {
  const s = new Set<string>();
  return { has: (f: string) => s.has(f), set: (f: string) => void s.add(f), unset: (f: string) => void s.delete(f) };
}
function mockInput() {
  const held = new Set<InputKey>();
  return {
    pressed: (k: InputKey) => held.has(k),
    press: (k: InputKey) => void held.add(k),
    release: (k: InputKey) => void held.delete(k),
    releaseAll: () => held.clear(),
  };
}
type Fill = { color: string; w: number; h: number };
function recordingCtx(): CanvasRenderingContext2D & { fills: Fill[] } {
  const fills: Fill[] = [];
  let fill = '#000';
  const noop = () => {};
  return new Proxy(
    { fills },
    {
      get(_t, p) {
        if (p === 'fills') return fills;
        if (p === 'fillStyle') return fill;
        if (p === 'fillRect') return (_x: number, _y: number, w: number, h: number) => fills.push({ color: fill, w, h });
        if (p === 'fillText') return noop;
        if (p === 'measureText') return () => ({ width: 10 });
        if (p === 'canvas') return { width: 320, height: 180 };
        return noop;
      },
      set(_t, p, v) {
        if (p === 'fillStyle') fill = String(v);
        return true;
      },
    },
  ) as unknown as CanvasRenderingContext2D & { fills: Fill[] };
}
const distinct = (xs: readonly (string | null)[]) => new Set(xs.filter((c): c is string => c !== null));

describe('proof-of-integration — authored grass renders across Route 31 (data-driven)', () => {
  test('Route 31 is data-driven and carries the tileRef override on its base grass', () => {
    const map = getMap('ROUTE31');
    expect(map.cells).toBeDefined(); // data-driven path
    expect(map.tilesetRef).toBe('outdoor_violet');
    expect(map.tileRefs?.['grass']).toEqual({ tileset: GRASS_SET, tile: GRASS_TILE });
  });

  test('the authored tile is registered and is real, opaque pixel art', () => {
    const ts = getTileset(GRASS_SET); // throws if unregistered → chain intact
    const tile = ts.tiles[GRASS_TILE];
    expect(tile).toBeDefined();
    expect(tile!.pixels.length).toBe(ts.tilesize * ts.tilesize);
    expect(distinct(tile!.pixels).size).toBeGreaterThanOrEqual(2); // multi-colour = authored art
    expect(tile!.pixels.every((p) => p !== null)).toBe(true); // opaque → no artifacts
  });

  test('rendering Route 31 draws the authored tile pixels across the open meadow', () => {
    const authored = distinct(getTileset(GRASS_SET).tiles[GRASS_TILE]!.pixels);
    const scene = createOverworldScene({
      map: 'ROUTE31',
      spawn: 'fromHearthwick', // §1 Meadowgate — drop into the open meadow
      inputState: mockInput(),
      flags: mockFlags(),
      onWarp: () => {},
      onEncounter: () => {},
      onTrainerBattle: () => {},
      onBossBattle: () => {},
      random: () => 0.999, // never roll a wild encounter
    });
    const ctx = recordingCtx();
    scene.draw?.(ctx);

    // Authored-colour 1×1 fills come from the meadow's `grass` cells (base placeholder
    // grass would draw as one baked/flat tile per cell, not the authored pixels).
    const authoredPixelFills = ctx.fills.filter((f) => f.w === 1 && f.h === 1 && authored.has(f.color));
    const authoredColorsDrawn = new Set(authoredPixelFills.map((f) => f.color));
    expect(authoredPixelFills.length).toBeGreaterThanOrEqual(256); // ≥ one full authored tile, at scale much more
    expect(authoredColorsDrawn.size).toBeGreaterThanOrEqual(2); // multiple authored colours on the canvas
    expect([...authoredColorsDrawn].some((c) => c.toLowerCase() !== '#86c06c')).toBe(true); // real detail, not a flat fill
  });
});
