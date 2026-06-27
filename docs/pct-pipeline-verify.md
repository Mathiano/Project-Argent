# PCT tiles — production-path render verification

**Status:** VERIFIED ✅ (2026-06-27, Terminal A). The Pocket Creature Tamer tiles
render as **complete, correctly-positioned 16×16 tiles through the production
overworld renderer**. The `?skip=pct-tiles` scaffold's "fragments" were debug-bypass
sloppiness, NOT a pipeline bug. **Tiled is clear to build.**

## The question
The `?skip=pct-tiles` scaffold shows clipped/smeared tile fragments — but it draws via
a custom **debug `drawImage` bypass** (slicing a multi-tile source PNG), so the
fragments could be scaffold sloppiness rather than a real bug. Before building Tiled
(which depends on the production tile-rendering path), confirm the pack tiles render
correctly through the **actual engine path real maps use**.

## The path tested (the production one — NOT the scaffold bypass)
`TileDef.tileRef` → `tilesetCatalog.getTileset` (registry) → `loadTileset` decode
(the rows→16×16 slice) → `drawTiles`/`drawOneTile` in `overworld.ts`
(`bakeTileCache`+`drawImage` in the browser; per-pixel `drawTilePixels` headless).
This is the exact bridge `overworld.ts` uses for Hearthwick's grass patch and Route
31, and the same one Tiled will inherit. **Not** the scaffold's `drawImage(sheet, …)`
slice bypass.

Driven by the **genuine `createOverworldScene`** on a dev fixture map
(`__PCT_VERIFY__`, `src/game/maps/pct_verify.json`) whose cells opt into `pct_*`
tiles via `tileRef`. 6×6 so the camera clamps to (0,0) and screen pos == world pos.
Reachable via **`?skip=pct-prod`** (walk it live) and asserted headless by
**`src/game/scenes/pctProdRender.test.ts`**.

## Result: tiles render WHOLE, sliced + positioned correctly — no fragment/clip/smear

The headless test captures every per-pixel `fillRect` the production renderer emits
and compares them to the `loadTileset`-decoded pixels:

- **Fully-opaque tiles (grass `pct_grass:r1c1`, path `pct_path:r2c9`, water
  `pct_water:r0c0`)** — the captured fills **exactly equal** the decoded 256 pixels
  mapped to the tile's cell: same 256 positions, same colours, nothing outside the
  cell. That single equality proves *whole* + *correctly sliced* + *correctly
  positioned* + *no smear/clip/overflow*, simultaneously.
- **Partial-opaque foliage (tree `pct_trees:r1c1`)** — only its opaque pixels draw
  (count matches), each at the right in-cell position/colour; transparent pixels are
  left empty (it overlays grass correctly).
- **Global no-smear** — every tile-coloured fill lands at integer coords inside the
  map's 16-aligned pixel bounds; none drifts off its cell.

A PNG of the captured production render (`tmp/pct_prod_render.png`, gitignored) was
eyeballed at 8×: grass tiles seamlessly across the field, the path a clean left
column, the tree and water single coherent tiles in their cells, the player
placeholder in place. No fragments.

### Headless vs browser
Headless (no DOM) the renderer takes its per-pixel `drawTilePixels` path — what the
test captures. The browser's baked path bakes the **same** decoded pixels to a 16×16
canvas and `drawImage`s it at the **same** integer `(x*16−camX, y*16−camY)` offset,
so per-pixel correctness here implies baked correctness there (a `drawImage` of a
correct 16×16 bake at an integer coord cannot fragment). The decode (`loadTileset`)
— where any real slicing bug would live — is shared by both and is exercised here.

## Why the scaffold fragmented (for the record)
`pctTileTest.ts`'s NATIVE side uses `drawImage(sheet, col*16, row*16, 16,16, …)`,
slicing arbitrary cells out of a multi-tile source sheet and composing them by hand
(e.g. picking trees cells `(c,r)` that don't form a coherent tree). That hand-slice
+ hand-compose is the fragment source — a property of the debug scene, not of the
engine. The production path never slices a multi-tile sheet: it works from per-tile
pre-decoded pixel grids, so it structurally cannot produce that artifact.

## Verdict
**The production tile-rendering path is working. Tiled is clear to build** — it
inherits a sound `tileRef → registry → indexed decode → draw` path. (Tile-CHOICE
notes, not bugs: `pct_trees:r1c1` is a trunk/shadow cell, not full foliage; the grass
tile is a fine green dither — both are art content, rendered faithfully.)

## Scope
Verification only. No combat/AI/sim/Calls/bond touched; palette, tile registry, and
ingested tiles unchanged. Additive: a dev fixture map + its registry registration, a
test, a `?skip=pct-prod` hook. Suite **779 green** (was 773 + 6 new); ladders
bit-identical (no engine/sim files touched).
