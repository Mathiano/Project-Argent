// A reusable paged-message overlay — a modal cutscene textbox over a dimmed
// backdrop (the paused scene shows through). Pages through `lines` 3 at a time;
// A/B/START advances; onDone fires once the last page is dismissed. Used by the
// CH1 ending beats; reusable for any narrated, non-branching cutscene text.

import { LOGICAL_H, LOGICAL_W } from '../canvas';
import { PALETTE } from '../palette';
import type { InputKey, Scene } from '../scene';
import { drawPanel, drawText } from '../ui';

export interface MessageSceneOpts {
  readonly lines: readonly string[];
  readonly onDone: () => void;
  readonly linesPerPage?: number;
}

const PER_PAGE = 3;

export function createMessageScene(opts: MessageSceneOpts): Scene {
  const perPage = opts.linesPerPage ?? PER_PAGE;
  const totalPages = Math.max(1, Math.ceil(opts.lines.length / perPage));
  let page = 0;
  let tick = 0;

  function advance(): void {
    page += 1;
    if (page >= totalPages) opts.onDone();
  }

  return {
    input(key: InputKey): void {
      if (key === 'a' || key === 'b' || key === 'start') advance();
    },
    update(dt: number): void {
      tick += dt;
    },
    draw(ctx: CanvasRenderingContext2D): void {
      ctx.fillStyle = 'rgba(16, 22, 34, 0.6)';
      ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
      const x = 2, y = LOGICAL_H - 50, w = LOGICAL_W - 4, h = 48;
      drawPanel(ctx, x, y, w, h);
      const slice = opts.lines.slice(page * perPage, page * perPage + perPage);
      slice.forEach((line, i) => drawText(ctx, line, x + 8, y + 8 + i * 12));
      if (Math.floor(tick * 2) % 2 === 0) {
        drawText(ctx, '▼', x + w - 14, y + h - 12, PALETTE.ink);
      }
    },
  };
}
