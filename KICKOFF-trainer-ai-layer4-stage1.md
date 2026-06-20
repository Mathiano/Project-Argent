# KICKOFF — Trainer AI (Combat Layer 4) — STAGE 1

Build **Layer 4 Stage 1 — trainer AI core**: replace the `wildFoeAI` stub
with per-trainer combat profiles, STAGED. Work from
`docs/trainer-combat-profiles.md`. This delivers the "every battle is a read"
pillar — currently only Falkner has real AI, and even he only single-steps
(no trainer Focuses yet). Stage 1 = the WIRING + distinct stance/two-step
tendencies on a FEW trainers, so the foe-action path is proven and the player
can FEEL trainers fighting differently. Richer dimensions come later.

## SCOPE — STAGE 1 ONLY (be disciplined)
BUILD:
- The per-trainer profile DATA STRUCTURE + the shared decision-tree that
  picks a foe action from a profile (the IF-THEN logic from the design doc,
  but ONLY the two dimensions below).
- TWO Stage-1 dimensions per trainer:
  1. **STANCE TENDENCY** (Aggressor / Bulwark / Evader / Balanced — the
     base-triangle weighting).
  2. **TWO-STEP TENDENCY** (Single-only / Occasional / Frequent / Signature —
     whether & how often the trainer FOCUSES, and which release they favor).
- Wire a FEW representative trainers with distinct profiles.
- CRITICALLY: trainers can now FOCUS — the player faces the flipped triangle
  (both-focus) + a trainer's hidden release for the first time. Headline.

DO NOT build (later stages — leave hooks if cheap, don't implement):
- Bond-gated Calls (trainer Call toolkit) — Stage 2.
- Call behavior (clutch/liberal/defensive) — Stage 2.
- Information discipline (veiled intent / hidden momentum / bluffing) — Stage 3.
- Terrain affinity — waits on environments (Layer 3).
- Adaptivity (reading the PLAYER back) — Stage 2/3.
(Note where these hook in; Stage 1 is stance + two-step tendency only.)

## THE FEW TRAINERS (Stage 1 — make them feel DISTINCT)
- A ROUTE-31 trainer (Youngster) — Balanced, Single-only (teaching baseline:
  a clean base-triangle fight, no focus).
- A second ROUTE-31 trainer (Lass / JAY) — AGGRESSOR, Occasional Charger
  (favors Aggressive + sometimes Focuses into HEAVY — the player learns to
  read a trainer's focus for the first time).
- FALKNER (gym) — Evader (Gale favors Fluid), Occasional with a signature
  Focus (his "gust" → a Focus the player must read). Now he FOCUSES.

## ARCHITECTURE (de-risk the load-bearing wiring)
- ISOLATE it: the profile-driven AI is a clean policy layer that REPLACES
  `wildFoeAI` for PROFILED trainers; WILD encounters (and any unprofiled
  trainer) keep `wildFoeAI` unchanged → wild battles stay bit-identical.
- The foe-action decision is PURE POLICY (no engine-math change) → sim-
  checkable, can't regress combat math.
- Reuse the player's Focus machinery for the foe (a trainer Focusing uses the
  same focus/release resolution — the engine already supports a side
  Focusing; now the FOE side can choose it via its profile).

## SIM-GATE (key validation)
- Each profile is a FAIR fight vs balanced play (competitive band, not 90%+
  or sub-20%). Report each profile's win-rate.
- Profiles are DISTINCT (report action distributions — Aggressor vs Balanced
  vs Evader differ measurably).
- Focusing trainers use it SENSIBLY (focus-rate matches tendency; no spam).
- Player combat balance (Adaptive tops etc.) unaffected.
- GAME ladders: Falkner now Focuses → the FALKNER ladder WILL change —
  re-baseline + report new numbers (fair-but-harder, not broken). Wild
  ladders bit-identical (wild AI untouched) — confirm.

## GATE
Profiled trainers pick actions from a stance-tendency + two-step-tendency
profile via the shared decision tree; 2-3 trainers + Falkner have CLEARLY
distinct profiles; trainers can now FOCUS (player faces hidden release + the
flip for the first time); wild/unprofiled AI unchanged (bit-identical wild
ladders); pure policy (no engine-math change). Sim: each profile fair-but-
distinct (win-rates + action distributions); Falkner ladder re-baselined;
wild ladders bit-identical. Existing tests green + NEW tests for: the profile
decision tree (each stance tendency picks sensibly), a trainer Focusing +
releasing, the both-focus flip vs a trainer, profile-vs-wildAI routing.

## FEEL SIGN-OFF (Mathias)
After it ships: fight the profiled trainers — confirm DISTINCT (Aggressor
pressures, Balanced is a clean read, Falkner now Focuses → the gym fight has
the two-step read), and that facing a trainer's HIDDEN release / the flipped
triangle is the richer read-war. Flag any profile that feels unfair/same-y.

## REPORT
Audit + each profile's sim win-rate + action distributions + the Falkner
ladder re-baseline + confirmation wild is bit-identical.
