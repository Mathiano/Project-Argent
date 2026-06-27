// Pocket Creature Tamer — PIPELINE TEST scene (dev-only, ?skip=pct-tiles).
//
// NOT map authoring. A contained check that the bought 16×16 pack renders in
// Argent at 320×180. It draws a small patch (grass + path + tree + water) and the
// four source tiles as swatches.
//
// The pack's palette is now CANON: argent-master was re-seeded from it
// (docs/palette-reseed-decision.md). So this scene shows BOTH renders side by side:
//   • NATIVE  — the pack's RGBA drawn directly (drawImage), its true colours.
//   • INDEXED — the SAME tiles routed through the palette-indexed pipeline
//     (src/assets/pct-sample/pct_sample_indexed.json, built by tools/pct_tile_ingest.mjs,
//     decoded against argent-master, drawn per-pixel).
// They should be indistinguishable — confirming the indexed pipeline is near-
// lossless (measured quantisation error mean≈0.01 / max 1.0). Authoring real maps
// still needs Tiled (Phase 8).

import grassUrl from '../../assets/pct-sample/grass.png';
import pathUrl from '../../assets/pct-sample/path.png';
import waterUrl from '../../assets/pct-sample/water.png';
import treesUrl from '../../assets/pct-sample/trees.png';
import indexedSample from '../../assets/pct-sample/pct_sample_indexed.json';
import { LOGICAL_H, LOGICAL_W } from '../canvas';
import { PALETTE } from '../palette';
import { PALETTE_KEYS } from '../overworld/tileset';
import type { InputKey, Scene } from '../scene';
import { drawText } from '../ui';

const T = 16; // pack tile size

type IndexedSheet = { readonly [id: string]: { readonly rows: readonly string[] } };
const SAMPLE = indexedSample as {
  readonly tilesize: number;
  readonly palette: readonly string[];
  readonly sheets: { readonly [name: string]: IndexedSheet };
};

function loadImg(url: string): HTMLImageElement {
  const img = new Image();
  img.src = url;
  return img;
}

export function createPctTileTestScene(opts: { readonly onExit: () => void }): Scene {
  const grass = loadImg(grassUrl);
  const path = loadImg(pathUrl);
  const water = loadImg(waterUrl);
  const trees = loadImg(treesUrl);
  const ready = (i: HTMLImageElement): boolean => i.complete && i.naturalWidth > 0;

  // NATIVE: slice cell (col,row) of a sheet to (dx,dy).
  function cell(ctx: CanvasRenderingContext2D, img: HTMLImageElement, col: number, row: number, dx: number, dy: number): void {
    ctx.drawImage(img, col * T, row * T, T, T, dx, dy, T, T);
  }
  // INDEXED: decode cell (col,row) of a named sheet and draw per-pixel (the real
  // tileset decode path). Blank (fully-transparent) cells were skipped at ingest.
  function indexedCell(ctx: CanvasRenderingContext2D, sheet: string, col: number, row: number, dx: number, dy: number): void {
    const tile = SAMPLE.sheets[sheet]?.[`r${row}c${col}`];
    if (!tile) return;
    for (let y = 0; y < T; y += 1) {
      const line = tile.rows[y]!;
      for (let x = 0; x < T; x += 1) {
        const ch = line[x]!;
        if (ch === '.' || ch === ' ') continue;
        const idx = PALETTE_KEYS.indexOf(ch);
        if (idx < 0 || idx >= SAMPLE.palette.length) continue;
        ctx.fillStyle = SAMPLE.palette[idx]!;
        ctx.fillRect(dx + x, dy + y, 1, 1);
      }
    }
  }

  // Draw the composed patch (grass field + path + tree + water) at origin (ox,oy),
  // using either the native or the indexed draw fn.
  function patch(ctx: CanvasRenderingContext2D, ox: number, oy: number, indexed: boolean): void {
    const cols = 5;
    const rows = 6;
    const g = (col: number, row: number, dx: number, dy: number) =>
      indexed ? indexedCell(ctx, 'grass', col, row, dx, dy) : cell(ctx, grass, col, row, dx, dy);
    const p = (col: number, row: number, dx: number, dy: number) =>
      indexed ? indexedCell(ctx, 'path', col, row, dx, dy) : cell(ctx, path, col, row, dx, dy);
    const w = (col: number, row: number, dx: number, dy: number) =>
      indexed ? indexedCell(ctx, 'water', col, row, dx, dy) : cell(ctx, water, col, row, dx, dy);
    const tr = (col: number, row: number, dx: number, dy: number) =>
      indexed ? indexedCell(ctx, 'trees', col, row, dx, dy) : cell(ctx, trees, col, row, dx, dy);
    for (let r = 0; r < rows; r += 1) for (let c = 0; c < cols; c += 1) g(0, 0, ox + c * T, oy + r * T);
    for (let r = 0; r < rows; r += 1) p(1, 1, ox + 1 * T, oy + r * T); // vertical path col 1
    for (let r = 0; r < 2; r += 1) for (let c = 0; c < 2; c += 1) w(0, 0, ox + (3 + c) * T, oy + (4 + r) * T); // pool
    for (let r = 0; r < 3; r += 1) for (let c = 0; c < 2; c += 1) tr(c, r, ox + (2 + c) * T, oy + r * T); // tree
  }

  return {
    input(key: InputKey): void {
      if (key === 'a' || key === 'b' || key === 'start') opts.onExit();
    },
    draw(ctx: CanvasRenderingContext2D): void {
      ctx.fillStyle = '#0d1018';
      ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
      if (!ready(grass) || !ready(path) || !ready(water) || !ready(trees)) {
        drawText(ctx, 'loading pack tiles...', 8, 8, PALETTE.paper);
        return;
      }

      // Two patches side by side: NATIVE (left) vs INDEXED (right).
      const oy = 28;
      drawText(ctx, 'NATIVE', 8, 20, PALETTE.paperDim);
      patch(ctx, 8, oy, false);
      const rx = 8 + 5 * T + 14;
      drawText(ctx, 'INDEXED', rx, 20, PALETTE.paperDim);
      patch(ctx, rx, oy, true);

      // Source swatches (far right): native (top) vs indexed (bottom), 2×.
      const sx = rx + 5 * T + 12;
      const swatches: ReadonlyArray<readonly [HTMLImageElement, string, string]> = [
        [grass, 'grass', 'grass'],
        [path, 'path', 'path'],
        [water, 'water', 'water'],
        [trees, 'tree', 'trees'],
      ];
      swatches.forEach(([img, label, sheet], i) => {
        const sy = oy + i * 36;
        ctx.drawImage(img, 0, 0, T, T, sx, sy, T, T); // native 1×
        // indexed 1× beside it (scale 1 — indexedCell draws at native size)
        indexedCell(ctx, sheet, 0, 0, sx + T + 3, sy);
        drawText(ctx, label, sx, sy + T + 6, PALETTE.paperDim);
      });

      // Caption.
      drawText(ctx, 'POCKET CREATURE TAMER - palette adopted as argent-master', 8, 6, PALETTE.star);
      drawText(ctx, 'native vs indexed should match (re-seed). A/B exits.', 8, 14, PALETTE.paperDim);
    },
  };
}
