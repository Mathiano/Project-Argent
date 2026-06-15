Goal: close the deferred Falkner items so the slice is walkable cold,
and add the prep-loop signposting the GRUBLEAF balance ruling needs.
No engine changes (team battles are the NEXT sprint, not this one).

1. C3 — Violet gym map (graybox) + wind-routing puzzle: rooftop
   walkways, timed gust pulses push the player, crossing requires moving
   between pulses. Warp from Route 31; gym exit warp after the badge.
2. C4 — one gym trainer fight (simple archetype AI); the win adds a
   line to the scout report (per the overworld script-trigger system).
3. Wire the walk: cold start → starter → Route 31 → gym door → puzzle →
   trainer → prep → Falkner → badge + first Call slot. Remove the
   ?skip=falkner dependency from the acceptance path (keep the flag for
   QA).
4. Prep-loop signpost (the GRUBLEAF ruling made legible): if the player
   enters the gym with a NATURE-type lead and no TERRA mon in party, a
   gym-door NPC or sign nudges toward the Route 31 cave ("Birds hate the
   stones below — a cave-catch might even the odds"). Data-driven via
   the existing dialog/flag system; no hardcoding.
5. Break-bar UI: replace the text-log Break progress with the 2-pip
   widget + a gust-telegraph banner ("The wind is rising…") + a
   phase-shift flash, per falkner-boss-card-v2 presentation notes.
6. Falkner-specific prep card: gust-rhythm habit line + ★ Catch-Breath
   note from the boss card's scout section (replace the generic
   KAMON-style reuse).

Acceptance: cold-start walk reaches Falkner with no skip flags; puzzle
solvable; Break pips + telegraph render; all tests green; CI green;
push. Report screenshots of the gym walk + the Break UI.

Also commit docs/bond-track.md (P1 design doc — do NOT build; it depends
on the Call system from the Bugsy slice).
