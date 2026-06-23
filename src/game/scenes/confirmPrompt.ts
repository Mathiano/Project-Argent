// A minimal reusable YES/NO confirm overlay. Left/right (or up/down) move the
// cursor; A/START confirms the highlighted option; B = No. Keyboard-first.

import { LOGICAL_H, LOGICAL_W } from '../canvas';
import type { InputKey, Scene } from '../scene';
import { PALETTE } from '../palette';
import { drawPanel, drawText } from '../ui';

export interface ConfirmOpts {
  readonly prompt: string;
  readonly onYes: () => void;
  readonly onNo: () => void;
  readonly defaultYes?: boolean; // initial cursor (default: No, the safe choice)
}

export function createConfirmScene(opts: ConfirmOpts): Scene {
  let yes = opts.defaultYes ?? false;
  return {
    input(key: InputKey): void {
      if (key === 'left' || key === 'right' || key === 'up' || key === 'down') yes = !yes;
      else if (key === 'a' || key === 'start') (yes ? opts.onYes : opts.onNo)();
      else if (key === 'b') opts.onNo();
    },
    draw(ctx: CanvasRenderingContext2D): void {
      ctx.fillStyle = 'rgba(20,20,30,0.55)';
      ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
      const w = LOGICAL_W - 40, h = 56, x = 20, y = Math.round((LOGICAL_H - h) / 2);
      drawPanel(ctx, x, y, w, h);
      drawText(ctx, opts.prompt, x + 8, y + 10);
      const yesLabel = (yes ? '▶ ' : '  ') + 'YES';
      const noLabel = (!yes ? '▶ ' : '  ') + 'NO';
      drawText(ctx, yesLabel, x + 12, y + 30, yes ? PALETTE.hpOk : PALETTE.ink);
      drawText(ctx, noLabel, x + 80, y + 30, !yes ? PALETTE.hpOk : PALETTE.ink);
    },
  };
}
