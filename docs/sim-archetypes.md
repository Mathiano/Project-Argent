# Sim Archetypes — canonical v1

Project lead ruling, 2026-06-12. These are **measurement instruments**, not gameplay AI. Drift in their win rates means the engine or the data drifted — never "improve" an archetype without an explicit design ruling.

The foe AI commits first each round; the player archetype sees the foe's committed action as a **telegraph** before choosing its own.

## Canonical definitions

- **static-guard**: always Guard; mid move if affordable, else light.
- **brute**: always Aggressive; heaviest affordable move. (Whitney uses it.)
- **naive-triangle**: counters telegraphed stance by pure triangle (A→Guard, G→Fluid, F→Aggressive). No speed/stamina awareness. No intent or empty history → Guard.
- **stamina-reader**: matchup-aware.
  - vs A: `(mySpd > foeSpd && st >= 40) ? Fluid : Guard`
  - vs G: `st >= 40 ? Fluid : Guard`
  - vs F: `mySpd > foeSpd ? Aggressive : Guard`
  - Foe resting → Aggressive
  - Mid move if affordable, else light.
  - Call: Catch Breath when `★ >= 1 && st < 30`, checked before committing.
- **human-ish**: 30% uniform-random stance (default move pick), otherwise stamina-reader policy. Models a learning human, not a lost one.

## Reference rival (KAMON)

For the rival-fight ladder regression test, the foe runs the demo's KAMON AI: 10% triangle-read of the player's modal stance after 3+ rounds of history, otherwise 55A / 35G / 10F weighted-random. Move: heavy if `st > 70`, else mid, else lightest.
