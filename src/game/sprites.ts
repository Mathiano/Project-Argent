// Sprite registry: known species map to ported demo art (14x14) or production
// assets (56x56 text-grid JSON). Unknown species render through the placeholder.

import embercubData from '../../assets/sprites/embercub.sprite.json';
import grubleafData from '../../assets/sprites/GRUBLEAF.sprite.json';
import kindrakeData from '../../assets/sprites/KINDRAKE.sprite.json';
import ch1BatchData from '../../docs/ch1-batch.json';
import type { ElementType } from '../engine';
import type { Facing, Sprite } from './sprite';
import { drawSprite, drawSpriteInSlot, validateSprite } from './sprite';

const EMBERCUB_56: Sprite = embercubData as Sprite;
const GRUBLEAF_56: Sprite = grubleafData as Sprite;
const KINDRAKE_56: Sprite = kindrakeData as Sprite;

const SPROUTLE_14: Sprite = {
  name: 'SPROUTLE',
  size: 14,
  palette: { g: '#3e8f4e', G: '#246b38', l: '#8fd06a', c: '#f0e6c0', k: '#22301f' },
  rows: [
    '......ll......',
    '.....lggl.....',
    '......gg......',
    '....kGGGGk....',
    '..kGGggggGGk..',
    '.kGgkggggkgGk.',
    '.kGggggggggGk.',
    '.kGgccccccgGk.',
    '.kGgccccccgGk.',
    '..kGgccccgGk..',
    '...kGGggGGk...',
    '..kk.kGGk.kk..',
    '..............',
    '..............',
  ],
};

const AQUAFIN_14: Sprite = {
  name: 'AQUAFIN',
  size: 14,
  palette: { b: '#3f7fd2', B: '#27579c', c: '#e8f2fa', k: '#1c2436' },
  rows: [
    '......BB......',
    '.....BBBB.....',
    '......BB......',
    '...kbbbbbbk...',
    '..kbbbbbbbbk..',
    '.kbbkbbbbkbbk.',
    '.kbbbbbbbbbbk.',
    '.kbccccccccbk.',
    '.kbccccccccbk.',
    '..kbbbbbbbbk..',
    '...kbbbbbbk...',
    '....kbbbbk....',
    '......kbBk....',
    '.......kk.....',
  ],
};

const FUZZLET_14: Sprite = {
  name: 'FUZZLET',
  size: 14,
  palette: { n: '#9a6a3a', N: '#6e4422', t: '#e7c894', k: '#2b2018' },
  rows: [
    '..k........k..',
    '.knk......knk.',
    '..knnnnnnnnk..',
    '.knnnnnnnnnnk.',
    '.knknnnnnnknk.',
    '.knnnnttnnnnk.',
    '.knnntkktnnnk.',
    '.knnnnttnnnnk.',
    '..knnnnnnnnk..',
    '..knnnnnnnnk..',
    '...knnnnnnk...',
    '..kk.kkkk.kk..',
    '..............',
    '..............',
  ],
};

// Validate at module load so bad data fails fast.
[EMBERCUB_56, GRUBLEAF_56, KINDRAKE_56, SPROUTLE_14, AQUAFIN_14, FUZZLET_14].forEach(validateSprite);

const REGISTRY: { readonly [name: string]: Sprite } = {
  EMBERCUB: EMBERCUB_56,
  GRUBLEAF: GRUBLEAF_56,
  KINDRAKE: KINDRAKE_56,
  SPROUTLE: SPROUTLE_14,
  AQUAFIN: AQUAFIN_14,
  FUZZLET: FUZZLET_14,
};

export function getSprite(name: string): Sprite | null {
  return REGISTRY[name] ?? null;
}

// Type-tinted placeholder fills. Covers legacy mixed-case (fixture trio)
// and CH1+ uppercase types. Unknown types fall back to neutral.
const TYPE_COLOR: { readonly [k: string]: string } = {
  Flame: '#c2491a',
  Sprout: '#246b38',
  Splash: '#27579c',
  FLAME: '#c2491a',
  NATURE: '#246b38',
  AQUA: '#27579c',
  BASIC: '#a98e5a',
  GALE: '#9aaecf',
  VENOM: '#7e3f9c',
  TERRA: '#7a4e2d',
  SPARK: '#f0c33a',
  FROST: '#8fc8e8',
  SPIRIT: '#9d7fcf',
  BRAWN: '#c25a36',
  FORGE: '#6a6a72',
  DRAKE: '#3d6b50',
};

