// Shared UI primitives for panels, bars, text, and stance badges.
// Pixel-grid drawing only — no anti-aliasing, no transforms.
//
// UI quality pass (code/layout tier): bars and panels are styled in RENDERING
// CODE only — a defined dark outline, a code-drawn bevel (1px lighter top edge +
// 1px darker bottom edge), and a softer inset frame line. NO bespoke pixel art:
// no new font (monospace stays), no frame graphics, no gradient textures — those
// are a separate art pass. The bevel uses translucent shading (not new solid
// palette colours), the established way the scene already shades (rgba panels).

import { PALETTE } from './palette';
import type { Stance } from './engine-types';

// Default bar height. Menus pass this (compact rows); the BATTLE HUD passes a
// taller bar (BAR_HEIGHT_TALL) so the bevel has room to read.
export const BAR_HEIGHT = 4;
export const BAR_HEIGHT_TALL = 6;
// Code-drawn bar bevel — a 1px translucent sheen on top + 1px shade on the
// bottom of a filled bar, so it reads rounded/lit without a gradient texture.
// Strengthened (was 0.30/0.22 — imperceptible at 320×180) so it actually reads.
const BAR_HIGHLIGHT = 'rgba(255,255,255,0.45)';
const BAR_SHADOW = 'rgba(0,0,0,0.40)';

// The UI font: m3x6 (Daniel Linssen — vendored, loaded by font.ts), a
// PROPORTIONAL pixel font (m5x7's smaller sibling). Metric grid 64 units/px
// (unitsPerEm 1024) → crisp ONLY at 16px (8px is sub-pixel); at 16px the caps are
// ~6px tall with a ~4.0px AVERAGE advance — NARROWER than the old monospace (4.8)
// so it fits the 320×180 boxes. The monospace fallback covers glyphs m3x6 lacks
// (★ ♥ ▼ ▶ ₽); those are rendered SMALL inline by the symbol pass below.
// Swapping fonts is a one-line flip (m5x7 + Press Start 2P are banked in font.ts).
export const UI_FONT_PX = 16;
export const UI_FONT = `${UI_FONT_PX}px m3x6, monospace`;
// PROPORTIONAL → no fixed char width; width-critical placement uses
// ctx.measureText (bond label, ChapterCard centering, the intent readout). This
// is only a rough AVERAGE for any remaining estimate. ⚠️ prefer measureText.
export const UI_CHAR_W = 4.0;
// Vertical-align offset: m3x6's 16px em is taller than its ~6px glyph, so with
// textBaseline='top' the caps sit ~4px low vs the 8px-tuned rows. Nudge text up
// so it lands where the old text did (esp. the bottom-menu rows, which would
// otherwise clip). ⚠️ EYE-CHECK / tune this single value (m3x6's 6px caps hang
// ~1px lower than m5x7's 7px, hence -4 here vs -3 for m5x7).
const UI_TEXT_DY = -4;
// SHADOW OFF by default (the crisp proportional font reads better without it).
// Flip to re-enable the solid (non-alpha) mid-tone emboss.
const TEXT_SHADOW_ON = false;
const TEXT_SHADOW = PALETTE.paperShadow;
// Proportional m3x6 has its own designed spacing — '0px' = native (no tightening).
const TEXT_LETTER_SPACING = '0px';

// ── Inline symbol pass ───────────────────────────────────────────────────────
// m3x6 lacks ★ ♥ ▼ ▲ ▶ ► (and the overworld arrows) + ₽. Embedded in a string,
// they'd fall back to 16px monospace and TOWER over the ~6px m3x6 caps. So
// drawText/drawTextRight split a string into m3x6 runs and symbol runs, drawing
// the symbols at a fixed small font matched to the caps (the approach used for
// the ★ pips). All BMP single-unit chars, so a per-char scan is safe.
const UI_SYMBOL_RE = /[★♥▼▲▶►◀▸◂▴▾₽]/;
const SYMBOL_FONT = '8px monospace';
// Small symbols sit a touch lower than the m3x6 text baseline at 16px — nudge
// them down to line up the caps. ⚠️ EYE-CHECK alongside UI_TEXT_DY.
const SYMBOL_DY = 4;

function isSym(ch: string): boolean {
  return UI_SYMBOL_RE.test(ch);
}

