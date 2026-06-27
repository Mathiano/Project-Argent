// Pocket Creature Tamer — PIPELINE TEST scene (dev-only, ?skip=pct-tiles).
//
// NOT map authoring. A contained check that the bought 16×16 pack renders in
// Argent at 320×180. It draws a few SAMPLE tiles (sliced 16×16 straight from the
// pack sheets) composed into a tiny patch — grass field + a path + a tree + a
// water pool — plus the four source tiles as labelled swatches.
//
// ⚠️ It draws the pack's RGBA art DIRECTLY (drawImage), i.e. at the pack's
// NATIVE palette — it deliberately does NOT route through the palette-indexed
// tileset pipeline (src/game/overworld/tileset.ts), because the pack's colours
// are disjoint from the locked argent-master palette (0/37 overlap — see the
// pipeline-test report). So this shows the pack's true look, which informs the
// palette-lift / adopt-palette decision. Authoring real maps still needs Tiled.

import grassUrl from '../../assets/pct-sample/grass.png';
import pathUrl from '../../assets/pct-sample/path.png';
import waterUrl from '../../assets/pct-sample/water.png';
import treesUrl from '../../assets/pct-sample/trees.png';
import { LOGICAL_H, LOGICAL_W } from '../canvas';
import { PALETTE } from '../palette';
import type { InputKey, Scene } from '../scene';
import { drawText } from '../ui';

const T = 16; // pack tile size

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

  // Slice cell (col,row) of a sheet to (dx,dy) on the canvas.
  function cell(ctx: CanvasRenderingContext2D, img: HTMLImageElement, col: number, row: number, dx: number, dy: number): void {
    ctx.drawImage(img, col * T, row * T, T, T, dx, dy, T, T);
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

      // ── Composed patch: a grass field with a path, a tree, and water ───────
      const ox = 8;
      const oy = 22;
      const cols = 11;
      const rows = 7;
      // Grass base (cell 0,0 tiled).
      for (let r = 0; r < rows; r += 1) {
        for (let c = 0; c < cols; c += 1) cell(ctx, grass, 0, 0, ox + c * T, oy + r * T);
      }
      // A vertical path down column 3 (path sheet cell 1,1 — a mid path tile).
      for (let r = 0; r < rows; r += 1) cell(ctx, path, 1, 1, ox + 3 * T, oy + r * T);
      // A water pool (3×2) at the bottom-right, frame 0 of the water sheet.
      for (let r = 0; r < 2; r += 1) {
        for (let c = 0; c < 3; c += 1) cell(ctx, water, 0, 0, ox + (7 + c) * T, oy + (5 + r) * T);
      }
      // A tree (2×3 block from the trees sheet top-left) on the grass.
      for (let r = 0; r < 3; r += 1) {
        for (let c = 0; c < 2; c += 1) cell(ctx, trees, c, r, ox + (6 + c) * T, oy + r * T);
      }

      // ── Source swatches (right column) ────────────────────────────────────
      const sx = ox + cols * T + 12;
      const swatches: ReadonlyArray<readonly [HTMLImageElement, string]> = [
        [grass, 'grass'],
        [path, 'path'],
        [water, 'water'],
        [trees, 'tree'],
      ];
      swatches.forEach(([img, label], i) => {
        const sy = oy + i * 34;
        ctx.drawImage(img, 0, 0, T, T, sx, sy, T * 2, T * 2); // 2× for visibility
        drawText(ctx, label, sx + T * 2 + 4, sy + 8, PALETTE.paper);
      });

      // Caption.
      drawText(ctx, 'POCKET CREATURE TAMER - pipeline test', 8, 6, PALETTE.star);
      drawText(ctx, '16x16, NATIVE palette (not indexed). A/B exits.', 8, 14, PALETTE.paperDim);
    },
  };
}
