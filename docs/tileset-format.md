# Tileset, prefab, and data-driven map formats

This is the **contract** between the design pipeline (tile/prefab art delivered as JSON) and the engine. Anything matching the schema below loads without code changes; the placeholder set under `assets/tilesets/` and `assets/prefabs/` exists only to prove the pipeline end-to-end and gets replaced when design ships real art.

Goal: tiles, multi-tile structures (houses, gyms, trees), per-area variants, and map layouts are all **editable data files**. Redesigning a building = editing one prefab; every map using it updates.

---

## 1. Tileset — `assets/tilesets/<name>.tileset.json`

```jsonc
{
  "name": "outdoor_violet",     // string; must match the file's basename (without .tileset.json)
  "tilesize": 16,               // pixel side (16 is the project standard)
  "palette": [
    "#0f1a14",                  // index 0 → palette key '0'
    "#1d4a26",                  // index 1 → palette key '1'
    // ... up to 22 colors usable (indices 0–9, then a–l → palette[10..21])
  ],
  "tiles": {
    "<tile_id>": {
      "label": "human-readable name",     // optional; falls back to tile_id
      "solid": true,                       // optional; default false
      "encounter": "primary",              // optional; encounter table id (reserved)
      "animated": false,                   // optional; reserved for future
      // Either `rows` OR `pixels`, not both:
      "rows": [                            // 16 strings, each 16 chars
        "0123456789abcdef",
        "0123456789abcdef",
        // ... 14 more rows
      ],
      "pixels": "..."                      // alternative: one flat tilesize*tilesize string
    }
    // ... more tiles
  }
}
```

### Palette index keys

Per pixel, characters map to palette entries via `PALETTE_KEYS = "0123456789abcdefghijklmnopqrstuvwxyz"`. So `'0'` → `palette[0]`, `'a'` → `palette[10]`, `'l'` → `palette[21]`. Up to 36 indices theoretical; practical max is `palette.length`.

Two reserved chars never map to palette:
- `' '` (space) — **transparent** pixel (skipped at render; the cell below shows through)
- `'.'` — **transparent** pixel (same as space; easier to scan in JSON)

### Validation

The loader throws at load time on:
- Wrong number of `rows` (must equal `tilesize`)
- Wrong length of any row (must equal `tilesize`)
- A `pixels` string of wrong length
- A char that doesn't resolve to a palette entry (or to one of the transparent chars)

A typo in tile data fails the page load; it never silently renders a black square.

---

## 2. Prefab — `assets/prefabs/<name>.prefab.json`

A prefab is a multi-tile structure stamped onto a map at a single (x, y).

```jsonc
{
  "name": "house_violet",
  "width": 4,
  "height": 3,
  // The anchor is the cell inside the prefab that lands on the map's
  // (x, y). For a building, this is typically the door tile, so the map
  // designer places the prefab "by its door".
  "anchor": { "x": 1, "y": 2 },
  "tiles": [
    ["roof_l",     "roof_m",     "roof_m",     "roof_r"],
    ["wall_brick", "wall_brick", "wall_brick", "wall_brick"],
    ["wall_brick", "wall_door",  "wall_brick", "wall_brick"]
  ],
  // Optional: per-cell solidity OVERRIDE. Same shape as `tiles`.
  // null   = use the tile's own `solid` flag
  // true   = force solid (block walking)
  // false  = force walkable (e.g. a roof prefab with a walkable door cell)
  "collision": [
    [null, null, null, null],
    [null, null, null, null],
    [null, false, null, null]
  ]
}
```

### Per-area variants

Variants ship as separate prefab files with area-tagged names: `house_violet`, `house_azalea`, `house_goldenrod`. Maps reference the variant they want by name. No engine change to add a new area look — drop the JSONs, register them in `maps.ts` (one line each), and reference from a map.

---

## 3. Data-driven map — `src/game/maps/<name>.json`

```jsonc
{
  "name": "ROUTE31",
  "width": 20,
  "height": 15,
  "tilesize": 16,
  "tilesetRef": "outdoor_violet",           // must match a registered tileset's `name`
  "baseTile": "grass",                       // tile id painted across the whole map first
  // Optional shorthand for the cells grid below:
  "tileMap": {
    ".": "grass",
    "p": "path",
    "G": "tall_grass",
    "T": "tree",
    "S": "sign_post",
    "X": "gym_door"
  },
  // Optional sparse overrides on top of baseTile. Each row may be:
  //   string (uses tileMap to expand 1 char → tile id),  OR
  //   array of explicit tile-id strings (no shorthand needed)
  "cells": [
    "TTTTTTTTTTTTTTTTTTTT",
    "T..............MMM.T",
    // ... height rows total
  ],
  // Prefabs stamp AFTER cells are painted. Declaration order = stamp
  // order; later prefabs overwrite earlier ones on overlap.
  "prefabs": [
    { "name": "house_violet", "x": 4, "y": 4 },
    { "name": "gym_violet",   "x": 11, "y": 13 }
  ],
  // Objects (warps, signs, NPCs, encounter zones, scripts, gust_pulse)
  // use the same schema as the legacy graybox maps.
  "objects": [...],
  "spawns": {
    "default":  { "x": 9, "y": 7, "facing": "down" },
    "fromLab":  { "x": 4, "y": 5, "facing": "down" }
  }
}
```

### Map validation

`mapLoader.ts` throws at load time on:
- `cells.length !== height` or any row's width != `width`
- A row-string char not in `tileMap` (and not `.`)
- A prefab reference to an unregistered name
- A final cell that doesn't resolve to a tile in the tileset (catches typos in `baseTile` or `cells` overrides)

---

## 4. Legacy graybox (back-compat)

The old single-char `tiles` string + inline `tileset` of `{color, solid, label}` still loads, recognized by the absence of `tilesetRef`. `?graybox=1` in the URL forces the graybox versions of any maps that have both, useful for comparing layout against the design pass.

---

## 5. Registration

Wire new assets in `src/game/overworld/maps.ts`:

```ts
registerTileset(myTilesetJson as TilesetJson);
registerPrefab(myHousePrefabJson as PrefabJson);
```

Maps in `src/game/maps/` are loaded on demand by `getMap(name)`. New maps go into the `REGISTRY` table at the bottom of `maps.ts`.

---

## 6. Rendering pipeline

The renderer:
1. At scene creation, bakes each tile's pixel grid to an `OffscreenCanvas` (or `HTMLCanvasElement` fallback) — one bitmap per tile.
2. On each frame, for each visible cell: `drawImage(bakedTile, cellX*ts, cellY*ts)`. One draw call per visible tile.

In Node tests (no DOM), bake returns `null` and the renderer falls back to per-pixel `fillRect` — slow but correctness-preserving so tests can drive the scene.

---

## 7. What to deliver (for design)

To ship a new area:

1. One tileset JSON (`<area>_<theme>.tileset.json`) with the tiles needed for that area.
2. Prefab JSONs for any multi-tile structures (`house_<area>.prefab.json`, etc.).
3. One map JSON per location, using `tilesetRef` + prefabs + objects.
4. One-line registrations in `maps.ts`.

No engine code edits.
