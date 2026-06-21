// Terrain autotiling (Phase 7). At load, rewrites a material's region cells to
// the 13-tile blob set (base + 4 edge + 4 outer + 4 inner) so grass/path/water
// boundaries get matched transition tiles instead of hard rectangles. Pure data:
// it only swaps tile IDS; each transition tile carries its own `solid` flag, so
// collision is unchanged (a path edge stays walkable, a water edge stays solid).
//
// Opt-in per map via the `autotile` field (e.g. ["path","water"]). A material is
// skipped unless the tileset actually defines its transition set (…_n etc.), so
// adding the field is safe even before the art lands.

import type { Tileset } from './tileset';

// Pick the transition variant for a region cell from its 8-neighbourhood.
// `grassAt(x,y)` = true when the neighbour is OUTSIDE the region (the material
// the boundary transitions TO). Degenerate 1-wide tips fall back to base.
function variant(
  base: string,
  x: number,
  y: number,
  w: number,
  h: number,
  inRegion: (x: number, y: number) => boolean,
): string {
  const g = (xx: number, yy: number): boolean => !(xx >= 0 && yy >= 0 && xx < w && yy < h && inRegion(xx, yy));
  const gN = g(x, y - 1), gS = g(x, y + 1), gE = g(x + 1, y), gW = g(x - 1, y);
  const orth = (gN ? 1 : 0) + (gE ? 1 : 0) + (gS ? 1 : 0) + (gW ? 1 : 0);
  if (orth >= 3) return base; // peninsula/tip — no tile for it, keep base
  if (orth === 2) {
    if (gN && gW) return `${base}_out_nw`;
    if (gN && gE) return `${base}_out_ne`;
    if (gS && gW) return `${base}_out_sw`;
    if (gS && gE) return `${base}_out_se`;
    return base; // opposite sides (1-wide strip) — no tile, keep base
  }
  if (orth === 1) return `${base}_${gN ? 'n' : gE ? 'e' : gS ? 's' : 'w'}`;
  // interior: an inner (concave) corner if a diagonal neighbour is outside
  if (g(x - 1, y - 1)) return `${base}_in_nw`;
  if (g(x + 1, y - 1)) return `${base}_in_ne`;
  if (g(x - 1, y + 1)) return `${base}_in_sw`;
  if (g(x + 1, y + 1)) return `${base}_in_se`;
  return base;
}

// Mutates `cells` in place. For each material whose transition set exists in the
// tileset, replace its region cells with the matched variant. Uses a snapshot
// mask per material so rewrites never feed back into neighbour lookups.
export function autotileTerrain(
  cells: string[][],
  width: number,
  height: number,
  tileset: Tileset,
  materials: readonly string[],
): void {
  for (const base of materials) {
    if (tileset.tiles[`${base}_n`] === undefined) continue; // no set authored yet
    const mask: boolean[][] = cells.map((row) => row.map((id) => id === base));
    const inRegion = (x: number, y: number): boolean => mask[y]![x]!;
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        if (!mask[y]![x]) continue;
        const id = variant(base, x, y, width, height, inRegion);
        if (tileset.tiles[id] !== undefined) cells[y]![x] = id;
      }
    }
  }
}
