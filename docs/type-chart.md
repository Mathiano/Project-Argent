# Type Chart — the 17-type canon

Machine-readable: `typechart.json` (engine imports this; the tables below are the human view). The roster is the canonical 17 (BASIC/FLAME/AQUA/NATURE/SPARK/FROST/BRAWN/VENOM/TERRA/GALE/PSI/INSECT/STONE/SPIRIT/DRAKE/UMBRA/FORGE).

**Status:** the **13×13 sub-grid below is APPROVED** (verified byte-identical under the FIELD→BASIC/VOLT→SPARK/SPLASH→AQUA/SPROUT→NATURE rename). The **4 new types — PSI/INSECT/STONE/UMBRA — are PROPOSED** (Gen-2-mapped) pending Mathias's approval; their rows/columns are in `typechart.json` and listed in "Proposed new-type matchups" below.

## Rules

- Multipliers: **1.3** super-effective (S), **0.7** resisted (r), 1.0 otherwise. No immunities — every fight stays winnable through stances; typing tilts, never decides. This is deliberate: reads are the core game, the chart is seasoning.
- Dual-type defense multiplies (1.3 × 0.7 = 0.91, etc.).
- Damage formula slot: type multiplier applies after stance multipliers, before Momentum.

## The matrix (attacker rows → defender columns)

```
ATT\DEF   FLAM NATU AQUA BASI GALE VENO TERR SPRK FROS SPIR BRAW FORG DRAK
FLAME        r    S    r    ·    ·    S    r    ·    S    ·    ·    S    r
NATURE       r    r    S    ·    r    r    S    ·    ·    ·    ·    r    ·
AQUA       S    r    r    ·    ·    ·    S    ·    ·    ·    ·    ·    ·
BASIC        ·    ·    ·    ·    ·    ·    ·    ·    ·    ·    ·    r    ·
GALE         ·    S    ·    ·    ·    ·    ·    r    ·    S    S    r    ·
VENOM        ·    S    ·    S    ·    r    r    ·    ·    r    ·    r    ·
TERRA        S    r    ·    ·    S    S    ·    S    ·    ·    ·    S    ·
SPARK         ·    ·    S    ·    S    ·    r    r    ·    ·    ·    ·    r
FROST        r    S    r    ·    S    ·    S    ·    r    ·    r    r    S
SPIRIT       ·    ·    ·    r    ·    ·    ·    ·    ·    S    S    ·    ·
BRAWN        ·    ·    ·    S    r    r    ·    ·    S    r    ·    S    ·
FORGE        r    ·    r    ·    S    ·    r    r    S    ·    ·    ·    ·
DRAKE        ·    ·    ·    ·    ·    ·    ·    ·    ·    ·    ·    r    S
```

## Immunity reclassification (Gen-2 zeros → 0.7 or 1.0) — ⚠ PENDING YOUR GLANCE

