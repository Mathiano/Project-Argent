// Proof-of-integration (Phase-2 registry → engine): a real Argent-Studio-authored
// grass tile, resolved from the asset registry by name, renders into Hearthwick.
//
// Two layers of proof:
//   1. Resolution chain — the registry tileset is registered, the Hearthwick 'g'
//      cells carry a tileRef to heartwick_grass_test_027, and that tile decodes to
//      real (multi-colour) 16×16 pixel art.
//   2. Render path — driving the actual overworld scene with a recording ctx shows
//      the authored tile's PIXELS getting drawn (per-pixel fills in the colours of
//      _027, not the single flat-colour placeholder fill).
//
// In the test env there's no DOM, so bakeTileCache() returns null and the renderer
// takes its drawTilePixels per-pixel fallback — which is exactly what lets us assert
// the authored colours hit the canvas.

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
// A ctx that records every (fillStyle, w, h) fill — so we can tell a per-pixel
// authored-tile draw (1×1 fills) from a flat placeholder cell (one 16×16 fill).
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

describe('proof-of-integration — registry grass renders in Hearthwick', () => {
  test('the registry tileset is registered and the authored tile is real pixel art', () => {
    const ts = getTileset(GRASS_SET); // throws if unregistered → resolution chain intact
    const tile = ts.tiles[GRASS_TILE];
    expect(tile).toBeDefined();
    expect(tile!.pixels.length).toBe(ts.tilesize * ts.tilesize); // decoded 16×16
    expect(distinct(tile!.pixels).size).toBeGreaterThanOrEqual(2); // multi-colour = authored, not flat
    expect(tile!.pixels.every((p) => p !== null)).toBe(true); // fully opaque → no transparent artifacts
  });

  test("Hearthwick's 'g' cells reference the registry tile, in the open band (walkable)", () => {
    const map = getMap('HEARTHWICK');
    const g = map.tileset['g'];
    expect(g).toBeDefined();
    expect(g!.solid).toBe(false); // walkable, like the grass it replaces
    expect(g!.tileRef).toEqual({ tileset: GRASS_SET, tile: GRASS_TILE });
    // the patch was painted into rows 4-5 (the open grass band)
    const rows = map.tiles.split('\n');
    expect(rows[4]!.includes('g')).toBe(true);
    expect(rows[5]!.includes('g')).toBe(true);
    // and only there — this is a patch, not the whole map (placeholder '.' remains)
    expect(map.tiles.includes('.')).toBe(true);
  });

  test('rendering Hearthwick draws the authored tile pixels (not the flat placeholder)', () => {
    const tile = getTileset(GRASS_SET).tiles[GRASS_TILE]!;
    const authored = distinct(tile.pixels);
    const scene = createOverworldScene({
      map: 'HEARTHWICK',
      spawn: 'default',
      spawnAt: { x: 9, y: 4, facing: 'down' }, // stand in the 'g' patch so it's on-camera
      inputState: mockInput(),
      flags: mockFlags(),
      onWarp: () => {},
      onEncounter: () => {},
      onTrainerBattle: () => {},
      onBossBattle: () => {},
      random: () => 0.999,
    });
    const ctx = recordingCtx();
    scene.draw?.(ctx);

    // per-pixel (1×1) fills in the AUTHORED tile's colours come from the 'g' cells'
    // pixel-art draw path; the flat placeholder grass draws as a single 16×16 fill.
    // (Player/NPC sprites also emit 1×1 fills — hence we count fills in authored
    // colours, not "every 1×1 fill", to prove the tile rendered without over-claiming.)
    const authoredPixelFills = ctx.fills.filter((f) => f.w === 1 && f.h === 1 && authored.has(f.color));
    const authoredColorsDrawn = new Set(authoredPixelFills.map((f) => f.color));
    expect(authoredPixelFills.length).toBeGreaterThanOrEqual(256); // ≥ one full authored tile's pixels rendered
    expect(authoredColorsDrawn.size).toBeGreaterThanOrEqual(2); // real art — multiple authored colours hit the canvas
    expect([...authoredColorsDrawn].some((c) => c.toLowerCase() !== '#86c06c')).toBe(true); // not just the flat fallback

    // and the placeholder grass still renders as flat 16×16 fills elsewhere (patch, not whole map)
    expect(ctx.fills.some((f) => f.w === 16 && f.h === 16 && f.color.toLowerCase() === '#86c06c')).toBe(true);
  });
});
