# Phase 4 (LEAN) — Pause menu shell + party menu

Per `BUILD-ROADMAP.md` Phase 4. **Lean cut:** party menu + pause-menu shell now; bag and box DEFERRED to Phase 5 (they ship with the items/economy that fill them — don't build empty shelves).

**Gate:** the player can open a menu in the overworld and view/manage their team.

## Scope

### S1 — Pause menu shell
- START (Enter) in the overworld opens a pause menu. Rows: POKEMON, SAVE, OPTIONS, EXIT. BAG and BOX rows present but greyed/"later" (or omitted — implementer's call; if greyed, label them so the structure reads).
- SAVE = manual save (Phase 2 autosave already exists; this is the explicit player-initiated save). OPTIONS can be a stub. EXIT closes the menu.
- B / START closes. Standard menu nav (up/down, A select, B back).

### S2 — Party menu (the actual ask)
- POKEMON opens the party list: each party member as a row with name, HP bar, and a status/level readout. Cursor navigates; A opens that mon's SUMMARY.
- SUMMARY: species, type(s), HP/ST, moveset (move names + tiers), plus a placeholder line for bond/trial progress (labeled empty slot — bond system fills it later; forward-hook so the screen doesn't need rework when bond lands).
- REORDER: from the party list, select a mon → move it up/down in party order (the lead matters in battle). B confirms placement.

### S3 — Wire to real run-state
- Menu reads `run.party` (real `SideState[]`). Reorder mutates party order; persists via existing save (Phase 2). HP/ST shown reflects current persisted state (damaged mon shows damaged, matching the writeback).

### S4 — Playtest hooks
- `?party=A,B,C` still seeds a multi-mon party for menu testing. Add `?skip=overworld-party` (drop into overworld with a 3-mon party) if useful. Update `docs/playtest-hooks.md`.

## Out of scope (Phase 5+)
BAG/items, BOX/PC storage, OPTIONS content, move reordering within a mon, item use. Greyed/stubbed only.

## Gate (Phase 4 done when)
- START opens a pause menu.
- POKEMON shows the real party with HP reflecting persisted state.
- SUMMARY shows a mon's moveset.
- Party REORDER works and persists.
- All existing tests green; both ladders bit-identical (engine untouched); CI green.
- Tests: menu opens/closes, party list reflects `run.party`, reorder mutates order and persists.

## Report as audit
Feel sign-off: Mathias opens the menu, views the team, reorders, confirms it persists across a save/reload.
