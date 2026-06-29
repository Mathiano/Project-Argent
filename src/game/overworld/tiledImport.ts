// Tiled (.tmj) → Argent map importer (Phase 8).
//
// Converts a Tiled JSON export into a loadable Argent MapData: tile layers become
// ordered ImportedTileLayers of registry tile refs; named objects become carried-
// through ImportedObjects. PURE — no DOM, no filesystem; the caller supplies the
// parsed .tmj plus a sheet resolver and (optionally) a tile-existence predicate, so
// it runs identically in tests, the dev render hook, and any future CLI.
//
// The GID→tile rule (verified — docs/tiled-gid-correspondence.md):
//   g===0 → empty; id = g & 0x1FFFFFFF (mask flip bits); tileset = the entry with
//   the largest firstgid ≤ id; local = id − firstgid; row = ⌊local/cols⌋,
//   col = local%cols; Argent key = r{row}c{col} in that tileset's pct_* registry.
// ⚠ cols comes from the SOURCE-PNG width (the resolver's table), NOT the .tsx —
//   a .tsx's columns/tilecount can be edited after export (the stale-export hazard).
//
// Robustness: it never throws on a bad export — it WARNS and degrades (empty cell /
// skipped object) so the author learns what to fix: duplicate tilesets, unnamed
// objects, GIDs whose sheet isn't ingested, and GIDs resolving past a tileset / to
// a missing-or-blank registry cell.

import type { ImportedObject, ImportedTileLayer, MapData, Spawn, TileRef } from './types';

// ── Tiled JSON shapes (only the fields we read) ───────────────────────────────
export interface TiledTilesetRef {
  readonly firstgid: number;
  readonly source: string; // ".tsx" path (external tileset)
}
export interface TiledTileLayer {
  readonly type: 'tilelayer';
  readonly name: string;
  readonly width: number;
  readonly height: number;
  readonly data: readonly number[];
}
export interface TiledProperty {
  readonly name: string;
  readonly value: unknown;
}
export interface TiledObject {
  readonly name: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly properties?: readonly TiledProperty[];
}
export interface TiledObjectGroup {
  readonly type: 'objectgroup';
  readonly name: string;
  readonly objects: readonly TiledObject[];
}
export type TiledLayer = TiledTileLayer | TiledObjectGroup | { readonly type: string };
export interface TiledMapJson {
  readonly width: number;
  readonly height: number;
  readonly tilewidth: number;
  readonly tileheight: number;
  readonly tilesets: readonly TiledTilesetRef[];
  readonly layers: readonly TiledLayer[];
}

// Resolver: a Tiled tileset `source` (".tsx" path) → its Argent registry tileset +
// the column count derived from the SOURCE PNG width (cols = pngWidth / 16).
export interface ResolvedSheet {
  readonly pct: string;
  readonly cols: number;
}
export type SheetResolver = (source: string) => ResolvedSheet | null;

export interface ImportOptions {
  readonly name: string;
  readonly resolveSheet: SheetResolver;
  // Optional: does pct tileset `pct` contain tile `key`? When given, the importer
  // warns on (and empties) GIDs that resolve to a missing/blank registry cell.
  readonly tileExists?: (pct: string, key: string) => boolean;
}

export interface ImportStats {
  readonly width: number;
  readonly height: number;
  readonly tileLayers: number;
  readonly objects: number;
  readonly gidsResolved: number;
  readonly gidsEmpty: number; // g===0 cells (intentionally empty)
  readonly gidsDropped: number; // resolved to nothing (warned) — rendered empty
  readonly collisionLayers: number; // collision layers consumed (excluded from render)
  readonly collisionCells: number; // cells marked solid from the collision layer(s)
}
export interface ImportResult {
  readonly map: MapData;
  readonly warnings: readonly string[];
  readonly stats: ImportStats;
}

const FLIP_MASK = 0x1fffffff; // strip Tiled's 3 high flip bits (H/V/D)

// Collision convention: a tile layer with one of these names (case-insensitive) is
// the COLLISION layer — metadata, not art. Any non-empty cell = solid; it is NOT
// added to the visual importedLayers. The tiles used to paint it don't matter
// (presence = solid). `collision` is canonical. See docs/tiled-importer.md.
const COLLISION_LAYER_NAMES = new Set(['collision', 'meta_collision']);
export function isCollisionLayerName(name: string): boolean {
  return COLLISION_LAYER_NAMES.has(name.trim().toLowerCase());
}

