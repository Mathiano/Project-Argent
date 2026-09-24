# Gym 2 — Rulings Packet (for Mathias to fill in)

**Status:** OPEN — nothing in this packet is decided. It collects every ruling the Gym 2 vertical slice (`ROAD-post-ui.md:7`) waits on, in the order that unblocks the most work, plus two skeletons (the Gym-2 boss card and `trainer-sets-ch2`) whose cells stay `TODO(ruling X)` until the matching ruling lands. CC wrote this from the gym2 build plan (step 13); CC has **not** resolved any ruling, edited any other doc, or chosen any number.

**How to use it:** tick an option (or write your own) and fill the **Ruling:** line. Every settled value quoted here carries the `path:line` it came from; those lines were read at commit `8315ec3` (re-verified at `c24808d`, 2026-09-24: only `src/game/sprites.ts` had moved, fixed below). Anything without a citation is an open question, not canon.

**[BLOCKER]** = gates the most downstream work. Until the six blockers in §1 land, CC can only build plumbing (the dex registry, boss-ladder harness, leader-fight plumbing, placeholders, batch validator — all combat-neutral and bit-identical).

---

## 1. The six blockers, in order

### C1 [BLOCKER, the biggest] — the archetype base stat table
`ch1-batch-sheet.md:23` derives CH1 stats from an "archetype base table (engine stat scale …) ± statFlavor 8% nudge", but that table exists nowhere. The only archetype spec is qualitative (`pilot-exit-decisions.md:43-52`: e.g. Drainer "mid stats", Pacer "balanced, regen perk"). Without numbers, no CH2 species can exist — which blocks encounters, trainers and the boss ladder.
- [ ] (a) Mathias writes the table: stage-1 hp/atk/dfn/spd per archetype, a per-stage multiplier, and a stat budget.
- [ ] (b) Approve templates reverse-engineered from the v1 CH1 sheet; Mathias authors the two shapes CH1 never used (Drainer, Pacer).
- [ ] (c) CC proposes numbers, sim-tunes them, Mathias approves.

**Ruling:** ____

### A1 [BLOCKER] — what type is Gym 2?
- [ ] (a) **VENOM** — matches the manifest gym line L009 (`mon-manifest.csv:17-18`, "GYM LINE — leader of CH2"), the gym ladder in `type-chart.md:88` (Gym 2 = VENOM, counters FLAME + TERRA) and "chip/poison war" (`content-progression-scope.md:60`). "Bugsy" and "HIVE" stay as Silver coordinates.
- [ ] (b) **INSECT with a VENOM ace** — needs the catalog's type-locked leader roster changed (`trainer-archetype-catalog.md:106`, `:145`) and INSECT's matchups approved (see A3).
- [ ] (c) A mixed roster.

Blocks: the leader roster, gym chaff, the room puzzle, all copy, and which CH2 lines are needed first.

**Ruling:** ____

### A2 [BLOCKER] — which stage is the ace?
- [ ] (a) **SLUDGNATH** (L009·2) as ace with **MURKIN** (L009·1) leading — the manifest ("leader of CH2 uses top stage as ace", `mon-manifest.csv:17`) plus the Falkner precedent (FLITPECK lead → GALEHAWK ace, `falkner-boss-card.md:22-23`).
- [ ] (b) **MURKIN** as ace — the ROAD's wording ("MURKIN the gym ace", `ROAD-post-ui.md:7`). A stage-1 ace has no heavy (`move-pool.md:53`: stage 1 learns light + mid + HEADBUTT only).

**Ruling:** ____

### D1 [BLOCKER] — the CH2 level band + the two-pool overflow rule
Level decides which moves a mon has (`move-pool.md:5`, `:51-55`). CH1 runs at a flat 13 in code (`src/game/dexRegistry.ts:25`) against the lv 6–11 mons in `trainer-sets-ch1.md` (e.g. `:16-20`, `:43-44`).
- [ ] (a) Falkner pattern: the ace at 16 or higher (SLUDGE BURST becomes boss-privilege, like DIVE BOMB at `falkner-boss-card.md:23`), chaff below that.
- [ ] (b) A flat level.
- [ ] (c) Per-trainer bands.

