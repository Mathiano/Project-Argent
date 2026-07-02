# DESIGN — Tuning Pass #5: the 6 quarantined degeneracies (finalize combat before content)
For docs/. Read the actual quarantined tests (src/sim/) to scope this. The "6 gates" are really TWO design problems + one re-baseline.

## The 6 quarantines, categorized (from reading the .skip tests)
GROUP A — turtles (3 tests, ONE root = repeatable DEFENSIVE self-escalation, no diminishing cost):
- effectMoves.test.ts: BULWARK-turtle (defense-buff; target <62%, measured ~56%)
- sustainEffects.test.ts: HEAL-turtle (heal-per-turn; <60% win, <10% draw — no unkillable healer/stall)
- sustainEffects.test.ts: SET-STANCE poker turtle (conditional DR, worst-case tell-unseen; <62%, BULWARK-class ceiling)
GROUP B — SECOND WIND→FULL POWER (1 test, ONE root = repeatable OFFENSIVE self-escalation = ★-farming):
- economyEffects.test.ts: second-wind-nuke (<60%; "★-farming is tempo-negative")
GROUP C — rival ladder (2 tests, NOT a degeneracy — CALIBRATION gates, likely shifted by the stamina change):
- rivalCard.test.ts: every pick winnable-but-tense (62-78% each)
- rivalCard.test.ts: the 3 picks tight (within ~8pp)

## Key finding: a diminishing-returns mechanism ALREADY EXISTS (for debuffs)
status.ts:119-128 — a live `applied` counter shrinks a re-applied status's duration (dur = pe.duration - (applied-1)) and past a threshold RESISTS the re-lock (emits statusResist, no refresh). The "diminishing cost on repeat" pattern — the Blissey lever — is BUILT + PROVEN on control debuffs. It's just not applied to the buff/heal/★-gain side.

## DECISION 1 — mechanism: extend the EXISTING diminishing-returns to self-buffs/heals/★-gain
Mathias's call: use the same `applied`-counter DR pattern, extended to the turtle-buffs/heals + SECOND WIND. Repeatable self-escalation gets diminishing value on repeat (like debuffs already do). ONE coherent mechanism, minimal new surface, matches what's already there (serves the rework-minimization goal — extend a proven system, don't add a parallel one). Fixes Groups A + B together.
(Rejected alts: escalating cost, cooldown, hard no-repeat — all viable but a NEW mechanism vs. extending the existing one.)

## DECISION 2 — tuning target: CAP THE CEILING, keep the strategy good
Per "metas are a feature — kill GAME-BREAKING degeneracy, NOT inequality": the tests ALLOW turtles at ~56% (a real edge is fine). So the lever caps the CEILING (prevent unkillable/stall/domination), keeping turtles ~55-60% = still a good, viable strategy, just not degenerate. Do NOT neuter turtles to average. SECOND WIND likewise: ★-farming stays possible but tempo-negative (not dominant).

## The build shape
1. Extend the diminishing-returns (`applied`-counter pattern) from debuffs to repeatable self-buffs/heals/★-gain (BULWARK-class DR-buffs, heals, SECOND WIND's ★-gain).
2. Sim-tune the DR so Groups A+B land in-band (turtles ~55-60%, SECOND WIND <60%) — capped, not neutered.
3. Re-baseline the rival ladder (Group C): check the 3 picks are actually fair post-stamina; if so re-lock the bands (calibration, not a design fix — likely shifted by the stamina change).
4. Un-quarantine all 6 (remove .skip), sim-validate, confirm NO new degeneracy introduced by the DR extension.
5. Isolation: the DR-on-buffs is a real combat-rule change — sim the fixture ladders to confirm no unintended shifts.

## After #5: combat is FINAL — content authors on clean ground (the rework-minimization goal)
