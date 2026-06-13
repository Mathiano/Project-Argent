import type { Species } from '../../engine';
import { LOGICAL_H, LOGICAL_W } from '../canvas';
import { PALETTE } from '../palette';
import type { InputKey, Scene } from '../scene';
import { drawSpeciesInSlot } from '../sprites';
import { drawPanel, drawText } from '../ui';

export interface StarterPickSceneOpts {
  readonly starters: readonly Species[];
  readonly onPick: (species: Species) => void;
}

export function createStarterPickScene(opts: StarterPickSceneOpts): Scene {
  let cursor = 1;
  let tick = 0;

  function species(i: number): Species {
    return opts.starters[i]!;
  }

  return {
    update(dt) {
      tick += dt;
    },

    input(key: InputKey) {
      if (key === 'left') cursor = (cursor + opts.starters.length - 1) % opts.starters.length;
      else if (key === 'right') cursor = (cursor + 1) % opts.starters.length;
      else if (key === 'a' || key === 'start') opts.onPick(species(cursor));
    },

    draw(ctx) {
      ctx.fillStyle = '#101622';
      ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

      drawText(ctx, 'CHOOSE YOUR PARTNER', 88, 8, PALETTE.paper);

      const SLOT = 56;
      const GAP = 16;
      const totalW = opts.starters.length * SLOT + (opts.starters.length - 1) * GAP;
      const startX = (LOGICAL_W - totalW) / 2;
      const slotY = 26;

      opts.starters.forEach((sp, i) => {
        const sx = startX + i * (SLOT + GAP);
        if (i === cursor) {
          ctx.strokeStyle = PALETTE.paper;
          ctx.lineWidth = 1;
          ctx.strokeRect(sx - 2 + 0.5, slotY - 2 + 0.5, SLOT + 3, SLOT + 3);
        }
        ctx.fillStyle = PALETTE.platform;
        ctx.beginPath();
        ctx.ellipse(sx + SLOT / 2, slotY + SLOT - 2, 26, 4, 0, 0, Math.PI * 2);
        ctx.fill();
        drawSpeciesInSlot(ctx, { name: sp.name, type: sp.types[0] ?? null }, sx, slotY);
      });

      const sp = species(cursor);
      drawPanel(ctx, 24, 102, LOGICAL_W - 48, 60);
      drawText(ctx, `${sp.name}  [${sp.types[0] ?? 'Neutral'}]`, 32, 110);
      drawText(ctx, `SPD ${sp.spd}   ATK ${sp.atk}`, 32, 124);
      drawText(ctx, `DEF ${sp.dfn}   HP  ${sp.hp}`, 32, 136);

      const note = sp.spd >= 100 ? 'Fast: dodging works.' :
        sp.dfn >= 105 ? 'Bulky: guard + counter.' :
          'Balanced: read & adapt.';
      drawText(ctx, note, 32, 150, PALETTE.paperShadow);

      if (Math.floor(tick * 2) % 2 === 0) {
        drawText(ctx, 'A: PICK', LOGICAL_W - 64, 168, PALETTE.paper);
      }
    },
  };
}