const PLACEHOLDER_NEUTRAL = '#6e6e7a';
const PLACEHOLDER_OUTLINE = '#1d1d28';
const PLACEHOLDER_MARK = '#f6efda';
const PLACEHOLDER_EYE = '#f6efda';

// Manifest-backed archetype/stage lookup. Placeholders read the LOCKED
// manifest so they're VISUALLY DISTINCT — shape by archetype, colour by
// type, size by evo stage — instead of an identical "?" for every mon.
const ARCHETYPE_BY_NAME: { [name: string]: string } = {};
const STAGE_BY_NAME: { [name: string]: number } = {};
for (const e of ch1BatchData as ReadonlyArray<{ name: string; archetype?: string; stage?: number }>) {
  if (e.archetype) ARCHETYPE_BY_NAME[e.name] = e.archetype;
  if (typeof e.stage === 'number') STAGE_BY_NAME[e.name] = e.stage;
}

// Silhouette primitives over NORMALISED slot coords (0..1). A shape is the
// union of a few of these; the renderer fills inside, outlines the edge.
type Pt = (nx: number, ny: number) => boolean;
const ell = (cx: number, cy: number, rx: number, ry: number): Pt =>
  (nx, ny) => ((nx - cx) / rx) ** 2 + ((ny - cy) / ry) ** 2 <= 1;
const box = (x0: number, x1: number, y0: number, y1: number): Pt =>
  (nx, ny) => nx >= x0 && nx <= x1 && ny >= y0 && ny <= y1;
// Rightward wedge (a beak): widest at xBase, tapering to a point at xTip.
const beak = (xBase: number, xTip: number, cy: number, halfH: number): Pt =>
  (nx, ny) => nx >= xBase && nx <= xTip && Math.abs(ny - cy) <= halfH * ((xTip - nx) / (xTip - xBase));
const union = (...ps: Pt[]): Pt => (nx, ny) => ps.some((p) => p(nx, ny));

interface Silhouette {
  readonly inside: Pt;
  // Optional eye dots (peeking eyes — the Trickster tell), normalised.
  readonly eyes?: ReadonlyArray<readonly [number, number]>;
}

// One silhouette per ARCHETYPE — honouring the locked concept families:
// Wall = wide armoured QUADRUPED (the FLAME fortress-drake, NOT a fire-
// bird); Counter-tank = round heavy (the AQUA mudskipper→leviathan line);
// Glass nuke = angular BIRD (GALE); etc. Same family = same shape; type
// colour + stage size separate the rest.
const SHAPES: { readonly [archetype: string]: Silhouette } = {
  // Wide low body, four stout legs, two back-plate humps.
  Wall: {
    inside: union(
      ell(0.5, 0.47, 0.41, 0.25),
      box(0.2, 0.3, 0.64, 0.92), box(0.38, 0.46, 0.64, 0.92),
      box(0.56, 0.64, 0.64, 0.92), box(0.72, 0.82, 0.64, 0.92),
      ell(0.37, 0.25, 0.1, 0.1), ell(0.63, 0.25, 0.1, 0.1),
    ),
  },
  // Tall, narrow, upright — a pointed head on a slim body, two thin legs.
  Dodger: {
    inside: union(ell(0.5, 0.48, 0.19, 0.38), ell(0.5, 0.15, 0.09, 0.13), box(0.41, 0.47, 0.82, 0.96), box(0.53, 0.59, 0.82, 0.96)),
  },
  // Big rounded heavy body on two stubby feet.
  'Counter-tank': {
    inside: union(ell(0.5, 0.5, 0.41, 0.4), box(0.3, 0.42, 0.86, 0.97), box(0.58, 0.7, 0.86, 0.97)),
  },
  // Angular bird: body + head + beak + a swept wing, two thin legs.
  'Glass nuke': {
    inside: union(
      ell(0.42, 0.53, 0.24, 0.19), ell(0.61, 0.41, 0.13, 0.13),
      beak(0.71, 0.94, 0.41, 0.13), ell(0.33, 0.36, 0.17, 0.1),
      box(0.42, 0.46, 0.68, 0.92), box(0.54, 0.58, 0.68, 0.92),
    ),
  },
  // Squat hooded mound with two peeking eyes (the cunning lurker).
  Trickster: {
    inside: ell(0.5, 0.58, 0.37, 0.33),
    eyes: [[0.4, 0.52], [0.6, 0.52]],
  },
  // Bulky upright torso, two side arms, two legs (the fighter).
  Brawler: {
    inside: union(
      ell(0.5, 0.43, 0.25, 0.29), ell(0.26, 0.49, 0.11, 0.15), ell(0.74, 0.49, 0.11, 0.15),
      box(0.39, 0.47, 0.7, 0.96), box(0.53, 0.61, 0.7, 0.96),
    ),
  },
  // Distinct simple fallbacks for archetypes not yet in CH1.
  Drainer: { inside: union(ell(0.5, 0.52, 0.34, 0.34), ell(0.5, 0.86, 0.12, 0.12)), eyes: [[0.42, 0.46], [0.58, 0.46]] },
  Pacer: { inside: union(ell(0.5, 0.5, 0.3, 0.24), box(0.3, 0.7, 0.5, 0.62)) },
};

