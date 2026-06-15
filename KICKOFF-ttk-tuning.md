# KICKOFF — TTK (time-to-kill) tuning pass

**Type:** sim-gated combat-math tuning. **This is a sanctioned, conscious ladder
re-baseline** (the same way Catch-Breath +50 was) — the ladders WILL move and
that's intended.
**Source:** `docs/combat-depth-types-status.md` Issue B.

## Why

Playtest: type-advantaged fights can end in ~3 turns — before reads / comebacks /
(future) status have room to matter. **Goal: meaningful fights last ~5-8 exchanges
so the tactical layer breathes.**

## Approach (sim-test, don't guess)

- The lever is the **HP:damage ratio**, tunable via HP pools, move power, or both.
  **Chosen: a single global HP-scale knob** (`COMBAT.hpScale`), keeping damage
  "crisp" (`dmgScale` unchanged) rather than nerfing damage (which feels mushy).
  The 1.3×/0.7× type multiplier stays.
- **Target bands:** an even matchup ~6-8 rounds; a type-ADVANTAGED matchup still
  meaningfully shorter but NOT a 3-turn blowout (~4-5); a DISADVANTAGED uphill
  fight longer than advantaged.
- **Measurement tool:** the existing sim ladders (`runLadder` already reports
  `meanRounds`). Swept HP-scale and read the fight-length distribution per
  matchup class until the bands were hit. Report length, not just win%.

## Result

`COMBAT.hpScale = 1.30` (every mon's maxHp scaled at `createSide`). Swept
1.0→1.6; 1.30 is the value that satisfies BOTH bands:

| hpScale | even (mean) | advantaged (mean) | disadvantaged (mean) |
|--------:|:-----------:|:-----------------:|:--------------------:|
| 1.00 (before) | 4.7 | 3.6 | 4.2 |
| **1.30 (chosen)** | **6.4** | **4.8** | **6.1** |
| 1.40 | 7.0 | 5.4 (over band) | 6.9 |

(n=2000/cell, naiveTriangle vs rivalAI, fixture triangle.) Even 6.4 ∈ [6,8] ✓,
advantaged 4.8 ∈ [4,5] ✓, advantage still clearly matters (4.8 < 6.4).

## Constraints — checked

- **On-pillar (length, not power-creep):** `hpScale` is global — it scales the
  baseline HP:damage RATIO for ALL mons, never per-mon bulk. Stats stay
  species-static.
- **Stamina interaction:** exhaustion-seen rose to ~24% (even) / 8% (advantaged)
  — a real stamina pressure, NOT rest-spam devolution (that would be most fights
  with repeated rests). No stamina co-adjust needed. **No flag.**
- **Falkner:** GUSTBORNE/ace levers UNCHANGED (gust=1.4, hp=1.15). The fair demo
  paths now breathe at ~5-7 rounds (more room for the 2-read Break/phase play);
  the hard GRUBLEAF path stays a ~3-round blowout BY DESIGN. Bands re-locked.

## Sim gate (the conscious re-baseline)

- **Both ladders re-locked WITH disclosure.** Rival ladder: exact win counts
  updated (all 15 cells moved); Falkner ladder: bands re-locked to new measured
  win%. Before/after disclosed in each test file's header.
- **Relationships preserved + sharpened:** reading archetypes gain (more rounds →
  reads matter more); pure-mash `brute` loses (longer fights → more counters).
  Type advantage still wins; reads still decide close fights. **TTK changed how
  LONG, not WHO.**
- **⚠️ One flagged distortion:** the `brute` archetype (zero-reads control, not a
  real player) inverts on the Falkner hard path (GRUBLEAF 34.8% > KINDRAKE-fair
  8.3%). Confined to the pathological no-read archetype; every read-based
  relationship holds. Locked-as-measured + flagged rather than bending TTK around
  a non-player bot.

## Gate (done when)

Even ~6-8, advantaged ~4-5 in sim ✓; HP:damage change is broad (not per-mon) ✓;
no stamina rest-spam devolution ✓; Falkner plays to its designed feel ✓; both
ladders re-locked with disclosed before/after (win% AND length) ✓; type/read
relationships preserved ✓; build + tests green ✓.

## Feel sign-off

Mathias feel-tests: fights should feel like they have ROOM now, not blink-and-done.
