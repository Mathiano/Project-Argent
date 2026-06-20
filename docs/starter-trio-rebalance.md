# Starter Trio Rebalance — fixing the bulk asymmetry (CH1)

**Status:** design spec for rebalancing the three CH1 starters, surfaced by the KAMON v2 sim (the trio is bulk-asymmetric; the rival fight only reached fairness via a wide per-pick ace-level spread, 0.95–1.37, papering over it). This is a **design/stat-pipeline task**, not a CC task. Cross-ref `mon-design-template.md` (pillar #2), `monmanifest.csv` (the trio rows), `kamon-rival-card-v2.md` (where the asymmetry showed).

---

## RESOLUTION (post-vocab-fix sim — the decision)

The clean mirror-sim (type now live) confirmed the rebalance is **required**: aggregate GRUBLEAF 21% / KINDRAKE 50% / SILTSKIP 79% — GRUBLEAF loses *even its type-advantaged* NATURE>AQUA matchup. The deeper cause is now confirmed: **the engine's exchange rate undervalues SPD/ATK vs HP/DEF, so the frail-fast Dodger is non-viable at parity** (GRUBLEAF has the highest total + the right shape + still loses).

**Decision — contained fix now, root banked:**
- **Don't touch the foundation on one data point.** The combat math is settled + feel-validated; one archetype isn't enough to justify re-baselining everything.
- **Contained fix:** soften GRUBLEAF to a viable *fast-bruiser* (more bulk, still clearly fastest, good offense) at the shared budget; rein SILTSKIP's extreme bulk; hold KINDRAKE (the 50% anchor). Sim-iterate the whole trio to ~50% RPS. **Accepted cost:** the pure-Dodger archetype is compromised here.
- **🏦 BANKED — systemic exchange-rate finding:** SPD/ATK buys less than HP/DEF; offense/initiative archetypes (Dodger/Glass-nuke/Pacer) are soft at parity. **Revisit deliberately** — a real combat-math pass with full re-validation — *only if* the pattern holds when those archetypes come online. Not a reaction to one mon.

**First-pass lines (shared budget 330 — CC iterates to ~50%):**
| Starter | HP | ATK | DEF | SPD | Total |
|---|---|---|---|---|---|
| KINDRAKE (FLAME·Wall) | 66 | 86 | 119 | 59 | 330 |
| GRUBLEAF (NATURE·Dodger→fast-bruiser) | 68 | 88 | 84 | 90 | 330 |
| SILTSKIP (AQUA·Counter-tank) | 66 | 88 | 98 | 78 | 330 |

Once the trio lands ~50%, KAMON's per-pick gate + the Falkner-GRUBLEAF cell re-lock off the balanced trio (the Falkner ~2–3% is a *type* matchup — on-thesis, bring a counter — not a stat fix).

### ✅ LOCKED (2026-06-21 — first-pass lines held; no further iteration needed)
The first-pass lines hit the target on the first sim. Wired into `docs/ch1-batch.json`; gated by `src/sim/starterMirror.test.ts`.
- **Mirror-sim (reader v reader, CH1 chart, n=2000):** aggregate **KINDRAKE 52.1 / GRUBLEAF 49.7 / SILTSKIP 47.4%**, spread **4.7pp**. The old 21/50/79 split is gone — GRUBLEAF now *wins* its NATURE>AQUA matchup (99.9%) instead of folding. Cross-cells are ~100/0 (pure type triangle at single-type parity), so each starter's structural aggregate ceiling is `(100+0+50)/3 ≈ 50` — ~50 each *is* the target.
- **KAMON per-pick re-gate** (`engine/rivalCard.ts` `KAMON_ACE_LEVEL`): re-converged to a tight band around ~1.0 — **SILTSKIP 1.03 / KINDRAKE 0.90 / GRUBLEAF 1.02** (was 0.95–1.37). Picks land winnable-but-tense: **KINDRAKE 72.0 / GRUBLEAF 70.3 / SILTSKIP 65.7%** (spread 6.3pp). Fairness gates restored in `src/sim/rivalCard.test.ts`.
- **Falkner ladder re-lock** (`src/sim/falknerLadder.test.ts`): all cells shifted (KINDRAKE/SILTSKIP stats moved too). GRUBLEAF-hard rose off its ~2-3% floor (now has real bulk) to ~7-27% but stays clearly the hard run; SILTSKIP-fair dropped on the no-read masher cells (bulk reined). Fair-vs-hard contract intact.
- **🏦 Still banked:** the systemic SPD/ATK-vs-HP/DEF exchange-rate finding — the pure-Dodger archetype is compromised here (GRUBLEAF is now a fast-*bruiser*). Revisit only when offense/initiative archetypes come online (per RESOLUTION).

---

## The finding
At flat level + flat 0.85, the KAMON picks swung **98 / 49 / 100%** — a free-win/wall split. The frail-Dodger pick (GRUBLEAF) walls the player; the bulky picks (KINDRAKE/SILTSKIP) free-win. CC reached ~70–73% fairness only by spreading the ace level wide. That spread is a *symptom*; the cause is the starters aren't budget-balanced.

## The principle (it's pillar #2, already law)
`mon-design-template.md` pillar #2: **stat SHAPE with a tradeoff, never raw total.** The three starters must share **one stat budget**, differentiated by *distribution* — so GRUBLEAF's frailty is **paid for** in speed + offense, not a flat deficit. A frail mon that isn't compensated is a smaller number, which the pillar forbids. Fix the trio to obey it and the per-pick papering disappears.

## The target shapes (same budget, archetype-true)
Relative emphasis, not numbers — the stat pipeline fills exact values against the shared budget:

| Starter | Type · Archetype | HP | DEF | ATK | SPD | How it wins / its tradeoff |
|---|---|---|---|---|---|---|
| **KINDRAKE** | FLAME · Wall | High | High | Mod–High | Low | Fortress — wins the slugfest, FLAME hits hard; **loses the race** |
| **SILTSKIP** | AQUA · Counter-tank | High | High | Mod | Mod–Low | Punisher — outlasts + counters aggression; **loses to initiative** |
| **GRUBLEAF** | NATURE · Dodger | Low | Low | **High** | **High** | Glass dancer — wins the race (first-strike / dodge); **folds in a slugfest** |

The load-bearing change: **GRUBLEAF's Low HP/DEF is bought with High ATK/SPD.** Confirmed by the dump: there's no discrete evasion stat — **SPD *is* the dodge currency** (initiative = spd / move-weight), so GRUBLEAF pays for frailty by acting first. Frail-but-fast-hitting, not just frail.

Bonus: the trio then maps cleanly onto the stance read-war — GRUBLEAF plays the **Fluid/Evader** game (initiative), KINDRAKE/SILTSKIP play **Guard/attrition**. The starter pick becomes a *playstyle* choice, which is exactly what a starter pick should be.

## Budget rule
All three = the **same total budget** (set it from the current trio's ballpark to minimize churn). No starter out-totals another; they only out-*shape* each other.

## Data-dump finding (it may be deeper than distribution)
The dump showed GRUBLEAF already has the archetype-true shape **and the highest total (342)** — yet it's the pick that walls/free-wins. So this isn't under-budget or mis-shaped. The likely cause: **a point of SPD/ATK buys less than a point of HP/DEF** in this engine (bulk wins the favored slugfest). If true, that's *systemic* — every offense/initiative archetype (Dodger/Glass-nuke/Pacer) is soft vs every Wall/Counter-tank, not just GRUBLEAF.

**So measure before locking.** Run the mirror-sim on the CURRENT lines first (type-neutral / aggregate, to isolate stat-shape from the symmetric starter triangle):
- **GRUBLEAF ~balanced** → the KAMON wall was type+0.85-specific; no big rebalance, just re-tune KAMON's levels.
- **GRUBLEAF clearly soft** → bulk-beats-offense is real; *modest gap* → compensate frail archetypes with budget (parity, not power-creep); *severe gap* → escalate the SPD/ATK exchange rate as a combat-math question.

## Validation (the success criteria)
1. **Mirror-sim the three at equal level** → the 98/49/100 split collapses toward balance (each is winnable by shape; no pure trap, no free win).
2. **Re-run KAMON's per-pick gate** → the ace levels **converge toward ~1.0** (the wide 0.95–1.37 spread was compensating for the imbalance; once budget-balanced, it shouldn't need it).

If those two hold, the trio is fixed and KAMON's levels can be re-locked clean.

## What I need to lock the numbers (the one dependency)
- The **current stat lines** for KINDRAKE / GRUBLEAF / SILTSKIP (from `ch1-batch.json`) — to set the shared budget and minimize churn.
- Confirmation of the **stat axes** — HP / ATK / DEF / SPD, and whether **evasion/dodge** is a discrete stat or emergent from SPD (it determines how GRUBLEAF pays for its frailty).

With those, the stat pipeline fills the exact lines, sim-validates against criteria 1–2, and CC re-locks KAMON's levels off the balanced trio.
