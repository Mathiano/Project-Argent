// Shared UI primitives for panels, bars, text, and stance badges.
// Pixel-grid drawing only — no anti-aliasing, no transforms.

import { PALETTE } from './palette';
import type { Stance } from './engine-types';

export function drawPanel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  ctx.fillStyle = PALETTE.paper;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = PALETTE.ink;
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  ctx.strokeRect(x + 2.5, y + 2.5, w - 5, h - 5);
}

export function drawBar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  value: number,
  max: number,
  color: string,
): void {
  ctx.fillStyle = PALETTE.barEmpty;
  ctx.fillRect(x, y, w, 4);
  // Clamp to [0, w] so an upstream value > max (e.g. a stale display
  // pre-switch) can never overflow the bar past the panel border.
  // The real fix is keeping value + max in sync (see battle.ts display
  // contract); this is belt-and-suspenders.
  let filled = Math.max(0, Math.min(w, Math.round((w * value) / Math.max(1, max))));
  // Legibility (turn-order-fix): a STILL-ALIVE mon must never render a
  // fully empty bar — a foe surviving a near-lethal hit at <1px otherwise
  // looks dead, so its Guard counter / follow-up reads as a "fainted mon
  // hit back" (the false mutual-KO the player reported). A living mon
  // always shows ≥1px; only true 0 (KO'd) renders empty.
  if (value > 0 && filled === 0) filled = 1;
  ctx.fillStyle = color;
  ctx.fillRect(x, y, filled, 4);
  ctx.strokeStyle = PALETTE.ink;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, 3);
}

export function hpColor(value: number, max: number): string {
  const r = value / Math.max(1, max);
  if (r > 0.5) return PALETTE.hpOk;
  if (r > 0.2) return PALETTE.hpWarn;
  return PALETTE.hpCrit;
}

export function drawWindedNotch(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
): void {
  const notchX = x + Math.round(w * 0.25);
  ctx.fillStyle = PALETTE.ink;
  ctx.fillRect(notchX, y - 1, 1, 6);
}

export const STANCE_NAME: { readonly [k in Stance]: string } = {
  A: 'AGGR',
  G: 'GUARD',
  F: 'FLUID',
};

export const STANCE_COLOR: { readonly [k in Stance]: string } = {
  A: PALETTE.stanceA,
  G: PALETTE.stanceG,
  F: PALETTE.stanceF,
};

export function drawStanceBadge(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  stance: Stance,
): void {
  ctx.fillStyle = STANCE_COLOR[stance];
  ctx.fillRect(x, y, 9, 9);
  ctx.strokeStyle = PALETTE.ink;
  ctx.strokeRect(x + 0.5, y + 0.5, 8, 8);
  ctx.fillStyle = '#ffffff';
  ctx.font = '8px monospace';
  ctx.textBaseline = 'top';
  ctx.textAlign = 'center';
  ctx.fillText(stance, x + 4.5, y + 1);
  ctx.textAlign = 'start';
}

export function drawMomentum(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  count: number,
  cap: number,
): void {
  ctx.font = '8px monospace';
  ctx.textBaseline = 'top';
  ctx.textAlign = 'start';
  for (let i = 0; i < cap; i += 1) {
    ctx.fillStyle = i < count ? PALETTE.star : PALETTE.starOff;
    ctx.fillText('★', x + i * 8, y);
  }
}

export function drawText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  color: string = PALETTE.ink,
): void {
  ctx.fillStyle = color;
  ctx.font = '8px monospace';
  ctx.textBaseline = 'top';
  ctx.textAlign = 'start';
  ctx.fillText(text, x, y);
}

export function drawTextRight(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  color: string = PALETTE.ink,
): void {
  ctx.fillStyle = color;
  ctx.font = '8px monospace';
  ctx.textBaseline = 'top';
  ctx.textAlign = 'right';
  ctx.fillText(text, x, y);
  ctx.textAlign = 'start';
}
