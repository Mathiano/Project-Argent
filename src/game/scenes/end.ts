import { LOGICAL_H, LOGICAL_W } from '../canvas';
import { PALETTE } from '../palette';
import type { InputKey, Scene } from '../scene';
import { drawText } from '../ui';

export interface EndSceneOpts {
  readonly won: boolean;
  readonly onRestart: () => void;
}

export function createEndScene(opts: EndSceneOpts): Scene {
  let tick = 0;

  const lines = opts.won
    ? [
        'Rival beaten — with',
        'the type edge against',
        'you. Reads > stats.',
      ]
    : [
        'The rival walks on.',
        'Reads beat edges —',
        'next time.',
      ];

  return {
    update(dt) {
      tick += dt;
    },

    input(key: InputKey) {
      if (key === 'a' || key === 'start') opts.onRestart();
    },

    draw(ctx) {
      ctx.fillStyle = '#101622';
      ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

      drawText(ctx, 'DEMO END', 124, 16, PALETTE.paper);

      ctx.fillStyle = '#1c2a44';
      ctx.fillRect(0, 36, LOGICAL_W, 1);

      lines.forEach((line, i) => {
        drawText(ctx, line, 56, 54 + i * 12, '#c5cfe2');
      });

      const liveLines = [
        'Live: stances, clash,',
        'dodge rule, counters,',
        'openings, ★ Calls,',
        'stamina locks, scout',
        'prep, coach tips.',
      ];
      liveLines.forEach((line, i) => {
        drawText(ctx, line, 56, 102 + i * 11, PALETTE.paperDim);
      });

      if (Math.floor(tick * 2) % 2 === 0) {
        drawText(ctx, 'A: title', LOGICAL_W - 76, 162, PALETTE.paper);
      }
    },
  };
}
