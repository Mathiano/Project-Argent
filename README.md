# Project Argent

A from-scratch monster-battler in the body of Pokémon Silver and the soul of a fighting game: every battle is a read, every boss is a puzzle, and preparation is gameplay. 320×180 pixel art, TypeScript + Vite + Canvas, headless-simulable combat engine, ~42-hour content plan, 200 original species.

**Status capsule — Falkner seam sprint close (2026-06-13). Slice cold-walkable.**

## How this project runs

Three tracks, one loop:

- **Design authority** (claude.ai project): specs, boss cards, balance rulings, content commissioning. Docs in `docs/` are the source of truth; when code and docs conflict, docs win.
- **Implementation** (Claude Code, this repo): builds against the docs, gated by sims. Combat numbers never change without re-running the ladder.
- **Creative direction** (Mathias): decision cards lock every marquee design choice; final veto on all content batches; playtests every build.

Dex content is commissioned from Gemini against `docs/mon-manifest.csv` (200 pre-shaped slots) per `docs/mon-commission-kit.md`: Gemini drafts identity, the pipeline derives stats, the sim gates balance.

## Build state

- `src/engine` — Combat 2.0 v0.3 ported, pure TS, no DOM (compiler-enforced), seeded RNG. 21 edge-case tests.
- `src/sim` — 4 canonical bot archetypes + rival AI, 15-cell n=2000 regression baseline locked.
- `src/game` — Sprint 1 closed: 320×180 renderer replaying engine events; playable title → starter pick → wild → prep → rival → end loop.
- Overworld kernel sprint closed (`KICKOFF-overworld.md`): JSON map pipeline, tile-locked grid movement with held-key dispatch, camera follow, warps with fade, interactables (A on faced sign → dialog), encounter zones pushing wild battles that pop back, step-on + auto script triggers with a session flag store.
- Falkner vertical slice sprint closed (`KICKOFF-falkner.md`): engine hooks A1–A6 all landed (type chart injection, dex/move loaders, species traits + GUSTBORNE, arena rhythm, break bar, boss-card AI). Sim gates B1 (Falkner ladder, 15-cell lock at gust=1.4 hp=1.15 — 4/15 cells in target band, the rest reported) and B2 (CH1 batch sim audit). Game layer C1 (KINDRAKE/GRUBLEAF/SILTSKIP starter pick) + C2 (Route 31 FLITPECK grass + GRITHOAX cave) + C5 partial (Falkner fight reachable via `?skip=falkner` with all engine mechanics live, prep+gym-puzzle+trainer flow + Break-bar UI deferred).
- Falkner seam sprint closed (`KICKOFF-falkner-seam.md`): graybox Violet gym map with two phased gust lanes that push the player, gym trainer NPC blocking the rear lane (one-shot fight via start-trainer-battle), gym door warp on Route 31, Falkner-specific prep card (scout report from the v2 boss card), Break-bar 2-pip widget + gust-telegraph banner + Break flash on the foe panel, data-driven NATURE-without-TERRA signpost via the new if-flag script command.
- Follow-up backlog: team-battle engine hook (the Sprint-2 KO-stamina memo applies — FLITPECK lead, GALEHAWK ace can't be expressed end-to-end yet), GALEHAWK + SILTSKIP + FLITPECK production sprites, Catching 2.0 to replace the demo-grade "defeat = adds type to party" shortcut feeding the signpost.
- Next sprint: overworld kernel (`KICKOFF-overworld.md`). Then: Falkner vertical slice.

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

1. Gemini returns: fortress-drake line, mudskipper line, gust-dancer entry rewrites → CH1 batch sheet (stats derived, collision-scanned) → Mathias veto → sprite generations
2. Falkner boss card v2 (on the new ace + starters), then the Falkner sprint
3. Full 13×13 type chart (due before CH2 commissioning)
4. Naming debt: leader/town names are Silver placeholders; 1:1 rename pass required before anything goes public — repo stays private until then

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
| **`docs/trainer-combat-profiles.md`** | Layer 4 DESIGN — trainer-AI variety (profiles, decision tree); build gated on Focus feel sign-off |
| **`docs/combat-depth-types-status.md`** | The 17-type mechanical identities + combat depth status |
| `docs/content-progression-scope.md` | 42-hour plan, boss ladder, read-rate ramp |
| `docs/pilot-exit-decisions.md` | Art direction, dex pipeline, overworld architecture |
| `docs/feature-ambition-scope.md` | Feature map with tiers; anti-scope |
| `docs/type-chart.md` + `docs/catching-2-0.md` + `docs/mon-design-template.md` | Type chart, catching params, dex/species schema + style bible (replaces the old `chapter-1-dex.md`) |
| `docs/mon-manifest.csv` + `docs/mon-commission-kit.md` | The 200-slot commission system |
| `docs/sim-archetypes.md` | Canonical bots + rival AI + design debt |
| `docs/falkner-boss-card.md` | v2 — Falkner gym kit on the new ace + starters |
| `docs/argent-demo.html`, `docs/*-sim.py` | POC + methodology reference |
