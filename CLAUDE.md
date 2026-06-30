# Project Argent

GBC-style monster battler: Pokémon Silver reimagined with Combat 2.0 (stances, stamina, reads).
320×180 logical resolution, integer-scaled (per docs/pilot-exit-decisions.md §1). TypeScript + Vite + Canvas. No game framework — the engine must run headless.

## Source of truth

`docs/` is the design bible:

- `project-argent-scope.md` — vision, pillars, feature tiers
- `combat-2-0-spec.md` — combat rules + the Whitney boss card (the boss-card template)
- `combat-enrichment-roadmap.md` — the combat depth layers (base triangle → two-step → environments → info-warfare → trainer profiles)
- `combat-focus-redesign.md` + `combat-focus-AS-BUILT.md` — the CURRENT two-step model (FOCUS: R1 generic focus → R2 hidden release, rotation triangle). The AS-BUILT doc is the code-truth (live config knobs). Supersedes the distinct-wind-up CHARGE/HIDE/FEINT design.
- `content-progression-scope.md` — 40h plan, full boss ladder, read-rate ramp
- `argent-demo.html` — reference implementation of the combat engine (POC)

When code and docs conflict: **docs win**. Flag conflicts; never silently change design numbers.

## Canon combat constants (v0.3 — sim-gated; do not tweak casually)

