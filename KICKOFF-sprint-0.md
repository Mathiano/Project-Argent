# Sprint 0 — engine port + sim harness

(Paste this whole file as your first prompt in Claude Code.)

Read CLAUDE.md and everything in docs/ before writing code. The key references are
docs/combat-2-0-spec.md (rules) and docs/argent-demo.html (working reference engine).

Do these tasks in order. Commit after each. Do NOT start any rendering/game work this sprint.

## 1. Scaffold

Vite + TypeScript (strict) + vitest. Folder layout per CLAUDE.md (`src/engine`, `src/game`, `src/sim`).
Set up npm scripts: `dev`, `test`, `sim`. Add .gitignore.

## 2. Port the combat engine → src/engine/

- Types: `Species`, `Move`, `Tier`, `Stance`, `SideState`, `BattleState`, `BossCard`, `BattleEvent`
- Core: `resolveRound(state, playerAction, foeAction, rng) -> { events, state }` — pure function;
  the UI later renders battles by replaying the event list
- Implement every v0.3 constant listed in CLAUDE.md, including: clash, the stamina-softlock
  auto-rest, ★ Momentum charging, and the Catch Breath call
- RNG is injected and seedable. `Math.random` is forbidden in src/engine

## 3. Sim harness → src/sim/

The four bot archetypes from CLAUDE.md plus a ladder runner.
Reproduce the demo's rival-fight ladder (the three starter-vs-counter matchups from
argent-demo.html, rival at 0.85 hesitation scale, 10% read, 55A/35G/10F mix) at n=2000, seeded.

Reference points from the POC (measured at only n=40, so verify with tolerance ±8%):

| Matchup | Archetype | Win % |
|---|---|---|
| SPROUTLE vs EMBERCUB | static-guard | ~83 |
| SPROUTLE vs EMBERCUB | human-ish | ~65 |
| EMBERCUB vs AQUAFIN | human-ish | ~65 |
| EMBERCUB vs AQUAFIN | stamina-reader + Call | ~70 |

Lock the n=2000 results as vitest regression tests with fixed seeds and tolerance bands.
If your n=2000 numbers differ meaningfully from the table, report the true numbers —
they become the new locked baseline (the POC sample was small).

## 4. `npm run sim`

Prints the full ladder table (archetype × matchup → win%, mean rounds, exhaustion rate).

## 5. Mechanic edge-case unit tests

- Counter fires only if the defender survives the hit
- KO mid-exchange ends the sequence (no posthumous actions)
- Exhaustion: forced rest, +25, ×1.25 taken that round
- Stamina softlock: no affordable move → auto-rest
- Winded lock on heavy moves
- Stagger halves next-round initiative
- Clash: loser whiffs and is staggered; winner gains ★
- Fluid-vs-Guard ordering override (Fluid acts first)

## Done =

All tests green, `npm run sim` table produced, no rendering code written.
Reply with the sim table and any spec ambiguities you hit.
