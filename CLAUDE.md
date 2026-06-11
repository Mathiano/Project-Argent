# Project Argent

GBC-style monster battler: Pokémon Silver reimagined with Combat 2.0 (stances, stamina, reads).
320×180 logical resolution, integer-scaled (per docs/pilot-exit-decisions.md §1). TypeScript + Vite + Canvas. No game framework — the engine must run headless.

## Source of truth

`docs/` is the design bible:

- `project-argent-scope.md` — vision, pillars, feature tiers
- `combat-2-0-spec.md` — combat rules + the Whitney boss card (the boss-card template)
- `content-progression-scope.md` — 40h plan, full boss ladder, read-rate ramp
- `argent-demo.html` — reference implementation of the combat engine (POC)

When code and docs conflict: **docs win**. Flag conflicts; never silently change design numbers.

## Canon combat constants (v0.3 — sim-gated; do not tweak casually)

- Stamina: tier costs 12/22/35/55; regen +8/round, +6 extra in Guard; Fluid surcharge +12; Aggressive cost ×1.15
- Winded ≤25: heavy/nuke locked. Exhausted at ≤0: forced rest round (+25), takes ×1.25 that round
- Softlock guard: if no move is affordable → forced rest round
- Stances: Aggressive ×1.25 dealt / ×1.15 taken; Guard ×0.75 dealt / ×0.60 taken; Fluid neutral
- Guard vs Aggressive: counter = 0.5× reflect (pre-mitigation damage) + stagger (next-round initiative ×0.5), only if defender survives the hit
- Fluid vs Guard: opening = ×1.15 through ×0.85 guard, Fluid side acts first, no counter
- Aggressive vs Fluid: defender dodge p = clamp((spdDef/spdAtk − 1) × 2, 0, 0.9)
- Aggressive vs Aggressive: clash — p(win) ∝ stamina × speed; loser whiffs and is staggered
- Tier weights (move): light 0.85 / mid 1.00 / heavy 1.15 / nuke 1.30
- Initiative: speed / move weight; stagger halves it
- ★ Momentum: +1 on read-wins (counter landed, opening landed, dodge succeeded, clash won), cap 2. Calls spend ★ (Catch Breath = rest action, +35 ST)

## Architecture rules

- `src/engine/` — pure TS. Zero DOM/browser imports — its tsconfig excludes DOM libs, so the headless rule is compiler-enforced. Deterministic given an injected RNG (seedable; never `Math.random` here). Everything must run headless in Node.
- `src/game/` — rendering, input, scenes, audio. Consumes the engine only through its public API. Battles render by replaying engine events.
- `src/sim/` — bot archetypes + ladder runner. Archetypes: static-guard, naive-triangle, stamina-reader, human-ish (30% error rate).
- Boss AIs are data-driven boss cards in the engine (Whitney card = the format).

## The sim gate (non-negotiable)

Any change to combat numbers, AI behavior, or a boss kit must re-run the relevant ladder before merging. Ladders are vitest regression tests with seeded RNG and tolerance bands (n ≥ 2000). A boss ships only when its archetype win rates land on its boss card's targets. Never commit failing ladders.

## Commands

- `npm run dev` — game in browser
- `npm test` — unit tests + ladder regressions
- `npm run sim` — full ladder table to stdout

## Pillars (reject features that violate these)

Every battle is a puzzle. Preparation is gameplay (prep phase before every boss). No grinding, no HM tax, instant boss retry. The read-rate ramp is the difficulty curve.

## Conventions

TypeScript strict. Small modules, no cyclic deps. Conventional commits, one task per commit.
