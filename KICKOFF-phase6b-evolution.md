# Phase 6b — Evolution (bond-gated, boss-capped)

Build from `docs/evolution-design.md` — evolution is driven by **bond + world-progress**, NOT levels. Plus one quick balance change. **Gate:** a CH1 mon evolves when its bond stage + gating badge are both met, firing at a meaningful end-of-fight beat, and the player can check evolution readiness per-mon.

## QUICK CHANGE (fold in) — Catch Breath becomes percentage
Catch Breath restore changes from **+35 flat → 50% of the mon's MAX ST** (so it scales / isn't a weak trickle that stalemates). Update `COMBAT` + the Call spec.
- **Ladder note (flagged):** a sim bot uses Catch Breath (`archetypes.ts` — `st < 30 + momentum ≥ 1`). So this MAY move both ladders. **Re-confirm bit-identical after; if they move, report the exact diff** (before/after), re-lock to the new measured baseline as the *intentional Catch-Breath re-baseline* (clearly disclosed), and flag it for Mathias. If they don't move, no re-baseline.

## Evolution scope
- **S1 — the two-gate check.** A mon evolves when BOTH: (a) its **bond** reaches the stage this evo sits at (read the interim 6a bond value), AND (b) the **gating badge/boss** is beaten. **Whichever is satisfied second triggers it.** Fires at the **END of a qualifying battle** (the fight that crossed the line), as a held **"[MON] is evolving!"** beat → the evolved form. Placeholder visual (the full silhouette-morph is Phase 7+ — logged in `visual-north-star.md` Layer 5).
- **S2 — per-mon evolution data.** Each mon entry carries per stage: **`evolvesTo`, `bondStage` (gate), `progressGate` (which badge caps it)**. Wire **CH1 LINES ONLY** (the 3 starters; the route bird FLITPECK→GALEHAWK; the cave TERRA line GRITHOAX→CAVELURE→CHASMTRAP; MARSHMASH = none). The other ~185 manifest mons are NOT defined now — the **structure** supports them slotting in per-chapter later. Convert any CH1 "16/34" remnants to the bond+badge model.
- **S3 — the 8-badge uncap rule.** Mons whose `progressGate` is empty/auto-satisfied (anything that'd gate beyond Gym 8, or post-8-badge catches) evolve on **bond alone**. For CH1 this mostly won't trigger, but build it correctly (no evolution gated beyond Gym 8).
- **S4 — legibility.** (a) A party-menu **"ask your mon"** action → a flavored response reflecting bond/readiness (placeholder fine — "nearly ready, but waiting to see you prove yourself" when bond-ready-but-badge-gated; "it trusts you completely" at high bond). (b) The **summary** shows readiness ("ready to evolve" / "ready once you earn the next badge" / nothing). Reuse the BOND line placeholder.

## Out of scope (later)
Full evolution animation (Phase 7+ art); defining the other 185 mons (per-chapter); evolution items/trade-evos; the full bond benefit system (Phase 8 — this uses the interim bond value only).

## Gate (6b done when)
- A CH1 mon (FLITPECK / GRITHOAX) evolves when bond + badge align, at an end-of-fight beat.
- Evolution is correctly **BLOCKED when only one gate is met** (bond-met-badge-missing → no; badge-met-bond-low → no; both-met → yes).
- The **ask-your-mon** action responds; **readiness** shows on the summary; the **8-badge uncap** rule is correct; Catch Breath is now **50%-of-max-ST**.
- Existing tests green; ladders bit-identical (report any Catch-Breath ladder diff).
- Tests: two-gate check (all four combinations), CH1 evo data, ask-your-mon response, readiness line, Catch Breath 50%.

## Report as audit (+ any Catch Breath ladder impact).
