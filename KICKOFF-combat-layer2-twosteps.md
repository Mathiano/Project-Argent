# KICKOFF — Combat Layer 2 (two-step plays)

Build COMBAT LAYER 2 — the two-step plays from combat-enrichment-roadmap.md.
The depth layer on top of the now-sound base triangle (Layer 1). Build to the
Layer 2 spec + the momentum-on-two-steps rule + the leak cap. SIM-GATE HARD —
this is the layer most likely to create a new dominant strategy if mistuned.

## WHAT TO BUILD — the two-step layer

**L2.1 — THREE two-step plays**, each a 2-round COMMITMENT from a base stance
(NOT a 4th–6th permanent stance — input stays {AGG,FLU,GUA} OR initiate
{CHARGE,HIDE,FEINT}):
- CHARGE (Aggressive+): wind-up round → release PUSHES THROUGH GUARD (brace
  can't block it).
- HIDE (Fluid+): conceal round → release strikes from concealment (reduced
  incoming when the blow lands).
- FEINT (Guard+): fake-a-charge round → release punishes a defensive reaction
  (DAZE).

**L2.2 — SIMULTANEOUS BLIND COMMIT (Option A — locked).** Round-1 actions lock
BLIND; neither side knows if the other two-stepped until resolution. Two-step-
vs-two-step is a MUTUAL read ("will they escalate?"), NOT telegraph-and-react.
No peeking.

**L2.3 — PHASE 1 is a distinct, COUNTERABLE state.** While winding up, the
two-stepper is EXPOSED. If the opponent plays the punishing single-step, they
hit the vulnerability. THE PHASE-1 VULNERABILITY MAGNITUDE IS THE MASTER
BALANCE KNOB — tune it HARSH. (Sim finding: if two-stepping is too safe,
two-step-SPAM dominates. Two-stepping MUST be a real gamble.)

**L2.4 — THE FLIPPED TRIANGLE (when BOTH commit two-steps):**
HIDE > CHARGE > FEINT > HIDE
- HIDE beats CHARGE (concealed when the big blow lands).
- FEINT beats HIDE (catches the over-committed evader — strong).
- CHARGE beats FEINT (power overwhelms the bluff).
(Single-step rewards aggression; two-step rewards evasion/trickery — the
triangle inverts when everyone goes big.)

**L2.5 — COUNTER STRENGTH: HARD on the base triangle (Layer 1, unchanged),
SOFT on the two-steps.** CRITICAL: a SEEN phase-1 wind-up must stay VIABLE, not
auto-lost — soft counters tilt the odds without guaranteeing, so telegraphed
two-steps aren't suicidal.

**L2.6 — ESCAPE FROM A COMMITTED ENEMY CHARGE = a CALL ONLY, never a stance.**
"GET AWAY" (guaranteed no-hit/dodge) or "HANG IN THERE" (can't die this round).
This is what makes the ★ economy clutch.

## L2.7 — MOMENTUM-★ AWARD ON TWO-STEPS (the exact rule — do NOT simplify)
★ goes to whoever WON A READ; a two-step only counts as a "read" vs ANOTHER
two-step:
- TWO-STEP vs TWO-STEP → genuine mutual read (flipped triangle decides) → the
  FLIPPED-TRIANGLE WINNER gets ★. ✓
- SINGLE-STEP PUNISHES a two-step's phase-1 → the SINGLE-STEPPER read the
  wind-up → THEY get ★ (consistent with the base triangle). ✓
- TWO-STEP "SURVIVES" a non-punishing single-step → NOBODY gets ★. It was a
  phase-1 GAMBLE, not a read — surviving a gamble is NOT out-reading anyone. ✗
★ cap stays 2. The "(+★ you!/foe)" callout shows the correct winner.

## INPUT (forward-compat from Layer 1)
Two-steps initiate as "current base stance + a COMMIT modifier." Desktop: a
modifier key. GBC/mobile: hold-B or a dedicated commit button (binding TBD —
pick cleanest, note it). Keep base {AGG,FLU,GUA} cycle as-is; commit-modifier
upgrades the current stance to its two-step. Make the phase-1 wind-up VISIBLE.

## SIM-GATE (critical — this layer can create a new dominant strat)
Re-run the combat balance check (extend the engine sim;
docs/argent_combat_montecarlo_twolayer.py is the reference model). Confirm:
- NO dominant strategy: two-step-SPAM (HideSpam, ChargeSpam, FeintSpam) below
  balanced/adaptive play. (MC hit ~16pp when phase-1 tuned harsh — match.)
- EVERY option used (~22% each base stance, ~10% each two-step) — no dead
  weight. (Leak cap: unused two-step = mistuned, report.)
- FluidSpam and single-stance spam STILL lose (Layer 1 preserved).
- Report the win-rate spread + per-action usage. If two-step-spam dominates,
  HARSHEN phase-1 and re-run until balanced.
Then run the GAME ladders. Two-steps add options, so ladders MAY shift as
archetypes gain access — report what moves and re-baseline. If the AI
archetypes don't use two-steps yet, ladders may be bit-identical — report which.

## THE LEAK CAP (binding)
No new per-turn number/state beyond stamina + ★. If a two-step goes unused in
sim, cut or retune it.

## GATE
Three two-steps initiate from base stances (commit-modifier, not new permanent
stances); simultaneous blind commit; phase-1 counterable+HARSH; flipped
triangle (HIDE>CHARGE>FEINT) resolves two-step-vs-two-step; soft counters keep
seen two-steps viable; Call-only escape from a committed Charge; ★-award
follows L2.7 EXACTLY (incl. "survives a gamble = no ★"). Sim: no dominant
strategy (two-step-spam below balanced, spread ~16pp), every option used.
Ladders re-baselined or bit-identical (report which). Leak cap held. Existing
tests green + new tests for: each two-step's resolution, the flipped triangle,
phase-1 punish, soft-counter-on-seen, Call-escape, and the L2.7 ★-award cases
(esp. "survives non-punishing single-step → no ★").

## FEEL SIGN-OFF (Mathias)
After ship: committing to a Charge feels weighty (and risky if read);
Hide/Feint give the bluff-and-evade game; escalating is a genuine "should I?"
read; a seen wind-up isn't auto-lost (soft counter); the only way out of a
committed enemy Charge is a clutch Call. No single option always-best.

Report as audit + sim spread + per-action usage + ladder result/re-baseline.
