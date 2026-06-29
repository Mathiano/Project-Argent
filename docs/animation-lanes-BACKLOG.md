# Animation Lanes — BACKLOG (deferred, two distinct lanes)

**Status:** BANKED. Two DIFFERENT animation problems with different scope/timing. Both come AFTER the combat-enrichment lanes (status/moves/playstyles). Drop in `docs/`.

## Lane 1 — Animated terrain (grass / water) — DEFERRED Tiled-pipeline refinement
**What:** frame-cycling overworld tiles — water shimmer (the Water_tile-Sheet anim frames, already ingested static), grass sway (4 grass variants Mathias has). A tile swaps between its frames on a timer.
**Status today:** the frames are INGESTED (static) but nothing cycles them. The importer does NOT read Tiled's tile-animation data yet (CC flagged "animated bush-anim frames deferred" twice).
**Scope (the build):**
- Importer reads Tiled's native tile-animation definition (frames + per-frame duration — Tiled supports this in the .tsx/.tmj).
- The overworld renderer cycles the frames on a timer (the animated tile updates its drawn frame).
- Connects to: the tile registry (frames are there), the overworld renderer, the importer.
**Tier:** polish/refinement — modest build, NOT urgent. Bundle with remaining Tiled refinements (Y-sort already done). After core systems.

## Lane 2 — In-battle animations — MAJOR separate lane (Phase 7+ visual polish)
**What:** combat-scene animation — attack effects, mon reactions, the Focus/stance/release visual beats, hit/heal/Call feedback. Makes combat FEEL alive.
**This is NOT terrain animation** — it's battle-scene rendering (battle.ts render layer + mon sprites + effect overlays), a much bigger art+code lane.
**Scope (rough):**
- Animation frames/sprites for attacks + reactions (a real ART need — beyond the current battle sprites).
- The battle renderer plays them at the right combat moments (on release, on hit, on Call, on read-win).
- Builds on the existing read-win mon-reactions (partly there) + the bond/Call beats.
**Dependency (critical):** do this AFTER the combat SYSTEMS are finalized (status/moves/playstyles). No point animating attacks before the attack system is locked — you'd animate things that then change. Animate the attacks once you KNOW the attacks.
**Tier:** major lane, Phase 7+ visual polish, after combat enrichment. Significant art investment.

## Sequencing note
Neither is next. Order: close Tiled sprint (Route 31 live) → combat enrichment (status→moves→playstyles) → THEN these animation lanes (terrain anim is cheap polish; battle anim is a major post-systems lane) + follower mon + full world-building. Systems before polish.
