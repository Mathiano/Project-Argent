# KAMON — Rival Card v2 (Chapter 1, first fight)

**Status:** the rival's first fight, rebalanced vs the new starter trio (KINDRAKE / GRUBLEAF / SILTSKIP). Bespoke — the RIVAL elite profile at its earliest rung. Next item in the Phase-7 queue after the generic CH1 trainers. Cross-ref `opening-design.md` (Beat 5, the theft), `main-story.md` §7 (KAMON's arc + the 0.85), `trainer-archetype-catalog.md` (RIVAL profile), `monmanifest.csv` (the trio).

---

## The character, in one line
KAMON took the counter-starter out of **belief** (strength outlasts bonds), not malice. The mon **hesitates — fights at 0.85**, because the trust isn't there. He's *you-if-you-believed-the-wrong-thing.* No mustache; he pities your "bond" talk.

## The thesis, made mechanical (the whole point of this fight)
- He has the **type advantage** — his stolen starter counters yours (the classic triangle).
- But his mon fights at **bond-factor 0.85** — the hesitation, the missing trust.
- So his type edge is **offset by the absent bond**. *Your bond is the equalizer.*
- Tuned **fair-but-tense**: winnable because the bond compensates for the type disadvantage. Beating him is the game's argument **demonstrated, not stated — in the first hour.**

## Which starter KAMON steals (the triangle)
| Player picks | KAMON steals (the counter) |
|---|---|
| KINDRAKE (FLAME) | SILTSKIP (SPLASH) |
| GRUBLEAF (SPROUT) | KINDRAKE (FLAME) |
| SILTSKIP (SPLASH) | GRUBLEAF (SPROUT) |

FLAME ← SPLASH ← SPROUT ← FLAME. He always takes the one that type-beats yours.

## The profile (first fight — earliest rung of the RIVAL ladder)
| Knob | Value |
|---|---|
| Stance | **Aggressor** — raw strength is his creed; he leans into commitment |
| Two-step | Single-only (floor — fight 1; his two-step fluency comes later) |
| Release | n/a |
| Bond → Calls | **none** — fittingly, he has no bond. He *can't Call* — commit a Charge and he can't Get Away. His ideology is his mechanical weakness. |
| Call-use | never |
| Info | Open (readable now; he hides more as he climbs) |
| Terrain | none |
| Adaptivity | Fixed (fight 1; → Reactive as the ladder climbs) |
| **Modifier** | **stolen starter at bond-factor 0.85** — the defining mechanic |

## The team (AS BUILT — the two-mon stage-1 gate)
The fight ships as the **Violet→Route 32 gate** (post-Falkner). The starter's first evolution gates on **Gym 2 / HIVE** (`evolution-design.md`), so the player's lead is **still stage 1** here even though it's after ZEPHYR.

- **Lead — the chaff:** a crudely-caught route bird, **FLITPECK** (GALE), at **chaff-level 1.2, normal bond** (no 0.85 — KAMON caught it himself). It leads and softens the player; the foil to the craft the player learned. *Why FLITPECK and not the literal weakest common:* GALE is the only chaff type that holds the **tight per-pick spread** — it's neutral both ways vs FLAME/AQUA, and its NATURE edge offsets the player's TERRA common countering KAMON's FLAME ace. (Flagged: FLITPECK is rarity-"uncommon"; tightness won over the label — a Mathias call if it matters.)
- **Ace — the stolen starter:** counter-type to the player's pick, **stage 1**, at **0.85** × a per-pick fairness level (`KAMON_ACE_LEVEL`, ~0.95–1.05 — back in the early-route band). The starter duel finishes the fight.
- **Fairness knobs:** `KAMON_ACE_LEVEL` (per pick) + `KAMON_CHAFF_LEVEL` (global). The **0.85 bond-factor and the kamon AI/profile are untouched.**

### Sim result (the gate — `src/sim/rivalCard.test.ts`, n=2000, seed=1)
The player = the `reader` leading a **stage-1 starter + one caught stage-1 common (GRITHOAX)** — a 2v2 mirror of KAMON's two-mon card.

| Player picks | vs KAMON (chaff + ace) | Player win% |
|---|---|---|
| KINDRAKE | FLITPECK + SILTSKIP | **65.4%** |
| GRUBLEAF | FLITPECK + KINDRAKE | **64.8%** |
| SILTSKIP | FLITPECK + GRUBLEAF | **69.3%** |

Winnable-but-tense (~65–70%), tight (spread 4.5pp).

> **⚠️ Player-team SIZE flag:** the sim player fields **one** common (2 mons), not "a couple" (3). A literal 3-mon player team is a **body-count romp** — the reader sweeps KAMON's two mons 96–100% regardless of the knobs (a fresh third body outweighs any stat tune, spread > 30pp). The ~65–70%-tight target is only reachable at the 2v2 mirror. Sized to the gate's actual fairness math; a card-shape call for Mathias if a 3-mon player gate is wanted (it would need KAMON's mon count or shape to grow too).

## The read (player-facing)
- KAMON leans Aggressive — **bait the commitment** with Guard/Brace and punish it.
- His stolen mon has the type edge but hits at **0.85** — softer than the matchup looks; your bonded mon trades better than it "should."
- He **can't Call** — commit freely, he can't escape.
- Winning = the thesis's first proof: your bond beat his raw strength *and* his type advantage.

## The escalation hook (the RIVAL ladder)
Fight 1 of KAMON's arc (`main-story.md` §7). Across the game his profile climbs (Aggressor/Single → Duelist-class, Reactive, two-step fluency) **and** his stolen mon's bond-factor moves: **0.85 → … → 1.0+** if he's redeemed in the capital, where it "protects him by its own read, not his order." The number you tune here is the baseline the whole arc moves off.

## CC wiring notes
- This is a deliberate **update** to the existing rival card (v2 = rebalanced vs the new trio + the 0.85). The **rival-ladder regression updates as an INTENDED shift** (like JAY's gate cell), not bit-identical. (This is separate from the generic-trainer wiring, which left KAMON untouched.)
- Wire the **type-triangle steal** (KAMON's starter = the counter to the player's pick).
- Apply **bond-factor 0.85** to his stolen starter — reuse the demo's existing "fights at 0.85" lever if it's the same per-mon hook; confirm the engine exposes it.
- **Sim-gate fair-but-tense across all three player picks** vs the reader: winnable-but-close (bond offsetting the type disadvantage), not a free win, not a wall.
- **Protect 0.85 as the thematic constant** — if a matchup isn't fair at 0.85, tune fairness via **levels/stats**, not by moving the hesitation number (it's load-bearing).
- Keep the **no-Calls / Open / Fixed** floor profile for fight 1.

## Scope guard (Chapter 1 stays clean)
This is the **personal** rival beat only — KAMON, the theft, the hesitation. **No Concord** here (Ch1 ships clean; the Concord is a faint seed at most, per `main-story.md` §9 sequencing). The rival's Concord courtship starts Ch3.