**Plus an overflow rule** — level 16+ already yields 5–6 attacks (in CH1 too, and on GALEHAWK at 24):
- [ ] the heavy replaces HEADBUTT and the L24 neutral is dropped
- [ ] a loader "replace" rule
- [ ] hand trims per mon

**Ruling:** ____

### B1 [BLOCKER] — may CC author graybox stand-in layouts?
`art-map-pipeline-decisions.md:89`: "Mathias never authors logic in Tiled; **CC never authors tile placement**." Against that: the Violet / gym / Route 32 JSON graybox precedent, and the PCT pack as the shipping direction.
- [ ] (a) CC grayboxes now; Mathias repaints later in Tiled with PCT tiles.
- [ ] (b) Mathias paints first.
- [ ] (c) Commission an artist.

**Ruling:** ____

### B2 [BLOCKER] — CH2 topology
- [ ] (a) Route 32 in several sections → the town (with the well inside it) → the gym, with the forest before the gym.
- [ ] (b) Route 32 → a forest approach → the town; Ilex comes after the gym.
- [ ] (c) Add a cave or Route 33 by re-bucketing the CH1 cave lines.

Also: is the old well in the slice? (L009's habitat is "old well", `mon-manifest.csv:17`.)

**Ruling:** ____

### F1 [BLOCKER] — how the stamina lesson ships while combat is CLOSED
Gym 2 teaches **stamina management** (`content-progression-scope.md:60`). The designed arena — web lines that tax Fluid, which Fire burns away (`content-progression-scope.md:60`, `combat-2-0-spec.md:143`) — and the Drained arena are unbuilt, and combat is closed (`combat-build-status.md:5`; `ROAD-post-ui.md:2` says so too, but that line also carries the stale "Reactive remains" — H9).
- [ ] (a) Neutral ground; the lesson comes through the room plus the overlay/AI (TOXIC SAP casts — built, `src/engine/data.ts:128`).
- [ ] (b) Existing mud or rocky ground (`src/engine/types.ts:278`) plus a card re-baseline.
- [ ] (c) Reopen combat for a Fluid-tax field.

Also: is "Fire burns webs" cut or deferred?

**Ruling:** ____

### E1 [BLOCKER] — the CH2 trainer set
Mathias authors the `trainer-sets-ch2` hand-off (classes per area, count, mons, levels) — skeleton in §6. Also:
- [ ] floor profiles, mid-tier profiles, or a mix?
- [ ] gym chaff: type-locked or area-locked?
- [ ] must chaff stay below the ace's signature (the CH1 lv11 precedent, `trainer-sets-ch1.md:43-44`)?

**Ruling:** ____

---

## 2. Blocker to ship

### F4 [BLOCKER to ship] — sim targets
- the archetype set (the Falkner five, `falkner-boss-card.md:43-49`, vs the `reader` yardstick, `sim-archetypes.md:23-26`)
- 1v1 or 2v2
- per-starter bands (GRUBLEAF is the hard path twice: GALE→NATURE and VENOM→NATURE are both ×1.3, `typechart.json:139`)
- Normal / Hard columns
- bands set up front, or after a placeholder measurement?

**Ruling:** ____

---

## 3. The remaining rulings

### A. Cross-cutting identity
**A3 — are the proposed INSECT / STONE / PSI / UMBRA matchups approved?** `type-chart.md:5` and `:48` say PENDING; root `CLAUDE.md:37` ("complete: all 17×17 pairs defined") and `BUILD-ROADMAP.md:81` ("Gen-2-mapped matchups **approved**") say approved. Needed before any INSECT or STONE line ships.

**Ruling:** ____

**A4 — slice scope.**
- [ ] (a) The whole CH2 bucket: 33 manifest rows.
- [ ] (b) A minimal subset: L009 + one Pacer (L126, `mon-manifest.csv:247-248`) + one Drainer (L130, `mon-manifest.csv:256-257`) + the local catchables.
- [ ] (c) Author the 15 unshipped CH1-bucket rows first (they include a Drainer, CHITTERLING, `mon-manifest.csv:206`, and a Pacer, GLIMMERFLY, `:210`).

Also: does "first Drainer + Pacer mons" (`ROAD-post-ui.md:7`) mean CH2's lines?

**Ruling:** ____

### B. World and area
**B3 — compass.**
- [ ] (a) Geography wins: south. Fix the CH1 ending lines ("people up north", "north, up the road", "The road runs north" — `src/game/ch1Ending.ts:58`, `:65`, `:77`).
- [ ] (b) Text wins: north. Re-lay the maps.

**Ruling:** ____

**B4 — town identity** under the city template (`violet-city-design.md:3`). Ratify main-story §6 row 2, the deep-forest town with the Concord "clinic" (`main-story.md:134`)? Then name the institution, the landmark, ~3 NPCs, and confirm the plank material and the "AZALEA" coordinate id.

**Ruling:** ____

**B5 — Layer-3 ground per CH2 map.** A biome must be a distinct combat environment (`world-scope-skeleton.md:25`), but `forest` is already Route 31's (`src/game/overworld/maps.ts:189`); Route 32 is `open` (`src/game/maps/route32.json:3`).
- [ ] (a) Route 32 stays open, forest areas use forest, the town is neutral, the well is neutral or rocky.
- [ ] (b) Use mud or fog stretches.
- [ ] (c) A new environment (reopens combat).

**Ruling:** ____

**B6 — Concord and KAMON in CH2.**
- Concord: [ ] (a) flavour only · [ ] (b) collared-mon set dressing (needs collar art + a downscale path) · [ ] (c) a clinic plus freeing a mon (needs the unbuilt "rescued" catch origin).
- KAMON: [ ] absent · [ ] a cameo with no fight.

**Ruling:** ____

**B7 — the CH2 chapter boundary:** where the card fires (badge award, or leaving town), its title, and the side beat.

**Ruling:** ____

### C. Mon batch
**C2 — stamina values no doc states:** Drainer, Pacer and Brawler stages 2–3; Glass nuke stage 3; and whether the starter-derived Counter-tank and Dodger curves apply to non-starters. (Stated: stage-1 bases, `stat-foundation-stamina-design.md:16-23`; the Wall 120/132/148 example, `:25`.)
- [ ] (a) Scale by the doc's per-stage ratios and let the sim tune.
- [ ] (b) Mathias authors them.

Also ratify "Decision A" (starters at 108/119/133), recorded only in code.

**Ruling:** ____

**C3 — the Pacer regen perk and the Drainer "attacks foe stamina" identity** (`pilot-exit-decisions.md:50-51`).
- [ ] (a) Drop the regen perk; Drainer identity comes from TOXIC SAP or LEECH BITE (`combat-design-canonical.md:81`, `:85`).
- [ ] (b) Bank it.
- [ ] (c) Build it (reopens combat).

**Ruling:** ____

**C4 — identity pass.** Run Gemini on the whole bucket, including the 14 unnamed rows (L043, L057, L071, L074, L079, L080, L081)? And confirm the sprite pipeline: `DECISION-sprite-canon-112.md` (Chat writes briefs → Sprite Studio) supersedes the commission kit.

**Ruling:** ____

**C5 — evolution gates for CH2 lines.** Follow the CH1 precedent (bond ~3 + HIVE, then bond ~5 + a badge-3 id — cf. `evolution-design.md:33-34`)? Name the badge-3 id; decide whether gates live in the dex JSON or in `evolution.ts`.

**Ruling:** ____

**C6 — batch-sim gate parameters:** reference foe, level, n (≥ 2000?), whether `reader` is included, and gate vs diagnostic-only (the kit route is round-robin + archetype ladder, ±3% gate — `ch1-batch-sheet.md:25`).

**Ruling:** ____

**C7 (minor) — dex ids:** continue at 16, or reserve ids for the CH1 leftovers first?

**Ruling:** ____

### D. Moves and kits
**D2 — techniques for dual-type lines** (L071, L124, L125, L129, L081): type1's pair, type2's pair, or hand-picked. L081 (DRAKE/FLAME) cannot use type1 while the DRAKE pair is unbuilt, so it needs an explicit stand-in record. Also: equip SWARM as built, or swap it (`combat-design-canonical.md:85`, "⚠️snowball")?

**Ruling:** ____

**D3 — PETALISK's techniques.** Keep NATURE's SIPHON + ENTANGLE (`combat-design-canonical.md:77`), or swap in a stamina-attack technique (LEECH BITE or TOXIC SAP) to express the Drainer?

**Ruling:** ____

**D4 — the ace's signature.**
- [ ] No nuke; SLUDGE BURST is the boss-privilege heavy (combat stays closed). Nukes are never pool moves (`move-pool.md:45`).
- [ ] Author a nuke (reopens combat through `delayNext`).

**Ruling:** ____

### E. Trainers
**E2 — info level per badge.**
- [ ] (a) Honest through Gym 4 (`intent-tells-design-note.md:41-43`: honest tells for "Gyms 1–4").
- [ ] (b) Veiled from Gym 2 (`trainer-archetype-catalog.md:60`, "first veiled info"; `combat-enrichment-roadmap.md:152`; `world-scope-skeleton.md:52`, "opponents hide more post-gym-1").

Then pin a badge → info-level table.

**Ruling:** ____

**E3 — profile fixes surfaced by measurement.**
- STONEWALL and DUELIST sit at 92–96% vs `reader` (measured in commit bodies `2973b05`, "walls the reader 93-96%", and `2d2fc50`, "93.5→92.1% vs the reader"; the test records only the accepted-provisional ruling and a <97% bound — `src/sim/trainerCalls.test.ts:124-135`): [ ] accept · [ ] drop to mid-bond · [ ] shrink the heal · [ ] exclude from CH2.
- TRICKSTER is fixed to FEINT in code (`src/engine/trainerAI.ts:486`, `{feintRate: 0.35, signature: 'feint'}`) vs the catalog's "Variable" (`trainer-archetype-catalog.md:72`): [ ] amend the catalog · [ ] extend ReleaseModel and re-gate.
- DRIFTER's reactive level and bond (`trainer-archetype-catalog.md:93`).
- AMBUSHER (`trainer-archetype-catalog.md:76-81`): [ ] author values now · [ ] defer.
- Map the catalog's terrain words onto environment ids (frozen → ice, water → ?; ids at `src/engine/types.ts:278`).

**Ruling:** ____

**E4 — the fairness band.** `sim-archetypes.md:25` calls a profile the reader "can't beat ~half the time" unfair, while code bands run up to 97% (`src/sim/trainerCalls.test.ts:135`). Also: the payout curve and the flag namespace.

**Ruling:** ____

### F. Boss card
**F2 — re-scale the ramp.** The ladder row says reads 10/25, bar 3 (`content-progression-scope.md:60`) — the pre-Spine-1 scale. Live Falkner is reads 0.45 / 0.60 (`src/engine/bossAI.ts:139-140`) with bar 4 (`src/engine/bossCards.ts:54`). Taken literally, Gym 2 would be easier than Gym 1.
- [ ] Re-derive the whole ladder.
- [ ] Use offsets from live Falkner.

**Ruling:** ____

**F3 — card levers:** teamSize (2, or 3 with L043); levels; statScale; opening ★; the DUELIST stamp's knobs (the catalog's High-bond, `trainer-archetype-catalog.md:105`, conflicts with "Gyms 1-3: … Mid-bond Calls", `trainer-combat-profiles.md:109`); which 2 leader Calls (`combat-2-0-spec.md:166`) with triggers and bark lines (`:124`); the per-phase script; what a Break does to the arena; the signature tell line.

