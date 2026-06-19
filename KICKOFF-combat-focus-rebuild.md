# KICKOFF — Combat FOCUS rebuild (two-step layer)

REBUILD the two-step layer from the shipped "distinct visible wind-ups" model
to the sim-validated FOCUS model (docs/combat-focus-redesign.md). REPLACES how
two-steps work; PRESERVES the base triangle (Layer 1) and the both-escalate
flip. Sim-validated at FOCUS_COST ~1.1 (Adaptive tops, focus-spam below
balanced, ~10pp spread). Sim-gate the rebuild.

## THE CHANGE — from distinct wind-ups to FOCUS + hidden release
CURRENT (remove): commit Charge/Hide/Feint in R1 with a DISTINCT VISIBLE
wind-up telegraphing WHICH release is coming → opponent pre-counters the
specific release (the "guess 2 turns out" readability problem).

NEW (build) — the FOCUS model:
- **F.1 R1 = FOCUS (shared wind-up).** Initiate a Focus, internally tied to a
  base stance for stability, but APPEARS as a GENERIC "gathering energy" — they
  know A release is coming, not WHICH. Distinct Charge/Hide/Feint tells GONE;
  one shared "focusing" state. The focuser TAKES DAMAGE / DEALS NONE this round
  — the guaranteed FOCUS COST (master knob, ~1.1).
- **F.2 R2 = HIDDEN RELEASE.** Player selects HEAVY/FEINT/HIDE on R2 (chosen
  now, not predetermined). Resolves vs the opponent's SIMULTANEOUS single-step
  via the ROTATION TRIANGLE:
  - HEAVY > Brace (crush + daze) ; loses to Fluid (dodged) ; neutral vs Agg (trade)
  - FEINT > Aggressive (miss + dmg) ; loses to Brace (whiff) ; neutral vs Fluid (both hit, they more)
  - HIDE  > Fluid (slip + counter) ; loses to Aggressive (flushed out) ; neutral vs Brace (stalemate)
  A clean ONE-TURN mutual read, NOT a telegraphed 2-turn prediction.
- **F.3 BOTH FOCUS → the FLIPPED triangle** still applies: HIDE > HEAVY > FEINT
  > HIDE. (Unchanged.)
- **F.4 TIMING MISMATCH** (one releasing while the other focus-winds-up): the
  focus-windup vs their release → loses to their HEAVY (devastated gathering),
  beats their FEINT (committing not defending → their feint whiffs), ~neutral
  vs their HIDE.
- **F.5 CALLS** (synergy): Focus telegraphs A release (not which) → the
  defender gets a meaningful Call read — HANG IN THERE (can't drop below 1 HP) /
  GET AWAY (evade). Call-only escape from a committed release stays. ★-powered.

## PRESERVE (don't rebuild)
- BASE single-step triangle (Layer 1): AGG > FLUID > GUARD, Fluid acts first.
- thrice-repeat self-daze.
- the flipped triangle (both-focus) — F.3.
- the Call escapes (Get Away / Hang In There) — F.5.
- REUSE the Layer-2 machinery (winding state, release resolution, flip) — a
  TRANSFORM, not a from-scratch rebuild.

## NOT Candidate C
Do NOT make Focus a 4th first-class stance on the R1 base triangle ("Focus
punished by Aggression in R1"). The sim showed that over-punishes focusing and
promotes defensive play. Focus is a SEPARATE commitment (internally tied to a
stance, appears generic), NOT a 4th triangle option.

## INPUT
R1: initiate Focus (the commit-modifier from current Layer 2 — keep that input
path; now triggers the generic Focus). R2: select the release (Heavy/Feint/
Hide) from the menu. R1 Focus appears as the generic "gathering energy" wind-up
(HUD: "FOCUSING" — NOT CHARGE/HIDE/FEINT). Opponent's view shows only that the
mon is focusing.

## SIM-GATE
Extend/reuse the balance sim (docs/argent_combat_montecarlo_focus.py is the
reference). Confirm at FOCUS_COST ~1.1: Adaptive tops; focus-spam below
balanced; all three releases used ~equally (~7.5% each, no dominant release);
single-step spam (FluidSpam) still loses; spread ~10pp. Report win-rates +
per-action usage; tune FOCUS_COST if needed. Then run GAME ladders — report +
re-baseline (or confirm bit-identical if AI archetypes don't focus).

## GATE
R1 Focus = shared generic wind-up (release hidden), focuser pays the cost; R2 =
player-selected hidden release via the rotation triangle (Heavy>Brace,
Feint>Agg, Hide>Fluid); both-focus = flipped triangle; timing-mismatch (F.4);
Calls give the defender the Hang-On/Get-Away read; base triangle + thrice-daze
preserved; NOT the 4th-stance model. Sim: Adaptive tops, focus-spam below
balanced, releases used equally, ~10pp spread. Ladders re-baselined or
bit-identical (report). Existing tests green + new tests for: the rotation
triangle (all 9 release-vs-stance cells), the focus cost in R1, the hidden
release (R2 selection), the timing-mismatch cases, both-focus flip, Call escapes.

## FEEL SIGN-OFF (Mathias)
Focus reads better: committing a Focus is a real "should I pay the cost?";
R2 is a clean one-turn read (pick a release, they pick a stance, find out
together — NOT a 2-turn guess); "gathering energy" without WHICH creates
tension + the Call read; no release feels always-best.

Report as audit + sim win-rates + per-action usage + ladder result/re-baseline.
