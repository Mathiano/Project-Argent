# Route 31 Migration — Scoped Plan (the Tiled capstone)

**Status:** Phase 8 capstone. Pipeline fully proven (kitchen-sink, 815 green). This migration is EXECUTION against a proven pipeline. Drop in `docs/`.

## Scope decision (Mathias)
Migrate Route 31 to a Tiled-built map, but SCOPED — not a 1:1 transcription of every legacy detail:

**IN scope (the focus):**
1. **The map itself** — the 22×74 terrain (4 sections: Meadowgate → Wending Wood → Wayside → Pondside) per B's spec (`route31-rebuild-spec.md`), painted in Tiled with the PCT tiles. Collision layer. The warps to Hearthwick (north) + Violet (south).
2. **The key trainer — JAY (the robber)** — the signature encounter: `approachOnEnter` (walks up, unmissable), the battle, and his mon joining post-win (the bond beat). This is the narrative anchor of the route.
3. **The Calls-unlock interaction** — the moment/interaction that unlocks Calls (the bond-gated combat toolkit). This is a KEY beat — Calls unlock at bond tiers; the route should deliver the unlock interaction meaningfully.

**OUT of scope / CC may redo or invent:**
- **KID / PIP lost-mon quest chain** — these were TEST scaffolding. Mathias is happy for CC to OVERWRITE or REWRITE them. Not precious.
- The other flavor NPCs, the ~14 signs, the 5th-detail encounter zones — CC has latitude. 

**A deliberate experiment:** once CC has a real, partially-complete map, see how well CC INVENTS interesting interactions/NPCs/flavor (within the where/what division — CC writes the *what*; Mathias places the *where*). Tests CC's creative-assist on a real canvas. Mathias places markers; CC proposes the content for them.

## Layering principle (LEARNED — critical for the paint)
Maps separate ART from COLLISION across layers:
- **Visible tile layers** (Floor, Props, Over-props): everything to SEE — grass, paths, tree tiles, WALL tiles, TALL-GRASS tiles, water tiles. These RENDER.
- **`Collision` layer**: invisible solid-marks over cells that block (walls, water, tree-trunks). Does NOT render (it's metadata — the importer excludes it). Presence = solid.
- So: a wall = wall-tile (visible layer) + solid-mark (Collision layer) — TWO layers, same cell.
- Tall grass = tall-grass tile (visible layer), NO collision mark (you walk into it for encounters).
- ⚠️ Do NOT make the Collision layer visible (it's meant to be invisible); paint visible things on visible layers.

## Encounter zones (hybrid, from the pipeline)
Encounter zones = `encounter_<route31x>` RECTANGLE markers (location-scoped unique names: route31a grassland, route31b cave, etc.) + ENCOUNTER_DEFS {species, rate}. Distinct zones = distinct names = distinct defs (proven).

## Scripts (hybrid — code-authored)
Scripts (give-item, set-flag, the Calls-unlock logic if scripted, quest logic) are CODE-authored, NOT Tiled markers (`script_*` markers warn+skip). The Calls-unlock interaction is likely a code/script + an NPC or trigger, authored by CC.

## Proposed phasing (case-by-case, not all at once)
- **Phase 1 — Terrain + collision + warps.** Mathias paints the 22×74 map (4 sections, the tiles), the Collision layer, places `warp_north`/`warp_south` + spawns. CC writes WARP_DEFS + spawn handling. PROVE: the map renders, you can walk it, collision blocks, warps to Hearthwick/Violet work. (No NPCs yet — just a walkable, correctly-bounded Route 31.)
- **Phase 2 — Jay + the Calls-unlock.** Add `npc_jay` (the robber) + the Calls-unlock interaction. CC writes the Jay DEF (approachOnEnter, battle, mon-joins-post-win) + the Calls-unlock logic. PROVE: Jay walks up, you fight him, his mon joins, Calls unlock.
- **Phase 3 — Encounters + the rest.** Encounter zones (route31a/b/...), then the flavor/NPC layer where CC gets latitude to invent interesting interactions. PROVE: encounters fire, the invented content is good.
- **Phase 4 — Swap in for the live Route 31.** Replace the current `route31.violet.json` path with the Tiled-built map, verify EVERYTHING (the neighbor warps from Hearthwick/Violet still land correctly, Jay, encounters), THEN retire the old map.

Each phase proven before the next. The old Route 31 stays live until Phase 4 swaps it (no broken-working-content gap).

## Reference
- B's full spec: `docs/route31-rebuild-spec.md` (dimensions, all NPCs+defs, warps+destinations, cave, encounter zones+tables, collision set, spawns, the 9 tree_big footprints).
- Pipeline docs: `tiled-importer.md`, `tiled-gid-correspondence.md`.