// Typographic-Unicode → ASCII QUOTE normalization (render-layer). m3x6 has the
// ASCII quote forms (' and ") but LACKS the "smart" curly forms (’ ‘ ” “) — embedded,
// those fall PER-GLYPH to the 16px monospace fallback and render OVERSIZED (the
// towering-apostrophe bug; smart-quote editors auto-insert the curly forms). Map
// them to the ASCII glyph m3x6 DOES have, so contractions ("don't") + dialogue
// quotes draw as proper small m3x6 marks. SOURCE strings keep their curly chars
// (authors type either) — only the drawn glyphs are normalized; applied at every
// draw/measure entry so widths agree.
//
// SCOPE: quotes only (the reported apostrophe bug + its double-quote twin). m3x6
// ALSO lacks the em/en dash (— –) and ellipsis (…) — the SAME oversize bug — but
// those are NOT remapped here: '—'→'-' is a typography downgrade and many UI strings
// + tests use the em-dash deliberately. To fix those, add the glyphs to the CC0
// m3x6.ttf, or extend this map (and update the em-dash-asserting tests). Flagged.
export function normalizeUiText(s: string): string {
  return s
    .replace(/[‘’]/g, "'") // ‘ ’ → '  (the apostrophe fix)
    .replace(/[“”]/g, '"'); // “ ” → "  (its double-quote twin)
}

// Sum the width of a mixed string, each run measured in its own font.
function mixedWidth(ctx: CanvasRenderingContext2D, text: string): number {
  let w = 0;
  for (let i = 0; i < text.length; ) {
    const sym = isSym(text[i]!);
    let j = i + 1;
    while (j < text.length && isSym(text[j]!) === sym) j += 1;
    ctx.font = sym ? SYMBOL_FONT : UI_FONT;
    ctx.letterSpacing = sym ? '0px' : TEXT_LETTER_SPACING;
    w += ctx.measureText(text.slice(i, j)).width;
    i = j;
  }
  return w;
}

// Draw a mixed string left-to-right from x: m3x6 runs at `baseY`, symbol runs
// small at `baseY + SYMBOL_DY`. textBaseline must already be 'top'.
function drawRuns(ctx: CanvasRenderingContext2D, text: string, x: number, baseY: number, color: string): void {
  ctx.textAlign = 'start';
  ctx.fillStyle = color;
  let cx = x;
  for (let i = 0; i < text.length; ) {
    const sym = isSym(text[i]!);
    let j = i + 1;
    while (j < text.length && isSym(text[j]!) === sym) j += 1;
    const run = text.slice(i, j);
    ctx.font = sym ? SYMBOL_FONT : UI_FONT;
    ctx.letterSpacing = sym ? '0px' : TEXT_LETTER_SPACING;
    ctx.fillText(run, cx, sym ? baseY + SYMBOL_DY : baseY);
    cx += ctx.measureText(run).width;
    i = j;
  }
}

// Lay the bevel over an already-filled bar span [x, y]..(+w, +h). Shared by the
// value bars (drawBar) and the bond meter (bondBar.ts) so every bar in the HUD
// reads consistently. No-op for an empty span.
export function bevelFilled(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number = BAR_HEIGHT,
): void {
  if (w <= 0) return;
  ctx.fillStyle = BAR_HIGHLIGHT;
  ctx.fillRect(x, y, w, 1);
  ctx.fillStyle = BAR_SHADOW;
  ctx.fillRect(x, y + h - 1, w, 1);
}

// Pixel-perfect rounded-rect fill (no canvas path → no anti-aliasing). Cuts the
// corner pixels by insetting each row near the top/bottom edges, giving a clean
// `r`-px rounded corner. Used by drawPanel for the RSE box shape + its shadow.
function fillRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  for (let i = 0; i < h; i += 1) {
    const dy = Math.min(i, h - 1 - i);
    const inset = dy < r ? r - dy : 0;
    ctx.fillRect(x + inset, y + i, w - 2 * inset, 1);
  }
}

const PANEL_RADIUS = 3;

export function drawPanel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  const r = PANEL_RADIUS;
  // DROP SHADOW — two soft layers offset down-right so the panel FLOATS over the
  // scene (the Emerald "game box" cue), code-drawn, no art. The body covers the
  // top-left, leaving a soft 2–3px shadow on the bottom + right edges.
  ctx.fillStyle = 'rgba(0,0,0,0.16)';
  fillRoundRect(ctx, x + 3, y + 4, w, h, r);
  ctx.fillStyle = 'rgba(0,0,0,0.30)';
  fillRoundRect(ctx, x + 2, y + 2, w, h, r);
  // ROUNDED BOX — a dark outer edge with rounded corners, the paper body inset
  // 1px (→ a 1px rounded border), and a 1px lit-from-above highlight inside the
  // top edge for depth.
  ctx.fillStyle = PALETTE.ink;
  fillRoundRect(ctx, x, y, w, h, r);
  ctx.fillStyle = PALETTE.paper;
  fillRoundRect(ctx, x + 1, y + 1, w - 2, h - 2, r - 1);
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillRect(x + r, y + 1, w - 2 * r, 1);
}

