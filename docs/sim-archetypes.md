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

For the rival-fight ladder regression test, the foe runs the demo's KAMON AI: 10% triangle-read of the player's modal stance after 3+ rounds of history (ties broken in key order A, G, F), otherwise 55A / 35G / 10F weighted-random. Move: heavy if `st > 70` and affordable, else first affordable mid, else first affordable light. Hesitation scale ×0.85 applies to atk/dfn only (spd/hp unscaled). Foe commits before the player chooses; player history records only real move stances (rests and Calls are not pushed). ★ cap 2.

## Design debt

**EMBERCUB into its counter** (player EMBERCUB vs rival AQUAFIN) is the hardest cell in the rival ladder — ~53% for the optimal `stamina-reader+Call` archetype at n=2000. The matchup combines a type-disadvantage with a speed-advantage in a way that the canonical reader policy can't fully exploit. To be re-tuned when the real game's rival fight gets its own boss card.
