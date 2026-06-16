# KICKOFF — First Road fixes (Hearthwick→Violet playtest)

Fixes from Mathias's Hearthwick→Violet playtest. Mostly small; one real mechanical fix (stamina reset) that touches combat — **sim-gate it.**

## S1 — STAMINA RESETS BETWEEN BATTLES (the mechanical fix — Mathias ruling)
**ST resets to FULL at the START of every battle.** HP is the **persistent** resource (the cost of fighting; healed at Centers/potions); **ST is the per-battle tactical resource** (fresh each fight). With the tuned higher TTK, non-resetting ST forces constant healing — the grind the design rejects. So: each mon enters each battle at **full ST**; **HP carries over as-is** (unchanged), momentum unchanged.

Implementation: the player's battle team is built in one funnel (`buildPlayerTeam`); reset `st` to full there (foes already build fresh via `createSide`, st 100). This is a **game-layer** change — the engine is untouched.

**SIM-GATE:** this changes battle-start state. Run **both ladders** and report the diff. The sim ladders build every fight with fresh `createSide` (already full ST), so the expectation is **no movement — bit-identical** (the game now simply matches what the sim already does). If they DO move, it's an **intentional re-baseline** (like the Catch-Breath re-lock) — re-lock with disclosure. Either way, **report.**

## S2 — "RUN" fits the battle menu
The RUN option (5th row) is cut off the bottom of the action panel (`BOTTOM.y 132 + 8 + 4×10 = 180` = the screen edge). Tighten the row spacing so all five rows (FIGHT/PKMN/BALL/CALL/RUN) sit within the 180px screen. Quick.

## S3 — Violet entry orientation
The player travels Hearthwick **north** → Route 31 **down** → so they should arrive at Violet's **TOP** and enter heading **south/down** into the city — but currently they enter from the **bottom** (spatially backwards). Fix: regenerate Violet so the Route 31→Violet warp emerges at Violet's **north entrance**, the player walking **south** into the city (gym + shops below). Keep the gym-as-building + Center/Mart functional; just re-orient the layout.

## S4 — PIP (the lost mon) needs a visible sprite
The seed event fires, but PIP the FLITPECK has no visible overworld sprite, so the player can't see/find it ("no idea how to rescue it"). Give the lost-mon NPC a **visible overworld sprite** (the FLITPECK placeholder — the type-tinted creature silhouette, per pilot-exit §2 "art never blocks gameplay") at the event location, so the player can SEE it and walk up to interact. The interaction already works; it just needs to be visible. Implementation: an optional `sprite` field on `npc` map objects → the overworld renders the species placeholder instead of a flat colour square.

## S5 — Richer seed-event writing (small, not a system)
The lost-mon event is mechanically fine but THIN. Add a little **character** — a couple of lines giving PIP + the worried kid a touch of personality, and a **warm beat on reunion** — so the moment is memorable, not just functional. A few dialog lines on existing verbs. This seeds the "journeys not corridors" **voice**.

## LOG (don't build now — later sprints)
- Violet: most houses not enterable (full population deferred); the symmetric layout feels too regular (needs asymmetry in the enrichment pass); no Academy yet (its own Phase 7 sprint). → Violet-enrichment + Academy sprints.
- In-battle SCAN (Pokédex lookup) not built — correct, designed (combat-depth doc), a later build. Not a bug.

## GATE
ST resets to full at battle start (HP carries over); RUN visible; Violet entered from its north/top walking south; PIP visible + rescuable; the seed event has a memorable beat. Ladders: report ST-reset impact (re-baseline if moved, with disclosure). Existing tests green.
**Tests:** ST full at battle start, RUN renders on-screen, Violet warp orientation, PIP sprite present at the event, the event still completes.

## Report as audit + any ST-reset ladder diff.
