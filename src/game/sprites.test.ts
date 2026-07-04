// firstroad-fixes (sprites) — distinct placeholder silhouettes. Every
// CH1 mon without registered art should render a DISTINCT placeholder:
// shape by archetype, colour by type, size by evo stage — so the player
// can tell the mons apart at a glance (not an identical "?").

import { describe, expect, test } from 'vitest';
import { drawPlaceholder, drawSprite, drawSpriteInSlot, drawSpeciesInSlot, getSprite } from './sprites';
import { validateSprite } from './sprite';
import type { Sprite } from './sprite';
import flitpeck from '../../assets/sprites/FLITPECK.sprite.json';
import flitpeckBack from '../../assets/sprites/FLITPECK_BACK.sprite.json';
import galehawk from '../../assets/sprites/GALEHAWK.sprite.json';
import galehawkBack from '../../assets/sprites/GALEHAWK_BACK.sprite.json';
import marshmash from '../../assets/sprites/MARSHMASH.sprite.json';
import marshmashBack from '../../assets/sprites/MARSHMASH_BACK.sprite.json';
import siltskip from '../../assets/sprites/SILTSKIP.sprite.json';
import siltskipBack from '../../assets/sprites/SILTSKIP_BACK.sprite.json';
import grithoax from '../../assets/sprites/GRITHOAX.sprite.json';
import grithoaxBack from '../../assets/sprites/GRITHOAX_BACK.sprite.json';

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

// ── Back-view sprites + FLITPECK/GALEHAWK/MARSHMASH/SILTSKIP art ──────────────
describe('commissioned CH1 art — front + back sprites', () => {
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
  // The battle-slot draw contract: 56px art → 2× integer, 112px → 1× native (the
  // integer rule floor(112/size)), fillSlot, bottom-anchored.
  function renderInSlot(name: string, view?: 'front' | 'back') {
    const { ctx, rects } = rectCtx();
    drawSpeciesInSlot(ctx, { name, type: null }, 0, 0, {
      slotSize: 112, fillSlot: true, bottomAnchor: true, ...(view ? { view } : {}),
    });
    return rects;
  }

  const NEW = [
    { name: 'FLITPECK', front: flitpeck, back: flitpeckBack },
    { name: 'GALEHAWK', front: galehawk, back: galehawkBack },
    { name: 'MARSHMASH', front: marshmash, back: marshmashBack },
    { name: 'SILTSKIP', front: siltskip, back: siltskipBack },
    { name: 'GRITHOAX', front: grithoax, back: grithoaxBack },
  ] as const;
  // The integer in-slot scale for a sprite's own size (112 slot): 112 → 1×, 56 → 2×.
  const slotScaleFor = (size: number) => Math.max(1, Math.floor(112 / size));
  const rawFor = (name: string, view?: 'front' | 'back') => {
    const e = NEW.find((n) => n.name === name)!;
    return (view === 'back' ? e.back : e.front) as unknown as Sprite;
  };

  test('per-sprite pins — every commissioned front+back validates, is a BLESSED size (56 or 112), and carries a palette', () => {
    for (const { front, back } of NEW) {
      for (const raw of [front, back]) {
        const s = raw as unknown as Sprite;
        expect(() => validateSprite(s)).not.toThrow();
        expect(s.size === 56 || s.size === 112, `${s.name} size ${s.size}`).toBe(true); // 56 legacy / 112 native
        expect(s.rows.length).toBe(s.size);
        expect(Object.keys(s.palette).length).toBeGreaterThan(0);
      }
    }
  });

  test('fronts route through getSprite → real REGISTERED art (not the placeholder) at the right scale', () => {
    for (const { name } of NEW) {
      expect(getSprite(name), name).toBeTruthy(); // registered → real art path (not a generated silhouette)
      const rects = renderInSlot(name); // default front
      expect(rects.length, name).toBeGreaterThan(0);
      // Clean integer blocks at the size's in-slot scale (112 → 1×, 56 → 2×).
      const sc = slotScaleFor(getSprite(name)!.size);
      expect(rects.every((r) => r.w === sc && r.h === sc), name).toBe(true);
    }
  });

  test('view:"back" renders the back art (distinct from the front) for authored mons', () => {
    for (const { name } of NEW) {
      const front = renderInSlot(name, 'front');
      const back = renderInSlot(name, 'back');
      expect(back.length, name).toBeGreaterThan(0);
      // Front + back are different art → their rect footprints differ.
      expect(back, name).not.toEqual(front);
    }
  });

  test('back FALLBACK — a front-only mon (KINDRAKE) renders view:"back" bit-identical to front', () => {
    const front = renderInSlot('KINDRAKE', 'front');
    const back = renderInSlot('KINDRAKE', 'back'); // no back authored → falls back to front
    expect(back).toEqual(front);
  });

  test('bounds harness — every new front + a back satisfies the fillSlot integer-scale / floor bounds', () => {
    const cases: Array<[string, 'front' | 'back']> = [
      ['FLITPECK', 'front'], ['GALEHAWK', 'front'], ['MARSHMASH', 'front'], ['SILTSKIP', 'front'], ['GRITHOAX', 'front'],
      ['FLITPECK', 'back'], ['GRITHOAX', 'back'],
    ];
    for (const [name, view] of cases) {
      const rects = renderInSlot(name, view);
      const sc = slotScaleFor(rawFor(name, view).size); // 112 → 1×, 56 → 2×
      expect(rects.length, `${name}/${view}`).toBeGreaterThan(0);
      for (const r of rects) {
        // Clean integer blocks at the sprite's own in-slot scale.
        expect(r.w, `${name}/${view}`).toBe(sc);
        expect(r.h, `${name}/${view}`).toBe(sc);
        expect(Number.isInteger(r.x) && Number.isInteger(r.y), `${name}/${view}`).toBe(true);
        // Fully inside the 112 slot (floor bounds — nothing escapes the stage tile).
        expect(r.x, `${name}/${view}`).toBeGreaterThanOrEqual(0);
        expect(r.y, `${name}/${view}`).toBeGreaterThanOrEqual(0);
        expect(r.x + r.w, `${name}/${view}`).toBeLessThanOrEqual(112);
        expect(r.y + r.h, `${name}/${view}`).toBeLessThanOrEqual(112);
      }
      // Bottom-anchored: the 56-row grid's floor sits at the slot floor (112), so
      // the lowest DRAWN block reaches within a grid row of it (art isn't floating).
      const floor = Math.max(...rects.map((r) => r.y + r.h));
      expect(floor, `${name}/${view}`).toBeLessThanOrEqual(112);
      expect(floor, `${name}/${view}`).toBeGreaterThanOrEqual(108); // ≥ grid-row-55 minus one row (54→110)
    }
  });
});