export function basename(p: string): string {
  const parts = p.split(/[\\/]/);
  return parts[parts.length - 1] ?? p;
}

// Resolve a GID's owning tileset entry: the one with the largest firstgid ≤ id.
function ownerOf(tilesets: readonly TiledTilesetRef[], id: number): TiledTilesetRef | null {
  let best: TiledTilesetRef | null = null;
  for (const t of tilesets) {
    if (t.firstgid <= id && (best === null || t.firstgid > best.firstgid)) best = t;
  }
  return best;
}

export function importTiledMap(tmj: TiledMapJson, opts: ImportOptions): ImportResult {
  const warnings: string[] = [];
  const { width: W, height: H } = tmj;
  const tilesize = tmj.tilewidth || 16;

  // Robustness: duplicate tilesets (same source, two firstgids — an editing artifact).
  const seenSource = new Map<string, number>();
  for (const t of tmj.tilesets) {
    const b = basename(t.source);
    if (seenSource.has(b)) {
      warnings.push(
        `duplicate tileset "${b}" (firstgid ${seenSource.get(b)} and ${t.firstgid}) — a Tiled-editing artifact; remove the duplicate in the source map.`,
      );
    } else {
      seenSource.set(b, t.firstgid);
    }
  }

  // Pre-resolve each tileset entry once (sheet lookup + warn on un-ingested sheets).
  const resolvedByFirst = new Map<number, ResolvedSheet | null>();
  const warnedSheet = new Set<string>();
  for (const t of tmj.tilesets) {
    const r = opts.resolveSheet(t.source);
    resolvedByFirst.set(t.firstgid, r);
    if (r === null && !warnedSheet.has(t.source)) {
      warnedSheet.add(t.source);
      warnings.push(
        `tileset "${basename(t.source)}" has no pct_* registry counterpart — ingest that sheet (tools/pct_tile_ingest.mjs) before its tiles can render. Its GIDs will import as empty.`,
      );
    }
  }

  let gidsResolved = 0;
  let gidsEmpty = 0;
  let gidsDropped = 0;
  const warnedMissing = new Set<string>();
  const warnedRange = new Set<number>();

  // Translate one GID → a TileRef (or null = empty), warning+dropping on any fault.
  const refOf = (g: number): TileRef | null => {
    if (g === 0) {
      gidsEmpty += 1;
      return null;
    }
    const id = g & FLIP_MASK;
    const owner = ownerOf(tmj.tilesets, id);
    if (!owner) {
      gidsDropped += 1;
      if (!warnedRange.has(id)) {
        warnedRange.add(id);
        warnings.push(`GID ${g} (id ${id}) is below every tileset's firstgid — empty.`);
      }
      return null;
    }
    const sheet = resolvedByFirst.get(owner.firstgid) ?? null;
    if (!sheet) {
      gidsDropped += 1;
      return null; // un-ingested sheet already warned once above
    }
    const local = id - owner.firstgid;
    const row = Math.floor(local / sheet.cols);
    const col = local % sheet.cols;
    const key = `r${row}c${col}`;
    if (opts.tileExists && !opts.tileExists(sheet.pct, key)) {
      gidsDropped += 1;
      const w = `${sheet.pct}:${key}`;
      if (!warnedMissing.has(w)) {
        warnedMissing.add(w);
        warnings.push(
          `GID ${g} → ${w} is not in the registry (blank/transparent cell or un-ingested) — rendered empty.`,
        );
      }
      return null;
    }
    gidsResolved += 1;
    return { tileset: sheet.pct, tile: key };
  };

  // Collision: false everywhere (= explicit walkable; imported maps have no base
  // tile grid for isWalkable to fall through to). A collision layer flips its
  // painted cells to true (solid). No collision layer → all-walkable (no regression).
  const solid: boolean[][] = [];
  for (let y = 0; y < H; y += 1) solid.push(new Array<boolean>(W).fill(false));
  let collisionLayers = 0;
  let collisionCells = 0;

  // Tile layers → ordered ImportedTileLayers (bottom→top, source order preserved).
  // The collision layer is consumed into `solid` and EXCLUDED from the visual layers.
  const importedLayers: ImportedTileLayer[] = [];
  for (const layer of tmj.layers) {
    if (layer.type !== 'tilelayer') continue;
    const tl = layer as TiledTileLayer;
    if (isCollisionLayerName(tl.name)) {
      collisionLayers += 1;
      for (let y = 0; y < H; y += 1) {
        for (let x = 0; x < W; x += 1) {
          if ((tl.data[y * W + x] ?? 0) !== 0) {
            if (!solid[y]![x]) collisionCells += 1;
            solid[y]![x] = true; // any painted cell = solid (presence, not GID)
          }
        }
      }
      continue; // metadata — not rendered
    }
    const grid: (TileRef | null)[][] = [];
    for (let y = 0; y < H; y += 1) {
      const rowArr: (TileRef | null)[] = new Array(W).fill(null);
      for (let x = 0; x < W; x += 1) {
        const g = tl.data[y * W + x] ?? 0;
        rowArr[x] = refOf(g);
      }
      grid.push(rowArr);
    }
    importedLayers.push({ name: tl.name, tiles: grid });
  }

  // Object layers → carried-through named markers (snapped to the tile grid).
  const importedObjects: ImportedObject[] = [];
  for (const layer of tmj.layers) {
    if (layer.type !== 'objectgroup') continue;
    const og = layer as TiledObjectGroup;
    for (const obj of og.objects) {
      const name = (obj.name ?? '').trim();
      if (name === '') {
        warnings.push(
          `unnamed object at (${obj.x.toFixed(1)}, ${obj.y.toFixed(1)}) — name it (npc_*/warp_*/…) so the wiring layer can resolve it; skipped.`,
        );
        continue;
      }
      // Optional `facing` custom property (up/down/left/right) — for spawn_* markers.
      let facing: 'up' | 'down' | 'left' | 'right' | undefined;
      const fp = obj.properties?.find((p) => p.name === 'facing');
      if (fp !== undefined) {
        const v = String(fp.value);
        if (v === 'up' || v === 'down' || v === 'left' || v === 'right') facing = v;
        else warnings.push(`object "${name}" has facing="${v}" (expected up/down/left/right) — ignored.`);
      }
      importedObjects.push({
        name,
        x: Math.round(obj.x / tilesize),
        y: Math.round(obj.y / tilesize),
        w: Math.max(1, Math.round((obj.width || tilesize) / tilesize)),
        h: Math.max(1, Math.round((obj.height || tilesize) / tilesize)),
        ...(facing !== undefined ? { facing } : {}),
      });
    }
  }

  // solidOverrides feeds the EXISTING isWalkable (types.ts): true=solid, false=
  // walkable. Built from the collision layer above; false elsewhere.
  const solidOverrides: (boolean | null)[][] = solid;

  const spawn: Spawn = { x: Math.floor(W / 2), y: Math.floor(H / 2), facing: 'down' };

  const map: MapData = {
    name: opts.name,
    width: W,
    height: H,
    tilesize,
    tiles: '',
    tileset: {},
    objects: [],
    spawns: { default: spawn },
    solidOverrides,
    importedLayers,
    importedObjects,
  };

  return {
    map,
    warnings,
    stats: {
      width: W,
      height: H,
      tileLayers: importedLayers.length,
      objects: importedObjects.length,
      gidsResolved,
      gidsEmpty,
      gidsDropped,
      collisionLayers,
      collisionCells,
    },
  };
}

