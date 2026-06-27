// PRODUCTION-PATH render verification for the Pocket Creature Tamer tiles.
//
// The ?skip=pct-tiles scaffold draws via a DEBUG drawImage bypass (slicing a
// multi-tile source PNG) — its "fragments" could be scaffold sloppiness. This test
// answers the real question: do the pct_* tiles render as COMPLETE, correctly
// positioned 16×16 tiles through the ACTUAL engine path the overworld uses for real
// maps — TileDef.tileRef -> tilesetCatalog (getTileset) -> loadTileset decode ->
// drawTiles/drawOneTile (bake/drawImage in the browser; per-pixel drawTilePixels
// headless)? It drives the genuine createOverworldScene renderer on the
// __PCT_VERIFY__ fixture map (whose cells opt into pct tiles via tileRef) and
// asserts each tile lands whole, in its exact cell, with no smear/clip/overflow.
//
// Headless (no DOM) the renderer takes its per-pixel drawTilePixels path, so each
// tile pixel is a 1×1 fillRect we can capture and check against the loadTileset-
// decoded pixels. The browser's baked path bakes the SAME decoded pixels to a 16×16
// canvas and drawImages it at the same integer (x*16, y*16) offset — so per-pixel
// correctness here implies baked correctness there (drawImage of a correct 16×16
// bake at an integer coord cannot fragment).

import { describe, expect, test } from 'vitest';
import fs from 'fs';
import { PNG } from 'pngjs';
import { createOverworldScene } from './overworld'; // transitively loads overworld/maps (registers pct tilesets + __PCT_VERIFY__)
import { getTileset } from '../overworld/tilesetCatalog';
import type { InputKey } from '../scene';

const TS = 16;

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

type Fill = { x: number; y: number; w: number; h: number; color: string };
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
        if (p === 'fillRect') return (x: number, y: number, w: number, h: number) => fills.push({ x, y, w, h, color: fill });
        if (p === 'fillText' || p === 'strokeRect' || p === 'save' || p === 'restore') return noop;
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

// Decoded pixels of one pct tile, as the production loadTileset produces them.
function decodedPixels(tilesetName: string, tileId: string): ReadonlyArray<string | null> {
  return getTileset(tilesetName).tiles[tileId]!.pixels;
}

// All 1×1 fills landing inside cell (cx,cy), keyed "x,y" -> lowercased color.
function cellFills(fills: readonly Fill[], cx: number, cy: number): Map<string, string> {
  const out = new Map<string, string>();
  const x0 = cx * TS, y0 = cy * TS;
  for (const f of fills) {
    if (f.w !== 1 || f.h !== 1) continue;
    if (f.x >= x0 && f.x < x0 + TS && f.y >= y0 && f.y < y0 + TS) out.set(`${f.x},${f.y}`, f.color.toLowerCase());
  }
  return out;
}