// The BATTLE panel — a warm "cabinet" (parchment body, aged-wood frame) with a
// silver inlay line + corner rivets ("jewelry on warm leather"). Battle-ONLY, so
// the shared drawPanel (every menu / overworld box) stays exactly as it was — the
// battle scene has its own palette (Part 2b-2). Same rounded-rect + drop-shadow
// construction as drawPanel; only the palette + the silver-inlay detail differ.
export function drawBattlePanel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  const r = PANEL_RADIUS;
  // Drop shadow — the panel floats over the arena (a touch deeper for depth, 2b-2 tune).
  ctx.fillStyle = 'rgba(40,26,14,0.24)';
  fillRoundRect(ctx, x + 3, y + 4, w, h, r);
  ctx.fillStyle = 'rgba(40,26,14,0.44)';
  fillRoundRect(ctx, x + 2, y + 2, w, h, r);
  // Dark-wood outer edge → wood frame band → parchment body (a ~2px warm frame).
  ctx.fillStyle = PALETTE.frameWoodDark;
  fillRoundRect(ctx, x, y, w, h, r);
  ctx.fillStyle = PALETTE.frameWood;
  fillRoundRect(ctx, x + 1, y + 1, w - 2, h - 2, r);
  ctx.fillStyle = PALETTE.frameParchment;
  fillRoundRect(ctx, x + 3, y + 3, w - 6, h - 6, Math.max(1, r - 1));
  // Silver inlay line just inside the top of the wood frame.
  ctx.fillStyle = PALETTE.silverMid;
  ctx.fillRect(x + r + 1, y + 2, w - 2 * r - 2, 1);
  // Warm top highlight inside the parchment (lit-from-above).
  ctx.fillStyle = 'rgba(255,250,235,0.45)';
  ctx.fillRect(x + r + 1, y + 4, w - 2 * r - 2, 1);
  // Silver corner rivets — 2×2 studs inset from each corner.
  ctx.fillStyle = PALETTE.silver;
  for (const [rx, ry] of [
    [x + 4, y + 4],
    [x + w - 6, y + 4],
    [x + 4, y + h - 6],
    [x + w - 6, y + h - 6],
  ] as ReadonlyArray<readonly [number, number]>) {
    ctx.fillRect(rx, ry, 2, 2);
    ctx.fillStyle = PALETTE.silverDim;
    ctx.fillRect(rx, ry + 1, 2, 1);
    ctx.fillStyle = PALETTE.silver;
  }
}

// A selection-row tint behind the cursor's menu row — code-drawn hierarchy (no
// new solid colour, no art): a paperShadow wash darkens the focused row over the
// light panel so it reads as selected, reinforcing the '>' marker. Strengthened
// (was 0.16 — imperceptible) so it actually reads. Drawn BEFORE the row text.
export function drawRowHighlight(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  ctx.fillStyle = 'rgba(90,74,42,0.38)';
  ctx.fillRect(x, y, w, h);
}

export function drawBar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  value: number,
  max: number,
  color: string,
  h: number = BAR_HEIGHT,
): void {
  ctx.fillStyle = PALETTE.barEmpty;
  ctx.fillRect(x, y, w, h);
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
  ctx.fillRect(x, y, filled, h);
  bevelFilled(ctx, x, y, filled, h); // code-drawn sheen — no gradient texture
  ctx.strokeStyle = PALETTE.ink;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
}

// HP color-shift — RSE's signature: green high → amber mid → red low. Pure
// value→colour thresholds (no art). Used for BOTH the player and foe HP bars.
//   > 50%  → hpOk (green)
//   > 20%  → hpWarn (amber)
//   ≤ 20%  → hpCrit (red)
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
  barH: number = BAR_HEIGHT,
  // Fraction of the bar the winded threshold sits at. Defaults to 0.25 (the
  // 25-of-100 case); per-mon stamina passes winded/maxSt so the notch tracks the
  // real threshold on a bigger/smaller pool.
  frac: number = 0.25,
): void {
  const notchX = x + Math.round(w * frac);
  ctx.fillStyle = PALETTE.ink;
  ctx.fillRect(notchX, y - 1, 1, barH + 2);
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
  // Fixed 8px so the single letter fits the 9px badge (m5x7's 16px would spill).
  ctx.font = '8px monospace';
  ctx.letterSpacing = '0px';
  ctx.textBaseline = 'top';
  ctx.textAlign = 'center';
  ctx.fillText(stance, x + 4.5, y + 1);
  ctx.textAlign = 'start';
}

