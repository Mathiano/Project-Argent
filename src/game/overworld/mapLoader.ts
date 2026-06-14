// Map JSON → runtime MapData.
//
// Two formats supported:
//
//   Legacy graybox (back-compat): tiles as one newline-separated string,
//   inline tileset of {char: {color, solid, label}}. The renderer fills
//   each cell with a flat color. Kept loadable behind a debug flag for
//   when designers want to compare layouts against the data-driven look.
//
//   Data-driven (new): tilesetRef + cells (rows of tile-ids) + prefab
//   placements. Prefabs stamp multi-tile structures (house, gym) onto
//   the cell grid; their per-cell solid mask carves walkable cutouts
//   into otherwise-solid silhouettes (the door cell of a house roof).
//
// loadMap auto-detects the format by the presence of `tilesetRef` and
// returns a unified MapData. Existing scenes read the same shape either
// way; the renderer branches on `cells` to pick its draw path.

import type { MapData, MapObject, Spawn, TileDef } from './types';
import type { PrefabPlacement } from './types';
import { getPrefab, getTileset } from './tilesetCatalog';
import { stampPrefab } from './tileset';

export interface GrayboxMapJson {
  readonly name: string;
  readonly width: number;
  readonly height: number;
  readonly tilesize: number;
  readonly tiles: string;
  readonly tileset: { readonly [key: string]: TileDef };
  readonly objects?: readonly MapObject[];
  readonly spawns: { readonly [id: string]: Spawn };
}

export interface DataDrivenMapJson {
  readonly name: string;
  readonly width: number;
  readonly height: number;
  readonly tilesize: number;
  readonly tilesetRef: string;
  // The default tile id painted over the full map before prefabs stamp.
  readonly baseTile: string;
  // Optional sparse per-row overrides on top of baseTile. Each entry is
  // either a string of single-char shorthand keys defined in `tileMap`,
  // or a row of explicit tile-id arrays (preferred for designer JSON
  // when ids exceed one char).
  readonly cells?: ReadonlyArray<string | ReadonlyArray<string>>;
  // Optional shorthand: 1-char → tile-id, used when `cells` rows are
  // strings. Designers writing 20×15 ASCII grids alongside named
  // prefabs lean on this; explicit arrays don't need it.
  readonly tileMap?: { readonly [char: string]: string };
  readonly prefabs?: readonly PrefabPlacement[];
  readonly objects?: readonly MapObject[];
  readonly spawns: { readonly [id: string]: Spawn };
}

export type MapJson = GrayboxMapJson | DataDrivenMapJson;

function isDataDriven(j: MapJson): j is DataDrivenMapJson {
  return (j as DataDrivenMapJson).tilesetRef !== undefined;
}

export function loadMap(json: MapJson): MapData {
  if (!isDataDriven(json)) return loadGrayboxMap(json);
  return loadDataDrivenMap(json);
}

function loadGrayboxMap(j: GrayboxMapJson): MapData {
  return {
    name: j.name,
    width: j.width,
    height: j.height,
    tilesize: j.tilesize,
    tiles: j.tiles,
    tileset: j.tileset,
    objects: j.objects ?? [],
    spawns: j.spawns,
  };
}

function loadDataDrivenMap(j: DataDrivenMapJson): MapData {
  const tileset = getTileset(j.tilesetRef);
  // Build the cell grid: fill with baseTile then apply cells overrides
  // and stamp prefabs in declaration order (later prefabs win on overlap).
  const cells: string[][] = [];
  for (let y = 0; y < j.height; y += 1) {
    const row: string[] = new Array(j.width);
    for (let x = 0; x < j.width; x += 1) row[x] = j.baseTile;
    cells.push(row);
  }
  const solidOverrides: (boolean | null)[][] = [];
  for (let y = 0; y < j.height; y += 1) {
    solidOverrides.push(new Array<boolean | null>(j.width).fill(null));
  }

  if (j.cells !== undefined) {
    if (j.cells.length !== j.height) {
      throw new Error(`Map "${j.name}": cells rows=${j.cells.length} != height=${j.height}`);
    }
    for (let y = 0; y < j.height; y += 1) {
      const row = j.cells[y]!;
      const ids = expandCellsRow(j, row, y);
      for (let x = 0; x < j.width; x += 1) cells[y]![x] = ids[x]!;
    }
  }

  for (const place of j.prefabs ?? []) {
    const prefab = getPrefab(place.name);
    stampPrefab(prefab, place.x, place.y, (x, y, tile, solidOverride) => {
      if (x < 0 || y < 0 || x >= j.width || y >= j.height) return;
      cells[y]![x] = tile;
      if (solidOverride !== null) solidOverrides[y]![x] = solidOverride;
    });
  }

  // Validate every cell id resolves to a real tile, so a typo in the map
  // surfaces at load time (loud), not as a missing-tile blank at render.
  for (let y = 0; y < j.height; y += 1) {
    for (let x = 0; x < j.width; x += 1) {
      const id = cells[y]![x]!;
      if (tileset.tiles[id] === undefined) {
        throw new Error(`Map "${j.name}" cell (${x},${y}): tile id "${id}" not in tileset "${j.tilesetRef}"`);
      }
    }
  }

  // Synthesize a flat-color tileset keyed by tile id, so the data-driven
  // path still satisfies tileAt() (it returns one TileDef per id with the
  // solid flag — used by isWalkable's fallback when solidOverrides is null).
  const tilesetFlat: { [key: string]: TileDef } = {};
  for (const id of Object.keys(tileset.tiles)) {
    const t = tileset.tiles[id]!;
    tilesetFlat[id] = {
      color: t.pixels.find((p) => p !== null) ?? '#000',
      solid: t.solid,
      label: t.label,
    };
  }

  return {
    name: j.name,
    width: j.width,
    height: j.height,
    tilesize: j.tilesize,
    // Data-driven maps don't use the legacy single-char tile string —
    // tileAt and the renderer branch on `cells` instead. Leave empty
    // so anyone reading map.tiles by accident sees the empty string.
    tiles: '',
    tileset: tilesetFlat,
    objects: j.objects ?? [],
    spawns: j.spawns,
    cells,
    solidOverrides,
    tilesetRef: j.tilesetRef,
  };
}

function expandCellsRow(
  j: DataDrivenMapJson,
  row: string | ReadonlyArray<string>,
  y: number,
): string[] {
  if (typeof row !== 'string') {
    if (row.length !== j.width) {
      throw new Error(`Map "${j.name}" row ${y}: width=${row.length} != ${j.width}`);
    }
    return row.slice();
  }
  if (row.length !== j.width) {
    throw new Error(
      `Map "${j.name}" row ${y}: string row length=${row.length} != ${j.width} (use tileMap shorthand)`,
    );
  }
  const out: string[] = new Array(j.width);
  for (let x = 0; x < j.width; x += 1) {
    const ch = row[x]!;
    if (ch === '.') {
      out[x] = j.baseTile;
      continue;
    }
    const id = j.tileMap?.[ch];
    if (!id) throw new Error(`Map "${j.name}" row ${y} col ${x}: char "${ch}" not in tileMap`);
    out[x] = id;
  }
  return out;
}
