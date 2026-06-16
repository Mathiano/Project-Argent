# Phase 6.5 — Box + Dex (the two mon-record systems catching made necessary)

Catching (6a) made two record systems unavoidable: somewhere to **store** mons beyond the party, and a **register** of what you've seen and caught. Cousins (both are browse-a-list-of-mons UIs) but distinct: **Box** = storage, **Dex** = seen/caught registry. **Gate:** the player can store/retrieve mons beyond their party, and has a working seen/caught record.

No new engine systems. This is **UI + save-state + registry tracking** layered on the existing mon/species data. **Engine + ladders untouched — confirm bit-identical** (no combat math here). Report in the audit.

## The Box (storage)

- **S1 — A PC at the Pokémon Center.** The classic "PC" — a terminal in the Center the player faces and activates (a new `open-box` script verb, parallel to `heal-party`/`open-mart`). Deposit a party mon → box; withdraw a box mon → party. This **replaces** 6a's minimal "auto-to-box when party full" with real deposit/withdraw. Per scope, design for box-access flexibility later (a pause-menu BOX, a field call) — but **Center access is the floor** for this phase.
- **S2 — Box UI.** Browse stored mons (a list), each row showing key info (species, bond stage, the ★ indicator). Select to deposit/withdraw. **Party must keep ≥1 mon** — depositing your last mon is blocked with a clear message. Reuse the party-menu summary patterns (HP/ST bars, moveset, bond stage).
- **S3 — Box persistence.** Stored mons fully persist via save — species, bond value, HP/state, everything. **One big box for now** (capacity-uncapped; flag if capacity becomes a concern). Extends 6a's `box`/`partyBond` save fields: bond **travels with the mon** between party and box (a parallel `boxBond`).

## The Dex (seen/caught registry)

- **S4 — Track SEEN + CAUGHT per species.** A **wild encounter** marks SEEN; a successful **catch / willing-join** marks CAUGHT (and CAUGHT implies SEEN). The **starter marks CAUGHT** on receipt. Persists via save. (Distinct from `src/engine/dexLoader.ts`, which is the *species database*; this is the player's *progress register*.)
- **S5 — Dex UI (from the pause/START menu).** A list of species showing status: **caught** → full info (name, sprite, type, short entry); **seen-but-not-caught** → partial (name + "seen"); **unseen** → unknown (`???`/locked). The "gotta see/catch 'em all" record.
- **S6 — A dex entry per species.** At minimum name + type(s) + sprite + bond/evolution hint; a flavor line is nice-to-have (pulled from the manifest `dexEntry` where present, placeholder otherwise). Covers the CH1 species that exist (starters, route mons, cave line, GALEHAWK, etc. — the 15 in `docs/ch1-batch.json`).

## Shared
- Both read from the **existing mon/species data**. No new engine systems.
- **New Game** initializes an empty dex + empty box; the **starter marks CAUGHT** on receipt.

## Design decisions (locked at kickoff)
- **Box access = Center PC only** this phase (scope's "flexibility later" honored as a forward note, not built now). The pause menu's disabled `BOX (Phase 6)` row is **repurposed to DEX** (enabled); a short "BOX — at a PC" hint replaces it so the player learns where storage lives.
- **SEEN = wild encounters only** (per S4). Trainer/boss foes don't mark SEEN this phase — noted as a possible later widening.
- **One box, uncapped.** Simplest correct thing for the demo; capacity/multiple-boxes deferred.
- Pure logic (`box.ts` deposit/withdraw, `dex.ts` registry) lives in headless, unit-tested modules; the scenes are thin shells over them — same split as `catching.ts` vs the battle scene.

## Out of scope (later)
Box organization/sorting/naming, box wallpapers/themes, dex search/filter, full flavor-text for all ~200 (per-chapter as the world builds), dex completion rewards. Keep it the core records.

## Gate (Phase 6.5 done when)
- The player can **deposit/withdraw** mons at the Center PC (party keeps ≥1; all state persists).
- The **dex** tracks seen vs caught, shows caught species fully + seen partially + unseen as unknown, is accessible from the menu, and persists.
- The **starter marks caught** on New Game; CH1 species have dex entries.
- Existing tests green; **engine/ladders untouched** (bit-identical — confirmed).
- **Tests:** deposit/withdraw round-trip + last-mon block; box persistence; dex seen-on-encounter + caught-on-catch; dex UI status states; save round-trip for both.

## Report as audit.
Feel sign-off: Mathias deposits/withdraws at the PC, and watches the dex fill in as he meets and catches CH1 mons.
