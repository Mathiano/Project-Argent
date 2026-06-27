// UI quality pass (code/layout tier) — the testable parts: the HP color-shift
// thresholds (value→colour), the styled primitives render safely, and the bond
// meter's longest stage name fits its label column (the long-text fit flagged
// in the Lane-A pass). The bevel/border/spacing LOOK is an eye-check at 320×180;
// these pin the logic that backs it.

import { describe, expect, test } from 'vitest';
import { hpColor, drawBar, drawPanel, drawRowHighlight, bevelFilled, drawText, drawTextCenter, measureUiText, BAR_HEIGHT, BAR_HEIGHT_TALL, UI_FONT, UI_FONT_PX } from './ui';
import { PALETTE } from './palette';
import { drawBondBar } from './bondBar';
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

describe('text pass — m3x6 proportional font, shadow off, small inline symbols', () => {
  test('UI_FONT is the m3x6 stack at its crisp 16px (monospace fallback)', () => {
    expect(UI_FONT).toContain('m3x6');
    expect(UI_FONT).toContain('monospace'); // fallback for glyphs m3x6 lacks
    expect(UI_FONT_PX).toBe(16); // the only crisp size (64 units/px)
  });

  test('plain text renders ONCE (shadow off; no symbol split)', () => {
    const ctx = stubCtx();
    drawText(ctx, 'HELLO', 10, 10, PALETTE.hpOk);
    expect(ctx.texts.filter((t) => t === 'HELLO').length).toBe(1);
  });

  test('a string with a ★ is split into runs (symbol rendered separately, small)', () => {
    const ctx = stubCtx();
    drawText(ctx, 'CALL ★2', 10, 10, PALETTE.ink);
    // The ★ is its own run (rendered in the small symbol font), and the text
    // runs are separate — so the symbol can be sized independently of m3x6.
    expect(ctx.texts).toContain('★');
    expect(ctx.texts.some((t) => t.includes('CALL'))).toBe(true);
    expect(ctx.texts).not.toContain('CALL ★2'); // not drawn as one oversized run
  });

  test('the combat callout helpers: drawTextCenter centers + splits symbols; measureUiText > 0', () => {
    const ctx = stubCtx();
    drawTextCenter(ctx, 'CLASH! (+★ you!)', 160, 60, PALETTE.ink); // a read-war callout w/ ★
    expect(ctx.texts).toContain('★'); // the ★ is a small separate run, not one oversized string
    expect(ctx.texts.some((t) => t.includes('CLASH'))).toBe(true);
    expect(measureUiText(ctx, 'COUNTER! GUARD turns it back')).toBeGreaterThan(0);
  });
});

describe('bond meter — the stage name is measured + drawn in full', () => {
  const longest = BOND_STAGES.reduce((a, b) => (b.name.length > a.length ? b.name : a), '');

  test('drawBondBar renders the longest stage name in full (measured, not truncated)', () => {
    const stage = BOND_STAGES.find((s) => s.name === longest)!;
    const ctx = stubCtx();
    drawBondBar(ctx, 0, 0, 200, stage.max); // a value inside the longest-named stage
    expect(ctx.texts.some((t) => t.includes(longest))).toBe(true);
  });
});
