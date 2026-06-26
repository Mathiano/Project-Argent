// UI quality pass (code/layout tier) — the testable parts: the HP color-shift
// thresholds (value→colour), the styled primitives render safely, and the bond
// meter's longest stage name fits its label column (the long-text fit flagged
// in the Lane-A pass). The bevel/border/spacing LOOK is an eye-check at 320×180;
// these pin the logic that backs it.

import { describe, expect, test } from 'vitest';
import { hpColor, drawBar, drawPanel, drawRowHighlight, bevelFilled, BAR_HEIGHT, BAR_HEIGHT_TALL } from './ui';
import { PALETTE } from './palette';
import { drawBondBar, BOND_LABEL_W, MONO_CHAR_W } from './bondBar';
import { BOND_STAGES } from './catching';

function stubCtx(): CanvasRenderingContext2D & { texts: string[] } {
  const noop = () => {};
  const texts: string[] = [];
  return new Proxy(
    { texts },
    {
      get(target, prop) {
        if (prop === 'texts') return (target as { texts: string[] }).texts;
        if (prop === 'fillText') return (t: string) => texts.push(String(t));
        if (prop === 'beginPath') return () => ({ fill: noop, stroke: noop, ellipse: noop });
        if (prop === 'measureText') return () => ({ width: 10 });
        return noop;
      },
      set: () => true,
    },
  ) as unknown as CanvasRenderingContext2D & { texts: string[] };
}

describe('hpColor — RSE value→colour shift (green → amber → red)', () => {
  test('thresholds: >50% green, >20% amber, ≤20% red (boundaries pinned)', () => {
    expect(hpColor(100, 100)).toBe(PALETTE.hpOk);
    expect(hpColor(51, 100)).toBe(PALETTE.hpOk);
    expect(hpColor(50, 100)).toBe(PALETTE.hpWarn); // exactly 50% → amber
    expect(hpColor(21, 100)).toBe(PALETTE.hpWarn);
    expect(hpColor(20, 100)).toBe(PALETTE.hpCrit); // exactly 20% → red
    expect(hpColor(1, 100)).toBe(PALETTE.hpCrit);
    expect(hpColor(0, 100)).toBe(PALETTE.hpCrit);
  });
  test('max=0 never divides by zero (still a valid colour)', () => {
    expect(hpColor(0, 0)).toBe(PALETTE.hpCrit);
  });
});

describe('styled primitives render without throwing (pixel-grid only)', () => {
  test('rounded+shadowed panel / bars (compact + tall) / row highlight / bevel are safe', () => {
    const ctx = stubCtx();
    expect(() => {
      drawPanel(ctx, 2, 2, 100, 40); // drop shadow + rounded corners
      drawPanel(ctx, 0, 0, 320, 180); // full-screen edge case
      drawPanel(ctx, 4, 4, 12, 10); // tiny panel (radius > half-height)
      drawBar(ctx, 4, 4, 80, 30, 100, PALETTE.hpOk); // default (compact) height
      drawBar(ctx, 4, 12, 80, 30, 100, PALETTE.hpOk, BAR_HEIGHT_TALL); // tall HUD bar
      drawBar(ctx, 4, 20, 80, 0, 100, PALETTE.stamina); // empty → no bevel
      drawBar(ctx, 4, 28, 80, 1, 100, PALETTE.hpCrit); // ≥1px floor for a live mon
      drawRowHighlight(ctx, 2, 2, 100, 9);
      bevelFilled(ctx, 4, 4, 12, BAR_HEIGHT_TALL);
      bevelFilled(ctx, 4, 4, 0); // empty span → no-op
    }).not.toThrow();
  });

  test('bar heights: compact 4px (menus) and tall 6px (battle HUD)', () => {
    expect(BAR_HEIGHT).toBe(4);
    expect(BAR_HEIGHT_TALL).toBe(6);
  });
});

describe('bond meter — the longest stage name fits its label column', () => {
  const longest = BOND_STAGES.reduce((a, b) => (b.name.length > a.length ? b.name : a), '');

  test(`"♥ ${longest}" fits BOND_LABEL_W with margin (no overflow into the bar)`, () => {
    const label = `♥ ${longest}`; // glyph + space + name
    expect(label.length * MONO_CHAR_W).toBeLessThan(BOND_LABEL_W);
  });

  test('drawBondBar renders the longest stage name in full (not truncated)', () => {
    const stage = BOND_STAGES.find((s) => s.name === longest)!;
    const ctx = stubCtx();
    drawBondBar(ctx, 0, 0, 200, stage.max); // a value inside the longest-named stage
    expect(ctx.texts.some((t) => t.includes(longest))).toBe(true);
  });
});
