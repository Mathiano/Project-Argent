# KICKOFF — Combat Layer 1: the base-triangle fix

Build COMBAT LAYER 1 from `docs/combat-enrichment-roadmap.md`. The ESSENTIAL
combat fix: Monte Carlo proved the current triangle makes FLUID dominant
(PureFLUID won 99.7% in sim). Fix the base triangle ONLY — NO two-steps
(Layer 2). Sim-gate the result.

## THE FIX (Layer 1 — base triangle)

**L1.1 — AGGRESSIVE now BEATS FLUID** (core fix). Currently Fluid beats
Aggressive (the dodge); flip it:
  `AGGRESSIVE > FLUID > GUARD > AGGRESSIVE` (hard counters)
- AGGRESSIVE beats FLUID — catches the dodger committing.
- FLUID beats GUARD — slips the brace (unchanged).
- GUARD beats AGGRESSIVE — braces + counters (unchanged).

**L1.2 — FLUID = INITIATIVE, not safety.** Fluid still ACTS FIRST (gets its
hit in before the opponent, even when slower) — but LOSES the exchange to
Aggressive on net. Speed/first-strike option (finish a low-HP foe, escape),
NOT the safe default. If both pick Fluid, the faster strikes first.

**L1.3 — MOMENTUM-★ AWARD FLIPS WITH THE EDGE** (critical). ★ goes to who
WINS the read. Aggressive-beats-Fluid → the AGGRESSIVE player gets the ★,
not the Fluid dodger. Damage-result and ★-award are the same "who won the
read" — flip TOGETHER. The DODGE/COUNTER/OPENING/CLASH "(+★ you/foe)"
callout must show the NEW winner. (No incoherent "damage flips, ★ doesn't".)

**L1.4 — THRICE-REPEAT SELF-DAZE.** Same stance 3 rounds running → the
repeater is DAZED (self-inflicted vulnerability). Twice fine; thrice too
predictable. Symmetric (player + foe).

## VARIANCE
Aggressive = HIGH (big reward unread, big punish read). Fluid = MID (raise
from current low — no longer ultra-safe). Guard = MID.

## SIM-GATE (how we KNOW it worked)
Reference model: `docs/argent_combat_montecarlo_run1-4.py`.
- PureFLUID NO LONGER dominant — drops from ~99% to roughly ~37% (a LOSING
  spam strategy). Report its win-rate.
- No single stance/policy dominates; balanced/adaptive ≥ pure spam. Report
  the spread (target: dominant-strategy collapse, spread well under 97pp).
- Every stance still USED.
Then run the GAME's archetype ladders. This CHANGES outcomes → ladders WILL
shift → intended RE-BASELINE, not regression. Report what moved + why,
re-baseline the locked bands on the Aggressive/Fluid edge.

## FORWARD-COMPAT (don't build, don't block)
Layer 2 will add TWO-STEP plays initiated as "stance + COMMIT modifier".
Build Layer 1's stance input so a commit-modifier can be ADDED later without
re-architecting (don't hard-wire to exactly 3 stances forever). Leave room;
build nothing for two-steps now.

## GATE
Aggressive beats Fluid (hard); Fluid acts first but loses that exchange;
★-award flips with the edge (callout shows new winner); thrice-repeat
self-dazes (both sides); Fluid variance raised. Sim: PureFLUID ~37%
(reported), spread collapsed, every stance used. Ladders re-baselined with
the shift explained. Existing tests green + new tests: Aggressive>Fluid
resolution, Fluid-acts-first, ★-on-new-winner, thrice-daze.

## FEEL SIGN-OFF (Mathias)
Going Aggressive into a Fluid foe now WINS (no longer punished); Fluid feels
like a fast-but-committal first-strike (not a safe default); spamming one
stance dazes you; choosing a stance feels like a real READ with no obvious
always-best option.
