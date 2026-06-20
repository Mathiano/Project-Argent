# KICKOFF — Falkner rhythm tune + Trainer Focus Foe-Intent

Two Stage-1 follow-up items from the feel-test: (1) Falkner's signature
rhythm needs to integrate Focus cleanly, (2) trainer Focus needs a graduated
Foe Intent tell so easy trainers' Focus is readable and elites' isn't (the
Layer 3.5 info-warfare foundation, in the simplest possible form).

## ITEM 1 — Falkner's 3/6/9 rhythm: loosen the lock to admit Focus
**Symptom:** Falkner has Focus in his profile (gust → FOCUS→HEAVY), but his
3/6/9 forced-Aggressive rhythm prevents him from Focusing on those signature
rounds. So his Focus only fires on 1/2/4/5/7/8 — rare, and ironically NOT on
his signature gust beats.
**Root:** the 3/6/9 lock was designed when he could only single-step.

**Fix (Falkner-only — bossAI.ts):**
- Change 3/6/9 from "forced AGGRESSIVE single-step" to "forced COMMITMENT —
  either AGGRESSIVE single-step OR FOCUS→HEAVY two-step."
- Preserves rhythm readability (player still reads "every 3rd round he
  commits hard") AND lets his signature gust BE a Focus on his signature
  beats (a charged gust = more aggressive, more thematic).
- The single-vs-Focus choice per existing boss-AI logic / Occasional tendency.
- Re-baseline the Falkner ladder; fair-vs-hard contract must hold (reading
  wins, mashing punished). Confirm.
- NOTE: gust-as-environment stamina-tax is BANKED for Layer 3 — out of scope.

## ITEM 2 — Trainer FOE INTENT for Focus (graduated, info-discipline)
**Problem:** when ANY trainer Focuses the player has NO read on which release
(HEAVY/FEINT/HIDE) is coming → a 1/3 guess, not a read. Easy trainers feel as
opaque as elites → flattens the curve.

**The tells (three 2-of-3 narrowings, each pairs two releases by a lens):**
- "FOE INTENT: <foe> focuses to attack"    → HEAVY or FEINT (both hit).
- "FOE INTENT: <foe> focuses to outwit"    → HIDE or FEINT (both deceptive).
- "FOE INTENT: <foe> focuses to move fast" → HEAVY or HIDE (both speed-of-commit).
Each leaves a real 50/50 between two releases — information without certainty.
Categories are LEARNED (not auto-narrated which two); the tell is the phrase.

**Wiring (Stage-1 info-discipline dimension, small + scoped):**
- Add an INFORMATION-DISCIPLINE field to TrainerProfile: "open"/"vague"/"opaque".
- When a profiled trainer Focuses, Foe Intent shows:
  - "open" → the truthful narrowing that INCLUDES the chosen release.
  - "vague" → a less specific tell ("is focusing intently") — mid placeholder.
  - "opaque" → just "FOCUSING" (no narrowing) — elites/Concord.
- Stage-1: YOUNGSTER/JAY/LASS = "open"; FALKNER = "vague"; hooks for later.
- NOTE: a release in two narrowings (e.g. HEAVY ∈ attack ∧ move-fast) — pick
  consistently per trainer per fight so tells are learnable.

**DO NOT (future stages):** bluffing/lying tells; hiding single-stance intent
(only Focus gains a tell); per-mon info discipline.

## SIM-GATE
- Re-run trainerAI sim — Falkner re-balanced (3/6/9 admits Focus): fair fight,
  reading wins, mashing punished.
- Trainer-Focus Foe Intent: no engine-math change (UI tell) → combat balance
  unchanged. Tests verify the narrowing PHRASE matches the chosen release.
- Ladders: Falkner re-baselined; rival/bond/wild bit-identical. Report.

## GATE
- Falkner's 3/6/9 admits Focus→HEAVY on his signature beats; ladder
  re-baselined, fair-vs-hard intact.
- Profiled trainers Focusing show a Foe Intent narrowing per discipline; the
  player gets a learnable 50/50, not a 1/3 guess.
- Existing tests green + new tests: 3/6/9 admits Focus; the three narrowing
  phrases match their releases; per-trainer discipline routes (Youngster→open,
  Falkner→vague).

## REPORT
Audit + Falkner ladder re-baseline + tell-routing tests.
