// Phase 6b — the evolution beat. A held two-step moment shown at the end
// of a qualifying battle when a mon's bond + badge gates both align.
// Placeholder visual (the full silhouette-morph sequence is Phase 7+ art,
// logged in docs/visual-north-star.md Layer 5). A/Start advances; the
// caller applies the evolution + continues via onDone.

import { LOGICAL_H, LOGICAL_W } from '../canvas';
import { PALETTE } from '../palette';
import type { InputKey, Scene } from '../scene';
import { drawPanel, drawText } from '../ui';

export interface EvolutionSceneOpts {
  readonly fromName: string;
  readonly toName: string;
  readonly onDone: () => void;
}

export function createEvolutionScene(opts: EvolutionSceneOpts): Scene {
  let tick = 0;
  // 0 = "is evolving!", 1 = "evolved into …!"
  let beat: 0 | 1 = 0;

  return {
    update(dt) {
      tick += dt;
    },
    input(key: InputKey) {
      if (key !== 'a' && key !== 'start') return;
      if (beat === 0) {
        beat = 1;
        tick = 0;
      } else {
        opts.onDone();
      }
    },
    draw(ctx) {
      ctx.fillStyle = '#0c0f1a';
      ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

      // A pulsing morph glow behind the name — placeholder for the
      // silhouette-morph sequence (Phase 7+).
      const cx = LOGICAL_W / 2;
      const cy = 64;
      const pulse = (Math.sin(tick * 5) + 1) / 2;
      ctx.fillStyle = beat === 1 ? PALETTE.star : '#3a6ea5';
      const r = 10 + pulse * (beat === 1 ? 10 : 5);
      ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
      ctx.strokeStyle = PALETTE.ink;
      ctx.strokeRect(cx - r + 0.5, cy - r + 0.5, r * 2 - 1, r * 2 - 1);

      drawPanel(ctx, 24, 100, LOGICAL_W - 48, 60);
      if (beat === 0) {
        drawText(ctx, `${opts.fromName} is evolving!`, 36, 110, PALETTE.paper);
        drawText(ctx, '(light pours off it…)', 36, 124, PALETTE.paperShadow);
      } else {
        drawText(ctx, `${opts.fromName} evolved into`, 36, 110, PALETTE.paper);
        drawText(ctx, `${opts.toName}!`, 36, 124, PALETTE.star);
      }
      if (Math.floor(tick * 2) % 2 === 0) {
        drawText(ctx, 'A: continue', LOGICAL_W - 90, 150, PALETTE.paperDim);
      }
    },
  };
}
