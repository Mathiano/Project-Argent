// The bond meter (Lane A — bond legibility). A slim, XP-style bar that
// surfaces the EXISTING bond value as the player can read it: the named stage
// + progress toward the next stage. Pure presentation — it reads the live
// bond math (stageProgress / bondStageName), never recomputes or mutates it.
//
// Used by the in-combat bar under the player panel (scenes/battle.ts, static
// during the fight, advancing on the post-fight beat) AND by the tier-up beat
// (scenes/bondStage.ts). The "bond bar IS bond" spine of
// docs/bond-legibility-design.md.

import { PALETTE } from './palette';
import { drawText, bevelFilled, UI_FONT } from './ui';
import { stageProgress } from './bond';
import { bondStageName } from './catching';

export interface BondBarOpts {
  // Override the fill fraction (0..1) — the in-combat bar passes an
  // interpolated value during its post-win advance so the fill animates while
  // the STAGE NAME stays put (a tier-cross is the post-fight beat's job, not a
  // mid-fill snap). Omitted → derived from the bond value via stageProgress.
  readonly progress?: number;
  // Hide the stage label (the tier-up beat draws its own headline).
  readonly hideLabel?: boolean;
}

// Draw the bond meter into [x, y] within width `w`: the stage name on the left,
// a thin fill bar on the right. Designed to sit in a slim strip.
export function drawBondBar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  bondValue: number,
  opts: BondBarOpts = {},
): void {
  const frac = Math.max(0, Math.min(1, opts.progress ?? stageProgress(bondValue)));
  // Text pass: m5x7 is PROPORTIONAL (no fixed char width) AND lacks ♥, so the
  // old "♥ <name> in a fixed 96px column" no longer holds. MEASURE the stage
  // name and place the bar right after it (with a small gap). The bond COLOUR
  // signals the relationship axis now that the ♥ glyph is gone.
  let labelW = 0;
  if (!opts.hideLabel) {
    const label = bondStageName(bondValue);
    drawText(ctx, label, x, y, PALETTE.bond);
    ctx.font = UI_FONT;
    labelW = Math.ceil(ctx.measureText(label).width) + 6;
  }
  const barX = x + labelW;
  const barW = Math.max(8, w - labelW);
  // 5px — a touch taller so the bevel reads (the HP/ST bars use 6; this slim
  // under-panel strip is tighter, so the bond meter stays one short of them).
  const barH = 5;
  ctx.fillStyle = PALETTE.barEmpty;
  ctx.fillRect(barX, y + 1, barW, barH);
  const filled = Math.round(barW * frac);
  if (filled > 0) {
    ctx.fillStyle = PALETTE.bond;
    ctx.fillRect(barX, y + 1, filled, barH);
    bevelFilled(ctx, barX, y + 1, filled, barH); // same code-drawn sheen as the HP/ST bars
  }
  ctx.strokeStyle = PALETTE.ink;
  ctx.lineWidth = 1;
  ctx.strokeRect(barX + 0.5, y + 1.5, barW - 1, barH - 1);
}
