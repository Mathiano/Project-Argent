# Project Argent — Master Build Roadmap

The spine. This replaces ad-hoc sprint picking. Each phase depends only on what's built before it. We do NOT build a later item before its dependency exists. Art and story content are authored against this skeleton — the skeleton comes first.

## The governing rule

**Foundation → Content → Polish, in dependency order.** A sprint may only start when its prerequisites are green. Features are fun to build out of order; that is exactly how the project breaks. When tempted to jump ahead, log the idea in the backlog and stay on the critical path.

> **Risks & gaps companion:** `docs/design-risks-and-gaps.md` is the watch-list — 4 design risks (with build-guidance mitigations) + 7 uncovered gaps (biggest: **audio**, with zero plan anywhere). Re-read the relevant risk before building a risky system (notably: build **status incrementally + be willing to cut**; consider building **bond earlier than Phase 8** since so much leans on it). It adds no features — it's there to catch problems early.

## Three scope tiers (what "done" means)

- **DEMO (the vertical slice):** New Bark → Route → Violet City → Falkner, playable start to finish with intro, save, party, healing, one real gym. This is the proof the game works. **Everything before "Phase 6" below is the demo.**
- **CHAPTER 1 COMPLETE:** the demo + full Johto chapter 1 content (real routes, trainers, story beats, the rival's first fight).
- **FULL GAME:** 8 Johto gyms + E4 + Kanto + Mt. Silver, all systems, ~42 hours. The long road; built chapter by chapter on the demo's foundation.

---

## PHASE 0 — Stabilize what exists (NOW, before anything new)
Prerequisite: none. **We are here.**
- Fix the battle-input layer completely (move-confirm, SELECT-stance, CALL, RUN, B-back) — one pass, fully tested, so it stops surfacing one bug at a time.
- Confirm the cold-start walk + first battle is playable end to end with no skip flags.
- **Gate:** a person can start the game, walk, fight a wild mon, win/lose. No new features until this is true.

## PHASE 1 — The keystone refactor: 6v6 team battles
Prerequisite: Phase 0. **Blocks: every trainer fight, every boss, switching, the bond track.**
- Already scoped in `ARCHITECTURE-AUDIT.md` (~800 LOC, 4 engine + 3 sim + 2 game files).
- The fixture + Falkner ladders must stay bit-identical at team-size 1 (the regression canary).
- **Gate:** a 2v2 battle works; switching works; Falkner is a real 2-mon fight.

## PHASE 2 — Save / load
Prerequisite: Phase 1 (you save a party, so the party system must be real first... see note).
- *Note:* minimal party state exists once 6v6 lands; full party MENU is Phase 4, but save/load of game state (party, position, flags, badges) is needed before any long playtest.
- **Gate:** quit mid-game, reload, resume exactly where you were. **This unblocks all real playtesting.**

## PHASE 3 — The opening (intro + context)
Prerequisite: Phase 2 (the intro sets initial save state).
- **This is the "why am I in an empty house" fix.** Title → new game → intro sequence (the professor/legacy framing from the scope doc) → starter choice in context → furnished starting town → a reason to walk out the door.
- Furnished interiors (the house gets furniture, an NPC, a purpose), the first NPCs with real dialogue, the first story beat.
- **Gate:** a new player understands who they are, where they are, and why they're leaving — without us explaining it to them.

## PHASE 4 — The core RPG menus
Prerequisite: Phase 1 (party) + Phase 2 (save).
- Party menu (view/reorder/summary), Bag/inventory, the pause menu. Box system (storage).
- **Gate:** the player can manage their team and items the way any Pokémon game allows.

## PHASE 5 — The town loop: healing + economy
Prerequisite: Phase 4 (bag/items exist to buy and use).
- Pokémon Center (heal), Poké Mart (buy/sell), money, trainer payouts.
- **Gate:** the route → town → heal → shop → next route rhythm works. *This is the heartbeat of Pokémon.* When this is done, **the DEMO is structurally complete.**

## PHASE 6 — Evolution + Catching 2.0
Prerequisite: Phase 1 (team) + Phase 5 (the loop).
- Evolution (identity-critical, currently absent) — the **bond-gated, boss-capped** model (NOT level 16/34; Argent has no player-facing levels). Two gates — bond stage + the gating badge, whichever is satisfied second triggers evo; the badge-gate is the anti-power-creep cap, lifted after 8 Johto badges (Kanto = bond-only). Design locked: `docs/evolution-design.md`. Catching 2.0 (replace the placeholder catch with the read-based spec).
- **Catching 2.0 is now the TWO-PATH system** — Path 1 (read-created windows, catching as skill) + Path 2 (the willing-join mercy path: heal a fainted wild mon → badge/level/bond-gated acceptance roll → joins or refuses-with-a-hint). Balls stay (mons are happy in them). Design locked: `docs/catching-2-0.md` (the Path-2 acceptance formula is settled at this phase's kickoff).
- **Build order (ruled 2026-06-15): CATCHING FIRST, as its own focused sprint, THEN evolution.** Catching is what the playtest is actively asking for (the GRUBLEAF→Falkner prep path is a dead-end without it), it's the bigger/more novel design, and it earns a focused sprint; evolution (the bond-gated/boss-capped model, `docs/evolution-design.md`) is the cleaner follow-on.
- **Gate:** starters evolve; catching is the designed mini-game.

## PHASE 6.5 (NEAR-TERM) — Box + Pokédex (mon-record UIs)
Prerequisite: Phase 6 (catching makes both necessary). Surfaced by playtest 2026-06-15.
- **Box (PC storage):** the full storage UI (the pause menu's greyed `BOX` row). Catching 2.0 already does a *minimal* box-add when the party is full; this is the real deposit/withdraw/organize screen.
- **Pokédex:** the game currently has **no Pokédex** — a real gap. A seen/caught registry + per-species entries (the dex-as-journal vision: entries that grow field notes from your history, per `feature-ambition-scope.md`).
- **Why bundled:** both are mon-record UIs, both made necessary by catching, both lean on the same party/box/species data. **Scope as one box+dex sprint soon.**
- **Gate:** deposit/withdraw a caught mon; the dex registers seen/caught with viewable entries.
- ✅ **SHIPPED (2026-06-16)** — `KICKOFF-phase6.5-box-dex.md`. Center PC deposit/withdraw (party keeps ≥1, bond travels), seen/caught registry + status-gated dex UI (caught full / seen partial / unseen `???`), starter marks caught, CH1 entries, all persisted. Engine/ladders bit-identical. **Follow-up shipped:** trainer/boss foes now mark **SEEN** too (dex isn't wild-only — `markSeenAll`).
- **Forward hook → in-battle SCAN:** the dex becomes a *live combat tool* later — a battle-menu SCAN of the foe, **gated by dex knowledge** (caught → full role + status tendencies; seen → type only; unseen → nothing). Design LOCKED in `combat-depth-types-status.md` **Part 7**; its schema slots (`role`, `statusTendencies`, `habitat`) are **already reserved** in `src/engine/dexLoader.ts` so content isn't retrofitted. Build lands with the status phase (depends on `statusTendencies`).

## PHASE 6.7 (NEAR-TERM) — Combat-depth groundwork (NOT the status build)
Three items surfaced by the combat-depth design pass (`docs/combat-depth-types-status.md`). The full status/type-identity **build** is Phase 6-8 (see Phase 8); these are the load-bearing-now slivers that ship as their own small sprints first.
- **(A) Enforce the intent-reliability ramp** ✅ **SHIPPED** (honest-partial model, Falkner AMBIGUOUS) — `docs/intent-tells-design-note.md`.
- **(B) TTK tuning pass** ✅ **SHIPPED** (global `COMBAT.hpScale` 1.30; both ladders re-baselined) — `KICKOFF-ttk-tuning.md`.
- **(C) Type-name reconciliation** ✅ **DONE — 17-type canon locked (2026-06-16)**. Rename + 4-type expansion (13→17): **FIELD→BASIC, VOLT→SPARK, SPLASH→AQUA, SPROUT→NATURE**; **4 new types: PSI, INSECT, STONE, UMBRA** (SPIRIT/UMBRA separate). `typechart.json` is 17×17 (existing 13×13 byte-identical under rename). Final rulings locked: new-type move-trio names + Gen-2-mapped matchups **approved**; **no hard immunities** — Gen-2 zeros classified flavor→0.7 / arbitrary→1.0 (2 flips applied: SPIRIT→BASIC, BRAWN→SPIRIT → 1.0); **TERRA→GALE kept 1.3** (GALE is weak to Ground — the load-bearing Falkner prep-loop). Identities in `combat-depth-types-status.md`, chart in `type-chart.md`. Ladders bit-identical throughout. See `KICKOFF-type-system-canon.md`.

## PHASE 7 — Content authoring tools + Chapter 1 content
Prerequisite: Phases 1–6 (the systems all the content sits on).

> **Per-mon design process:** `docs/mon-design-template.md` — the repeatable spec sheet + 8-point pillar checklist for turning a manifest row into a designed creature (type identity, stat-shape, character, evo, front/back sprites, dex). Use it per-chapter as the roster fills in; CH1 is the first application.

- **CONTENT PILLAR — "JOURNEYS, NOT CORRIDORS":** routes are anime-style **stages for events**, not trainer gauntlets. The space between cities is where the world feels alive and storied. **Every route is built as a potential stage** — each one plants at least one small "something happens" beat (a vignette, a discovery), not just encounters + trainers. (Established in Sprint 1.)
- **Sprint 1 — "The First Road" (Hearthwick → Violet)** ✅ **SHIPPED (2026-06-16)** — `KICKOFF-phase7-sprint1-first-road.md`. The chapter TEMPLATE proven once: Route 31 rebuilt as a real multi-screen journey (varied terrain — grass/forest/impassable pond with a marooned islet as the deferred-traversal seam; easy approachable trainers; terrain-varied encounters; hidden items; the **lost-mon** seed event), Violet rebuilt as a functional **plaster** city (gym-as-building + enterable Center/Mart), and an animated-tile art proof (grass sway + water ripple). New overworld plumbing: the `give-item` verb + a multi-frame animated-tile render path. Engine/ladders bit-identical. **Later sprints replicate the template** (Violet's full population, the rival fight, the Rocket beat, more routes).
- Real Route 31 + Violet with proper trainers, the rival's first fight (KAMON v2 card — already queued), the first Rocket beat, gym trainers feeding scout reports.
- **The Violet Academy** — a post-gym teaching/training hub in Violet City (stance-triangle teaching + move-mastery-trial intro + bond context), built on existing dialog/script/flag verbs, gated `falkner_beaten`. Design locked: `docs/violet-academy.md`.
- **Gate:** Chapter 1 is a complete, authored ~2.5-hour experience. **CHAPTER 1 COMPLETE.**

## PHASE 8+ — Scale to the full game (chapter by chapter)
Prerequisite: Phase 7 (the chapter template proven once).
- Gyms 2–8 (boss cards on the Whitney template), the Rocket arc, E4, Kanto, Mt. Silver, **status conditions + the 17 type identities** (design locked: `docs/combat-depth-types-status.md` — deterministic status that attacks the read/rhythm/triangle/bond, the status economy, Doubt/Resolve, bond-baseline-★), held items, day/night, Phone 2.0, the bond track, the Gauntlet.
  - **Status DISPLAY (Part 4B, LOCKED):** dual-layer like stances — a 3-letter bar TAG (BRN/FRZ/DAZ/… thematically colored: negatives by inflicting-type flavor, positives GREEN) + the full plain-language battle-log sentence. Lingering-only tagging; 3-negative cap with positives (Brace/Shrouded/Resolve) tracked separately. Build with the status system.
  - **In-battle SCAN (Part 7, LOCKED):** dex-knowledge-gated foe lookup (see Phase 6.5 forward hook). Pairs with the intent ramp — dex = species tendencies, intent = this individual. Schema reserved in `dexLoader.ts`.
- Each chapter reuses the Phase 7 template. Features interleave per the parity checklist order.
- **The "living world" / mon-character layer** (`docs/living-world.md`, `docs/mon-character.md`) — world-reactions, recurring stateful KAMON, the mon-remembers-its-origin flavor, personality/preference/quirk-driven character. Build on a finished chapter. **Forward-compat seams already reserved** (cheap-now, impossible/painful to retrofit):
  - **`catchOrigin`** (`'read'|'mercy'|'starter'|'gift'`) — **SHIPPED**: set at catch/grant time + persisted (`save.ts`), travels with the mon through the box. Feeds Feature 3 (the mon remembers how it was caught). Impossible to backfill, so set now.
  - **Mon-character schema slots** — reserved in `src/engine/dexLoader.ts` (type-only, optional, populate per-chapter): `personality` (the locked 8-archetype enum), `preferredEnvironment`/`dislikedEnvironment` (emotional affinities, distinct from spawn `habitatTags`), `quirk` (individual tic). Read later by world-reactions, KAMON's coldness, "ask your mon," catch-origin flavor. The two-axis model: reaction = personality × bond stage.
  - Other honored seams (not foreclosed by Phase 7): overworld can read the lead mon's bond+species; tiles/events can carry reaction triggers; the actor system doesn't block a follower-mon; KAMON modeled as recurring/stateful; NPC mons can carry a bond-characterization.

---

## Where ART fits (the deferral you asked for)
**Art is authored AGAINST this skeleton, not before it, and everything is built visually swappable.**
- The tileset/prefab/sprite systems are already data-driven — art is a data swap at any time, zero code change. This is the flexibility you asked to preserve; it already exists.
- **Ruling: through Phase 5 (demo-complete), we use placeholder/first-pass art and do NOT sink major time into sprite/tile polish.** One real tileset (current style) is enough to make the demo not-graybox; the full per-city art set, all 200 mon sprites, and back sprites are a **post-demo art pass** (interleaved during Phase 7+).
- The exception: mon sprites for the ~15 species the demo actually shows (starters + Falkner's birds + the cave mon) — those trickle in via the Gemini pipeline as time allows, but never block a sprint.

## Where STORY fits
- The intro/framing is **Phase 3** (it's foundation — context is not optional polish).
- Per-chapter story beats are authored in **Phase 7+** alongside each chapter's content.
- The overarching legacy/time narrative is designed now (it's in the scope doc) but *authored* chapter by chapter.

## The backlog (ideas captured, NOT built until their phase)
Anything we think of out of order lands here instead of derailing the critical path: bond track (Phase 8), temperaments/marked (needs the dex schema slice), Phone 2.0 (Phase 8), the Gauntlet (post-launch), day/night (Phase 8), the full art set (post-demo pass), Stance Beasts + cover legendary (Phase 8 content).

- **Mobile touch-control UX pass.** Current controls are keyboard-placeholder only. The game is phone-first; there is no SELECT on a phone. Needs on-screen D-pad + A/B + tappable stance / actions, and stance must be a VISIBLE control — it cannot stay hidden under an unlabeled SELECT cycle in the shipping mobile UI. Phase TBD (likely interleaves with Phase 4 menus / before Phase 7 chapter content); whichever sprint covers it owns the input-layer rewrite so handleMoveInput etc. consume action intents rather than raw key codes.
- **Seeded overworld RNG (replays / Gauntlet / determinism).** Overworld encounter rolls (`Math.random() < zone.rate` in `scenes/overworld.ts`) bypass the seeded `mulberry32` the engine uses. Save/load (Phase 2) stores the seed; loading reseeds; but encounter-zone rolls aren't reproducible across save boundaries. Land before the Gauntlet / replay features (Phase 8) so seed-based bug repros and "this exact encounter sequence" mods are possible. Lift is small — route encounter rolls through `run.rng`; persisting its internal counter is a `version: 2` save migration.
- **Autosave vs. permadeath / Nuzlocke mode.** Phase 2's autosave silently writes on every overworld transition. A future Nuzlocke / hardcore mode (fainted = released, no save scumming) needs to either disable autosave or write-once-and-block-revert. Design the toggle BEFORE autosave becomes load-bearing in player muscle memory; "we autosave constantly" and "permadeath is meaningful" are mutually exclusive without an explicit mode flag.
