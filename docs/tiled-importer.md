# Tiled → Argent map importer (Phase 8)

**Status:** BUILT ✅ (2026-06-29, Terminal A). Converts a Tiled `.tmj` export into a
loadable Argent map, rendered through the verified production tile path. Implements
the correspondence in `docs/tiled-gid-correspondence.md`; depends on the ingested
`pct_*` tilesets (`docs/palette-reseed-AS-BUILT.md`). 16×16 tiles only (trees are
composed 16×16 components; buildings/interiors = the later big-object lane).

## Input → output

- **Input:** a parsed Tiled `.tmj` (JSON) — `width/height`, `tilewidth/tileheight`,
  `tilesets[]` (each `firstgid` + `source` `.tsx`), tile `layers[]` (`data[]` GID
  arrays), and `objectgroup` layer(s) (named objects with `x/y/width/height`).
- **Output (`importTiledMap` → `{ map, warnings, stats }`):** a `MapData` with
  - `importedLayers` — one `ImportedTileLayer` per Tiled tile layer (order
    preserved), each a row-major grid of `{tileset, tile}` registry refs (null =
    empty). The renderer draws them **bottom→top**.
  - `importedObjects` — carried-through named markers `{name, x, y, w, h}` (grid
    coords). The importer does **not** invent NPC/warp definitions — it carries the
    NAME; a later wiring layer resolves `name` → a CC-code def (the typed-object
    contract: `npc_*` → an NPC, `warp_*` → a warp, …).
  - `solidOverrides` all-false (walkable everywhere — collision is a later wiring
    concern; pct tiles are `solid:false`), a center `spawn`, empty `objects`/`tiles`.

`importTiledMap` is **pure** (no DOM/fs): the caller passes the parsed `.tmj`, a
`resolveSheet` function, and an optional `tileExists` predicate — so it runs
identically in unit tests, the dev render hook, and any future CLI.
(`src/game/overworld/tiledImport.ts`.)

## The GID translation rule (verified)

For each layer cell GID `g`:
1. `g === 0` → empty.
2. `id = g & 0x1FFFFFFF` — mask Tiled's 3 high flip bits (H/V/D).
3. owning tileset = the `tilesets[]` entry with the largest `firstgid ≤ id`;
   `local = id − firstgid`.
4. `cols` from the **source-PNG width** (the resolver table), **not** the `.tsx`
   (a `.tsx`'s `columns`/`tilecount` can be edited after export — the stale-export
   hazard). `row = ⌊local/cols⌋`, `col = local % cols`.
5. map the tileset's source `.tsx` → its `pct_*` registry tileset; **key =
   `r{row}c{col}`** → emit `{tileset, tile}`.

The default sheet table (`DEFAULT_SHEET_TABLE`, keyed by `.tsx` basename, `cols` =
pack-PNG width / 16): `Argent_Grass_1→pct_grass(12)`, `path_02→pct_path02(12)`,
`Hills→pct_hills(19)`, `bush-anim→pct_bushanim(24)`, `trees_new→pct_trees(10)`
(+ `Argent_Trees_1`, `Argent_Bush_1`, `path_01` aliases). Extend as sheets are
ingested.

Objects snap to the grid: `tileX = round(obj.x / 16)`, `tileY = round(obj.y / 16)`;
`w/h = max(1, round(size / 16))`.

## Robustness — it warns and degrades, never throws

| Fault | Behaviour |
|--|--|
| **Duplicate tileset** (same source, two firstgids — an editing artifact) | warn, keep going |
| **Unnamed object** (`name:""`) | warn (name it `npc_*`/`warp_*`), skip the object |
| **Unresolvable sheet** (source has no `pct_*` counterpart — not ingested) | warn once per sheet, its GIDs import as empty |
| **GID past every firstgid / past a tileset** | warn, empty cell |
| **GID → missing/blank registry cell** (via `tileExists`) | warn once per tile, empty cell |

These tell the author what to fix instead of silently producing a broken map. The
renderer is independently safe too: an unregistered/missing ref draws nothing.

## Render path & dev hook

`overworld.ts` gains an additive, gated branch: when `map.importedLayers` is set it
draws each layer's refs via the **same** verified `drawOneTile` (baked bitmap /
per-pixel fallback) live maps use — `drawImportedLayers` — and `drawImportedObjectMarkers`
draws each carried marker as a labelled box (`warp*` gold / others red) until wiring
resolves it. Existing maps don't set the field → unchanged (bit-identical).

- **`?skip=tiled-test`** — `maps.ts` imports a snapshot of Mathias's export
  (`src/game/maps/tiled/test-map.tmj.json`), runs `importTiledMap` live (warnings →
  console), and `showOverworld('__TILED_TEST__')` walks it through the real renderer.

## Verified against the real export (`test-map.tmj`)

20×18, 5 tilesets, 3 tile layers, 2 objects. The importer produces a valid map with
**0 warnings, 0 GIDs dropped** — all **19 distinct painted GIDs** resolve to ingested
tiles; the **3 tile layers** are preserved in order; both objects land on the right
tiles (`npc_test → (6,2)`, `warp_test → (4,0)`). A headless render of `__TILED_TEST__`
through `createOverworldScene` emits real multi-colour per-pixel tile fills (PNG at
`tmp/tiled_import_render.png`): grass base, the Hills cobble path, composed tree
clusters, and the `path_02` dirt all render whole and correctly layered.

Tests: `tiledImport.test.ts` (11 — translation, flip-bit mask, layer order, object
snapping, all 4 warn cases, full-fixture coverage) + `tiledRender.test.ts` (1 —
production render). Suite 791 green.

## Seams / next
- **Collision** — imported maps are fully walkable (no solidity yet). A later pass
  derives collision (per-tile `solid` or a Tiled collision layer / object).
- **Layer depth** — all imported layers draw below the player; Y-sorted walk-behind
  for "top" layers (tree canopies) is the big-object-lane refinement.
- **Wiring** — `importedObjects` carry names only; the resolver (`npc_*`/`warp_*` →
  CC defs) is the next task. Animated tiles (bush-anim frames) import static for now.
- **Snapshot** — `test-map.tmj.json` is a committed snapshot of a live working file;
  re-snapshot when Mathias re-exports.
