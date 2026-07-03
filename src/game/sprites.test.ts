// firstroad-fixes (sprites) — distinct placeholder silhouettes. Every
// CH1 mon without registered art should render a DISTINCT placeholder:
// shape by archetype, colour by type, size by evo stage — so the player
// can tell the mons apart at a glance (not an identical "?").

import { describe, expect, test } from 'vitest';
import { drawPlaceholder, drawSprite, drawSpriteInSlot } from './sprites';
import type { Sprite } from './sprite';

// Recording ctx: maps every filled pixel → its colour, so we can compare
// silhouette masks + colour palettes between species.
function recCtx() {
  let style = '#000000';
  const px = new Map<string, string>();
  return new Proxy(
    { px },
    {
      get(t, p) {
        if (p === 'px') return (t as { px: Map<string, string> }).px;
        if (p === 'fillRect') {
          return (x: number, y: number, w: number, h: number) => {
            for (let i = 0; i < w; i += 1)
              for (let j = 0; j < h; j += 1) px.set(`${Math.round(x + i)},${Math.round(y + j)}`, style);
          };
        }
        return () => {};
      },
      set(_t, p, v) {
        if (p === 'fillStyle') style = String(v);
        return true;
      },
    },
  ) as unknown as CanvasRenderingContext2D & { px: Map<string, string> };
}

const OUTLINE = '#1d1d28';
const SIZE = 40;

interface Sig {
  mask: Set<string>; // every filled pixel coord
  count: number; // silhouette area
  fills: Set<string>; // colours used (excl. outline)
}
function render(name: string, type: string | null): Sig {
  const ctx = recCtx();
  drawPlaceholder(ctx, type as never, 0, 0, { slotSize: SIZE, name });
  const mask = new Set(ctx.px.keys());
  const fills = new Set<string>();
  for (const c of ctx.px.values()) if (c !== OUTLINE) fills.add(c);
  return { mask, count: mask.size, fills };
}
function maskDiffers(a: Set<string>, b: Set<string>): number {
  let d = 0;
  for (const k of a) if (!b.has(k)) d += 1;
  for (const k of b) if (!a.has(k)) d += 1;
  return d; // symmetric-difference size
}

describe('distinct placeholders', () => {
  test('different ARCHETYPES → different shapes', () => {
    const wall = render('KILNDRAKE', 'FLAME'); // Wall (quadruped)
    const bird = render('FLITPECK', 'GALE'); // Glass nuke (bird)
    const lurk = render('GRITHOAX', 'TERRA'); // Trickster (mound)
    const tank = render('SILTSKIP', 'AQUA'); // Counter-tank (round)
    const sigs = [wall, bird, lurk, tank];
    // Every pair's silhouette mask differs substantially.
    for (let i = 0; i < sigs.length; i += 1)
      for (let j = i + 1; j < sigs.length; j += 1)
        expect(maskDiffers(sigs[i]!.mask, sigs[j]!.mask)).toBeGreaterThan(40);
  });

  test('different TYPES → different fill colours', () => {
    expect(render('KILNDRAKE', 'FLAME').fills).not.toEqual(render('FLITPECK', 'GALE').fills);
    expect([...render('GRITHOAX', 'TERRA').fills][0]).not.toBe([...render('VINESNAP', 'NATURE').fills][0]);
  });

  test('same TYPE, different ARCHETYPE → same colour but different shape', () => {
    const tank = render('SILTSKIP', 'AQUA'); // Counter-tank
    const brawler = render('MARSHMASH', 'AQUA'); // Brawler
    // Same AQUA fill colour…
    expect([...tank.fills].some((c) => brawler.fills.has(c))).toBe(true);
    // …but clearly different silhouettes.
    expect(maskDiffers(tank.mask, brawler.mask)).toBeGreaterThan(40);
  });

  test('evo STAGE scales the silhouette (later stage is bigger)', () => {
    const s1 = render('FLITPECK', 'GALE'); // stage 1
    const s2 = render('GALEHAWK', 'GALE'); // stage 2 (same shape, bigger)
    expect(s2.count).toBeGreaterThan(s1.count);
  });

  test('unknown name → the neutral "?" blob (clearly placeholder)', () => {
    const ctx = recCtx();
    drawPlaceholder(ctx, 'AQUA' as never, 0, 0, { slotSize: SIZE }); // no name
    // The "?" mark uses the pale mark colour the archetype shapes don't.
    expect([...ctx.px.values()]).toContain('#f6efda');
  });

  test('every CH1 placeholder species renders a non-empty silhouette', () => {
    for (const [name, type] of [
      ['KILNDRAKE', 'FLAME'], ['FORTDRAKE', 'FLAME'], ['VINESNAP', 'NATURE'], ['WYRMFERN', 'NATURE'],
      ['SILTSKIP', 'AQUA'], ['BRACKSLAP', 'AQUA'], ['CRASHMAW', 'AQUA'], ['FLITPECK', 'GALE'],
      ['GALEHAWK', 'GALE'], ['GRITHOAX', 'TERRA'], ['CAVELURE', 'TERRA'], ['CHASMTRAP', 'TERRA'],
      ['MARSHMASH', 'AQUA'],
    ] as const) {
      expect(render(name, type).count, name).toBeGreaterThan(60);
    }
  });
});