// Draw an auto-generated silhouette for any species without registered art.
// Per pilot-exit-decisions §2: gameplay never blocks on art — but the
// placeholders are now DISTINCT (shape×colour×size), so the player can
// tell the mons apart at a glance. `name` (optional) selects the manifest
// archetype/stage; without it, the neutral "?" blob is used (e.g. the
// dex's unseen silhouette).
export function drawPlaceholder(
  ctx: CanvasRenderingContext2D,
  type: ElementType | null,
  slotX: number,
  slotY: number,
  options: { slotSize?: number; name?: string } = {},
): void {
  const slotSize = options.slotSize ?? 56;
  const fill = type !== null && TYPE_COLOR[type] ? TYPE_COLOR[type]! : PLACEHOLDER_NEUTRAL;
  const archetype = options.name ? ARCHETYPE_BY_NAME[options.name] : undefined;
  const shape = archetype ? SHAPES[archetype] : undefined;

  if (!shape) {
    drawBlobWithMark(ctx, fill, slotX, slotY, slotSize);
    return;
  }

  // Stage scales the silhouette: a freshly-hatched stage 1 is smaller, a
  // final form bigger (an evo line reads as one family, growing). Sampled
  // around the slot centre.
  const stage = (options.name ? STAGE_BY_NAME[options.name] : undefined) ?? 1;
  const scale = 0.84 + Math.min(stage, 3) * 0.07; // 1→0.91, 2→0.98, 3→1.05
  const inside = shape.inside;
  const test = (nx: number, ny: number): boolean => inside(0.5 + (nx - 0.5) / scale, 0.5 + (ny - 0.5) / scale);

  for (let py = 0; py < slotSize; py += 1) {
    for (let px = 0; px < slotSize; px += 1) {
      const nx = (px + 0.5) / slotSize;
      const ny = (py + 0.5) / slotSize;
      if (!test(nx, ny)) continue;
      const e = 1 / slotSize;
      const onEdge =
        !test(nx - e, ny) || !test(nx + e, ny) || !test(nx, ny - e) || !test(nx, ny + e);
      ctx.fillStyle = onEdge ? PLACEHOLDER_OUTLINE : fill;
      ctx.fillRect(slotX + px, slotY + py, 1, 1);
    }
  }

  // Eyes (the Trickster/Drainer tell) — a couple of pale dots so the form
  // reads as a creature, not a rock.
  for (const [ex, ey] of shape.eyes ?? []) {
    const sx = 0.5 + (ex - 0.5) * scale;
    const sy = 0.5 + (ey - 0.5) * scale;
    const dot = Math.max(1, Math.round(slotSize / 20));
    ctx.fillStyle = PLACEHOLDER_EYE;
    ctx.fillRect(slotX + Math.round(sx * slotSize) - 1, slotY + Math.round(sy * slotSize) - 1, dot, dot);
  }
}

