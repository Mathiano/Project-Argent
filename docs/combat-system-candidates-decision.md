# Combat System — the three candidates (decision doc)

**Status:** DECISION POINT. Three combat models have been Monte-Carlo validated. This doc compares them so the choice is deliberate — the combat model has large downstream implications (the move system, status effects, AI profiles, the bond/Call economy, mon design). Sims: argent_combat_montecarlo_twolayer.py (B), argent_combat_montecarlo_focus.py (Focus), argent_combat_montecarlo_candidateC.py (C).

## The three candidates

### B — Distinct two-step wind-ups (CURRENTLY SHIPPED, Layer 2)
Three separate two-steps with VISIBLE distinct wind-ups (Charge/Hide/Feint). You commit one in R1; the opponent sees WHICH; R2 it releases.
- **Sim:** Adaptive tops (76.9%), spam below balanced, two-steps used ~18% each, spread 16-29pp. Balanced.
- **Strength:** built + shipped + feel-tested ("excellent"). Distinct wind-ups are READABLE as threats.
- **Weakness:** the "guess 2 turns out" problem — your R2 release is telegraphed (opponent sees the specific wind-up), so they can pre-counter. The soft-counter (×0.7) mitigates but the read is a turn early.
- **Input:** needs a commit-modifier (shift / hold-B).

### Focus — separate commit, HIDDEN release
"Focus" is a separate commitment (generic "gathering energy" wind-up — opponent knows A release is coming, not WHICH). R2 = hidden release (Heavy/Feint/Hide) via the rotation triangle (Heavy>Brace, Feint>Agg, Hide>Fluid).
- **Sim:** Adaptive tops, FocusSpam below balanced, releases used ~7.5% each, spread ~10pp (at FOCUS_COST~1.1). Balanced + tight.
- **Strength:** fixes the "2 turns out" problem — the release is HIDDEN, so R2 is a clean ONE-turn mutual read. Self-balancing (the focus-round cost). Call synergy (Focus telegraphs A release → defender's Hang On / Get Away read).
- **Weakness:** still needs a commit-modifier input; Focus is a separate subsystem (not on the base triangle).
- **Input:** needs a commit-modifier.

### C — FOCUS as a 4th first-class STANCE (merged), HIDDEN release
Round-1 menu = {AGG, FLUID, BRACE, FOCUS} — four first-class choices. FOCUS sits on the round-1 triangle, GENTLY punished by Aggression (think-twice, not a trap). If it survives, R2 = the hidden release (same rotation triangle as Focus). Both-focus → flipped triangle. Timing-mismatch (offset two-steps) modeled: focus-windup loses to their Heavy, beats their Feint, neutral vs Hide.
- **Sim (TUNED):** at a GENTLE focus-punish (~0.3), Adaptive tops (55.6%), AntiFocus drops below it, FocusLover below balanced (46.8%), focus used ~16%, spread 12.7pp. Balanced.
- **CRITICAL TUNING FINDING:** at a STRONG focus-punish (1.0), it BREAKS — anti-focus aggression dominates (60%), focus barely used (~5%), Adaptive only 4th. The "Aggression punishes Focus" effect MUST be GENTLE (~0.3) — a nudge to think-twice, NOT a hammer. (The design intent was right; the magnitude is the knob.)
- **Strength:** CLEAN INPUT — Focus is just a 4th menu choice (no commit-modifier; GBC-console-friendly). Unified read (Focus on the same triangle as everything). Hidden release (fixes the 2-turn problem). "Think twice before focusing" is a first-class read.
- **Weakness:** needs careful tuning (the gentle-punish knob); the timing-mismatch case is legible-but-messy (not a perfectly clean triangle); depends on smart AI to punish mistimed focus (ties to the trainer-profiles/Layer 4 work).
- **Input:** CLEANEST — 4th menu choice, no modifier.

## The comparison

| | B: Distinct wind-ups | Focus: separate commit | C: Focus 4th-stance (tuned) |
|---|---|---|---|
| Adaptive (reading) tops? | ✅ (76.9%) | ✅ | ✅ (55.6%) |
| Spam below balanced? | ✅ | ✅ | ✅ |
| Two-steps used? | ✅ ~18% | ✅ ~7.5% | ✅ ~16% |
| Spread (health) | 16-29pp | ~10pp | 12.7pp |
| Fixes "2-turns-out" read? | ❌ telegraphed | ✅ hidden | ✅ hidden |
| Input | commit-modifier | commit-modifier | ✅ clean 4th choice |
| Build status | SHIPPED | rebuild | rebuild |
| Tuning sensitivity | low | low (focus cost) | HIGHER (gentle-punish knob) |

## Downstream implications (why this matters to get right)
The combat model shapes: the MOVE system (how do "moves" map to stances/releases? — TBD), STATUS effects (Toxic, etc. — how do they fit four stances?), defensive moves (Double Team etc.), the AI trainer-profiles (Layer 4 — they must play the chosen model well), the bond/CALL economy (Calls interact differently per model), and MON DESIGN (do mons favor certain stances/releases?). So the choice is load-bearing — worth getting right before building the dependent systems.

## Recommendation
**Top two: the Focus model and Candidate C.** Both fix the "2-turns-out" readability problem (the core reason to move off B). Both sim-balanced.
- **Candidate C wins on INPUT** (clean 4th-stance choice, no commit-modifier — important for the GBC mobile console) and on UNIFIED read (Focus on the same triangle).
- **Candidate C's risk** is higher tuning sensitivity (the gentle-punish knob) and the legible-but-messy timing-mismatch case.
- **The Focus model is slightly safer** (lower tuning sensitivity, tighter spread) but needs a commit-modifier input.

**Suggested path:** PLAYTEST the shipped B first (it's readable now) to confirm the "2-turns-out" problem actually FEELS bad. IF it does → adopt Candidate C (best input + readability) as the rebuild, with the gentle-punish tuning locked (~0.3) and the timing-mismatch accepted as a legible high-stakes read (dependent on smart AI). The Focus model is the fallback if C's tuning proves fragile in the hand.

**Whichever is chosen:** lock it before building the dependent systems (moves, status, AI profiles), since they all assume a combat model. Re-validate any tuning change in the relevant sim.

## Cross-ref
combat-enrichment-roadmap, combat-focus-redesign (the Focus model detail), combat-case-reference, trainer-combat-profiles (the AI must play the chosen model), and the three Monte Carlo scripts.
