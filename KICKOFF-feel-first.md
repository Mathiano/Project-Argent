# Feel-first sprint — make the cold-start walk look and feel like a real place

Bug fix first. Then re-skin with the real tileset. Then a little life. The 6v6 refactor and boss-ladder content ruling are on hold until this slice feels right.

## Part 1 — THE BUG (blocker, do first)
A playtest found that walking into a room (NO `?skip` flags) boots back to title/start. The seam acceptance was likely verified via skip flags, not a true room-to-room walk.

- Reproduce the FULL cold-start walk manually: title → starter → lab interior → Route 31 → each building → gym, with **zero** `?skip` flags, watching the browser console at every warp.
- Find and fix the broken warp/crash.
- Add a regression test that exercises a warp round-trip (enter building → exit → still in world).
- Report exactly what broke.

## Part 2 — TILESET INGEST (look-alive)
A finished tileset is incoming from design (Mathias approves art; design provides the assets). The overworld must stay **editable at any later stage**:

- Tiles load from a **data file** (tileset JSON: id → pixel grid or palette-indexed rows + flags solid/encounter/animated). NOT hardcoded.
- Multi-tile structures (4×4 buildings, 2×2 trees) are **prefabs** in data: prefab = name + grid of tile-ids + anchor + collision mask. Maps reference a prefab at (x,y); the loader stamps it. Redesigning a building = editing one prefab; every map using it updates.
- **Per-area tile variants**: tileset supports area-tagged variants (e.g. `building_violet` vs `building_azalea`) so each city/region looks distinct without new code. Wire the hook even though only one set ships now.
- Keep the existing graybox maps loadable behind a flag for debugging.

Re-skin Route 31 + Violet Town + the gym exterior with the real tiles. Goal: the scene a player walks looks like the design mock, not flat rectangles.

## Part 3 — A LITTLE LIFE
- 1–2 NPCs with dialogue on Route 31 / Violet (use the existing interactable + dialog system; no new tech).
- The player character renders as a real 16×16 sprite with the 3-frame walk cycle the kernel already supports (placeholder art is fine if no character sprite exists — flag for the art pipeline).

## Acceptance
- Cold-start walk reaches Falkner with NO skip flags (bug fixed).
- Route 31 + Violet render with the real tileset via the data/prefab system (not hardcoded).
- Tileset + prefabs are editable data files.
- 1–2 NPCs talk.
- All tests green incl. the new warp test.
- CI green; push.

Report: screenshots of the re-skinned overworld + confirmation the tileset/prefabs are data-driven and swappable.
