# DESIGN - Calls expansion: the info-war + team-tempo lanes (4 new Calls, greenlit)
For docs/. Ruled by Mathias. Now builds COMBINED with the trainer-Calls increment (one brief, internally staged).

## The gap this fills
The current roster (Catch Breath / Get Away / Shake-It-Off-owed / Recover / Dodge / Full Power) is all body-and-resources. Not one Call touches the read-war - the information layer that IS the game. This adds the info-war lanes (both directions) plus the team-tempo lane.

## The four Calls (all star-cost 1)
1. READ THEM! - buy the truth. This round the player's intent line reads HONEST regardless of foe info level (true stance lean + true focus tell; pierces veiled/opaque for one round). Anime: "Watch its movements!" Design: information-for-stars, a new spend axis (know vs act). Skill-expressive: worthless vs open floors, gold vs opaque elites - value grows as gyms 2-8 ramp info discipline. Build: cheap, a one-round bypass of degradeIntent (intent display is decoupled presentation). Sim-safe by construction (bots read commits directly).
2. THROW THEM OFF! - plant the lie. Poisons the player's own stance history: the record history-reading foes consult logs a stance of the player's choosing this round instead of the real one. Counterplay to KAMON's modal-read (live today) and part-B Reactive trainers (blooms when Reactive lands). Anime: "It was a feint all along!" Build: tiny - the history array is the entire surface. Sim gate: the KAMON ladder.
3. COME BACK! - the protected switch. Recall + send the next mon WITHOUT conceding the free hit a normal menu-switch eats. Anime: "return!" Design: the team-tempo lane nothing touches; switching-as-a-read is on-thesis; invests in the multi-mon content phase. Build: the biggest - switch resolution timing needs engine care. Sim gate: switch timing + no free-value degeneracy.
4. SHAKE IT OFF - owed. The long-banked status cleanse, now trivially buildable (clearDebuff is live; the locked placeholder slot exists in CALL_SET).

## Deliberate NON-picks (record the reasoning)
- NO bond-expressive Call - the lane is RESERVED: RESOLVE is design-only + stage 7 is Mathias's coming plan.
- NO initiative/"NOW!" Call - would re-import the CUT tempo axis. Tempo stays cut.
- NO Counter Call - Dodge's banked future upgrade ("evade + counter-window") owns that slot; the counter design is explicitly unsettled.

## Practicalities
- MENU: roster hits 9 -> the Call panel grows (two columns of 4-5). A LOADOUT system (equip N of the roster) is the banked future option.
- TRAINER-SIDE ADOPTION is staged: trainers cast the CLASSIC toolkit this increment; the info-war pair enters trainer policy logic at part B (Reactive - there is nothing for a trainer READ THEM to act on until Reactive reads exist); COME BACK enters when multi-mon trainer switching AI lands. The new Calls are flagged in catalog data as future-adopt.
- SIM GATES per Call: (1) safe by construction, (2) KAMON ladder, (3) switch-timing + no-free-value, (4) DR-on-cleanse interaction check (spam-cleanse bounded by the #5 economy - verify).
- Star economy unchanged: cap 3, cost 1 each, hold-vs-spend intact - the expansion widens WHAT stars buy, not how many exist.