// ── Default sheet table — the documented source→registry mapping ──────────────
// Keyed by the .tsx basename the .tmj references; `cols` = source-PNG width / 16
// (the immutable pack dims — NOT the .tsx's editable columns attr). Extend here as
// more sheets are ingested. (docs/tiled-gid-correspondence.md §3.)
//   Grass.png 192→12 · path_02.png 192→12 · Hills.png 304→19 · bush-anim.png 384→24
//   · trees.png 160→10 · bush.png 48→3 · path_01.png 192→12
export const DEFAULT_SHEET_TABLE: { readonly [tsx: string]: ResolvedSheet } = {
  'Argent_Grass_1.tsx': { pct: 'pct_grass', cols: 12 },
  'path_02.tsx': { pct: 'pct_path02', cols: 12 },
  'Hills.tsx': { pct: 'pct_hills', cols: 19 },
  'bush-anim.tsx': { pct: 'pct_bushanim', cols: 24 },
  'trees_new.tsx': { pct: 'pct_trees', cols: 10 },
  'Argent_Trees_1.tsx': { pct: 'pct_trees', cols: 10 }, // legacy alias for trees.png@16
  'Argent_Bush_1.tsx': { pct: 'pct_bush', cols: 3 },
  'path_01.tsx': { pct: 'pct_path', cols: 12 },
};

export function defaultResolveSheet(source: string): ResolvedSheet | null {
  return DEFAULT_SHEET_TABLE[basename(source)] ?? null;
}