**Ruling:** ____

**F5 — the P0 room puzzle** (web routing, a step budget, or a toxic-drip rhythm) and its object type — the room teaches the leader (`falkner-boss-card.md:62`). The HIVE scout sheet: seller assignment, and confirm WEAK TO stays purchasable.

**Ruling:** ____

**F6 (minor) — template:** Falkner format (`docs/CLAUDE.md:38`) or Whitney format (`combat-2-0-spec.md:170`)? Should `infoLevel` live on the card?

**Ruling:** ____

### G. Art and audio
**G1 — the art required to exit the slice** (the ROAD says "every content pipeline exercised once", `ROAD-post-ui.md:7`). E.g. the two missing starter backs (KINDRAKE, GRUBLEAF), then SLUDGNATH / MURKIN fronts through the full pipeline, everything else on placeholders.

**Ruling:** ____

**G2 — the INSECT placeholder hex** (the "bug-olive" family). `TYPE_COLOR` (`src/game/sprites.ts:146`; the packet first cited `:145`, its line at `8315ec3`) has no INSECT or STONE entry.
- *Placeholder reach (added 2026-09-24, review of `6c7ca36`):* since that commit every NAMED `mon-manifest.csv` row outside `ch1-batch.json` draws its archetype silhouette instead of the "?" blob — 157 names, including 14 CH1-bucket rows not in the batch (NIPVOLE, BURROWDROVE, DRISKIT, DRISKADE, CHITTERLING, MITESWARM, HIVEMAW, THISTLEKIT, GLIMMERFLY, DUSKMOTH, GROTTLE, STALAGNAW, DRILLNOUT, BORESCARAB), not only CH2+. None is reachable in live play yet (no map, encounter table or roster names them). The Pacer shape (`src/game/sprites.ts:256`) is a small plain ellipse-over-a-bar with no eyes: [ ] keep it · [ ] give Pacer a distinct placeholder before a CH2 Pacer (FAWNDLE, STRIDEHART) ships.