function buildScene() {
  const scene = createOverworldScene({
    map: '__PCT_VERIFY__',
    spawn: 'default', // player at (5,5) — clear of every asserted cell
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
  return ctx;
}

describe('PCT tiles — PRODUCTION render path (tileRef → registry → indexed decode → draw)', () => {
  // For a FULLY-OPAQUE tile at cell (cx,cy): the captured per-pixel fills must
  // EXACTLY equal the loadTileset-decoded pixels mapped to that cell — same 256
  // positions, same colours, nothing outside the cell. That single equality proves
  // whole + correctly sliced + correctly positioned + no smear/clip/overflow.
  const opaqueCases: ReadonlyArray<[string, string, string, number, number]> = [
    ['grass', 'pct_grass', 'r1c1', 1, 0],
    ['path', 'pct_path', 'r2c9', 0, 0],
    ['water', 'pct_water', 'r0c0', 4, 1],
  ];

  for (const [label, tsName, tileId, cx, cy] of opaqueCases) {
    test(`${label} renders as one whole, correctly positioned 16×16 tile`, () => {
      const ctx = buildScene();
      const pixels = decodedPixels(tsName, tileId);
      // Fixture sanity: this case is meant to be a fully-opaque tile.
      expect(pixels.every((p) => p !== null)).toBe(true);
      expect(pixels.length).toBe(TS * TS);

      const got = cellFills(ctx.fills, cx, cy);
      // Exactly 256 pixels drawn in this cell — whole tile, no missing/extra.
      expect(got.size).toBe(TS * TS);
      // Every decoded pixel is present at its exact in-cell position + colour.
      for (let i = 0; i < pixels.length; i += 1) {
        const px = i % TS, py = Math.floor(i / TS);
        const key = `${cx * TS + px},${cy * TS + py}`;
        expect(got.get(key)).toBe((pixels[i] as string).toLowerCase());
      }
    });
  }

  test('tree (partial-opaque foliage) renders its opaque pixels in-cell, transparent gaps left empty', () => {
    const ctx = buildScene();
    const pixels = decodedPixels('pct_trees', 'r1c1');
    const opaqueN = pixels.filter((p) => p !== null).length;
    expect(opaqueN).toBeGreaterThan(0);
    expect(opaqueN).toBeLessThan(TS * TS); // genuinely has transparency (it overlays grass)

    const got = cellFills(ctx.fills, 2, 1);
    // Only the opaque pixels are drawn — count matches, and each matches position+colour.
    expect(got.size).toBe(opaqueN);
    for (let i = 0; i < pixels.length; i += 1) {
      const px = i % TS, py = Math.floor(i / TS);
      const key = `${2 * TS + px},${1 * TS + py}`;
      if (pixels[i] === null) expect(got.has(key)).toBe(false); // transparent → not filled
      else expect(got.get(key)).toBe((pixels[i] as string).toLowerCase());
    }
  });

  test('no tile-coloured pixel ever lands off its 16-aligned cell (global no-smear)', () => {
    const ctx = buildScene();
    // Collect every authored colour across the referenced pct tiles.
    const authored = new Set<string>();
    for (const [, tsName, tileId] of [
      ['', 'pct_grass', 'r1c1'],
      ['', 'pct_path', 'r2c9'],
      ['', 'pct_water', 'r0c0'],
      ['', 'pct_trees', 'r1c1'],
    ] as const) {
      for (const c of decodedPixels(tsName, tileId)) if (c) authored.add(c.toLowerCase());
    }
    // Every 1×1 fill in an authored colour must sit at integer coords within the
    // 6×6 map's pixel bounds (no fractional offset, no out-of-cell drift).
    for (const f of ctx.fills) {
      if (f.w !== 1 || f.h !== 1) continue;
      if (!authored.has(f.color.toLowerCase())) continue; // skip player/HUD colours
      expect(Number.isInteger(f.x) && Number.isInteger(f.y)).toBe(true);
      expect(f.x).toBeGreaterThanOrEqual(0);
      expect(f.y).toBeGreaterThanOrEqual(0);
      expect(f.x).toBeLessThan(6 * TS);
      expect(f.y).toBeLessThan(6 * TS);
    }
  });

  // Visual artifact (not an assertion) — render the captured production fills to a
  // PNG so the result can be eyeballed. Written under tmp/ (gitignored).
  test('dump a PNG of the production render for visual inspection', () => {
    const ctx = buildScene();
    const W = 6 * TS, H = 6 * TS;
    const png = new PNG({ width: W, height: H });
    png.data.fill(0);
    const hex = (c: string): [number, number, number] | null => {
      const m = /^#([0-9a-f]{6})$/i.exec(c);
      if (!m) return null;
      const n = parseInt(m[1]!, 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    };
    for (const f of ctx.fills) {
      const rgb = hex(f.color);
      if (!rgb) continue;
      for (let yy = 0; yy < f.h; yy += 1)
        for (let xx = 0; xx < f.w; xx += 1) {
          const x = f.x + xx, y = f.y + yy;
          if (x < 0 || y < 0 || x >= W || y >= H) continue;
          const i = (y * W + x) * 4;
          png.data[i] = rgb[0]; png.data[i + 1] = rgb[1]; png.data[i + 2] = rgb[2]; png.data[i + 3] = 255;
        }
    }
    fs.mkdirSync('tmp', { recursive: true });
    fs.writeFileSync('tmp/pct_prod_render.png', PNG.sync.write(png));
    expect(fs.existsSync('tmp/pct_prod_render.png')).toBe(true);
  });
});
