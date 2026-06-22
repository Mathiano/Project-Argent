// Tileset and prefab data formats.
//
// A Tileset is a palette + a named bag of tiles. Each tile is a 16x16
// (or whatever the tileset's tilesize is) grid of palette indices stored
// as a single string for compactness — one character per pixel, using
// the same compact alphabet as PALETTE_KEYS below. Tiles carry flags
// (solid / encounter / animated) so collision and triggers stay in data,
// not code.
//
// A Prefab is a multi-tile structure (a house, a tree, a path segment).
// It declares a grid of tile-ids that the map loader stamps at (x, y).
// One prefab edit propagates to every map that references it.
//
// Per-area variants: tilesets are addressed by name. A map declares
// `tileset: "outdoor_violet"` (or "outdoor_azalea"); the loader pulls
// the right one. No code change to ship new area looks — drop a
// new tileset JSON.

// Single-char palette keys. Extended 36 -> 62 (0-9a-zA-Z) so the decoder can
// render master-palette indices past 35 — the prerequisite for growing the
// palette beyond 36 colours (docs/visual-ceiling-rse-2d.md). Matches the
// 0-9a-zA-Z scheme the validators + studio already use; existing 0-9a-z indices
// are unchanged (additive — no renumbering). Decoding still bounds-checks
// against palette.length, so a key past the live palette is rejected.
export const PALETTE_KEYS =
  '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ' as const;

export interface TilesetJson {
  readonly name: string;
  readonly tilesize: number;
  readonly palette: readonly string[];
  readonly tiles: { readonly [id: string]: TileJson };
}

export interface TileJson {
  // Palette-indexed pixel grid. Two equivalent forms:
  //   pixels: "0123…" — one flat string of tilesize*tilesize chars
  //   rows: ["….", "….", …] — tilesize strings, each tilesize chars
  // Use rows in hand-edited JSON (clearer, length-checkable per row);
  // pixels for tooling that emits a flat string. Each char is a key
  // into PALETTE_KEYS pointing at palette[index]. Use ' ' or '.' for
  // transparent pixels (skipped during render).
  readonly pixels?: string;
  readonly rows?: readonly string[];
  readonly solid?: boolean;
  // Encounter zone id (matched against map-level encounter tables). null
  // = no encounter on this tile. Reserved for future use; flat tiles
  // with encounters declared on the map keep working in graybox mode.
  readonly encounter?: string | null;
  readonly animated?: boolean;
  readonly label?: string;
  // Phase 7 animation: extra frames beyond the base (pixels/rows = frame
  // 0). Each entry is a `rows`-style grid (tilesize strings of tilesize
  // chars). When present (≥1 extra frame), the tile cycles base→frames at
  // `fps` (default 2). Cheap "the world breathes" — water ripple, grass
  // sway. Static tiles omit both and render exactly as before.
  readonly frames?: readonly (readonly string[])[];
  readonly fps?: number;
}

export interface PrefabJson {
  readonly name: string;
  readonly width: number;
  readonly height: number;
  // Grid of tile-ids (rows of length `width`). Use null/empty string to
  // leave the underlying map tile untouched (lets prefabs have non-rect
  // silhouettes, e.g. a tree with rounded corners).
  readonly tiles: readonly (readonly (string | null)[])[];
  // Per-cell solidity override. If absent, the tile's own `solid` flag
  // is used; if present (same shape as tiles), the prefab can mark
  // walkable cutouts inside an otherwise-solid prefab (e.g., the door
  // tile of a house roof).
  readonly collision?: readonly (readonly (boolean | null)[])[];
  // Anchor (in prefab-local coords) — when the map places the prefab
  // at (x, y), the anchor cell lands on (x, y). Lets a 4-tall house
  // be placed by its door, etc.
  readonly anchor?: { readonly x: number; readonly y: number };
}

export interface Tileset {
  readonly name: string;
  readonly tilesize: number;
  readonly palette: readonly string[];
  readonly tiles: { readonly [id: string]: Tile };
}

export interface Tile {
  readonly id: string;
  // Decoded pixel grid: row-major, `tilesize * tilesize` entries.
  // null = transparent pixel. Equals frames[0] (the base frame).
  readonly pixels: ReadonlyArray<string | null>;
  readonly solid: boolean;
  readonly encounter: string | null;
  readonly animated: boolean;
  readonly label: string;
  // Phase 7: all frames (base + extras), decoded. Length 1 for a static
  // tile. Renderer cycles by tick when length > 1.
  readonly frames: ReadonlyArray<ReadonlyArray<string | null>>;
  readonly fps: number;
}

export interface Prefab {
  readonly name: string;
  readonly width: number;
  readonly height: number;
  readonly cells: ReadonlyArray<ReadonlyArray<PrefabCell>>;
  readonly anchor: { readonly x: number; readonly y: number };
}

export interface PrefabCell {
  readonly tile: string | null;
  readonly solid: boolean | null;
}

