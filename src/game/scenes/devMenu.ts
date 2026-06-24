// Dev debug menu — the convenient (in-session) form of the dev-nav URL params.
// A flat, scrollable list of actions (map jumps, progression presets, party sets)
// that call the SAME dev-state setters main.ts uses for the URL form. Dev-only:
// main.ts only constructs + opens this behind the import.meta.env.DEV gate.

import { LOGICAL_H, LOGICAL_W } from '../canvas';
import type { InputKey, Scene } from '../scene';
import { PALETTE } from '../palette';
import { drawPanel, drawText } from '../ui';

export interface DevMenuItem {
  readonly label: string;
  readonly run: () => void;
}

export function createDevMenuScene(items: readonly DevMenuItem[], onClose: () => void): Scene {
  let sel = 0;
  const lh = 11;
  return {
    input(key: InputKey): void {
      if (items.length === 0) {
        if (key === 'b') onClose();
        return;
      }
      if (key === 'up') sel = (sel - 1 + items.length) % items.length;
      else if (key === 'down') sel = (sel + 1) % items.length;
      else if (key === 'a' || key === 'start') items[sel]!.run();
      else if (key === 'b') onClose();
    },
    draw(ctx: CanvasRenderingContext2D): void {
      ctx.fillStyle = 'rgba(10,12,20,0.88)';
      ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
      drawPanel(ctx, 8, 8, LOGICAL_W - 16, LOGICAL_H - 16);
      drawText(ctx, 'DEV MENU   ` close · ↑↓ move · A go', 16, 14, PALETTE.paper);
      const top = 30;
      const maxRows = Math.max(1, Math.floor((LOGICAL_H - 22 - top) / lh));
      const start = Math.max(0, Math.min(sel - (maxRows >> 1), Math.max(0, items.length - maxRows)));
      for (let i = 0; i < Math.min(maxRows, items.length); i += 1) {
        const idx = start + i;
        const it = items[idx];
        if (!it) break;
        drawText(
          ctx,
          (idx === sel ? '> ' : '  ') + it.label,
          16,
          top + i * lh,
          idx === sel ? PALETTE.hpOk : PALETTE.paperDim,
        );
      }
    },
  };
}