// ── Beat 3 — INTEGER sprite scaling (bigger battle sprites, pixel-crisp) ──────
describe('integer sprite scaling (beat 3 — no fractional smoothing)', () => {
  function rectCtx() {
    const rects: { x: number; y: number; w: number; h: number }[] = [];
    return {
      rects,
      ctx: new Proxy(
        { rects },
        {
          get(_t, p) {
            if (p === 'rects') return rects;
            if (p === 'fillRect') return (x: number, y: number, w: number, h: number) => rects.push({ x, y, w, h });
            return () => {};
          },
          set: () => true,
        },
      ) as unknown as CanvasRenderingContext2D & { rects: { x: number; y: number; w: number; h: number }[] },
    };
  }

  test('drawSprite at scale 2 emits 2×2 integer blocks (crisp, no smoothing)', () => {
    const sprite: Sprite = { name: 'T', size: 2, palette: { a: '#ff0000' }, rows: ['aa', 'a.'] };
    const { ctx, rects } = rectCtx();
    drawSprite(ctx, sprite, 10, 20, { scale: 2 });
    expect(rects.length).toBe(3); // 3 filled cells (aa / a.)
    for (const r of rects) {
      expect(r.w).toBe(2);
      expect(r.h).toBe(2);
      expect(Number.isInteger(r.x)).toBe(true);
      expect(Number.isInteger(r.y)).toBe(true);
    }
    // cells (0,0)(1,0)(0,1) → origins step by the scale (2) from (10,20).
    expect(rects.map((r) => `${r.x},${r.y}`).sort()).toEqual(['10,20', '10,22', '12,20'].sort());
  });

  test('fillSlot fills a 112 slot with 56px art at a clean 2× (integer, bottom-anchored)', () => {
    const rows = Array.from({ length: 56 }, () => 'a'.repeat(56));
    const sprite: Sprite = { name: 'B', size: 56, palette: { a: '#00ff00' }, rows };
    const { ctx, rects } = rectCtx();
    drawSpriteInSlot(ctx, sprite, 0, 0, { slotSize: 112, fillSlot: true });
    const xs = rects.map((r) => r.x);
    const ys = rects.map((r) => r.y);
    const right = Math.max(...rects.map((r) => r.x + r.w));
    const bottom = Math.max(...rects.map((r) => r.y + r.h));
    // 56 × floor(112/56)=2 → the art spans exactly 112px, integer, filling the slot.
    expect(right - Math.min(...xs)).toBe(112);
    expect(bottom - Math.min(...ys)).toBe(112);
    expect(Math.min(...xs)).toBe(0); // centred: (112-112)/2
    expect(Math.min(...ys)).toBe(0); // bottom-anchored: 112-112
    for (const r of rects) expect(r.w).toBe(2); // every source pixel → a 2×2 block
  });

  test('WITHOUT fillSlot the sprite is NATIVE size (existing callers byte-identical)', () => {
    const rows = Array.from({ length: 56 }, () => 'a'.repeat(56));
    const sprite: Sprite = { name: 'N', size: 56, palette: { a: '#0000ff' }, rows };
    const { ctx, rects } = rectCtx();
    drawSpriteInSlot(ctx, sprite, 0, 0, { slotSize: 112 }); // no fillSlot
    for (const r of rects) expect(r.w).toBe(1); // 1×1 cells → native, unscaled
  });
});