// The ★ momentum meter as a TRIANGLE: 1 slot on top, 2 on the bottom (3 slots
// total — the display is ready for a cap of 3; if the cap is still 2 the apex
// just never fills). Slots fill (gold) up to `count`, the rest dim. Fill order is
// base-first (bottom-left, bottom-right, then the apex) so the common 2-of-3
// state reads as a symmetric full base. ★ isn't in m3x6 → fixed 8px, matching
// the small-symbol pass. VISUAL ONLY — does not touch the momentum cap value.
export function drawMomentum(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  count: number,
): void {
  ctx.font = '8px monospace';
  ctx.letterSpacing = '0px';
  ctx.textBaseline = 'top';
  ctx.textAlign = 'start';
  // [bottom-left, bottom-right, apex] — a compact triangle (~16×13px).
  const slots: ReadonlyArray<readonly [number, number]> = [
    [x, y + 6],
    [x + 8, y + 6],
    [x + 4, y],
  ];
  // GOLD — the momentum meter is the "legendary treasure" accent (battle-only
  // caller). Lit pips gold, unlit a warm dim (Part 2b-2 skin).
  for (let i = 0; i < slots.length; i += 1) {
    ctx.fillStyle = i < count ? PALETTE.momentumGold : PALETTE.momentumOff;
    ctx.fillText('★', slots[i]![0], slots[i]![1]);
  }
}

export function drawText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  color: string = PALETTE.ink,
): void {
  text = normalizeUiText(text);
  ctx.textBaseline = 'top';
  const ty = y + UI_TEXT_DY;
  // Mixed (contains a symbol m3x6 lacks) → run-split so the symbol renders small.
  if (UI_SYMBOL_RE.test(text)) {
    if (TEXT_SHADOW_ON) drawRuns(ctx, text, x + 1, ty + 1, TEXT_SHADOW);
    drawRuns(ctx, text, x, ty, color);
    return;
  }
  // Fast path: pure m3x6 text.
  ctx.font = UI_FONT;
  ctx.letterSpacing = TEXT_LETTER_SPACING;
  ctx.textAlign = 'start';
  if (TEXT_SHADOW_ON) {
    ctx.fillStyle = TEXT_SHADOW; // solid (non-alpha) mid-tone emboss
    ctx.fillText(text, x + 1, ty + 1);
  }
  ctx.fillStyle = color;
  ctx.fillText(text, x, ty);
}

export function drawTextRight(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  color: string = PALETTE.ink,
): void {
  text = normalizeUiText(text);
  ctx.textBaseline = 'top';
  const ty = y + UI_TEXT_DY;
  if (UI_SYMBOL_RE.test(text)) {
    // Right-align a mixed string: measure it, then draw left-to-right from x−w.
    const w = mixedWidth(ctx, text);
    if (TEXT_SHADOW_ON) drawRuns(ctx, text, x - w + 1, ty + 1, TEXT_SHADOW);
    drawRuns(ctx, text, x - w, ty, color);
    return;
  }
  ctx.font = UI_FONT;
  ctx.letterSpacing = TEXT_LETTER_SPACING;
  ctx.textAlign = 'right';
  if (TEXT_SHADOW_ON) {
    ctx.fillStyle = TEXT_SHADOW;
    ctx.fillText(text, x + 1, ty + 1);
  }
  ctx.fillStyle = color;
  ctx.fillText(text, x, ty);
  ctx.textAlign = 'start';
}

// Mixed-aware width of a UI string (m3x6 runs + small symbol runs). Use this to
// SIZE a box around proportional text (e.g. the combat callout banner).
export function measureUiText(ctx: CanvasRenderingContext2D, text: string): number {
  return mixedWidth(ctx, normalizeUiText(text));
}

// Draw a UI string CENTERED on `cx` — applies the vertical offset + the small
// inline-symbol pass, like drawText. For transient banners (the read-war
// callout) that need to sit centered in a measured box.
export function drawTextCenter(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  y: number,
  color: string = PALETTE.ink,
): void {
  text = normalizeUiText(text);
  ctx.textBaseline = 'top';
  const ty = y + UI_TEXT_DY;
  const left = Math.round(cx - mixedWidth(ctx, text) / 2);
  if (TEXT_SHADOW_ON) drawRuns(ctx, text, left + 1, ty + 1, TEXT_SHADOW);
  drawRuns(ctx, text, left, ty, color);
}