**Ruling:** ____

**G3 — CH2 tiles:** the PCT sheet ingest route (the pack is not in this checkout), the town material, the well interior, the Gym-2 kit.

**Ruling:** ____

**G4 — is CH2 music in the slice?**

**Ruling:** ____

---

## 4. Doc conflicts to ratify (docs win, but the code has diverged)
Listed, not resolved. For each: [ ] the doc stands (CC fixes the code) · [ ] the code stands (Mathias amends the doc).

| # | Conflict | Where |
|---|---|---|
| H1 | Trainer RECOVER is once per battle — recorded in code only | `src/engine/trainerAI.ts:316` |
| H2 | "Decision A" starter stamina (108/119/133) — code only | see C2 |
| H3 | Status diminishing returns: canon says 3 → 2 → 1; code applies DR to control effects only, and Drained refreshes to full | `combat-depth-types-status.md:91` |
| H4 | "8 ST class" for effect moves vs the tier cost | `move-pool.md:46` |
| H5 | The Falkner card doc says bar 2, reads 0 / 15, and carries stale bands; live is bar 4, reads 0.45 / 0.60 | `falkner-boss-card.md:3`, `:43-49` vs `src/engine/bossCards.ts:54`, `src/engine/bossAI.ts:139-140` |
| H6 | Status tag DRN (doc) vs DRND (code) | `combat-depth-types-status.md:122` vs `src/game/scenes/battle.ts:443` |
| H7 | Leader-Call and badge-Call text vs the Falkner Call-unlock ruling | `falkner-boss-card.md:5` |
| H8 | The GALEHAWK stage example in the evolution doc | `evolution-design.md:33-34` |
| H9 | Stale "Reactive remains" and "Only Catch Breath is built" text | `ROAD-post-ui.md:2`, `combat-2-0-spec.md:122` |

