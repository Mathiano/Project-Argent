import { LOGICAL_H, LOGICAL_W } from '../canvas';
import { PALETTE } from '../palette';
import type { InputKey, Scene } from '../scene';

export function createBootScene(getScale: () => number): Scene {
  let tick = 0;
  let prompt = 'Press A — scene framework live';

  return {
    update(dt) {
      tick += dt;
    },

    input(key: InputKey) {
      if (key === 'a' || key === 'start') prompt = `pressed ${key} @ t=${tick.toFixed(1)}s`;
    },

    draw(ctx) {
      ctx.fillStyle = PALETTE.battleSky;
      ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

      ctx.fillStyle = PALETTE.ink;
      ctx.fillRect(0, 0, LOGICAL_W, 14);
      ctx.font = '8px monospace';
      ctx.textBaseline = 'top';
      ctx.fillStyle = PALETTE.paper;
      ctx.fillText('PROJECT ARGENT — Sprint 1 boot', 6, 3);

      ctx.fillStyle = PALETTE.ink;
      ctx.fillText(`Canvas ${LOGICAL_W}x${LOGICAL_H} @ ${getScale()}x integer scale`, 6, 24);
      ctx.fillStyle = PALETTE.paperShadow;
      ctx.fillText(prompt, 6, 36);

      // Blinking cursor proves the scene loop is ticking dt.
      if (Math.floor(tick * 2) % 2 === 0) {
        ctx.fillStyle = PALETTE.ink;
        ctx.fillRect(6 + ctx.measureText(prompt).width + 2, 36, 4, 8);
      }

      ctx.fillStyle = PALETTE.stanceA;
      ctx.fillRect(0, LOGICAL_H - 1, 1, 1);
      ctx.fillStyle = PALETTE.stanceG;
      ctx.fillRect(LOGICAL_W - 1, LOGICAL_H - 1, 1, 1);
      ctx.fillStyle = PALETTE.stanceF;
      ctx.fillRect(LOGICAL_W - 1, 0, 1, 1);
    },
  };
}
