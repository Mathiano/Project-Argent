# Phase 2 — Save / load (per BUILD-ROADMAP.md)

**Gate:** quit mid-game, reload, resume exactly where you were — AND party hp/st/momentum persists across battles (closes the Phase 1 writeback seam). One state model, two consumers.

## Scope

### S1 — The save shape + module
- `save.ts` with `SaveState` / `SavedSide` shapes (`version: 1`).
- `toSavedSide` / `fromSavedSide` — the single serialization seam used by BOTH the writeback and save/load.
- Persist: party (hp/st/momentum), position (map/x/y/facing), flags, call-unlock, rngSeed.
- Drop round-local state (`exhausted` / `staggered` / `maxHp` / `partyTypes` — recomputed on load).
- No mid-battle save; reload returns to the overworld. No `BattleState` serialization.

### S2 — RNG: option 1 (save seed, fresh mulberry32 on load). Approved.
- **LOG (don't fix):** overworld encounters use unseeded `Math.random()`; full determinism (for replays / Gauntlet seeds) is a later concern. Add to backlog.

### S3 — Party-state writeback (the deferred Phase 1 seam, same model)
- On battle resolve, extract the post-battle Team's member `SideState`s back into `run.party` (hp/st/momentum carry forward). Use the same extractor the save path uses.
- This means a wild fight that leaves GRUBLEAF at half HP → GRUBLEAF is still at half HP next encounter. Verify by playtest.

### S4 — Autosave
- Silent, non-blocking autosave on overworld scene-transitions (warp / encounter-end / battle-end). NEVER mid-battle.
- Persist to `localStorage` (single slot for now; save slots are Phase 4).
- **LOG (don't build):** autosave-vs-permadeath interaction for a future Nuzlocke mode — flag so we don't architect into a corner.

### S5 — Load path + continue
- On boot, if a save exists, offer **Continue** (load → spawn at saved position with saved party) vs **New Game** (fresh state, clears save).
- `call_unlocked`: implementer's call — flag vs top-level field; prefer the flag if cheap, don't refactor a pile of reads just for purity.

### S6 — Playtest hooks stay alive (the contract)
- Every `?skip=` hook still works. Add `?wipe` to clear the save (QA: test the New Game path repeatedly). Update `docs/playtest-hooks.md`.

### S7 — Tests
- Round-trip: build state → save → load → assert identical party hp/st/momentum, position, flags.
- Writeback: battle leaves a mon at reduced hp/st → that persists into the next battle.
- New Game clears the save; Continue restores it.

## Gate (Phase 2 done when)

1. Quit (close tab) mid-game, reopen → Continue → exact same position, party, HP/ST, badges, flags.
2. A mon damaged in one battle is still damaged in the next (writeback).
3. New Game starts fresh and clears the old save.
4. Both ladders bit-identical (sim gate — engine untouched this sprint).
5. All `?skip=` hooks + the new `?wipe` work; `playtest-hooks.md` updated.

## Report as audit

Feel sign-off is Mathias confirming quit → reload → resume actually works in the browser.