## 5. Also named as a ruling by the build plan
**Prep exit ("B: leave").** Prep has no exit, so after a loss the player cannot leave to catch or train the counter the Falkner card names (`vision-gap-audit-2026-09.md:64`). Add the option?

**Ruling:** ____

---

## 6. Gym-2 boss card — SKELETON (Falkner format, `docs/CLAUDE.md:38`)

> Everything below is the layout of `falkner-boss-card.md` with the Gym-2 cells either cited (settled) or `TODO(ruling X)`. Nothing is sim-gated; no value here may enter code until its ruling lands and the ladder is run.

**Gym 2 · ⟨CH2 town⟩ `TODO(ruling B4)` · Reads `TODO(ruling F2)` · Break bar `TODO(ruling F2)` · Badge: HIVE** (`evolution-design.md:45`; id `src/game/badges.ts:16`)

The lesson: **stamina management** (`content-progression-scope.md:60`). Framing line: `TODO(ruling A1)`.

### Arena
- Designed: web lines tax Fluid; chip/poison war drains your bar (`content-progression-scope.md:60`); Fire moves burn webs away (`combat-2-0-spec.md:143`). **Unbuilt; combat is closed** (`combat-build-status.md:5`).
- What ships: `TODO(ruling F1)` · ground id: `TODO(ruling B5)`.
- Reusable engine shape (if a rhythm is used): `ArenaSchedule` on the card (`src/engine/bossCards.ts:25`; Falkner's values at `:43-48`).

### The trait
`TODO(ruling F3 / D4)` — no Gym-2 trait is designed. (GUSTBORNE is Falkner's, `falkner-boss-card.md:14-16`.)

### Roster
Leader profile: **DUELIST + a thin signature overlay** (`trainer-archetype-catalog.md:103-104`, `:11`); roster **type-locked** to the gym type (`trainer-archetype-catalog.md:106`, `:145` — A1(b) would amend this).

| Mon | Level band | Stats | Stamina | Kit | Notes |
|---|---|---|---|---|---|
| MURKIN L009·1 — VENOM · Drainer (`mon-manifest.csv:17`) | `TODO(ruling D1)` | `TODO(ruling C1)` | ~115 stage-1 Drainer base (`stat-foundation-stamina-design.md:18`) | attacks: VENOM BARB (light) · TOXIN FANG (mid) (`move-pool.md:28`, `moves.json:98-105`), learned per `move-pool.md:53` · techniques: TOXIC SAP + CORRODE (VENOM pair, `combat-design-canonical.md:81`; built `src/engine/data.ts:128`, `:140`) | lead or ace: `TODO(ruling A2)` |
| SLUDGNATH L009·2 — VENOM · Drainer (`mon-manifest.csv:18`) | `TODO(ruling D1)` | `TODO(ruling C1)` × statScale `TODO(ruling F3)` | `TODO(ruling C2)` | + SLUDGE BURST (heavy) (`move-pool.md:28`, `moves.json:108-110`) at the stage-2 heavy slot (`move-pool.md:54`) · signature: `TODO(ruling D4)` (no pool nukes, `move-pool.md:45`) | ace per the manifest (`mon-manifest.csv:17`); `TODO(ruling A2)` |
| third slot? (L043, VENOM · Brawler, `mon-manifest.csv:84-85`) | `TODO(ruling F3)` | `TODO(ruling C1)` | `TODO(ruling C2)` | `TODO` | teamSize: `TODO(ruling F3)` |

Overflow at level 16+: `TODO(ruling D1)`.

### Behavior script
- Base knobs: release is **variable from Gym 2** (`trainer-archetype-catalog.md:9`; `docs/CLAUDE.md:28`). Bond, Call-use and info level: `TODO(ruling F3 / E2 / F6)` (the catalog's DUELIST row, `trainer-archetype-catalog.md:105`, conflicts with `trainer-combat-profiles.md:109` and `intent-tells-design-note.md:43`).
- Leader Calls: leaders hold **2 Calls** (`combat-2-0-spec.md:166`) with bark-line tells (`:124`); the Call system lands in this slice (`combat-2-0-spec.md:326`; `falkner-boss-card.md:28`). Which 2, their triggers and barks: `TODO(ruling F3)`.
- **Phase 1** (Break 0 – ⟨n⟩, reads `TODO(ruling F2)`): `TODO(ruling F3)`.
- **Phase 2** (after the first Break, reads `TODO(ruling F2)`): `TODO(ruling F3)`.
- **Break bar** `TODO(ruling F2)`: player read-wins fill it; a Break bumps the phase and resets the rhythm anchor (`combat-2-0-spec.md:300-308`). What a Break does to the arena: `TODO(ruling F3)`.

### Scout report (prep phase, earned from the gym trainers — Falkner precedent, `falkner-boss-card.md:31`)
Seller, lines and the WEAK TO entry: `TODO(ruling F5)`. Habit line / signature tell line: `TODO(ruling F3)`.

### Matchup texture (typechart canon — valid only if A1 = VENOM)
- VENOM hits NATURE ×1.3 (`typechart.json:139`) → GRUBLEAF (NATURE, `ch1-batch.json:205-208`) is hard mode again.
- FLAME hits VENOM ×1.3 (`typechart.json:29`) → KINDRAKE (FLAME, `ch1-batch.json:6-9`); VENOM→FLAME is neutral (`typechart.json:137`).
- AQUA ↔ VENOM neutral both ways (`typechart.json:48`, `:138`) → SILTSKIP (AQUA, `ch1-batch.json:399-402`).
- TERRA hits VENOM ×1.3 (`typechart.json:162`) — the CH1 cave line is again the prep-loop catch; the gym ladder lists FLAME + TERRA as the counters (`type-chart.md:88`).
- Starters are **still stage 1** through Gym 2 — their first evolution gates on beating it (`evolution-design.md:42`, `:45`; `kamon-rival-card-v2.md:39`).

### Sim targets — PER-STARTER bands
Format: Falkner's per-starter table (`falkner-boss-card.md:39-49`); yardstick `reader` (`sim-archetypes.md:23-26`); seeded, n ≥ 2000 (`docs/CLAUDE.md:41`).

| Player archetype | Fair path `TODO(ruling F4)` | Hard mode `TODO(ruling F4)` |
|---|---|---|
| `TODO(ruling F4)` — archetype set | TODO | TODO |

### Tuning levers
`TODO(ruling F3)` — none frozen yet.

### Engine hooks
Reuse only (no new hooks while combat is closed, `combat-build-status.md:5`): arena rhythm, the trait slot, the Break bar and the card loader already exist (`src/engine/bossCards.ts:20-31`, `:69-89`). Anything new (web lines, a Drained arena) = F1(c) / B5(c).

### Gym room (P0 rule: the room teaches the leader, `falkner-boss-card.md:62`)
`TODO(ruling F5)`.

### Card data shape (`BossCardData`, `src/engine/bossCards.ts:20-31`)
| Field | Falkner (live, `src/engine/bossCards.ts:35-59`) | Gym 2 |
|---|---|---|
| `id` | `'FALKNER'` | `TODO(ruling A1)` |
| `roster` (lead first, ace last) | FLITPECK 13 → GALEHAWK 15 (GUSTBORNE) | `TODO(ruling A2 / D1 / F3)` |
| `statScale` | `{ hp: 1.15 }` | `TODO(ruling F3)` |
| `arenaSchedule` | every 3rd round, +8 ST, ×1.3 init, 1 ahead | `TODO(ruling F1)` |
| `breakBar` | 4 | `TODO(ruling F2)` |
| `openingMomentum` | `FALKNER_OPENING_MOMENTUM` | `TODO(ruling F3)` |
| `traits` | `GUSTBORNE { dmgMult 1.4, initMult 1.25 }` | `TODO(ruling F3 / D4)` |
| `infoLevel` | — (not on the card) | `TODO(ruling F6)` |

---

## 7. `trainer-sets-ch2` — SKELETON (TBD; Mathias authors, per E1)

> Mirrors `trainer-sets-ch1.md`. Only settled rules are restated; every roster cell waits on a ruling.

### Settled rules (restated, not new)
- **Profile-first, overlay-only** — trainers are data (the 8 knobs); a thin overlay only when the knobs can't express it (`trainer-archetype-catalog.md:11`, `:16`).
- **Variable release starts at Gym 2** (`trainer-archetype-catalog.md:9`; `trainer-sets-ch1.md:7`; `docs/CLAUDE.md:28`).
- **Mid tier = Gyms 2–4:** CHARGER, TRICKSTER, AMBUSHER, STONEWALL, DRIFTER (`trainer-archetype-catalog.md:58-95`). Floor profiles: GREENHORN, BRUISER, TURTLE, SKIRMISHER (`:24-54`). The mix: `TODO(ruling E1)`; AMBUSHER values: `TODO(ruling E3)`.
- **Rosters are area-locked by default** (`trainer-archetype-catalog.md:18`); the gym leader is **type-locked** (`:145`); chaff locking: `TODO(ruling E1)`.
- **Class → profile** defaults (`trainer-archetype-catalog.md:134-150`), e.g. Bug Catcher GREENHORN → BRUISER on later routes (`:137`), forest Camper → AMBUSHER (`:138`).
- **Mons by line ID + stage** (`trainer-sets-ch1.md:50`); names are ⟨placeholder⟩ (CH1 convention, `trainer-sets-ch1.md:8`).
- **Sim-gate every new trainer against `reader`**, fair-but-distinct (`trainer-archetype-catalog.md:13`; `trainer-sets-ch1.md:52`; `docs/CLAUDE.md:41`). Fairness band: `TODO(ruling E4)`.
- **Leader:** DUELIST + overlay (`trainer-archetype-catalog.md:103-104`) — see the boss card in §6.

### Open per-set cells
- Info level: `TODO(ruling E2)` · levels: `TODO(ruling D1)` · CH2 pool in scope: `TODO(ruling A4)` · KAMON / Concord presence: `TODO(ruling B6)`.
- The CH2 manifest bucket (the candidate pool): L009 (`mon-manifest.csv:17-18`), L043 (`:84-85`), L057 (`:110-111`), L071 (`:139-140`), L074 (`:144`), L079 (`:153-155`), L080 (`:156-157`), L081 (`:158-159`), L123 (`:239-241`), L124 (`:242-243`), L125 (`:244-246`), L126 (`:247-248`), L128 (`:251-253`), L129 (`:254-255`), L130 (`:256-257`) — 33 rows, none authored as batch data.

### ⟨Area 1⟩ `TODO(ruling B2)` — lv `TODO(ruling D1)` · ground `TODO(ruling B5)`
| Trainer | Class | Profile | Mons (line·stage, ~lv) | Status |
|---|---|---|---|---|
| ⟨TBD⟩ | TODO(ruling E1) | TODO(ruling E1) | TODO(ruling E1 / A4 / D1) | new |

### ⟨CH2 town⟩ `TODO(ruling B4)` — lv `TODO(ruling D1)`
| Trainer | Class | Profile | Mons (line·stage, ~lv) | Status |
|---|---|---|---|---|
| ⟨TBD⟩ | TODO(ruling E1) | TODO(ruling E1) | TODO(ruling E1 / A4 / D1) | new |

### GYM 2 — HIVE badge, type `TODO(ruling A1)` — lv `TODO(ruling D1)`
| Trainer | Class | Profile | Mons (line·stage, ~lv) | Status |
|---|---|---|---|---|
| ⟨TBD⟩ | TODO(ruling E1) | TODO(ruling E1) | TODO(ruling E1 / A1 / D1) — below the ace's signature? `TODO(ruling E1)` | new (gym chaff) |
| **⟨Leader⟩** | Gym Leader | **DUELIST** + overlay (`trainer-archetype-catalog.md:103-104`) | ace `TODO(ruling A2)` *(see §6)* | bespoke |
