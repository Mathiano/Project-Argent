// Sprite registry: known species map to ported demo art (14x14) or production
// assets (56x56 text-grid JSON). Unknown species render through the placeholder.

import embercubData from '../../assets/sprites/embercub.sprite.json';
import grubleafData from '../../assets/sprites/GRUBLEAF.sprite.json';
import kindrakeData from '../../assets/sprites/KINDRAKE.sprite.json';
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

// Draw an auto-generated silhouette for any species without registered art.
// Per pilot-exit-decisions §2: type palette + "?" — gameplay never blocks on art.
export function drawPlaceholder(
  ctx: CanvasRenderingContext2D,
  type: ElementType | null,
  slotX: number,
  slotY: number,
  options: { slotSize?: number } = {},
): void {
  const slotSize = options.slotSize ?? 56;
  const fill = (type !== null && TYPE_COLOR[type]) ? TYPE_COLOR[type]! : PLACEHOLDER_NEUTRAL;

  // Rounded body anchored to the bottom of the slot.
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
      // Outline = the layer of pixels that has a neighbor outside the ellipse.
      const onEdge =
        ((px - 1 - cx) / rx) ** 2 + ((py - cy) / ry) ** 2 > 1 ||
        ((px + 1 - cx) / rx) ** 2 + ((py - cy) / ry) ** 2 > 1 ||
        ((px - cx) / rx) ** 2 + ((py - 1 - cy) / ry) ** 2 > 1 ||
        ((px - cx) / rx) ** 2 + ((py + 1 - cy) / ry) ** 2 > 1;
      ctx.fillStyle = onEdge ? PLACEHOLDER_OUTLINE : fill;
      ctx.fillRect(px, py, 1, 1);
    }
  }

  // ? mark in the middle, pixel-stamped so it sits in the 8px grid.
  const mark: readonly string[] = [
    '.qqqq.',
    'qq..qq',
    '....qq',
    '..qqq.',
    '..qq..',
    '......',
    '..qq..',
    '..qq..',
  ];
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
  const placeholderOpts = options.slotSize !== undefined ? { slotSize: options.slotSize } : {};
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
