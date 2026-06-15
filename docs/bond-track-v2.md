# Bond Track v0.2 — the campaign progression spine (supersedes v0.1)

**What changed from v0.1:** bond is no longer an L40+ endgame sweetener. It is the **primary training-reward loop for the whole game** — the answer to "what does preparing/training with a mon earn me, if not raw power?" It replaces stat-grinding as the growth the player *feels*, and it does so without ever rewarding repetition. This resolves the campaign progression hole: levels gate the base moveset, bond does everything else.

## The principle (unchanged and load-bearing)

- Bond is **horizontal**: it never touches HP/ATK/DFN/SPD. No stat-check returns through this door.
- Bond is earned by **quality, not quantity** — winning reads, clearing hard fights, landing Calls, beating bosses. NOT by farming weak wild encounters. A mon you've fought hard battles *with* becomes a better partner; a mon you've spam-farmed does not. This is the anti-grind guarantee: training is rewarded, grinding is not.
- Bond cannot win a matchup a read or type couldn't. Sim gate: each tier's combined effect shifts the archetype ladder ≤3% (the Temperament gate).

## What bond earns (the two tracks, per the ruling: BOTH)

### Track A — Moves (the anime "training reveals the kit")
A mon's learnset has base entries (level-gated, as today) PLUS **bond-gated entries** — its signature move and select coverage moves are unlocked by bond tier, not level. Training a mon *reveals* its kit.
- A starter's stage-3 signature (the reserved nuke slot) is **bond-gated**, not purely level-gated: you earn it by fighting well with the line, not by hitting a level number. Very anime — the partner masters its ultimate move through the bond.
- 1-2 coverage moves per significant line sit behind bond tiers, giving the player a reason to invest in a specific mon and a sense of it "growing into itself."

### Track B — Call economy (the partnership)
The ★ Momentum / Trainer Call system deepens with bond — pure read-economy, the most anime-bond mechanic in the game:

| Bond tier | Earned by (quality) | Unlock |
|---|---|---|
| **I — Familiar** | first few read-wins / first boss fought with | first read-win each battle grants ★ free (jumpstart) |
| **II — Trusted** | sustained read-wins, a gym cleared | Catch Breath also clears one Winded step |
| **III — Attuned** | multiple bosses, many Calls landed | ★ cap 2 → 3 for this mon (more Call banking) |
| **IV — In Step** | deep investment | this mon's signature Call costs 1 less ★ |
| **V — Bonded** | endgame-level investment | **second Call slot** — two charges, two Calls per battle (the veteran partner) |

## The display model — named stages, never a number (ruling)

Bond is a **HIDDEN 1–100 value**. The player **never sees the number**; it is surfaced only as **~7 named, visible STAGES**. The stage *is* the UI — so bond reads as a **deepening relationship, not a grind-bar.**

| Stage | Hidden range | Name (approved 2026-06-15) |
|---|---|---|
| 1 | 1–15 | Wary |
| 2 | 16–30 | Warming |
| 3 | 31–45 | Companions |
| 4 | 46–62 | In Sync |
| 5 | 63–78 | Partners in Kind |
| 6 | 79–92 | Kindred |
| 7 | 93–100 | Inseparable |

- **Each stage gates the bond benefits above** — the bond-gated moves (Track A) and the Call-economy unlocks (Track B). Crossing into a new stage is a felt step in the partnership that also unlocks capability. (The five Call-economy tiers map onto these seven stages; the exact stage→unlock placement is a tuning/wordsmith detail for Mathias — e.g. the second-Call-slot payoff sits at the top stage, the jumpstart at the first.)
- **Where it shows:** the **party-menu summary screen's BOND line** — the forward-hook placeholder already rendered there (Phase 4). It shows the **stage name**, never the number.
- **Rationale:**
  - **Hidden number → no grind-bar feel.** A visible 0–100 bar invites grinding to fill it; a named stage invites *living with* the mon. The number still exists under the hood for the sim/tuning — it's just never shown.
  - **Named stage → felt partnership.** "In Sync" / "Kindred" reads as a relationship deepening — the anime-bond promise made visible, not a percentage.
  - **Horizontal, not vertical.** Relationship language, never power levels — consistent with bond's no-stat-check pillar. The player levels a *relationship*, not a stat bar.

## How it feels across the 42 hours

- **Early (gyms 1-3):** bond is gentle — first tier or two. You notice a favored mon charging ★ faster and learning a move ahead of a benched one. Training your starter *matters* and it's visible.
- **Mid (gyms 4-8):** bonded mons have their signature moves and a richer Call economy; your core team diverges from your bench in *capability*, not stats. This is where "preparation is gameplay" pays off — a prepped, bonded team enters a boss with more tactical options.
- **Endgame (E4 / Kanto / Red / Gauntlet):** full Bonded mons (3-★ cap, two Calls, full kit) play markedly differently. L100 means "fully bonded," the qualified endgame state — not "bigger numbers."

## The anti-grind math (must hold)

- Bond XP per source is tuned so a **campaign-length, well-played run** reaches ~Tier 3-4 on the core team by the E4, full Bonded only by deep endgame. You cannot fast-track it by farming — weak-encounter bond gain is near-zero by design (a read-win vs a trivial foe is worth a fraction of a read-win vs a boss).
- Speedrunning is possible but leaves bond low → fewer Calls, later signature moves → the read-rate ramp bites harder. **Preparation (bond) is the intended path; speed is the hard path.** Exactly the design intent: "work and prepare for the next challenge."

## Interactions / constraints

- **Levels still gate the BASE moveset + evolution (16/34).** Bond gates signature/coverage moves + Call economy. The two are complementary, not redundant — base kit from levels, mastery from bond.
- Temperaments stack on bond; the combined solo shift must stay ≤3% (test the cross-product).
- Marked mons may start one bond tier up (minor, sim-gated).
- **Bond XP source = QUALITY ONLY** (ruling): read-wins, boss clears, Calls landed. No participation/time XP. This is the anti-grind firewall — keep it strict.

## Sequencing (revised — pulled forward)

- **Design: locked now** (this doc). It is the campaign progression model, not an endgame addon.
- **Build: P1, after (1) the Call system is in-engine (leader Calls at the Bugsy slice) and (2) save/load exists (Phase 2 — bond state must persist).** Bond rides Call infrastructure + the event stream we already record; it is tuning + UI on top, not new core combat.
- Bond-gated moves need the dex learnset schema to carry a `bondTier` field alongside `level` — a small schema add, flagged for whenever the dex slice is next touched.
- The **display** (hidden value → named stage on the party-menu BOND line) is presentation that lands when bond is built; until then the BOND line stays its current labelled placeholder.
- Until built, the campaign ships with level-gated movesets only; bond layers in without breaking anything (additive).
