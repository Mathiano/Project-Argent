# KICKOFF — Focus damage bugfix

Playtest surfaced a real balance bug + two smaller issues. Priority is the
Heavy-damage overshoot. (Bigger items are banked at the end — do not build.)

## BUG 1 (PRIORITY) — Heavy release does WAY too much damage

**Symptom (playtest):** Focus → HEAVY release (Focus+Aggressive) is doing
~70-100% of a foe's HP in a single hit — one-shotting early trainers and
doing ~70% to GALEHAWK (Falkner's mon). A Heavy should be STRONG (payoff for
paying the focus cost + winning the read) but NOT a one-shot. One-shotting
breaks the read-war (if Heavy near-kills in one hit, nothing else matters).

**Root cause (likely):** releaseBase (the 1.7 multiplier in config.ts FOCUS)
+ the Heavy-vs-Brace crush bonus stack too high. The SIM validated strategy
BALANCE (Heavy isn't dominant — Fluid counters it) but did NOT check ABSOLUTE
damage magnitude — so this is a feel-tune the sim couldn't catch.

**Fix:** tune releaseBase (and the Heavy crush multiplier if needed) DOWN so
a landed Heavy is STRONG but proportionate — a big chunk (~35-50% vs a
neutral target, more vs a crushed Brace, less/dodged vs Fluid), NOT a
one-shot. Judgment on the exact number; goal is "Heavy feels powerful and
worth the focus cost, but the foe survives a single landed Heavy at full HP
in the normal case."

**IMPORTANT:** re-run the focus balance sim after tuning to confirm STRATEGY
balance still holds (Adaptive tops, focus-spam below balanced, releases used
equally) at the new damage level.

## BUG 2 — missing KO reaction on a one-shot

**Symptom:** when Focus+Aggressive KO'd the foe (HP to 0), "no reaction from
the game that round" — the KO/faint beat didn't fire. Likely same overshoot:
the damage spike may zero HP in a way that skips death/faint handling, OR the
release-resolution path doesn't emit the KO beat. Investigate: does a KO via
a Heavy release correctly trigger the faint message + end-of-battle flow?
Fix so a Heavy-release KO fires the normal KO reaction (the held "fainted"
beat). (Bug 1's fix may reduce frequency, but the KO-beat should fire
regardless of damage source.)

## BUG 3 — UI text overlap in the release menu

**Symptom (screenshot):** in the R2 release menu, the "RELEASE:" label and
the move/outcome text OVERLAP/collide (e.g. "RELEASE:" overlapping "HEAVY"
and the "crushes a Brace" callout). Fix the layout so the release menu
(HEAVY/FEINT/HIDE + rotation hints + any outcome callout) renders cleanly
without overlapping text. (Contained layout fix — broader UI upgrade banked.)

## REPORT
1. Bug 1: new releaseBase/crush values + sim re-confirmation (strategy
   balance healthy at new damage) + a sense of Heavy's new damage range.
2. Bug 2: KO-reaction root cause + fix (a Heavy KO now fires the faint beat).
3. Bug 3: release-menu layout fixed.

Sim-gate Bug 1 (re-run focusBalance, confirm Adaptive tops / spam below /
releases equal at the new damage). Ladders: report if the damage change
shifts them (may — re-baseline if so). Existing tests green.

## BANKED (do NOT build — noted for later)
- SoulSilver-quality UI upgrade (richer panels/framing) — presentation-layer
  goal, later.
- Move-vs-stance/release mapping (how Tackle/Pebble Shot relate to
  Heavy/Feint/Hide — currently a Heavy is generic) — a design question, later.
- More anime-style Calls (the Call economy is the combat x-factor) — a
  combat-flavor vein, later.
