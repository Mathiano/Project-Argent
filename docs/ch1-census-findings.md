# CH1 census — first measured read (2026-09-23)

`npm run census` (`src/game/ch1Census.ts` + `runCh1Census.ts`). Enumerates every
fight and encounter zone by **walking the shipped maps**, then runs each fight
through the real engine against the canonical `reader` yardstick
(`docs/sim-archetypes.md`).

It exists because `docs/design-risks-and-gaps.md` **Risk 4** ("core fun is unproven
at length") and the "no grinding ⇒ too little to do?" question are questions about
numbers, and nobody should have to sit through a two-hour run to get a first answer.

**It gates nothing.** No ladder band reads these figures, and the tests deliberately
pin the *instrument* (does it still see every fight? is the control applied?) rather
than the win rates — pinning those would turn a content edit into a false regression.

---

## Reading the table

`n=300/fight, seed 1, starter GRUBLEAF`. **`vN` is the team size on BOTH sides**: the
player mirrors the trainer's count.

That control matters more than it sounds. Without it the player fights solo against
a 2-mon trainer, and Route 31's PAX measured **9%** against 69–100% for his
neighbours — a difficulty spike that was entirely the harness. Matched, he is 99.3%.
`ch1Census.test.ts` fails if the control is ever dropped.

| fight | map | profile | ground | vN | win% | rounds | ★ earned | HP left | skippable |
|---|---|---|---|---|---|---|---|---|---|
| route31_youngster_beaten | ROUTE 31 | YOUNGSTER MILO | forest | 1 | 100.0 | 5.1 | 1.62 | 64.3% | yes |
| route31_camper_beaten | ROUTE 31 | BRUISER | forest | 1 | **81.7** | 8.8 | 3.00 | **26.1%** | yes |
| route31_birdkeeper_beaten | ROUTE 31 | SKIRMISHER | forest | 1 | 100.0 | 5.0 | 1.30 | 61.0% | yes |
| route31_youngster2_beaten | ROUTE 31 | YOUNGSTER MILO | forest | 2 | 99.3 | 18.0 | 5.08 | 34.8% | yes |
| route31_lass_beaten | ROUTE 31 | LASS BRYN | forest | 1 | **68.7** | 9.3 | 3.05 | **19.7%** | yes |
| route31_trainer_beaten | ROUTE 31 | JAY | forest | 1 | 100.0 | 6.2 | 1.51 | 65.3% | yes |
| violet_schoolkid_beaten | VIOLET CITY | YOUNGSTER MILO | open | 1 | 100.0 | 7.9 | 2.34 | 55.9% | yes |
| gym_trainer_beaten | GYM | SKIRMISHER | open | 2 | 100.0 | 10.5 | 2.65 | 61.5% | yes |
| gym_trainer_2_beaten | GYM | SKIRMISHER | open | 2 | 99.7 | 13.0 | 3.08 | 43.7% | no |
| gym_trainer_3_beaten | GYM | SKIRMISHER | open | 1 | 90.0 | 7.0 | 1.82 | 33.2% | no |
| gym_trainer_4_beaten | GYM | SKIRMISHER | open | 2 | 100.0 | 12.8 | 3.19 | 45.3% | no |

**Totals:** 11 trainer fights (8 avoidable, 11 profiled) · **~104 rounds** of trainer
combat · ₽6300 payout · 7 encounter zones across 4 wild species.

---

## What it says

**1. The chapter is ~104 rounds of *mandatory-ish* trainer combat, plus wilds.**
This is the first hard number for session length. 8 of the 11 fights are avoidable,
so a beeline run is materially shorter — and, since the scout-report economy hangs
two of its six intel lines off skippable trainers, also materially harder at the
boss. Those two systems now point the same way, which is the design working.

**2. CH1's floor is FLAT, and mostly frictionless.** Against a competent reader, 8 of
11 fights are ≥99% and 5 end with more than 45% HP intact. That is not automatically
wrong — CH1 is the teaching chapter and the read-rate ramp is the difficulty curve —
but it is worth naming that the chapter currently has **two** fights with real teeth:

- **LASS BRYN** (bulwark) — 68.7%, 19.7% HP left
- **BRUISER / ⟨Rourke⟩** (aggressor) — 81.7%, 26.1% HP left

Both are the trainers with a *distinct stance identity*. Every 100% fight is a
`balanced` or `evader` profile. 🟡 Inference, not measurement: the floor is soft
where the profile has no stance for the player to read, which is the opposite of
what a teaching chapter wants — a teaching fight should be easy *because you made
the read*, not easy because there was none to make.

**3. The gym teaches one read, four times.** All four gym trainers are `SKIRMISHER`.
That is the documented "gym chaff" decision in `trainerAI.ts`, not an accident, but
it means the four fights guarding Falkner exercise a single profile. Falkner's kit is
rhythm + heavy releases; nothing on the way up rehearses it.

**4. The ★ economy is exercised, lightly.** 1.3–3.2 ★ earned per fight (5.1 in the
long 2v2) against a cap of 3. The short fights (5–6 rounds, 1.3–1.6 ★) barely reach
the Calls economy at all.

**5. GALEHAWK — Falkner's ace — is catchable on Route 31** at 18% across four zones.
Noted, not judged: it may well be intended (you can bring the gym's own bird to the
gym), but it is the kind of thing worth being deliberate about.

---

## Not claims this makes

- **It does not measure a wild-encounter budget.** Zones and rates are enumerated;
  steps-per-encounter and therefore the real wild round-count are not modelled.
- **It does not model the player's actual party.** The mirror control uses one
  species on both sides. A real run arrives with a caught team and items.
- **It does not include the boss.** Falkner has his own ladder
  (`src/sim/falknerLadder.test.ts`) with real tolerance bands; duplicating him here
  would invite two sources of truth.
- **It does not include items, bond, or Calls carried in.** `reader` plays the
  combat toolkit only.
