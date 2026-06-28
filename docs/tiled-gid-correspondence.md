# Tiled GID ↔ Argent registry-key correspondence (Phase-8 importer scope)

**Status:** INVESTIGATION (2026-06-28, Terminal A). Scopes the Phase-8 Tiled
importer for **16×16 tilesets only** (trees/buildings/interiors = big-object lane,
deferred). Read-only analysis — no importer built, no registry/map/palette change.
Source: `tiled-maps/tiled-experiments/test-map.tmj` + the `tiled-maps/*.tsx`.

## TL;DR — the translation rule (deterministic for 16×16 sheets)

Given a map cell's GID `g` (from a `.tmj` layer's `data` array):

1. `g === 0` → empty cell (no tile). Skip.
2. `id = g & 0x1FFFFFFF` — mask Tiled's 3 high flip bits (H/V/D). (None set in this
   test map, but mask defensively.)
3. Resolve the tileset: pick the `.tmj` `tilesets[]` entry `T` with the **largest
   `firstgid ≤ id`**. `local_id = id − T.firstgid` (0-based, row-major).
4. `cols = sourcePNG.width / 16` (== the `.tsx` `columns` for a clean 16×16 sheet).
   `row = floor(local_id / cols)`, `col = local_id % cols`.
5. Map `T.source` PNG → the Argent `pct_*` tileset (table below).
6. **Argent key = `r{row}c{col}`** in that tileset → emit `tileRef:{tileset, tile}`.
   If the key is absent (CC skipped that cell as fully transparent at ingest), the
   cell is transparent → treat as empty / warn (a painted blank shouldn't occur).

**This is confirmed positional and lossless** (see §2). The output feeds the
verified `tileRef → registry → indexed decode → draw` bridge (`docs/pct-pipeline-verify.md`).

## 1. The test map's tilesets (firstgids as recorded in the .tmj)

| order | `.tsx` | firstgid | source PNG | tile w×h | cols | tilecount | GID range |
|--|--|--|--|--|--|--|--|
| 1 | Argent_Grass_1 | 1 | Tilesets/Grass.png (192×96) | 16×16 | 12 | 72 | 1–72 |
| 2 | Argent_Bush_1 | 73 | …/Bushes/bush.png (48×48) | 16×16 | 3 | 9 | 73–81 |
| 3 | Argent_Trees_1 | 82 | …/Trees/trees.png (160×176) | **32×58** | 5 | 15 | 82–96 ⚠ |
| 4 | bush-anim | 192 | …/Bushes/bush-anim.png (384×48) | 16×16 | 24 | 72 | 192–263 |
| 5 | Hills | 264 | Tilesets/Hills.png (304×400) | 16×16 | 19 | 475 | 264–738 |
| 6 | path_02 | 739 | Tilesets/path_02.png (192×64) | 16×16 | 12 | 48 | 739–786 |

(`Argent_Loose_Tiles.tsx` = empty placeholder, 0 tiles — ignore.)

⚠ **firstgid spacing vs current trees.tsx — a stale-export hazard.** The recorded
firstgids imply **trees occupies 82–191 (110 slots)** — i.e. trees.png sliced as
**16×16** (160×176 / 16² = 10 cols × 11 = 110). But trees.tsx on disk now declares
**32×58 / 15 tiles**. So trees.tsx was reconfigured to the big-object size *after*
the map was exported. The map's data DOES paint GIDs in 82–191 (93,94,103,104,113,
114,134 — heavily, as borders), which resolve to **trees.png 16×16 slices** = exactly
CC's `pct_trees` tiles (r1c1, r1c2, r2c1, r2c2, r3c1, r3c2, r5c2 — all present). See §4.

## 2. Slicing is identical (Tiled ↔ Argent) — empirically confirmed

Both slice the same source PNG into a 16×16 grid, **row-major, left→right /
top→bottom, origin (0,0)**. CC's ingest keys each tile `r{row}c{col}` by its true
grid position (the row/col counters advance for every cell, blank or not), so the key
*is* the grid coordinate — the same coordinate Tiled's `local_id` decomposes to.

Verified by re-slicing each source PNG at the position its registry key implies,
quantising to the master, and comparing to the stored tile:

| pct tileset | source | grid | registry tiles | checked | **mismatches** |
|--|--|--|--|--|--|
| pct_grass | Grass.png | 12×6 (72) | 20 | 20 | **0** |
| pct_bush | bush.png | 3×3 (9) | 1 | 1 | **0** |
| pct_trees | trees.png | 10×11 (110) | 72 | 72 | **0** |

