// Pure viewport math for the game footprint + the touch overlay. No DOM here:
// canvas.ts and input.ts apply these numbers to elements, and viewport.test.ts
// exercises them directly.

import type { InputKey } from './scene';

// Integer display scale for a logical size inside a viewport — pilot-exit §1:
// integer scale only, no smoothing. Never below 1.
export function integerScale(vw: number, vh: number, lw: number, lh: number): number {
  return Math.max(1, Math.floor(Math.min(vw / lw, vh / lh)));
}

// Portrait fallback for a coarse-pointer device. A 16:9 game in a portrait phone
// viewport floors to ×1 (390px wide / 320 = 1.2), so the host rotates 90° and
// lays the game along the long axis instead — still an integer scale, just a
// rotated footprint, and it holds with rotation lock on. Rotate only when it
// STRICTLY wins, so a landscape phone, a desktop window and a square viewport
// are never touched.
export function shouldRotate(iw: number, ih: number, lw: number, lh: number): boolean {
  return integerScale(ih, iw, lw, lh) > integerScale(iw, ih, lw, lh);
}

export type OverlayKind = 'dpad' | 'ab' | 'meta';

export interface OverlayButton {
  readonly key: InputKey;
  readonly label: string;
  readonly kind: OverlayKind;
  // Top-left corner + size, in the (possibly rotated) viewport's own coordinates.
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

// Lay the touch controls out around the canvas footprint (cw wide, centered in
// a vw×vh viewport; its height never matters — phones are wider than 16:9, so
// the slack is always horizontal). Phones are taller than 16:9, so in landscape the footprint
// leaves side gutters — the D-pad goes in the left one and A/B in the right one,
// sized from the gutter so they cover as little of the game as possible (on a
// gutterless 16:9 viewport they fall back to the corners at their minimum size
// and rely on translucency). START/SELECT stay top-right: the only thing under
// them there is sky above the foe.
export function overlayLayout(vw: number, vh: number, cw: number): readonly OverlayButton[] {
  const gutter = Math.max(0, (vw - cw) / 2);
  const edge = 6;

  // D-pad: a cross of 3×3 cells, centered in the left gutter, a little below
  // the vertical middle (thumb rests lower). The cross may overlap the canvas
  // edge by up to ~20px at the minimum cell size — that is the panel border.
  const s = clamp(Math.round(gutter / 3), 38, 52);
  const dpadCx = Math.max(gutter / 2, 1.5 * s + edge);
  const dpadCy = vh * 0.58;
  const cell = (key: InputKey, label: string, dx: number, dy: number): OverlayButton => ({
    key,
    label,
    kind: 'dpad',
    x: Math.round(dpadCx + dx * s - s / 2),
    y: Math.round(dpadCy + dy * s - s / 2),
    w: s,
    h: s,
  });

  // A/B: two rounds on a diagonal in the right gutter, A high-right, B low-left.
  const ab = clamp(Math.round(gutter / 2), 48, 64);
  const aCx = vw - edge - ab / 2;
  const aCy = vh * 0.5;
  const bCx = aCx - ab * 0.85;
  const bCy = aCy + ab * 0.85;
  const round = (key: InputKey, label: string, cx: number, cy: number): OverlayButton => ({
    key,
    label,
    kind: 'ab',
    x: Math.round(cx - ab / 2),
    y: Math.round(cy - ab / 2),
    w: ab,
    h: ab,
  });

  const pillW = 62;
  const pillH = 26;
  const pill = (key: InputKey, label: string, x: number): OverlayButton => ({
    key,
    label,
    kind: 'meta',
    x,
    y: 12,
    w: pillW,
    h: pillH,
  });

  return [
    cell('up', '▲', 0, -1),
    cell('down', '▼', 0, 1),
    cell('left', '◀', -1, 0),
    cell('right', '▶', 1, 0),
    round('b', 'B', bCx, bCy),
    round('a', 'A', aCx, aCy),
    pill('start', 'START', vw - edge - pillW * 2 - 8),
    pill('select', 'SELECT', vw - edge - pillW),
  ];
}
