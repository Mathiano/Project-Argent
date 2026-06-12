import { LOGICAL_H, LOGICAL_W } from '../canvas';
import { PALETTE } from '../palette';
import type { InputKey, Scene } from '../scene';
import { drawSpeciesInSlot } from '../sprites';
import type { SpeciesRef } from '../sprites';

const SHOWCASE: readonly SpeciesRef[] = [
  { name: 'EMBERCUB', type: 'Flame' },
  { name: 'SPROUTLE', type: 'Sprout' },
  { name: 'AQUAFIN', type: 'Splash' },
  { name: 'FUZZLET', type: null },
  { name: 'MYSTERY', type: 'Flame' },
];

const SLOT = 56;
const SLOT_Y = 28;
const SLOT_X = (i: number): number => 4 + i * 64;

export function createBootScene(getScale: () => number): Scene {
  let tick = 0;
  let flip = false;

  return {
    update(dt) {
      tick += dt;
    },

    input(key: InputKey) {
      if (key === 'a') flip = !flip;
    },

    draw(ctx) {
      ctx.fillStyle = PALETTE.battleSky;
      ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

      // Title bar
      ctx.fillStyle = PALETTE.ink;
      ctx.fillRect(0, 0, LOGICAL_W, 14);
      ctx.font = '8px monospace';
      ctx.textBaseline = 'top';
      ctx.textAlign = 'start';
      ctx.fillStyle = PALETTE.paper;
      ctx.fillText('PROJECT ARGENT — sprite system check', 6, 3);

      // Platforms under each slot for the "standing" look
      for (let i = 0; i < SHOWCASE.length; i += 1) {
        const cx = SLOT_X(i) + SLOT / 2;
        ctx.fillStyle = PALETTE.platform;
        ctx.beginPath();
        ctx.ellipse(cx, SLOT_Y + SLOT - 2, 24, 4, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      // Sprites
      for (let i = 0; i < SHOWCASE.length; i += 1) {
        drawSpeciesInSlot(ctx, SHOWCASE[i]!, SLOT_X(i), SLOT_Y, { flip });
      }

      // Labels
      ctx.font = '6px monospace';
      ctx.fillStyle = PALETTE.ink;
      ctx.textAlign = 'center';
      for (let i = 0; i < SHOWCASE.length; i += 1) {
        ctx.fillText(SHOWCASE[i]!.name, SLOT_X(i) + SLOT / 2, SLOT_Y + SLOT + 4);
      }
      ctx.textAlign = 'start';

      // Footer
      ctx.font = '8px monospace';
      ctx.fillStyle = PALETTE.ink;
      ctx.fillText(`Canvas ${LOGICAL_W}x${LOGICAL_H} @ ${getScale()}x`, 6, LOGICAL_H - 36);
      ctx.fillStyle = PALETTE.paperShadow;
      ctx.fillText('A toggles sprite flip — animation timer t=' + tick.toFixed(1) + 's', 6, LOGICAL_H - 24);
      ctx.fillStyle = PALETTE.paperDim;
      ctx.fillText('14x14 demo sprites stand on the slot floor; EMBERCUB is the 56x56 ref.', 6, LOGICAL_H - 12);
    },
  };
}
