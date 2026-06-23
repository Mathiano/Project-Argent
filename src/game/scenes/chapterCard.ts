// A reusable full-screen chapter card — "CHAPTER ONE / <title> / To be continued."
// A/START dismisses (→ onDone). Light, reusable for future chapter ends; replaces
// the old Route 32 boundary placard.

import { LOGICAL_H, LOGICAL_W } from '../canvas';
import { PALETTE } from '../palette';
import type { InputKey, Scene } from '../scene';
import { drawText } from '../ui';

export interface ChapterCardOpts {
  readonly chapter: string;
  readonly title: string;
  readonly footer: string;
  readonly onDone: () => void;
}

// 8px monospace ≈ 4.8px/char — center text by its rough pixel width.
function centerX(text: string): number {
  return Math.round((LOGICAL_W - text.length * 4.8) / 2);
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
      drawText(ctx, opts.chapter, centerX(opts.chapter), 64, PALETTE.paperDim);
      drawText(ctx, opts.title, centerX(opts.title), 84, PALETTE.paper);
      drawText(ctx, opts.footer, centerX(opts.footer), 108, PALETTE.paperShadow);
      if (Math.floor(tick * 2) % 2 === 0) {
        drawText(ctx, 'A', LOGICAL_W - 16, LOGICAL_H - 14, PALETTE.paperDim);
      }
    },
  };
}
