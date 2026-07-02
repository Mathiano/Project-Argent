# DESIGN — Per-mon stamina: the 8-archetype endurance spread (stat-foundation, part 1)
For docs/. Grounded in the real roster (docs/mon-manifest.csv: 345 mons / 169 lines / 8 archetypes; docs/ch1-batch.json: the 15 CH1 mons authored so far).

## The gap (verified in code)
- Species stats are per-mon for hp/atk/dfn/spd (ch1-batch.json `stats` block; each EVOLUTION STAGE is a separately-authored dex row — KINDRAKE 66hp → KILNDRAKE 76 → FORTDRAKE 90 — so "evolution-stage scaling" already exists as authored-per-stage, NOT a formula).
- STAMINA is the gap: no stamina field in the dex `stats` block, and createSideState (state.ts:46) HARDCODES `st: 100` for every mon. "Uniform stamina" — explicitly rejected in our docs. This increment fixes it.

## The concept: stamina = ARCHETYPE ENDURANCE
Stamina governs how long a mon can keep acting (moves cost ST; regen +8/round; running low forces Catch Breath / limits tier access). So stamina = staying power / endurance, and it should EXPRESS each archetype. This makes stamina a 4th axis of identity (alongside the hp/atk/dfn/spd spreads that already differentiate mons), and turns stamina from a non-factor (flat 100) into a real strategic axis (can I keep attacking, or must I rest?).

## The full 8-archetype stamina spread (Stage-1 base; scales UP per evolution stage like the other stats)
The roster has 8 archetypes (CH1 authors only 6 of them; Pacer + Drainer arrive in later chapters — spec'd here so future authoring is principled).

| Archetype     | Stamina identity                          | ~Stage-1 base |
|---------------|-------------------------------------------|---------------|
| Wall          | Highest — wins by outlasting              | ~120 |
| Counter-tank  | High — grinding absorb-and-punish         | ~115 |
| Drainer       | High — sustain/toxic attrition (long game)| ~115 |  (CH2+; e.g. MURKIN venom line)
| Pacer         | High-med — controls the clock/flow        | ~110 |  (CH2+; e.g. MAREGLACE, "embodies Fluid")
| Brawler       | Above-avg — sustained aggression          | ~105 |
| Dodger        | Medium — nimble, not enduring             | ~95  |
| Trickster     | Medium-low — wins by wit, not attrition   | ~90  |
| Glass nuke    | Lowest — burst then fade (the "end it fast" limiter; fragility extends to stamina) | ~75 |

Per-stage: each evolution stage authors a HIGHER stamina (e.g. a Wall line ~120→~132→~148), keeping the archetype's RELATIVE position while growing with evolution — exactly how hp/atk/dfn/spd already scale per authored stage.

## CH1 authoring (the 15 mons in ch1-batch.json — the 6 archetypes CH1 uses)
- Wall: KINDRAKE/KILNDRAKE/FORTDRAKE (~120/132/148)
- Counter-tank: SILTSKIP/BRACKSLAP/CRASHMAW (~115/127/143)
- Brawler: MARSHMASH (single-stage, ~105)
- Dodger: GRUBLEAF/VINESNAP/WYRMFERN (~95/105/118)
- Trickster: GRITHOAX/CAVELURE/CHASMTRAP (~90/100/112)
- Glass nuke: FLITPECK/GALEHAWK (~75/84)
(Exact per-mon values tuned in the build + sim pass; the table is the target spread.)

## CAVEATS (this is a BALANCE change, not just data)
1. Flat-100 → a 75-120 spread CHANGES combat: Glass nukes fade faster (intended — their limiter), Walls/Counter-tanks/Drainers outlast more (intended — their identity). Must SIM-VALIDATE (reader-bot ladders) to confirm it doesn't create a degenerate "high-stamina archetype always wins by attrition" dynamic or break existing matchups. Author → sim → tune → commit.
2. The numbers are the design STARTING POINT (Mathias is feel-authority; sim + playtest tune the finals).
3. Interacts with the other stat-foundation goal — one-shot-prevention via HP (Spine-3 reframe): confirm authored HP (× hpScale 1.3) pools are big enough that one-shots don't occur in normal play. Same increment or the immediate follow-up tune.

## SCOPE for the build
- Add `stamina` to the dex `stats` schema ({hp,atk,dfn,spd,stamina}) + the Species type.
- Derive `st`/max from species stamina in createSideState (replace hardcoded `st:100`).
- Populate stamina across the 15 CH1 dex rows per the spread above.
- Sim-validate (reader ladders) + tune. Confirm no-one-shots holds (HP check).
- Deferred (NOT this increment): profile-matched stat sets (→ archetype-catalog work); authoring the other ~185 mons (per-chapter content).
