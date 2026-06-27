# Art Pipeline — Pocket Creature Tamer palette finding

**Status:** FINDING (2026-06-27). A contained pipeline test, not map authoring.
Captures the headline result so it survives a context clear. Cross-ref
`assets/palettes/argent-master.palette.json` (the locked palette),
`src/game/overworld/tileset.ts` (the indexed tile format),
`docs/visual-ceiling-rse-2d.md` (the per-tile / cross-tileset colour ceilings).

## TL;DR

The bought **Pocket Creature Tamer 16×16 pack flows through slicing with zero
friction, but its palette is entirely disjoint from Argent's locked palette and
cannot be merged into it.** That forces a one-time decision (below). The pack
art itself is clean and GBA-appropriate — the blocker is palette governance, not
the tiles.

## 1. Slicing — clean, no friction

Pack tiles are **PNG, 8-bit RGBA truecolor** (alpha used for overlays). Every
sampled sheet's dimensions are exact 16-multiples, so they **slice to 16×16 with
no padding/offset**:

| sheet | px | 16×16 tiles |
|---|---|---|
| Tilesets/Grass.png | 192×96 | 12×6 |
| Tilesets/path_01.png | 192×64 | 12×4 |
| Tilesets/Water_tile-Sheet.png | 704×80 | 44×5 (anim frames) |
| Enviroment/Vegetation/Trees/trees.png | 160×176 | 10×11 |

Per-sheet colour counts are tight (grass **4**, path **13**, water **12**,
trees **26**) — within the ≤16-colours/tile RSE ceiling at the per-tile level.

## 2. Palette — 37 colours, 0% overlap (the headline)

Across the 4 sample sheets: **37 unique opaque colours, of which 0 are in the
54-colour `argent-master` palette (0% exact overlap).** The pack has its own
cohesive palette, **disjoint** from Argent's.

It is **unmergeable**: `argent-master` is the locked *cross-tileset* ceiling
(currently 54, hard-capped ~64 by the single-char key alphabet `0-9a-zA-Z` = 62
usable). Adding the pack's 37 new colours → 54 + 37 = **91 > 64** — past the
ceiling. So you cannot simply grow the master to include the pack.

## 3. Registry — palette-indexed with a locked master ceiling

Argent does NOT store tiles as PNGs. A tileset (`TilesetJson` in
`src/game/overworld/tileset.ts`) is a `palette: string[]` plus tiles stored as
**palette-key strings** (one char per pixel, each char indexing the palette via
`PALETTE_KEYS`). The renderer looks up `palette[key]` per pixel.

So importing a pack tile means **quantising each RGBA pixel to a palette key**.
A tileset may declare its own `palette`, but it must live under the master
ceiling (the cross-tileset budget). Because the pack's colours are disjoint and
over-budget to merge, **the indexed registry can't take the pack at its native
look without a palette decision** (below). The test scaffold sidesteps this by
drawing the pack RGBA directly (see §5).

## 4. The open decision (re-palette Argent ← pack, vs quantise pack → old 54)

Two paths:

- **A — Re-seed `argent-master` FROM the pack (adopt the pack's palette as the
  new canon).** Rebuild the master from the pack's colours; re-index/derive
  future tilesets against it.
- **B — Quantise the pack down to the existing 54 (palette-lift the pack).**
  Lossy: 0% exact match means *every* pixel shifts to a nearest-colour, heavily
  recolouring the art you bought.

**Recommendation: A (re-palette Argent to the pack).** The current
`argent-master` was a **POC/placeholder seed** (violet-batch-01, grown
additively for graybox masters); the **Pocket Creature Tamer pack is the chosen
shipping art direction**. Lifting the pack to a placeholder palette throws away
what the pack was bought for. Adopting the pack's palette as canon is the
forward move. (DECISION PENDING — Mathias's call; this doc only flags it.)

Implication once decided: a future task re-seeds `argent-master.palette.json`
from the pack and updates the few committed graybox tilesets/validators that
index against it. Real map authoring (Route 31 / Hearthwick / Violet) is
separate and still needs the map editor (**Tiled, Phase 8 — not built**).

## 5. The test scaffold (for eye-checking the native look)

- **`?skip=pct-tiles`** → `src/game/scenes/pctTileTest.ts` — a dev-only scene
  that slices a few sample tiles 16×16 and composes a small patch (grass field +
  path + tree + water) + labelled source swatches, at 320×180.
- It draws the pack's RGBA **directly (`drawImage`) at the NATIVE palette**,
  deliberately bypassing the indexed pipeline — so the patch shows the pack's
  TRUE colours (what the §4 decision needs to judge).
- Sample sheets vendored at **`src/assets/pct-sample/`** (grass/path/water/trees
  — a handful, NOT the whole pack). The pack `.zip` + DEMO stay untracked.

Presentation/pipeline only — no combat/AI/sim/Calls/bond touched; ladders
bit-identical (call-greedy 81.8/31.3/86.8).
