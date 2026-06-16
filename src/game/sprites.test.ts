// firstroad-fixes (sprites) — distinct placeholder silhouettes. Every
// CH1 mon without registered art should render a DISTINCT placeholder:
// shape by archetype, colour by type, size by evo stage — so the player
// can tell the mons apart at a glance (not an identical "?").

import { describe, expect, test } from 'vitest';
import { drawPlaceholder } from './sprites';

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
