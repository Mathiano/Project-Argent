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
import { drawText, bevelFilled } from './ui';
import { stageProgress } from './bond';
import { bondStageName } from './catching';

// A warm heart glyph marks the meter as the bond/relationship axis (diegetic,
// not a combat resource). Monospace-safe single char.
const BOND_GLYPH = '♥'; // ♥

export interface BondBarOpts {
  // Override the fill fraction (0..1) — the in-combat bar passes an
  // interpolated value during its post-win advance so the fill animates while
  // the STAGE NAME stays put (a tier-cross is the post-fight beat's job, not a
  // mid-fill snap). Omitted → derived from the bond value via stageProgress.
  readonly progress?: number;
  // Hide the ♥ + stage label (the tier-up beat draws its own headline).
  readonly hideLabel?: boolean;
}

// Draw the bond meter into [x, y] within width `w`: "♥ <Stage>" on the left,
// a thin fill bar on the right. One 8px row; designed to sit in a slim strip.
export function drawBondBar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  bondValue: number,
  opts: BondBarOpts = {},
): void {
  const frac = Math.max(0, Math.min(1, opts.progress ?? stageProgress(bondValue)));
  // The label column holds the longest stage name + the ♥ glyph: "♥ Partners
  // in Kind" = 18 chars × ~4.8px ≈ 86px, so a 96px column never overflows into
  // the bar (the long-text fit flagged in the Lane-A pass). The fill bar takes
  // the rest of the row.
  const labelW = opts.hideLabel ? 0 : BOND_LABEL_W;
  if (!opts.hideLabel) {
    drawText(ctx, `${BOND_GLYPH} ${bondStageName(bondValue)}`, x, y, PALETTE.bond);
  }
  const barX = x + labelW;
  const barW = Math.max(8, w - labelW);
  ctx.fillStyle = PALETTE.barEmpty;
  ctx.fillRect(barX, y + 1, barW, 4);
  const filled = Math.round(barW * frac);
  if (filled > 0) {
    ctx.fillStyle = PALETTE.bond;
    ctx.fillRect(barX, y + 1, filled, 4);
    bevelFilled(ctx, barX, y + 1, filled); // same code-drawn sheen as the HP/ST bars
  }
  ctx.strokeStyle = PALETTE.ink;
  ctx.lineWidth = 1;
  ctx.strokeRect(barX + 0.5, y + 1.5, barW - 1, 3);
}

// Label-column width — sized for the longest stage name (see drawBondBar).
// Exported so a test can pin the long-name fit against the real stage table.
export const BOND_LABEL_W = 96;
// 8px-monospace advance width (canvas reports ~0.6em). The longest label must
// fit BOND_LABEL_W with margin — asserted in the UI test.
export const MONO_CHAR_W = 4.8;