- Stamina: tier costs 12/22/35/55; regen +8/round, +6 extra in Guard; Fluid surcharge +12; Aggressive cost ×1.15
- Winded ≤25: heavy/nuke locked. Exhausted at ≤0: forced rest round (+25), takes ×1.25 that round
- Softlock guard: if no move is affordable → forced rest round
- Stances: Aggressive ×1.25 dealt / ×1.15 taken; Guard ×0.75 dealt / ×0.60 taken; Fluid neutral
- TRIANGLE (Combat Layer 1, 2026-06-19): **AGGRESSIVE > FLUID > GUARD > AGGRESSIVE** (hard counters; combat-enrichment-roadmap.md)
- Guard vs Aggressive: counter = 0.5× reflect (pre-mitigation damage) + stagger (next-round initiative ×0.5), only if defender survives the hit
- Fluid vs Guard: opening = ×1.15 through ×0.85 guard, no counter
- Aggressive vs Fluid: **PUNISH** = the aggressor catches the dodger for ×1.35 (punishMult) and charges ★ (was a Fluid dodge — flipped in Layer 1; the ★-award follows the win-edge)
- Fluid = INITIATIVE not safety: a Fluid move ACTS FIRST vs any non-Fluid stance (even when slower); both-Fluid → faster first; it gets its hit in but loses the exchange to Aggressive
- Aggressive vs Aggressive: clash — p(win) ∝ stamina × speed; loser whiffs and is staggered
- Thrice-repeat self-daze: the same move stance 3 rounds running → the repeater takes ×1.30 (dazeTaken) that round (anti-spam; symmetric)
- Tier weights (move): light 0.85 / mid 1.00 / heavy 1.15 / nuke 1.30. Tier power: 55 / 80 / 110 / 140. NUKE also `delayNext` — it delays the user's following action
- Damage: `tier.power × atk/dfn × dmgScale (0.155) × variance (0.9–1.0) × typeEff × traitMods`, then the stance / triangle / daze / exhaust multipliers above apply
- Initiative: speed / move weight; stagger halves it
- ★ Momentum: +1 on read-wins (counter landed, opening landed, **punish landed (A>F)**, clash won), cap 3. **Calls** (spend 1 ★): GET AWAY (negate the incoming hit), HANG IN THERE (can't drop below 1 HP), Catch Breath (**+50 ST** — `catchBreathRestorePct` 0.5 of the 100-ST cap; was +35, re-baselined Phase 6b). **Bond JUMPSTART** (engine hook `jumpstartArmed`): a Familiar-tier mon's FIRST read-win banks +1 extra ★, once per battle
- Global TTK: `hpScale` **1.30** — every mon's maxHp ×this at battle creation (a length lever, not power; both ladders re-baselined)
- Type chart: canonical = `docs/typechart.json` (CH1 content — UPPERCASE types, ×1.3 super / ×0.7 resist, 17 types, **complete: all 17×17 pairs defined**). The permanent fixture trio uses the separate `LEGACY_TYPE_CHART` in `data.ts` (Mixed-case `Flame`/`Sprout`/`Splash`, ×1.5 / ×0.67). **Never mix the two vocabularies** — a CH1 mon/move must use UPPERCASE or its type interaction silently no-ops.
- **FOCUS two-step (Combat Layer 2):** R1 = a generic focus (deals 0, takes the foe's strike ×`focusCost` **0.6**). R2 = a hidden release resolving on the rotation triangle (HEAVY>Brace, FEINT>Aggressive, HIDE>Fluid) ×`releaseBase` **1.3** × outcome (win 1.45 / foe-strike 0.35 · lose 0.5 / foe 1.15 · neutral 1.0). Both sides release → the FLIPPED triangle (HIDE>HEAVY>FEINT; winner 1.45 / loser 0.62). Release vs a still-focusing foe = mismatch (heavy 1.7 / feint 0.4 / hide 1.0). **All live knobs in `combat-focus-AS-BUILT.md` (code-truth).**
- **Traits** (data-driven species traits; fire on arena rhythm rounds): GUSTBORNE = `dmgMult` × `initMult` (Falkner 1.4 / 1.25; default `LEGACY_TRAIT_TABLE` 1.3 / 1.25)
- **Boss cards** (data, in-engine — Whitney = template, Falkner = shipped): arena rhythm (a gust every `rhythmEveryN` rounds — heavy pays `heavyExtraCost` extra ST + `heavyExtraInitWeight`; telegraphed `telegraphAheadBy` ahead), Break bar (player read-wins fill it → BREAK to the next phase), `statScale` (per-mon ace bump), `teamSize`
- **Teams & faints:** multi-mon teams; a faint forces a switch to the first survivor. KO-stamina settle — the survivor settles stamina, the fainted side forfeits its remaining action; stamina carries across a trainer's team within the fight (memo'd canon)

## Architecture rules

- `src/engine/` — pure TS. Zero DOM/browser imports — its tsconfig excludes DOM libs, so the headless rule is compiler-enforced. Deterministic given an injected RNG (seedable; never `Math.random` here). Everything must run headless in Node.
- `src/game/` — rendering, input, scenes, audio. Consumes the engine only through its public API. Battles render by replaying engine events.
- `src/sim/` — bot archetypes + ladder runner. Archetypes (`archetypes.ts`): button-masher, static-guard, brute, naive-triangle, stamina-reader, human-ish (30% error rate) — plus **`reader`**, the canonical fair-fight yardstick every trainer profile is sim-gated against (`docs/sim-archetypes.md`).
- Boss AIs are data-driven boss cards in the engine (Whitney card = the format; FALKNER = the shipped boss). Trainer AIs (Combat Layer 4) are data-driven **profiles** — `src/engine/trainerAI.ts` (`TRAINER_PROFILES` + the shared decision tree); wild + any unprofiled trainer keep `wildFoeAI` (bit-identical).

## Game-layer systems (`src/game`; pointers, not canon — design lives in the linked docs)

- Foe-Intent tells — info-discipline + phase-aware focus tells (`battle.ts`; `docs/intent-tells-design-note.md`)
- Catching 2.0 — read-window catches (`docs/catching-2-0.md`)
- Evolution — bond + badge gated (`docs/evolution-design.md`)
- Bond growth — challenge-scaled XP; gates the JUMPSTART ★ (`docs/bond-track-v2.md`)
- PC box + Pokédex — `src/game/scenes/{boxMenu,dexMenu}.ts`
- Black-out + instant boss retry — `src/game/main.ts`
- **DESIGNED, NOT BUILT — do not canonize:** RESOLVE (the bond ceiling-breaker / desperate comeback) is design-only (`docs/bond-track-v2.md`, `docs/the-concord.md`); the engine has no Resolve mechanic (only a deferred-unlock note in `bond.ts`). The Calls toolkit today is GET AWAY / HANG IN THERE / Catch Breath only.

## The sim gate (non-negotiable)

Any change to combat numbers, AI behavior, or a boss kit must re-run the relevant ladder before merging. Ladders are vitest regression tests with seeded RNG and tolerance bands (n ≥ 2000). A boss ships only when its archetype win rates land on its boss card's targets. Never commit failing ladders.

The original starter trio (EMBERCUB / SPROUTLE / AQUAFIN) and their movesets are **permanent sim fixtures** in `src/engine/data.ts` — not shipping content. The rival-ladder regressions in `src/sim/ladder.test.ts` keep them forever; shipping species arrive through `docs/mon-manifest.csv` + the commission pipeline and live in their own data files.

## Commands

- `npm run dev` — game in browser
- `npm test` — unit tests + ladder regressions
- `npm run typecheck` — `tsc --build` (strict; the engine project excludes DOM libs)
- `npm run sim` — full ladder table to stdout

## Pillars (reject features that violate these)

Every battle is a puzzle. Preparation is gameplay (prep phase before every boss). No grinding, no HM tax, instant boss retry. The read-rate ramp is the difficulty curve.

## Conventions

TypeScript strict. Small modules, no cyclic deps. Conventional commits, one task per commit.

Push to `origin` after every committed task batch; never end a session with unpushed green commits. The repo is **private** and stays private until the naming-debt rename pass (see README open threads).
