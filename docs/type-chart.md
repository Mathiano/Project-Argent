# Type Chart v1 — the 13×13 (CANON)

Machine-readable: `typechart.json` (engine imports this; the table below is the human view).

## Rules

- Multipliers: **1.3** super-effective (S), **0.7** resisted (r), 1.0 otherwise. No immunities — every fight stays winnable through stances; typing tilts, never decides. This is deliberate: reads are the core game, the chart is seasoning.
- Dual-type defense multiplies (1.3 × 0.7 = 0.91, etc.).
- Damage formula slot: type multiplier applies after stance multipliers, before Momentum.

## The matrix (attacker rows → defender columns)

```
ATT\DEF   FLAM SPRO SPLA FIEL GALE VENO TERR VOLT FROS SPIR BRAW FORG DRAK
FLAME        r    S    r    ·    ·    S    r    ·    S    ·    ·    S    r
SPROUT       r    r    S    ·    r    r    S    ·    ·    ·    ·    r    ·
SPLASH       S    r    r    ·    ·    ·    S    ·    ·    ·    ·    ·    ·
FIELD        ·    ·    ·    ·    ·    ·    ·    ·    ·    ·    ·    r    ·
GALE         ·    S    ·    ·    ·    ·    ·    r    ·    S    S    r    ·
VENOM        ·    S    ·    S    ·    r    r    ·    ·    r    ·    r    ·
TERRA        S    r    ·    ·    S    S    ·    S    ·    ·    ·    S    ·
VOLT         ·    ·    S    ·    S    ·    r    r    ·    ·    ·    ·    r
FROST        r    S    r    ·    S    ·    S    ·    r    ·    r    r    S
SPIRIT       ·    ·    ·    r    ·    ·    ·    ·    ·    S    S    ·    ·
BRAWN        ·    ·    ·    S    r    r    ·    ·    S    r    ·    S    ·
FORGE        r    ·    r    ·    S    ·    r    r    S    ·    ·    ·    ·
DRAKE        ·    ·    ·    ·    ·    ·    ·    ·    ·    ·    ·    r    S
```

## Type identities (one line each)

- **FLAME** — broad burner: melts plants, ice, metal, toxins; founders against water and earth
- **SPROUT** — offensively narrow, statistically compensated (Dodger-heavy type); suffers many predators
- **SPLASH** — the clean duelist: two good hits, two clean resists, few liabilities
- **FIELD** — the reliable neutral: hits nothing hard, almost nothing hits it hard (the Whitney type)
- **GALE** — sky raider: scatters plants, monks, and spirits; falls to stones, sparks, frost, and steel
- **VENOM** — fells beasts and greenery; helpless against earth, metal, and the bodiless
- **TERRA** — the great grounder: buries fire, lightning, metal, toxins, and now birds
- **VOLT** — precise: storms vs sea and sky, useless into the ground
- **FROST** — best offense in the game (4 supers incl. DRAKE), worst defense (5 types resist it, 3 hunt it)
- **SPIRIT** — touches only its own kind and flesh-fighters; mundane FIELD shrugs hauntings off
- **BRAWN** — breaks the tough (FIELD/FROST/FORGE); loses to reach (GALE) and the ungraspable (SPIRIT)
- **FORGE** — the fortress: six resists incl. DRAKE; cracked only by fire, earth, and fists
- **DRAKE** — the apex tax: nothing exploits it but FROST and itself; only FORGE blunts it

## Design rulings (logged)

1. Starter triangle FLAME > SPROUT > SPLASH > FLAME — load-bearing, validator-enforced
2. DRAKE is neutral vs SPROUT and SPLASH **both directions** (fortress-drake starter ruling): stage-3 FLAME/DRAKE keeps the triangle (0.7 from SPROUT, 1.3 from SPLASH)
3. TERRA > GALE — restores the "catch a cave mon for the bird gym" prep loop (CH1 cave line L023 is TERRA)
4. Gym counter thresholds: gym 1 needs ≥1 accessible counter (it's the stance exam); gym 3 (FIELD) keeps exactly 1 by design — it is the first wall; all other gyms ≥2 counters available by their chapter
5. No immunities, multiplier band fixed at [0.7, 1.3] — widening this band requires re-running the full ladder and is a balance change, not a data tweak

## Gym counter curriculum (validated)

| Gym | CH | Type | Counters available by then |
|---|---|---|---|
| 1 | 1 | GALE | TERRA |
| 2 | 2 | VENOM | FLAME, TERRA |
| 3 | 3 | FIELD | VENOM *(wall by design)* |
| 4 | 4 | SPIRIT | GALE, SPIRIT |
| 5 | 5 | BRAWN | GALE, SPIRIT |
| 6 | 6 | FORGE | FLAME, TERRA, BRAWN |
| 7 | 7 | FROST | FLAME, BRAWN, FORGE |
| 8 | 8 | DRAKE | FROST, DRAKE |

Supersedes the partial chart in chapter-1-dex.md §3.
