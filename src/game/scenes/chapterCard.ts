// A reusable full-screen chapter card — "CHAPTER ONE / <title> / To be continued."
// A/START dismisses (→ onDone). Light, reusable for future chapter ends; replaces
// the old Route 32 boundary placard.

import { LOGICAL_H, LOGICAL_W } from '../canvas';
import { PALETTE } from '../palette';
import type { InputKey, Scene } from '../scene';
import { drawText, UI_FONT } from '../ui';

export interface ChapterCardOpts {
  readonly chapter: string;
  readonly title: string;
  readonly footer: string;
  readonly onDone: () => void;
}

// m5x7 is proportional → MEASURE the text and centre it (no fixed char width).
function drawCentered(ctx: CanvasRenderingContext2D, text: string, y: number, color: string): void {
  ctx.font = UI_FONT;
  const x = Math.round((LOGICAL_W - ctx.measureText(text).width) / 2);
  drawText(ctx, text, x, y, color);
}

export function createChapterCardScene(opts: ChapterCardOpts): Scene {
  let tick = 0;
  return {
    input(key: InputKey): void {
      if (key === 'a' || key === 'start') opts.onDone();
    },
    update(dt: number): void {
      tick += dt;
    },
    draw(ctx: CanvasRenderingContext2D): void {
      ctx.fillStyle = '#0d1018';
      ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
      drawCentered(ctx, opts.chapter, 64, PALETTE.paperDim);
      drawCentered(ctx, opts.title, 84, PALETTE.paper);
      drawCentered(ctx, opts.footer, 108, PALETTE.paperShadow);
      if (Math.floor(tick * 2) % 2 === 0) {
        drawText(ctx, 'A', LOGICAL_W - 16, LOGICAL_H - 14, PALETTE.paperDim);
      }
    },
  };
}
