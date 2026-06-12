// Text-grid sprite format. Each row is a string of palette keys
// ('.' = transparent). Rendered at 1px per cell, native size — no scaling.

export type Facing = 'left' | 'right';

export interface Sprite {
  readonly name: string;
  readonly size: number;
  readonly palette: { readonly [key: string]: string };
  readonly rows: readonly string[];
  // Source-art direction. Defaults to 'left' (the demo's convention).
  // Renderer flips if the slot wants the opposite direction.
  readonly facing?: Facing;
}

export function validateSprite(sprite: Sprite): void {
  if (sprite.rows.length !== sprite.size) {
    throw new Error(
      `Sprite ${sprite.name}: ${sprite.rows.length} rows, expected ${sprite.size}`,
    );
  }
  for (let r = 0; r < sprite.rows.length; r += 1) {
    const row = sprite.rows[r]!;
    if (row.length !== sprite.size) {
      throw new Error(
        `Sprite ${sprite.name}: row ${r} length ${row.length}, expected ${sprite.size}`,
      );
    }
  }
}

export interface DrawOptions {
  readonly flip?: boolean;
}

export function drawSprite(
  ctx: CanvasRenderingContext2D,
  sprite: Sprite,
  x: number,
  y: number,
  options: DrawOptions = {},
): void {
  const flip = options.flip ?? false;
  for (let r = 0; r < sprite.rows.length; r += 1) {
    const row = sprite.rows[r]!;
    for (let c = 0; c < row.length; c += 1) {
      const ch = row[c]!;
      if (ch === '.') continue;
      const color = sprite.palette[ch];
      if (!color) continue;
      const px = flip ? row.length - 1 - c : c;
      ctx.fillStyle = color;
      ctx.fillRect(x + px, y + r, 1, 1);
    }
  }
}

// Place a sprite inside an arbitrary-size slot, anchored at bottom-center
// so smaller legacy art "stands on" the platform with the slot floor.
export function drawSpriteInSlot(
  ctx: CanvasRenderingContext2D,
  sprite: Sprite,
  slotX: number,
  slotY: number,
  options: DrawOptions & { slotSize?: number } = {},
): void {
  const slotSize = options.slotSize ?? 56;
  const dx = slotX + Math.floor((slotSize - sprite.size) / 2);
  const dy = slotY + slotSize - sprite.size;
  drawSprite(ctx, sprite, dx, dy, { flip: options.flip ?? false });
}
