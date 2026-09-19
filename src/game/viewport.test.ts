import { describe, expect, it } from 'vitest';
import { integerScale, overlayLayout, shouldRotate } from './viewport';

const W = 320;
const H = 180;

describe('integerScale', () => {
  it('floors to the integer scale that fits both axes (pilot-exit §1)', () => {
    expect(integerScale(1920, 1080, W, H)).toBe(6);
    expect(integerScale(1280, 720, W, H)).toBe(4);
    expect(integerScale(844, 390, W, H)).toBe(2); // phone, landscape
    expect(integerScale(390, 844, W, H)).toBe(1); // phone, portrait
  });
  it('never drops below 1', () => {
    expect(integerScale(200, 100, W, H)).toBe(1);
  });
});

describe('shouldRotate', () => {
  it('rotates a portrait phone: swapped axes give ×2 instead of ×1', () => {
    expect(shouldRotate(390, 844, W, H)).toBe(true);
    expect(shouldRotate(600, 900, W, H)).toBe(true);
  });
  it('rotates a portrait tablet when the swap strictly wins (×3 over ×2)', () => {
    expect(shouldRotate(768, 1024, W, H)).toBe(true);
  });
  it('leaves landscape, desktop and square viewports alone', () => {
    expect(shouldRotate(844, 390, W, H)).toBe(false);
    expect(shouldRotate(1280, 720, W, H)).toBe(false);
    expect(shouldRotate(1024, 768, W, H)).toBe(false);
    expect(shouldRotate(500, 500, W, H)).toBe(false); // ×1 both ways — not strictly better
  });
});

describe('overlayLayout', () => {
  const inside = (b: { x: number; y: number; w: number; h: number }, vw: number, vh: number): boolean =>
    b.x >= 0 && b.y >= 0 && b.x + b.w <= vw && b.y + b.h <= vh;

  it('phone landscape (844×390, 640×360 footprint): A/B sit fully in the right gutter', () => {
    const vw = 844, vh = 390, cw = 640;
    const gutter = (vw - cw) / 2; // 102
    const buttons = overlayLayout(vw, vh, cw);
    expect(buttons.map((b) => b.key).sort()).toEqual(
      ['a', 'b', 'down', 'left', 'right', 'select', 'start', 'up'],
    );
    for (const b of buttons) expect(inside(b, vw, vh)).toBe(true);
    const canvasRight = vw - gutter;
    for (const key of ['a', 'b'] as const) {
      const b = buttons.find((x) => x.key === key)!;
      expect(b.x).toBeGreaterThanOrEqual(canvasRight);
    }
  });

  it('phone landscape: the D-pad overlaps the canvas by at most the panel border', () => {
    const vw = 844, vh = 390, cw = 640;
    const gutter = (vw - cw) / 2;
    const right = overlayLayout(vw, vh, cw).find((b) => b.key === 'right')!;
    expect(right.w).toBeGreaterThanOrEqual(38); // stays a usable thumb target
    expect(right.x + right.w - gutter).toBeLessThanOrEqual(20);
  });

  it('D-pad cells form a cross: up/down share x, left/right share y', () => {
    const b = overlayLayout(844, 390, 640);
    const at = (k: string) => b.find((x) => x.key === k)!;
    expect(at('up').x).toBe(at('down').x);
    expect(at('left').y).toBe(at('right').y);
    expect(at('up').y).toBeLessThan(at('down').y);
    expect(at('left').x).toBeLessThan(at('right').x);
  });

  it('gutterless 16:9 viewport: falls back to the corners at minimum size, still on-screen', () => {
    const vw = 1280, vh = 720;
    const buttons = overlayLayout(vw, vh, vw);
    for (const b of buttons) expect(inside(b, vw, vh)).toBe(true);
    expect(buttons.find((b) => b.key === 'up')!.w).toBe(38);
    expect(buttons.find((b) => b.key === 'a')!.w).toBe(48);
  });

  it('sizes cap on a wide desktop gutter', () => {
    const buttons = overlayLayout(2560, 720, 1280);
    expect(buttons.find((b) => b.key === 'up')!.w).toBe(52);
    expect(buttons.find((b) => b.key === 'a')!.w).toBe(64);
  });
});
