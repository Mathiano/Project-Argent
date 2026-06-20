# Project Argent

A from-scratch monster-battler in the body of Pokémon Silver and the soul of a fighting game: every battle is a read, every boss is a puzzle, and preparation is gameplay. 320×180 pixel art, TypeScript + Vite + Canvas, headless-simulable combat engine, ~42-hour content plan, 200 original species.

**Status capsule — CH1 combat + content slice playable cold (Phase 0 gate green). Combat Layers 1, 2, 3.5-foundation, 4 + KAMON v2 shipped, sim-gated (2026-06-20).**

## How this project runs

Three tracks, one loop:

- **Design authority** (claude.ai project): specs, boss cards, balance rulings, content commissioning. Docs in `docs/` are the source of truth; when code and docs conflict, docs win.
- **Implementation** (Claude Code, this repo): builds against the docs, gated by sims. Combat numbers never change without re-running the ladder.
- **Creative direction** (Mathias): decision cards lock every marquee design choice; final veto on all content batches; playtests every build.

Dex content is commissioned from Gemini against `docs/mon-manifest.csv` (200 pre-shaped slots) per `docs/mon-commission-kit.md`: Gemini drafts identity, the pipeline derives stats, the sim gates balance.

## Build state

- `src/engine` — Combat 2.0 (stances, stamina, the **A>F>G>A** triangle, counters/openings/punish/clash, ★ Momentum + Calls), pure TS, DOM-excluded (compiler-enforced), seeded RNG. **Layer 1** (triangle fix — Aggressive punishes Fluid; thrice-repeat self-daze). **Layer 2 FOCUS two-step** (R1 generic focus → R2 hidden release; rotation + flipped triangles; F.4 timing mismatch). **Layer 4 trainer profiles** (`trainerAI.ts` — 8 knobs, release variability, stamina-aware focusing, unified info level + shared decision tree). Global TTK `hpScale` 1.30. Bond growth, Catching 2.0, evolution. Boss cards (Falkner: GUSTBORNE, arena rhythm, break bar — and now FOCUSes on his signature gust).
- `src/sim` — canonical bots + the **`reader`** fair-fight yardstick. Sim gates: focus-balance (no dominant strategy), trainer-profiles (fair-but-distinct), KAMON rival-card (per-pick fairness), + the rival / Falkner / bond regression ladders (n≥2000, re-baselined as intended through each layer build; bond ladder bit-identical).
- `src/game` — 320×180 renderer replaying engine events. **Full CH1 loop, cold-walkable end to end:** title → bedroom → house → Hearthwick → lab (starter pick) → KAMON theft → Route 31 → Violet City (hub) → gym → Falkner → ZEPHYR badge. Graduated **Foe-Intent tells** (Layer 3.5 foundation — stance tell + phase-aware focus tell: "is charging to…" wind-up vs "focuses to…" release). PC box, dex, bag, mart, party, prep cards, bond/evolution beats, black-out + instant boss retry.
- **CH1 content wired (data-driven, sim-gated):** starter trio KINDRAKE/GRUBLEAF/SILTSKIP; Route 31 + Violet generic trainers stamped from the floor profiles (Greenhorn / Bruiser / Skirmisher) + **JAY** (fixed-Heavy Charger) + the gym chaff (Skirmisher); **KAMON v2** rival (type-triangle steal at bond-factor 0.85 + the RIVAL profile); **Concord seed** (kiosk + billboard, flavor-only set-dressing in Violet).
- **Phase 0 gate: GREEN** — cold-start → end of first battle with no skip flags (coldstart/spine/intro/battle-input suites, 118 tests); full suite 559 green; `npm run typecheck` clean.
- Next: the move-type-vocab fix (see open threads), then the starter-trio bulk rebalance (on hold behind it), then Layer 4 Stage 2 (bond-gated Calls, adaptivity) / Layer 3 (environments).

## Locked decisions (the short list)

- Combat: stances (Aggressive/Guard/Fluid), stamina economy, counters, openings, dodges, clash, ★ Momentum + Calls — constants in CLAUDE.md, sim-gated
- Difficulty curve = boss read-rate ramp (0% → 95% across 27 set-piece bosses)
- Presentation: 320×180 integer-scaled; battle sprites 48–56px native at 1×; GBC design principles, not GBC specs
- Sprites: generated draftsmanship + `tools/sprite_ingest.py` enforcement (grid-truth, master palette, outline law)
- Dex: 200 species / 105 lines, chapter-batched; stats derived from archetype templates, never authored
- New starters: fortress drake (FLAME, Wall), leaf gecko (NATURE, Dodger), mudskipper→leviathan (AQUA, Counter-tank). The original trio (EMBERCUB/SPROUTLE/AQUAFIN) are permanent sim fixtures, not shipping content
- Falkner's ace: GALEHAWK, gust-dancer (trait GUSTBORNE — first species trait, rides arena rhythm)
- Catching 2.0: windows created by reads; rarity gates depth, not access; commons never flee

