// End-to-end: the IMPORTED Tiled map (__TILED_TEST__) renders through the REAL
// overworld renderer (createOverworldScene → drawImportedLayers → drawOneTile →
// per-pixel/baked draw). Proves the new multi-layer import path draws actual pct
// tile pixels, and dumps a PNG (tmp/, gitignored) to eyeball the map in-engine.
import { describe, expect, test } from 'vitest';
import fs from 'fs';
import { PNG } from 'pngjs';
import { createOverworldScene } from './overworld';
import { getMap } from '../overworld/maps';
import type { InputKey } from '../scene';
import { LOGICAL_H, LOGICAL_W } from '../canvas';

function mockFlags() {
  const s = new Set<string>();
  return { has: (f: string) => s.has(f), set: (f: string) => void s.add(f), unset: (f: string) => void s.delete(f) };
}
function mockInput() {
  const held = new Set<InputKey>();
  return { pressed: (k: InputKey) => held.has(k), press: (k: InputKey) => void held.add(k), release: (k: InputKey) => void held.delete(k), releaseAll: () => held.clear() };
}
type Fill = { x: number; y: number; w: number; h: number; color: string };
function recordingCtx(): CanvasRenderingContext2D & { fills: Fill[] } {
  const fills: Fill[] = [];
  let fill = '#000';
  const noop = () => {};
  return new Proxy({ fills }, {
    get(_t, p) {
      if (p === 'fills') return fills;
      if (p === 'fillStyle') return fill;
      if (p === 'fillRect') return (x: number, y: number, w: number, h: number) => fills.push({ x, y, w, h, color: fill });
      if (p === 'measureText') return () => ({ width: 10 });
      if (p === 'canvas') return { width: LOGICAL_W, height: LOGICAL_H };
      return noop;
    },
    set(_t, p, v) { if (p === 'fillStyle') fill = String(v); return true; },
  }) as unknown as CanvasRenderingContext2D & { fills: Fill[] };
}

describe('imported Tiled map renders through the production path', () => {
  test('drawing __TILED_TEST__ emits real per-pixel tile fills (multi-layer)', () => {
    const map = getMap('__TILED_TEST__');
    expect(map.importedLayers!.length).toBe(3);
    const scene = createOverworldScene({
      map: '__TILED_TEST__', spawn: 'default', inputState: mockInput(), flags: mockFlags(),
      onWarp: () => {}, onEncounter: () => {}, onTrainerBattle: () => {}, onBossBattle: () => {}, random: () => 0.999,
    });
    const ctx = recordingCtx();
    scene.draw?.(ctx);

    // Per-pixel (1×1) tile fills from drawImportedLayers' per-pixel fallback path.
    const tilePx = ctx.fills.filter((f) => f.w === 1 && f.h === 1);
    expect(tilePx.length).toBeGreaterThan(2000); // many tiles' worth of pixels drawn
    expect(new Set(tilePx.map((f) => f.color)).size).toBeGreaterThanOrEqual(5); // real multi-colour art

    // Dump the viewport to a PNG for visual inspection (gitignored).
    const W = LOGICAL_W, H = LOGICAL_H;
    const png = new PNG({ width: W, height: H });
    png.data.fill(0);
    const hex = (c: string): [number, number, number] | null => {
      const m = /^#([0-9a-f]{6})$/i.exec(c); if (!m) return null;
      const n = parseInt(m[1]!, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    };
    for (const f of ctx.fills) {
      const rgb = hex(f.color); if (!rgb) continue;
      for (let yy = 0; yy < f.h; yy += 1) for (let xx = 0; xx < f.w; xx += 1) {
        const x = f.x + xx, y = f.y + yy; if (x < 0 || y < 0 || x >= W || y >= H) continue;
        const i = (y * W + x) * 4; png.data[i] = rgb[0]; png.data[i + 1] = rgb[1]; png.data[i + 2] = rgb[2]; png.data[i + 3] = 255;
      }
    }
    fs.mkdirSync('tmp', { recursive: true });
    fs.writeFileSync('tmp/tiled_import_render.png', PNG.sync.write(png));
    expect(fs.existsSync('tmp/tiled_import_render.png')).toBe(true);
  });
});