Ruling 2026-06-15: **NO hard immunities (0×) in Argent.** Each Gen-2 zero-matchup resolves flavor-justified → **0.7** (a real reason one can't meaningfully hit the other) or arbitrary-convention → **1.0**. All 7 Gen-2 zeros, classified; **5 already match the chart, 2 need a change, 1 is a CONFLICT.** Nothing written until you veto/approve.

| Gen-2 zero (0×) | Argent cell | Class | → value | current | action |
|---|---|---|---|---|---|
| Normal→Ghost | BASIC→SPIRIT | arbitrary *(your example)* | 1.0 | 1.0 | none |
| Ghost→Normal | SPIRIT→BASIC | arbitrary *(your example, both ways)* | 1.0 | 0.7 | **set 1.0** |
| Fighting→Ghost | BRAWN→SPIRIT | arbitrary *(same incorporeal logic as Normal→Ghost)* | 1.0 | 0.7 | **set 1.0** *(judgment — veto?)* |
| Ground→Flying | TERRA→GALE | flavor *(bird hard to hit with earth)* | 0.7 | **1.3** | ⚠ **CONFLICT — see below** |
| Electric→Ground | SPARK→TERRA | flavor *(earth grounds electricity)* | 0.7 | 0.7 | none |
| Poison→Steel | VENOM→FORGE | flavor *(can't poison metal)* | 0.7 | 0.7 | none |
| Psychic→Dark | PSI→UMBRA | flavor *(closed/cunning mind resists psychic)* | 0.7 | 0.7 | none |

⚠️ **TERRA→GALE conflict:** the flavor rule wants 0.7 (GALE resists Ground), but the chart reads **1.3** as the *load-bearing Falkner prep-loop* ("catch a TERRA cave mon to counter the GALE gym" — `falkner-boss-card.md`, ruling #3 below, gym-1 counter = TERRA, and the GRITHOAX/CAVELURE/CHASMTRAP cave line is built as that counter). Flipping to 0.7 **inverts the prep loop**. Two ways to resolve — your call: **(a)** keep TERRA→GALE = **1.3** (prep loop intact; GALE's "resist Ground" identity then applies to OTHER Ground threats, not the Falkner cheese — and "GALE resists Ground" becomes aspirational/partial); or **(b)** set **0.7** (clean no-immunity identity) and **re-home the Falkner counter** to SPARK/FROST/STONE (all hit GALE 1.3), re-typing or replacing the cave line. (a) is the smaller change; (b) is cleaner-but-cascades.

## Proposed new-type matchups (PSI / INSECT / STONE / UMBRA) — ⚠ PENDING APPROVAL

Gen-2-mapped to the gentle [0.7, 1.3] band (Gen-2 2× → 1.3 S, 0.5×/0× → 0.7 r). In `typechart.json` now (inert — no mon carries these types yet). **Mathias: approve or adjust each row/column.**

- **PSI** (Psychic) — *att:* S vs BRAWN, VENOM; r by PSI, FORGE, **UMBRA (Dark walls Psychic)**. *def:* weak to INSECT, SPIRIT, UMBRA; resists BRAWN, PSI.
- **INSECT** (Bug) — *att:* S vs NATURE, PSI, UMBRA; r by FLAME, BRAWN, VENOM, GALE, SPIRIT, FORGE. *def:* weak to FLAME, GALE, STONE; resists BRAWN, NATURE, TERRA.
- **STONE** (Rock) — *att:* S vs FLAME, FROST, GALE, INSECT; r by BRAWN, TERRA, FORGE. *def:* weak to AQUA, NATURE, BRAWN, TERRA, FORGE; resists BASIC, FLAME, VENOM, GALE. *(NOTE: STONE=Rock is distinct from TERRA=Ground — TERRA grounds birds/sparks/metal, STONE pelts fliers/bugs/ice.)*
- **UMBRA** (Dark) — *att:* S vs PSI, SPIRIT; r by BRAWN, UMBRA, FORGE. *def:* weak to BRAWN, INSECT; resists PSI (immune-in-Gen2 → 0.7), SPIRIT, UMBRA.

> Two open chart questions flagged for the same review: (1) the existing **GALE-immune-to-TERRA identity** is a *rule* in combat-depth, but the chart has TERRA→GALE = 1.3 (super) — reconcile when the immunity rule is built. (2) The "no immunities" rule (band fixed [0.7,1.3]) still holds; PSI/SPIRIT/UMBRA's Gen-2 zero-matchups are mapped to 0.7, not 0.

## Type identities (one line each)

- **FLAME** — broad burner: melts plants, ice, metal, toxins; founders against water and earth
- **NATURE** — offensively narrow, statistically compensated (Dodger-heavy type); suffers many predators
- **AQUA** — the clean duelist: two good hits, two clean resists, few liabilities
- **BASIC** — the reliable neutral: hits nothing hard, almost nothing hits it hard (the Whitney type)
- **GALE** — sky raider: scatters plants, monks, and spirits; falls to stones, sparks, frost, and steel
- **VENOM** — fells beasts and greenery; helpless against earth, metal, and the bodiless
- **TERRA** — the great grounder: buries fire, lightning, metal, toxins, and now birds
- **SPARK** — precise: storms vs sea and sky, useless into the ground
- **FROST** — best offense in the game (4 supers incl. DRAKE), worst defense (5 types resist it, 3 hunt it)
- **SPIRIT** — touches only its own kind and flesh-fighters; mundane BASIC shrugs hauntings off
- **BRAWN** — breaks the tough (BASIC/FROST/FORGE); loses to reach (GALE) and the ungraspable (SPIRIT)
- **FORGE** — the fortress: six resists incl. DRAKE; cracked only by fire, earth, and fists
- **DRAKE** — the apex tax: nothing exploits it but FROST and itself; only FORGE blunts it

## Design rulings (logged)

1. Starter triangle FLAME > NATURE > AQUA > FLAME — load-bearing, validator-enforced
2. DRAKE is neutral vs NATURE and AQUA **both directions** (fortress-drake starter ruling): stage-3 FLAME/DRAKE keeps the triangle (0.7 from NATURE, 1.3 from AQUA)
3. TERRA > GALE — restores the "catch a cave mon for the bird gym" prep loop (CH1 cave line L023 is TERRA)
4. Gym counter thresholds: gym 1 needs ≥1 accessible counter (it's the stance exam); gym 3 (BASIC) keeps exactly 1 by design — it is the first wall; all other gyms ≥2 counters available by their chapter
5. No immunities, multiplier band fixed at [0.7, 1.3] — widening this band requires re-running the full ladder and is a balance change, not a data tweak

## Gym counter curriculum (validated)

| Gym | CH | Type | Counters available by then |
|---|---|---|---|
| 1 | 1 | GALE | TERRA |
| 2 | 2 | VENOM | FLAME, TERRA |
| 3 | 3 | BASIC | VENOM *(wall by design)* |
| 4 | 4 | SPIRIT | GALE, SPIRIT |
| 5 | 5 | BRAWN | GALE, SPIRIT |
| 6 | 6 | FORGE | FLAME, TERRA, BRAWN |
| 7 | 7 | FROST | FLAME, BRAWN, FORGE |
| 8 | 8 | DRAKE | FROST, DRAKE |

Supersedes the partial chart in chapter-1-dex.md §3.
