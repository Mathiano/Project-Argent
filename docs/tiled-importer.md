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

Tests: `tiledImport.test.ts` (14 — translation, flip-bit mask, layer order, object
snapping, all 4 warn cases, full-fixture coverage, + collision) + `tiledRender.test.ts`
(1 — production render) + `tiledWiring.test.ts` (8 — marker resolution, see below).
Suite 802 green.

## Wiring layer — markers → real definitions (loop complete)

`src/game/overworld/tiledWiring.ts` resolves the carried `importedObjects` into the
engine's EXISTING inline `MapObject`s (Argent has no shared NPC registry — NPCs/warps
/signs live inline in each map's `objects`; warps target `"MAP:spawnName"`). The
naming convention IS the contract — **Tiled supplies *where* (the marker), CC supplies
*what* (the definition), joined by name:**

| marker | resolves via | becomes |
|--|--|--|
| `npc_<id>` | `NPC_DEFS["npc_<id>"]` | inline `npc` MapObject at the marker (dialogue/sprite/behaviour) |
| `warp_<id>` | `WARP_DEFS["warp_<id>"]` | `warp` MapObject, `target:"MAP:spawn"` |
| `sign_<id>` | `SIGN_DEFS["sign_<id>"]` | `sign` MapObject (lines) |
| `spawn_<name>` | — (no def) | `map.spawns["<name>"]` = a spawn warps can land on |

`wireImportedMap(map, defs=DEFAULT_DEFS) → { map, warnings }` emits those objects/
spawns into the map and consumes `importedObjects` (so placeholders stop rendering —
the real objects do). **Unknown prefix / missing definition → warn + skip** (same
robustness as the importer). `maps.ts buildTiledTestMap` runs import → wire, so
`?skip=tiled-test` is fully interactive: `DEFAULT_DEFS` seeds `npc_test` (a dialogue
NPC) and `warp_test` (→ `HEARTHWICK:fromRoute`). Add a marker's behaviour by adding
an entry to `NPC_DEFS`/`WARP_DEFS`; Mathias places the matching-named marker in Tiled.

Tests: `tiledWiring.test.ts` (8 — npc/warp/spawn resolution, missing-def + unknown-
prefix warns, preservation, and the real `__TILED_TEST__` map wiring `npc_test`→(6,2)
/ `warp_test`→(4,0)).

## Collision — a dedicated collision layer (self-describing)

A Tiled **tile layer named `collision`** (case-insensitive; `meta_collision` also
accepted) is the collision layer: **any non-empty cell = solid**, empty = walkable.
The tiles used to paint it don't matter (presence, not GID) — paint with any marker
tile. It is **metadata, not art**: the importer consumes it into collision and
**excludes it from the visual `importedLayers`** (never rendered).

Feeds the EXISTING engine collision — `isWalkable` (types.ts) reads
`map.solidOverrides[y][x]` (`true`=solid / `false`=walkable). The importer builds
`solidOverrides`: `true` for painted collision cells, `false` elsewhere — so imported
maps collide via the same movement code (`tryStartMove` → `isWalkable`) every
hand-authored map uses. **No collision layer → all-`false` → all-walkable (no
regression).** Wiring preserves `solidOverrides` untouched. Self-describing: the
collision travels in the `.tmj`, so a layout change carries its own collision.

Verified on the fixture (a `collision` layer paints the border — minus the warp tile
— plus an interior wall at row 8, cols 6–14): `isWalkable` is false on the wall
`(10,8)` and border `(0,5)`, true on the spawn `(10,9)`, the warp `(4,0)`, and open
interior — and the collision layer does not render. Via `?skip=tiled-test` the player
is blocked walking up into the wall.

## Seams / next
- **Tile-property defaults** — a possible later convenience: mark always-solid tiles
  (building walls) solid in the tileset so they needn't be painted on the collision
  layer. The collision layer stays primary (per-cell, handles exceptions).
- **Layer depth** — all imported layers draw below the player; Y-sorted walk-behind
  for "top" layers (tree canopies) is the big-object-lane refinement.
- **Definitions library** — `DEFAULT_DEFS` holds the test markers; real maps grow it
  with their NPCs/warps (or per-map override defs). Animated tiles (bush-anim) import
  static for now.
- **Snapshot** — `test-map.tmj.json` is a committed snapshot of a live working file;
  re-snapshot when Mathias re-exports. (Its `collision` layer is currently test-
  authored — Mathias paints the real one in Tiled and re-exports.)