// Decode TilesetJson into runtime form. Validates pixel-grid size; throws
// on a malformed tile so a corrupted asset surfaces at load time rather
// than during render (which would freeze the canvas).
export function loadTileset(json: TilesetJson): Tileset {
  const tiles: { [id: string]: Tile } = {};
  const expectLen = json.tilesize * json.tilesize;
  // Decode one flat palette-char string into a pixel grid (null = transparent).
  const decode = (flat: string): (string | null)[] => {
    const out: (string | null)[] = new Array(expectLen);
    for (let i = 0; i < expectLen; i += 1) {
      const ch = flat[i]!;
      if (ch === ' ' || ch === '.') {
        out[i] = null;
        continue;
      }
      const idx = PALETTE_KEYS.indexOf(ch);
      if (idx === -1 || idx >= json.palette.length) {
        throw new Error(`Tileset "${json.name}" tile "${id}" pixel ${i}: char "${ch}" not in palette`);
      }
      out[i] = json.palette[idx]!;
    }
    return out;
  };
  let id = '';
  for (id of Object.keys(json.tiles)) {
    const t = json.tiles[id]!;
    const base = decode(flattenPixels(json.name, id, t, json.tilesize, expectLen));
    // Phase 7: optional extra animation frames (each a rows-style grid).
    const frames: (string | null)[][] = [base];
    for (const frameRows of t.frames ?? []) {
      frames.push(decode(flattenFrameRows(json.name, id, frameRows, json.tilesize)));
    }
    tiles[id] = {
      id,
      pixels: base,
      solid: t.solid ?? false,
      encounter: t.encounter ?? null,
      animated: (t.animated ?? false) || frames.length > 1,
      label: t.label ?? id,
      frames,
      fps: t.fps ?? 2,
    };
  }
  return {
    name: json.name,
    tilesize: json.tilesize,
    palette: json.palette,
    tiles,
  };
}

function flattenPixels(
  tilesetName: string,
  tileId: string,
  t: TileJson,
  tilesize: number,
  expectLen: number,
): string {
  if (t.rows !== undefined) {
    if (t.rows.length !== tilesize) {
      throw new Error(
        `Tileset "${tilesetName}" tile "${tileId}": rows=${t.rows.length} != tilesize=${tilesize}`,
      );
    }
    for (let y = 0; y < tilesize; y += 1) {
      if (t.rows[y]!.length !== tilesize) {
        throw new Error(
          `Tileset "${tilesetName}" tile "${tileId}" row ${y}: length=${t.rows[y]!.length} != ${tilesize}`,
        );
      }
    }
    return t.rows.join('');
  }
  if (t.pixels === undefined) {
    throw new Error(`Tileset "${tilesetName}" tile "${tileId}": missing pixels or rows`);
  }
  if (t.pixels.length !== expectLen) {
    throw new Error(
      `Tileset "${tilesetName}" tile "${tileId}": pixel grid length ${t.pixels.length} != ${expectLen}`,
    );
  }
  return t.pixels;
}

// Validate + flatten one animation frame (rows-style grid). Same row/size
// checks as flattenPixels' rows branch.
function flattenFrameRows(
  tilesetName: string,
  tileId: string,
  rows: readonly string[],
  tilesize: number,
): string {
  if (rows.length !== tilesize) {
    throw new Error(`Tileset "${tilesetName}" tile "${tileId}" frame: rows=${rows.length} != tilesize=${tilesize}`);
  }
  for (let y = 0; y < tilesize; y += 1) {
    if (rows[y]!.length !== tilesize) {
      throw new Error(`Tileset "${tilesetName}" tile "${tileId}" frame row ${y}: length=${rows[y]!.length} != ${tilesize}`);
    }
  }
  return rows.join('');
}

export function loadPrefab(json: PrefabJson): Prefab {
  if (json.tiles.length !== json.height) {
    throw new Error(
      `Prefab "${json.name}": tiles rows=${json.tiles.length} != height=${json.height}`,
    );
  }
  const cells: PrefabCell[][] = [];
  for (let y = 0; y < json.height; y += 1) {
    const row = json.tiles[y]!;
    if (row.length !== json.width) {
      throw new Error(
        `Prefab "${json.name}" row ${y}: width=${row.length} != ${json.width}`,
      );
    }
    const colRow: PrefabCell[] = [];
    for (let x = 0; x < json.width; x += 1) {
      const tile = row[x] ?? null;
      const solid =
        json.collision !== undefined ? (json.collision[y]?.[x] ?? null) : null;
      colRow.push({ tile: tile || null, solid });
    }
    cells.push(colRow);
  }
  return {
    name: json.name,
    width: json.width,
    height: json.height,
    cells,
    anchor: json.anchor ?? { x: 0, y: 0 },
  };
}

// Map-level prefab placement: stamps the prefab onto the tile grid at
// (placeX, placeY), with the prefab's anchor landing on that cell.
export function stampPrefab(
  prefab: Prefab,
  placeX: number,
  placeY: number,
  putTile: (x: number, y: number, tile: string, solidOverride: boolean | null) => void,
): void {
  const ox = placeX - prefab.anchor.x;
  const oy = placeY - prefab.anchor.y;
  for (let py = 0; py < prefab.height; py += 1) {
    for (let px = 0; px < prefab.width; px += 1) {
      const cell = prefab.cells[py]![px]!;
      if (cell.tile === null) continue;
      putTile(ox + px, oy + py, cell.tile, cell.solid);
    }
  }
}
