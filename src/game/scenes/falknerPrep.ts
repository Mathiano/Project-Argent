// Falkner-specific scout report driven by the boss card's notes.
// Distinct from the generic createPrepScene (KAMON-rival style).

import type { Species } from '../../engine';
import { LOGICAL_H, LOGICAL_W } from '../canvas';
import { PALETTE } from '../palette';
import type { InputKey, Scene } from '../scene';
import { drawSpeciesInSlot } from '../sprites';
import { drawPanel, drawText } from '../ui';

export interface FalknerPrepSceneOpts {
  readonly playerSpecies: Species;
  readonly foeSpecies: Species;
  readonly onContinue: () => void;
}

export function createFalknerPrepScene(opts: FalknerPrepSceneOpts): Scene {
  let tick = 0;
  const faster = opts.playerSpecies.spd > opts.foeSpecies.spd;

  return {
    update(dt) {
      tick += dt;
    },

    input(key: InputKey) {
      if (key === 'a' || key === 'start') opts.onContinue();
    },

    draw(ctx) {
      ctx.fillStyle = PALETTE.ink;
      ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

      drawText(ctx, 'SCOUT REPORT — VIOLET GYM', 80, 4, PALETTE.paper);
      drawPanel(ctx, 8, 14, LOGICAL_W - 16, LOGICAL_H - 22);

      const slotX = LOGICAL_W - 76;
      const slotY = 26;
      ctx.fillStyle = PALETTE.platform;
      ctx.beginPath();
      ctx.ellipse(slotX + 28, slotY + 56, 28, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      drawSpeciesInSlot(
        ctx,
        { name: opts.foeSpecies.name, type: opts.foeSpecies.types[0] ?? null },
        slotX,
        slotY,
      );

      drawText(ctx, `FALKNER's ${opts.foeSpecies.name}`, 18, 28);
      drawText(ctx, 'TYPE: GALE — hits SPROUT', 18, 42, PALETTE.hpCrit);

      drawText(ctx, `SPD ${opts.foeSpecies.spd} (${faster ? 'SLOWER' : 'FASTER off-gust'})`, 18, 56);
      drawText(ctx, 'TRAIT: GUSTBORNE', 18, 70);
      drawText(ctx, 'HABIT: strikes with the wind —', 18, 84);
      drawText(ctx, 'count the rounds.', 18, 96, PALETTE.paperShadow);

      ctx.fillStyle = PALETTE.barEmpty;
      ctx.fillRect(18, 108, LOGICAL_W - 36, 1);

      drawText(ctx, 'PLAN:', 18, 116, PALETTE.paperShadow);
      drawText(ctx, 'Gusts every 3rd round, telegraphed.', 18, 128);
      drawText(ctx, 'Guard the gust, counter the dive.', 18, 138);
      drawText(ctx, 'Break bar 2 — two reads cracks him.', 18, 148, PALETTE.hpOk);

      drawText(ctx, '★ Catch Breath on the round BEFORE', 18, 162, PALETTE.paperShadow);
      drawText(ctx, 'a gust is the safe tempo play.', 18, 172, PALETTE.paperShadow);

      if (Math.floor(tick * 2) % 2 === 0) {
        drawText(ctx, 'A: FIGHT', LOGICAL_W - 70, 168, PALETTE.paper);
      }
    },
  };
}