Spot-check from the map: base GID 16 (Grass firstgid 1) → `local_id 15` →
`r1c3` → exists in `pct_grass`. ✅ Correspondence is positional and reliable.

Note: CC **skips fully-transparent cells** at ingest (e.g. Grass.png = 72 cells but
20 non-blank tiles). The key still encodes true position, so non-blank GIDs map
exactly; a GID pointing at a skipped (blank) cell has no registry tile (→ empty).

## 3. Sheet inventory — Tiled-used vs ingested registry

`pct_tile_ingest.mjs` ingested: Grass.png→`pct_grass`, path_01.png→`pct_path`,
Fences.png→`pct_fences`, water_anim.png→`pct_water`, trees.png→`pct_trees`,
bush.png→`pct_bush`, flowers.png→`pct_flowers`, premade_builds.png→`pct_buildings`.

| Tiled source PNG (16×16) | in registry? | maps to |
|--|--|--|
| Grass.png | ✅ yes | `pct_grass` |
| bush.png | ✅ yes | `pct_bush` |
| **bush-anim.png** | ❌ **no** | — needs ingest |
| **Hills.png** | ❌ **no** | — needs ingest |
| **path_02.png** | ❌ **no** | — needs ingest (CC ingested path_**01**, a different sheet) |
| trees.png (32×58 in .tsx) | n/a (16×16 = `pct_trees`) | deferred — see §4 |

**Sheets Tiled uses but the registry lacks (must be ingested before the importer can
map them): `bush-anim.png`, `Hills.png`, `path_02.png`.** Adding them is a one-liner
each in `pct_tile_ingest.mjs`'s `SHEETS` (e.g. `pct_path02`, `pct_hills`,
`pct_bushanim`). `path_02` ≠ the already-ingested `path_01` — confirm which path
Mathias wants standard (he painted with path_02).

## 4. Deferred (non-16×16 — big-object lane, OUT of scope for the first importer)

- **Argent_Trees_1 / trees.png @ 32×58** (5 cols, 15 tiles) — the only non-16×16
  tileset Mathias loaded. Tree objects are taller-than-tile sprites = the big-object
  lane (Y-sorted props), handled later.
  - **Caveat (act before importing this map):** the test map was *painted* with
    trees as **16×16** (firstgids assume 110 tiles; GIDs 82–191 are used). The
    on-disk trees.tsx since switched to 32×58, so those painted GIDs are now stale /
    out-of-range relative to the .tsx. Resolve by **re-exporting the map after the
    trees geometry is final**, and keep two distinct tilesets if both looks are
    wanted: a 16×16 `pct_trees` (foliage tiles for borders) and a 32×58 big-object
    trees set. Until then, the importer should derive `cols` from the **source PNG
    width**, not a possibly-reconfigured `.tsx`, so a stale .tsx can't mis-slice.

No buildings/interiors tilesets are loaded in this test map (also deferred when they
arrive).

## 5. Importer logic (what to build next, from this)

- Parse the `.tmj`: `width/height`, `tilesets[]` (firstgid + source), `layers[]`
  (`data` GID arrays; flatten/merge layers per Argent's base/fringe/prop model TBD),
  and `objectgroup` objects (npc/warp markers → Argent map objects — separate pass).
- Build a **GID→(pct tileset, key)** resolver using the rule in the TL;DR. Need a
  static `sourcePNG → pct_tileset` table (Grass.png→pct_grass, bush.png→pct_bush,
  path_02.png→pct_path02, Hills.png→pct_hills, bush-anim.png→pct_bushanim).
- Derive `cols` from `sourcePNG.width / 16` (cross-check vs `.tsx columns`); reject
  non-16×16 tilesets (tilewidth≠16 or tileheight≠16) → route to the deferred lane / warn.
- Emit an Argent map JSON whose cells carry `tileRef:{tileset, tile}` (the bridge
  proven in `pct-pipeline-verify.md`). GID 0 → empty; missing registry key → empty+warn.
- **Determinism:** fully deterministic for 16×16 sheets given a *consistent* export
  (map + .tsx exported together). The one live risk is a `.tsx` edited post-export
  (the trees case) — mitigated by deriving cols from the PNG and validating
  tilecount/range at import.

## Open items for Mathias / the importer build
1. **Ingest the 3 missing 16×16 sheets** (`bush-anim.png`, `Hills.png`,
   `path_02.png`) — prerequisite for mapping the test map.
2. **path_01 vs path_02** — which is the standard route path? (He painted path_02.)
3. **Trees geometry** — re-export the map once 16×16-vs-32×58 trees is settled; the
   current export is internally consistent but its trees.tsx is not.