## Open threads

1. **Move-type-vocab collision (engine bug, found 2026-06-20):** the CH1 mid moves EMBER SNAP / LEAF LASH / BUBBLE JET share names with the legacy fixture moves, and `lookupMove = MOVES ?? REGISTERED_MOVES` prefers the legacy Mixed-case (`Flame`/`Sprout`/`Splash`) version — so the starters' STAB type interaction silently no-ops in live CH1 play (the type triangle is inert). Fix **CH1-side** (rename/namespace the CH1 moves) to keep the fixture ladders bit-identical. **Blocks #2.**
2. **Starter-trio bulk rebalance — ON HOLD behind #1.** The mirror-sim showed the 98/49/100 KAMON split is mostly the *inert* triangle (type-on collapses it to ~44–56% RPS); fix the vocab, re-measure, then decide if stat budgets need touching. KAMON's per-pick ace levels (0.95–1.37) are the working baseline meanwhile.
3. Production sprites: CH1 batch is stat-derived + wired (`ch1-batch.json`), but several entries still need generated sprites (`spriteRef: null` — SILTSKIP, etc.).
4. Naming debt: leader/town/trainer names are placeholders (Rourke/Wren/Pax/Dell/Skye/Gust + Silver-derived leaders); 1:1 rename pass required before public — repo stays private until then.

*(Resolved since the freeze: Falkner boss-card v2 + the gym sprint shipped; the type chart is now 17×17 complete — see CLAUDE.md.)*

## Doc map

| Path | Role |
|---|---|
| `CLAUDE.md` | Constitution: constants, architecture law, sim gate |
| `docs/project-argent-scope.md` | Vision and pillars |
| `docs/combat-2-0-spec.md` | Combat rules (v0.3.2) + Whitney boss-card template |
| **`docs/combat-enrichment-roadmap.md`** | The combat depth layers (1: base triangle; 2: two-step/FOCUS; 3: environments; 3.5: info-warfare; 4: trainer profiles) |
| **`docs/combat-focus-redesign.md`** | The FOCUS two-step DESIGN (R1 generic focus → R2 hidden release, rotation triangle) — current two-step model |
| **`docs/combat-focus-AS-BUILT.md`** | The FOCUS model AS IMPLEMENTED (code-truth: live config knobs, events, sim result) |
| **`docs/combat-system-candidates-decision.md`** | Decision record: B (distinct wind-ups) vs Focus vs Candidate C |
| **`docs/trainer-combat-profiles.md`** | Layer 4 — trainer-AI dimension defs + the IF-THEN tree (SHIPPED; in-doc AS-BUILT notes track the engine) |
| **`docs/trainer-archetype-catalog.md`** | Layer 4 — the reusable profile library (Greenhorn/Bruiser/Skirmisher floor → Duelist/Warden/Bluffer elites); the stamp source |
| **`docs/trainer-sets-ch1.md`** | CH1 trainer data — floor stamps onto Route 31 + Violet classes (SHIPPED) |
| **`docs/kamon-rival-card-v2.md`** | KAMON rival card — type-triangle steal + bond-factor 0.85 + the RIVAL profile (SHIPPED) |
| `docs/starter-trio-rebalance.md` | Starter bulk-rebalance spec (ON HOLD — see open thread #2) |
| **`docs/combat-depth-types-status.md`** | The 17-type mechanical identities + combat depth status |
| `docs/main-story.md` + `docs/opening-design.md` | Story arc + the CH1 opening beats (theft, the bond thesis) |
| `docs/the-concord.md` + `docs/concord-seed-ch1.md` | The Concord antagonist (Phase 8+) + its Ch1 flavor seed (SHIPPED) |
| `docs/content-progression-scope.md` | 42-hour plan, boss ladder, read-rate ramp |
| `docs/pilot-exit-decisions.md` | Art direction, dex pipeline, overworld architecture |
| `docs/feature-ambition-scope.md` | Feature map with tiers; anti-scope |
| `docs/type-chart.md` + `docs/catching-2-0.md` + `docs/mon-design-template.md` | Type chart, catching params, dex/species schema + style bible (replaces the old `chapter-1-dex.md`) |
| `docs/mon-manifest.csv` + `docs/mon-commission-kit.md` | The 200-slot commission system |
| `docs/sim-archetypes.md` | Canonical bots + the `reader` fair-fight yardstick + rival AI + design debt |
| `docs/falkner-boss-card.md` | v2 — Falkner gym kit on the new ace + starters |
| `docs/argent-demo.html`, `docs/*-sim.py` | POC + methodology reference |
