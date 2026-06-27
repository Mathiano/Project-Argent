# Palette Re-seed — AS-BUILT (the documented canon)

**Status:** BUILT (2026-06-27, Terminal A). Implements `docs/palette-reseed-decision.md`
(Option A — adopt the Pocket Creature Tamer pack's palette). This doc is the
code-truth for the new master; the JSON's own `note` field carries the same
provenance. Supersedes the open question in `art-pipeline-palette-finding.md`.

## The new canon: argent-master = 41 colours (PCT-derived)

`assets/palettes/argent-master.palette.json` was rewritten **from the PCT pack's
de-jittered environment palette**, replacing the old 54-colour violet-batch-01 POC
seed. Single-char keys `0-9a-zA-Z` (62 cap) — 41 fits, **NO ceiling raise**,
`PALETTE_KEYS` unchanged.

| key | hex | | key | hex | | key | hex | | key | hex |
|--|--|--|--|--|--|--|--|--|--|--|
| 0 | #f0e4e1 | | b | #a8b3ad | | m | #2e1e29 | | x | #7a5d45 |
| 1 | #1c1c1f | | c | #d6c2bf | | n | #c299a4 | | y | #a2bdba |
| 2 | #aad9a5 | | d | #9e555e | | o | #a18a64 | | z | #452a34 |
| 3 | #b58d79 | | e | #dba9a2 | | p | #2f3c4d | | A | #232636 |
| 4 | #8c6253 | | f | #c1d6cc | | q | #4d6378 | | B | #50395c |
| 5 | #f0ecc7 | | g | #dce3cc | | r | #9c7090 | | C | #6d4f73 |
| 6 | #c3ccdb | | h | #573539 | | s | #4e5e69 | | D | #72939e |
| 7 | #d9c5a5 | | i | #72709e | | t | #70384c | | E | #2b2336 |
| 8 | #99a3c2 | | j | #c4bd93 | | u | #5c5078 | | | |
| 9 | #6eb88f | | k | #7c8e8f | | v | #37585c | | | |
| a | #c78189 | | l | #637178 | | w | #458575 | | | |

Order = pixel-frequency descending (design-load-bearing first). Reps are **exact
pack hexes** (no averaging). Key↔index is positional (`PALETTE_KEYS.indexOf`).

## How it was derived (de-jitter — the load-bearing step)

`tools/pct_palette_ingest.mjs` (committed; requires the bought pack extracted at
`PCT_PACK_ROOT`, default `tmp/pct-full/...` — the pack stays untracked for
licensing). Census of **34 environment sheets** (Tilesets + Enviroment/{Buildings,
Decoration, Interiors, Vegetation}; NOT creatures/characters/UI/items):

- **84 raw opaque colours**, inflated by alpha-export jitter (±1/channel twins).
- **De-jittered → 41 canonical**, greedy frequency-first clustering at euclidean
  T=6. The count is a hard plateau: **41 stable across T=4..8** (42 at T≤3, 40 at
  T≥9). This matches B's "~41 stable, merge-threshold 2→12" census.
- The two high-frequency creams (#f0e4e1 path/dirt highlight, #f0ecc7 sand) were
  verified as genuine cross-sheet design colours, **not** single-sheet backgrounds.

## Per-tile ≤16 holds (B's flagged gap, closed)

Sliced every env sheet to 16×16 and quantised to the new master: **all 6104 tiles
≤16 colours, 0 violations.** B's dense-sheet worry resolves at tile granularity —
the per-SHEET counts (trees 26, interiors 38) are not per-TILE: trees peak 8/tile,
premade buildings 12, water 11. The only tile hitting exactly 16 is in
`interiors.png` (which is 622×416 — **not 16-aligned**, floor-cropped, and indoor;
outside the ingest set). ⚠ **Seam to flag:** if interiors are ever ingested, that
sheet needs re-gridding to a 16 multiple and sits right at the ceiling.

## Representative tiles ingested (the working set)

`tools/pct_tile_ingest.mjs` → **603 tiles across 8 tilesets** in
`assets/tilesets/pct_*.tileset.json` (Route 31 / Hearthwick / Violet basics; each
embeds the full 41-colour master, index-aligned; `solid:false`, set per-placement
at the map/prefab layer; registered in `manifest.json`):

| tileset | tiles | src sheet |
|--|--|--|
| pct_grass | 20 | Tilesets/Grass.png |
| pct_path | 47 | Tilesets/path_01.png |
| pct_fences | 16 | Tilesets/Fences.png |
| pct_water | 4 | Tilesets/water_anim.png (anim ingested static) |
| pct_trees | 72 | Vegetation/Trees/trees.png |
| pct_bush | 1 | Vegetation/Bushes/bush.png |
| pct_flowers | 5 | Vegetation/Flowers/flowers.png |
| pct_buildings | 438 | Buildings/premade_builds.png (complete houses) |

Fully-transparent cells are dropped. **Quantisation error native→master: mean
0.01, max 1.00** (euclidean RGB) — essentially lossless, because the master *is*
the pack's palette (the only delta is ±1 jitter twins folding onto canon). More
sheets (beach, hills, path variants, roofs/walls, interiors) ingest later by adding
to `SHEETS`. **NOT the whole pack; NOT map authoring** (Tiled, Phase 8, separate).

## Old placeholder tilesets — KEPT, not discarded (reasoned deviation)

The decision doc allowed "discard or re-quantize" the ~390-tile graybox tilesets.
**I kept them.** They embed their *own* palettes (self-contained — the master
re-seed doesn't break them), and they are wired into live maps + tests (e.g.
`heartwick_grass_test` ← HEARTHWICK ← `hearthwickGrass.test.ts`). Discarding now
would break the green suite and force map re-authoring — **explicitly out of
scope** ("do NOT author maps"). They are harmless placeholders that get replaced at
Phase-8 Tiled authoring, when maps are repainted with the `pct_*` tiles. ([[scope-guard-vs-design]]:
additive, suite stays green, deviation flagged.)

## Tooling

- **Validators** (`validate_assets.mjs`/`.py`) — **no change needed.** They are
  palette-agnostic (read each tileset's embedded palette / raw PNG pixels, never
  the master). `COLOR_CEIL=16` + `KEYS=0-9a-zA-Z` already correct. All 8 new
  tilesets **pass** (advisories only: >4-legacy-GBC, which the locked 16-ceiling
  supersedes; "no #000000 outline" since the palette's darkest is #1c1c1f).
- **Argent Studio** (`tools/argent_studio/index.html`) — fetches the master **live**
  on the dev-server path (auto-adopts the re-seed); its embedded `FALLBACK`
  (file:// path) updated to the new 41.
- **`tools/tile_ingest.mjs`** (the only legacy master-writer) — **guarded**: refuses
  to run without `ALLOW_LEGACY_INGEST=1`, so it can't silently clobber the new
  master back to the violet seed. Other legacy violet-batch tools write only
  placeholder tilesets (no master clobber) and are left as historical provenance.

## Untouched (scope fence held)

UI/HUD palette `src/game/palette.ts` (decoupled — own hexes), the sprite pipeline,
creatures/characters, and **all** combat/AI/sim/bond/engine. Ladders bit-identical
(773 tests green; KAMON 65.4/64.8/69.3, starter mirror 52.1/49.7/47.4 unchanged —
zero combat files touched). The `?skip=pct-tiles` scaffold now renders native vs
indexed side-by-side (the match check) instead of the old native-only bypass.
