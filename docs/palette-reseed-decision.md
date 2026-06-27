# Palette Re-seed — DECISION + Build Scope

**Status:** DECIDED — adopt Option A (re-seed `argent-master` from the Pocket Creature Tamer pack's palette). Supersedes the open question in `art-pipeline-palette-finding.md`. Drop in `docs/`.

## The decision
Re-seed `argent-master` **from the PCT pack's de-jittered ~41-color environment palette** (replace the old 54-color POC-seed master). Mathias has no aesthetic ownership of the old palette (mechanics are his work, not the placeholder art); the pack is the chosen shipping art direction.

## Why it's low-risk (per the B full-pack census)
- **Pack's real palette = ~41 canonical colors** (not 84 raw — the 84 is alpha-export jitter; ±1-per-channel twins of ~41 real colors, stable from merge-threshold 2→12). De-jitter is FORCED by the no-AA indexed pipeline anyway.
- **Fits the existing ceiling** — ~41 < the ~62-key `PALETTE_KEYS` cap. **NO ceiling raise needed.** (The doc's "91 > 64 over ceiling" was MERGE math; this is REPLACE — the relevant number is the pack's own ~41.) Master lands SMALLER than today's 54.
- **0% overlap with old argent-master** holds pack-wide (confirmed across full pack, not just 4 tiles).
- **UI is DECOUPLED — zero recolor.** The HUD palette is `src/game/palette.ts` (own hand-picked hexes: HP green #3e9a52, ST blue #4a7fc0, momentum gold #c9a227, bond rose #c0608a, etc.), read via `import { PALETTE }`, NOT from any tileset. A tileset re-seed leaves the m3x6 UI untouched. (Matching the HUD to the pack's mood later = optional independent retune, not forced.)
- **Existing tiles are throwaway placeholders** — ~390 tiles across 10 tilesets, all graybox/POC (CLAUDE.md: "Art is a data swap (Phase 7+) — placeholder now"; master self-notes "violet-batch-01 POC seed"). Re-quantize or discard — cheap, they were always going to be replaced by the pack.

## Blast radius (what the build touches)
**Touched:**
- `assets/palettes/argent-master.palette.json` — rewritten from the pack's de-jittered palette
- `tools/validate_assets.mjs` + `.py` — `COLOR_CEIL=16` per-tile check STAYS (reads the new palette)
- `tools/argent_studio/index.html` — the editor's palette clamp (new palette)
- 6 ingest/quantize tools (`tile_ingest.mjs`, `tile_master_ingest.mjs`, `tile_master2_ingest.mjs`, `tile_ingest_b02.mjs`, `tile_rotate_synth.mjs`, `tile_swap_outdoor_violet.mjs`) — map source→master keys
- the 10 `*.tileset.json` — each embeds master colors → re-index or discard (they're placeholders)
- `PALETTE_KEYS` in `src/game/overworld/tileset.ts` — **only needs change if raw jitter is kept; DON'T keep jitter → single-char keys still work, NO key change needed**

**NOT touched:** `src/game/palette.ts` (UI), the sprite pipeline (`sprite_ingest.py`, creatures/characters), engine/combat/sim/bond. Terrain-palette swap only.

## Build requirements / gotchas
1. **De-jitter is mandatory** — canonicalize the pack's raw 84 → ~41 (merge ±1-2/channel near-duplicates). This is what keeps it under the 62-key ceiling AND it's what the no-AA pipeline forces anyway. Do NOT seed the raw 84 (would break single-char indexing).
2. **Per-tile ≤16 check** — B measured per-SHEET; the build must confirm tile-by-tile at ingest that no 16×16 tile exceeds 16 colors. Dense sheets to watch: Interiors (38/sheet), trees (26/sheet) — confirm clean once sliced.
3. **The old tilesets** — re-quantize to the new palette OR discard (they're placeholders; discarding is fine — the pack replaces them). Don't agonize over preserving them.
4. **The whole pack (187/~81-94 colors) is irrelevant** — that includes creatures/characters/UI/items which are sprites/HUD drawn OUTSIDE the tileset registry. The cross-tileset master only needs the environment ~41.

## What this does NOT do (scope fence)
- Does NOT author any maps (that's Tiled, Phase 8 — separate). This re-seeds the palette + makes the pack's tiles available in the pipeline.
- Does NOT retune the UI/HUD palette (decoupled; optional later).
- Does NOT touch combat/sim/bond/engine.
- Does NOT raise the ceiling (not needed).
