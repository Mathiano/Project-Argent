import { LOGICAL_H, LOGICAL_W } from '../canvas';
import { PALETTE } from '../palette';
import type { InputKey, Scene } from '../scene';
import { drawSpeciesInSlot } from '../sprites';
import { drawText } from '../ui';

export interface TitleSceneOpts {
  readonly onStart: () => void;
}

export function createTitleScene(opts: TitleSceneOpts): Scene {
  let tick = 0;

  return {
    update(dt) {
      tick += dt;
    },

    input(key: InputKey) {
      if (key === 'a' || key === 'start') opts.onStart();
    },

    draw(ctx) {
      ctx.fillStyle = '#101622';
      ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

      // Horizon band
      ctx.fillStyle = '#1c2a44';
      for (let i = 0; i < 12; i += 1) ctx.fillRect(0, 130 + i * 4, LOGICAL_W, 2);

      // Hero mons flanking the title
      drawSpeciesInSlot(ctx, { name: 'EMBERCUB', type: 'Flame' }, 30, 52);
      drawSpeciesInSlot(ctx, { name: 'AQUAFIN', type: 'Splash' }, 234, 52, { flip: true });

      // Brand
      drawText(ctx, 'P R O J E C T', 116, 28, '#9fb6d8');
      ctx.font = 'bold 14px monospace';
      ctx.fillStyle = PALETTE.paper;
      ctx.textBaseline = 'top';
      ctx.textAlign = 'center';
      ctx.fillText('A R G E N T', LOGICAL_W / 2, 40);
      ctx.textAlign = 'start';

      drawText(ctx, 'COMBAT 2.0 — DEMO 0.2', 96, 124, '#8aa0c4');

      if (Math.floor(tick * 1.6) % 2 === 0) {
        drawText(ctx, 'PRESS START', 126, 158, PALETTE.paper);
      }
    },
  };
}
