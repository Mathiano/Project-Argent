import type { Species } from '../../engine';
import { LOGICAL_H, LOGICAL_W } from '../canvas';
import { PALETTE } from '../palette';
import type { InputKey, Scene } from '../scene';
import { drawSpeciesInSlot } from '../sprites';
import { drawPanel, drawText } from '../ui';

export interface PrepSceneOpts {
  readonly playerSpecies: Species;
  readonly foeSpecies: Species;
  readonly foeTrainerName: string;
  readonly onContinue: () => void;
}

export function createPrepScene(opts: PrepSceneOpts): Scene {
  const faster = opts.playerSpecies.spd > opts.foeSpecies.spd;
  let tick = 0;

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

      // Title bar
      drawText(ctx, 'SCOUT REPORT', 122, 4, PALETTE.paper);

      drawPanel(ctx, 8, 14, LOGICAL_W - 16, LOGICAL_H - 22);

      // Foe sprite slot
      const slotX = LOGICAL_W - 76;
      const slotY = 26;
      ctx.fillStyle = PALETTE.platform;
      ctx.beginPath();
      ctx.ellipse(slotX + 28, slotY + 56, 28, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      drawSpeciesInSlot(
        ctx,
        { name: opts.foeSpecies.name, type: opts.foeSpecies.type },
        slotX,
        slotY,
      );

      // Trainer + species
      drawText(ctx, `${opts.foeTrainerName}'s ${opts.foeSpecies.name}`, 18, 28);
      drawText(ctx, 'TYPE: edge vs you', 18, 42, PALETTE.hpCrit);
      drawText(
        ctx,
        `SPD ${opts.foeSpecies.spd} (${faster ? 'SLOWER' : 'FASTER'})`,
        18,
        56,
      );
      drawText(ctx, 'HABIT: ALL-OUT ATK', 18, 70);

      // Divider
      ctx.fillStyle = PALETTE.barEmpty;
      ctx.fillRect(18, 84, LOGICAL_W - 36, 1);

      drawText(ctx, 'PLAN:', 18, 92, PALETTE.paperShadow);

      if (faster) {
        drawText(ctx, 'You are faster: FLUID', 18, 106);
        drawText(ctx, 'dodges his Aggressive', 18, 118);
        drawText(ctx, 'attacks. Stamina is', 18, 130);
        drawText(ctx, 'the limit.', 18, 142);
      } else {
        drawText(ctx, 'He outspeeds you:', 18, 106);
        drawText(ctx, 'Aggressive gets dodged.', 18, 118);
        drawText(ctx, 'GUARD + counter his', 18, 130);
        drawText(ctx, 'attacks.', 18, 142);
      }

      drawText(ctx, '★ CALL: catch breath', 18, 156, PALETTE.paperShadow);

      if (Math.floor(tick * 2) % 2 === 0) {
        drawText(ctx, 'A: BATTLE', LOGICAL_W - 76, 156, PALETTE.ink);
      }
    },
  };
}