// The neutral fallback: a rounded blob + "?" (the original placeholder),
// for species with no manifest archetype (or the dex's unseen silhouette).
function drawBlobWithMark(
  ctx: CanvasRenderingContext2D,
  fill: string,
  slotX: number,
  slotY: number,
  slotSize: number,
): void {
  const bodyTop = slotY + Math.floor(slotSize * 0.25);
  const bodyBottom = slotY + slotSize - 2;
  const bodyLeft = slotX + Math.floor(slotSize * 0.15);
  const bodyRight = slotX + slotSize - Math.floor(slotSize * 0.15) - 1;
  const cx = slotX + slotSize / 2;
  const cy = (bodyTop + bodyBottom) / 2;
  const rx = (bodyRight - bodyLeft) / 2;
  const ry = (bodyBottom - bodyTop) / 2;
  for (let py = bodyTop; py <= bodyBottom; py += 1) {
    for (let px = bodyLeft; px <= bodyRight; px += 1) {
      const nx = (px - cx) / rx;
      const ny = (py - cy) / ry;
      if (nx * nx + ny * ny > 1) continue;
      const onEdge =
        ((px - 1 - cx) / rx) ** 2 + ((py - cy) / ry) ** 2 > 1 ||
        ((px + 1 - cx) / rx) ** 2 + ((py - cy) / ry) ** 2 > 1 ||
        ((px - cx) / rx) ** 2 + ((py - 1 - cy) / ry) ** 2 > 1 ||
        ((px - cx) / rx) ** 2 + ((py + 1 - cy) / ry) ** 2 > 1;
      ctx.fillStyle = onEdge ? PLACEHOLDER_OUTLINE : fill;
      ctx.fillRect(px, py, 1, 1);
    }
  }
  const mark: readonly string[] = ['.qqqq.', 'qq..qq', '....qq', '..qqq.', '..qq..', '......', '..qq..', '..qq..'];
  const mx = Math.floor(cx) - 3;
  const my = Math.floor(cy) - 4;
  for (let y = 0; y < mark.length; y += 1) {
    const row = mark[y]!;
    for (let x = 0; x < row.length; x += 1) {
      if (row[x] !== 'q') continue;
      ctx.fillStyle = PLACEHOLDER_MARK;
      ctx.fillRect(mx + x, my + y, 1, 1);
    }
  }
}

export interface SpeciesRef {
  readonly name: string;
  readonly type: ElementType | null;
}

export function drawSpeciesInSlot(
  ctx: CanvasRenderingContext2D,
  species: SpeciesRef,
  slotX: number,
  slotY: number,
  options: { slotSize?: number; flip?: boolean; facing?: Facing } = {},
): void {
  const sprite = getSprite(species.name);
  if (sprite) {
    const flip = resolveFlip(sprite, options);
    const drawOpts: { slotSize?: number; flip: boolean } =
      options.slotSize !== undefined
        ? { slotSize: options.slotSize, flip }
        : { flip };
    drawSpriteInSlot(ctx, sprite, slotX, slotY, drawOpts);
    return;
  }
  // Pass the species name so the placeholder picks the manifest archetype
  // (distinct shape) — falls back to the neutral "?" blob for unknown names.
  const placeholderOpts: { slotSize?: number; name: string } =
    options.slotSize !== undefined ? { slotSize: options.slotSize, name: species.name } : { name: species.name };
  drawPlaceholder(ctx, species.type, slotX, slotY, placeholderOpts);
}

// 'facing' wins when both are given: caller declared which way the slot
// should face, so we flip whenever the source art disagrees.
function resolveFlip(sprite: Sprite, options: { facing?: Facing; flip?: boolean }): boolean {
  if (options.facing !== undefined) {
    const source: Facing = sprite.facing ?? 'left';
    return source !== options.facing;
  }
  return options.flip ?? false;
}

export { drawSprite, drawSpriteInSlot };
