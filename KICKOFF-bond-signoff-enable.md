# KICKOFF — Enable the Bond Feel-Test Sign-off

**GOAL:** enable the bond feel-test sign-off. The bond playtest stalled
because a devoted mon never reached stage 2 (Warming) — there aren't enough
real fights in the current content, and a couple of bugs would corrupt the
test. Fix the core, add JUST ENOUGH fights to reach stage 2, so Mathias can
feel the jumpstart perk + the meter crossing into Warming and sign off.
TIGHT scope — completing the bond sign-off, NOT a full overworld overhaul.

## CORE BUGS (fix — these corrupt the test or the combat)

**C1 — Stance-mismatch penalty ASYMMETRY (combat-integrity, priority).**
Mathias chose GUARD vs an agile/aggressive attack and took damage only
ONCE, but FOES that mismatch take the full (double) penalty — and vs
Falkner the double-penalty applied correctly. The read-war MUST be
symmetric. Trace whether the stance-mismatch penalty applies IDENTICALLY to
player and foe in ALL cases (wild + trainer + boss, all stance pairings).
Fix so player and foe are penalized the same. Test: a player stance-
mismatch incurs the same penalty as the foe's.

**C2 — Remove the "show your read" battle-start text** — old placeholder.

**C3 — EXHAUSTED (EXH) legibility.** When stamina hits 0 the mon is winded
and can't act for some rounds (Mathias hit this vs Falkner — "could do
nothing, no idea what's happening"). (a) Verify the EXH/winded mechanic
works as intended. (b) Make it LEGIBLE: a clear message when a mon becomes
exhausted and a visible indicator while it can't act, so the player
understands WHY they can't input.

**C4 — Bond-meter legibility (the "6 stars" confusion).** In the summary
the BOND meter (★ Wary/Warming) is confusable with a separate 5-pip thing
next to a MOVE. Make the BOND meter CLEARLY DISTINCT (label/position/style)
so bond progress is unmistakable.

## ENABLE THE TEST: just-enough fights to reach stage 2
Stage 2 (Warming) ≈ ~10 challenge-positive real fights. Current content
can't get a single mon there. Add enough REAL fights on Hearthwick→Violet→
Falkner:

**F1 — MORE GYM TRAINERS:** the Violet gym has only 1 trainer before
Falkner. Add 2-3 more (real teams, beatable, scaling toward Falkner).

**F2 — TRAINER LINE-OF-SIGHT:** route/gym trainers are passive/skippable.
Implement line-of-sight: a trainer sees you (facing cone) → walks up →
forced battle (once, then defeated-flagged). Unskippable, so the fight-
count accrues. Use existing trainer-battle + flag systems. (Trainer AI
stays current behavior — this sprint is the ENCOUNTER, not the AI.)

**F3 — CHALLENGE-POSITIVE:** tune the new trainers near a devoted
starter's power so wins award real bond (not trivial → zero).

## EXPLICITLY DEFERRED (NOT this sprint)
Follower-mon, NPC wandering, robber blocking the path, Center/Mart roofs,
dex tidy/animations, professor/rival dialogue, catch onboarding, scout-
report diegesis, deeper trainer AI. Logged, none built now.

## GATE
Stance penalty symmetric (tested); "show your read" gone; EXH explained +
legible; bond meter distinct from move pips; gym has 3-4 trainers +
Falkner; trainers challenge via line-of-sight (unskippable, once each); new
fights challenge-positive; a devoted starter can reach stage 2 (Warming) +
trigger the jumpstart on the current stretch. Sim-gate: the stance fix
touches combat — run both ladders, report any shift (if the player penalty
was wrongly HALVED, fixing it may move the ladder; correctness re-baseline,
disclose). Existing tests green.

## FEEL SIGN-OFF (Mathias)
Play Hearthwick→Violet→Falkner, fight the fuller gauntlet, confirm: combat
is fair (penalized for mismatches like the foe), EXH is understandable, and
— the real test — a devoted mon visibly reaches WARMING and the jumpstart
fires in a way that feels EARNED. THIS completes the bond feel-test.
