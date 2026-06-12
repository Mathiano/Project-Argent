# Sprint — Overworld Kernel (replaces Falkner slice in the order; Falkner moves after the CH1 dex batch lands)

Read CLAUDE.md and docs/pilot-exit-decisions.md §3 first.

## Housekeeping before the sprint (commit as docs/tools)

1. Commit `tools/sprite_ingest.py`, `embercub.sprite.json` (engine test fixture art), `mon-manifest.csv`, `mon-commission-kit.md` into the repo (docs/ and tools/).
2. Mark docs/chapter-1-dex.md §4–6 (the species tables/entries) as SUPERSEDED by the manifest + commission process. §1–3 and §7–10 (schema, types, templates, temperaments, catching, style bible) remain canon.
3. Note in CLAUDE.md: the original starter trio (EMBERCUB/SPROUTLE/AQUAFIN) are permanent sim fixtures, not shipping content. Ladder regressions keep them forever.

## Goal

The seven kernel verbs from pilot-exit-decisions §3, data-driven, with a graybox Violet City + Route 31. No story content, no final art, no new battle mechanics.

## Tasks (commit after each)

1. **Map data pipeline**: load Tiled JSON (orthogonal, 16px tiles): tile layers, a collision layer, and an object layer of typed triggers (`warp`, `interact`, `encounter_zone`, `script`, `npc`). Author the two graybox maps in Tiled (placeholder tileset: flat colors + labels is fine).
2. **Grid movement**: tile-locked player movement with held-direction repeat, facing, collision, camera follow with map-edge clamping at 320×180.
3. **Warps**: door/cave/exit transitions between maps with a fade; spawn points by id.
4. **Interactables**: A-press on faced tile → dialog box (reuse the battle scene's panel/dialog components) or script.
5. **Encounter zones**: stepping in tagged tiles rolls encounters from a zone table (rate, species list — point it at the sim-fixture species for now); on trigger, push the existing battle scene, return to the overworld on resolve with state intact.
6. **Script triggers**: step-on and auto triggers running a minimal script list (dialog, move-player, warp, start-battle, set-flag); flags persist in a session store.
7. **Scene flow**: title → overworld → battle → overworld loop, clean push/pop.

## Acceptance

- `npm run dev`: walk out of a graybox lab, down Route 31 grass, hit a wild battle, win/lose, return to the map where you stood
- Enter/exit two buildings via warps; read two signs; one step-on script fires once (flag-gated)
- Zero engine commits; all existing tests green
- Report: screenshots, the map JSON schema you settled on, any verbs that didn't fit the seven
