// Demo-complete — the badge payoff beat. Shown the moment the player
// beats a gym leader from the overworld (and on the ?skip=falkner
// standalone). A short fanfare panel; A/Start continues (back to the
// gym in the real path, to the title on the skip path — the caller
// decides via onContinue).

import { LOGICAL_H, LOGICAL_W } from '../canvas';
import { PALETTE } from '../palette';
import type { InputKey, Scene } from '../scene';
import { drawPanel, drawText } from '../ui';

export interface BadgeAwardSceneOpts {
  readonly badgeName: string;
  readonly leaderName: string;
  // Flavor lines under the headline (2–3 short lines).
  readonly lines: readonly string[];
  readonly onContinue: () => void;
}

export function createBadgeAwardScene(opts: BadgeAwardSceneOpts): Scene {
  let tick = 0;
  return {
    update(dt) {
      tick += dt;
    },
    input(key: InputKey) {
      if (key === 'a' || key === 'start') opts.onContinue();
    },
    draw(ctx) {
      ctx.fillStyle = '#101622';
      ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

      // Sky-burst backdrop — a few pulsing rays behind the badge.
      const cx = LOGICAL_W / 2;
      const cy = 62;
      const pulse = (Math.sin(tick * 4) + 1) / 2;
      ctx.fillStyle = '#1c2a44';
      for (let i = 0; i < 12; i += 1) {
        const a = (i / 12) * Math.PI * 2 + tick * 0.6;
        const len = 70 + pulse * 8;
        ctx.fillRect(cx + Math.cos(a) * 14, cy + Math.sin(a) * 14, 2, 2);
        ctx.fillRect(
          Math.round(cx + Math.cos(a) * len),
          Math.round(cy + Math.sin(a) * len),
          2,
          2,
        );
      }

      // The badge — a star medallion.
      ctx.fillStyle = pulse > 0.5 ? PALETTE.star : '#caa148';
      ctx.fillRect(cx - 9, cy - 9, 18, 18);
      ctx.strokeStyle = PALETTE.ink;
      ctx.strokeRect(cx - 8.5, cy - 8.5, 17, 17);
      drawText(ctx, '★', cx - 4, cy - 5, PALETTE.ink);

      drawPanel(ctx, 24, 96, LOGICAL_W - 48, 70);
      drawText(ctx, `You earned the ${opts.badgeName} BADGE!`, 36, 104, PALETTE.paper);
      drawText(ctx, `${opts.leaderName} nods.`, 36, 118, PALETTE.paperShadow);
      opts.lines.slice(0, 3).forEach((line, i) => {
        drawText(ctx, line, 36, 132 + i * 11, PALETTE.paperDim);
      });

      if (Math.floor(tick * 2) % 2 === 0) {
        drawText(ctx, 'A: continue', LOGICAL_W - 90, 168, PALETTE.paper);
      }
    },
  };
}
