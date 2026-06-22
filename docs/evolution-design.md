# Evolution — design note (the bond-gated, boss-capped model)

**Status:** design locked. Build is **Phase 6** (with catching). **This supersedes the "evolves at level 16/34" model everywhere in the docs** — Argent has no traditional levels, so evolution is driven by **bond + world-progress**, not an XP number. This doc resolves the long-standing contradiction (docs said both "no levels" and "evolves at 16/34").

**Cross-references:** `BUILD-ROADMAP.md` (Phase 6 — where this builds, after catching) · `bond-track-v2.md` (the bond stages the bond-gate reads) · `violet-academy.md` (the Academy assesses evolution readiness). **Supersedes** the "16/34" wording flagged in `silver-parity-checklist.md`, `move-pool.md`, and the dex-schema sketch in `pilot-exit-decisions.md`. The one dependency to settle — the interim bond-tracking for Phase 6 (full bond is Phase 8) — is resolved at the **catching kickoff** (the first Phase 6 sprint).

## The core idea — evolution is earned, not numbered

Evolution in Argent is the anime model: a mon evolves through **relationship and growth**, not a level threshold. It matures because of the partnership and because it (and the trainer) have grown — not because a counter hit 16.

## The two-gate rule (every mon follows this)

A mon evolves when **BOTH** are true:

1. **Bond gate** — its bond has reached the stage this evolution sits at (bond is earned by *quality play* — reads, hard fights, bosses — per `bond-track-v2.md`; never by farming).
2. **Progress gate (the "badge cap")** — the gym/boss that unlocks this evolution tier has been beaten.

**Whichever gate is satisfied *second* triggers the evolution**, and it fires at a *meaningful moment* (the end of the fight that crossed the line) so it feels earned, not like a menu pop.

- **If the boss is already beaten:** evolution fires as soon as bond reaches the stage → post-gym, it's a pure bond reward.
- **If bond is already high enough:** evolution fires the moment you beat the gating boss → the badge is the key it was waiting on.

## Why two gates (the design payoff)

- **The progress gate IS the level cap — this is the anti-power-creep mechanism.** You can never out-evolve the content: the world gates your evolution tier, so your team can't trivialize the next gym by over-evolving. This *replaces traditional level caps entirely.*
- **The bond gate keeps evolution a relationship moment** — it's earned through partnership, not a number, staying true to the bonds-over-strength thesis.
- Together: *"your partner is ready (bond) AND the world has opened the door (badge)."*

## Worked example — the route bird (FLITPECK line)

| Stage | Evolves to | Bond gate | Progress gate (cap) |
|---|---|---|---|
| FLITPECK (1) | → stage 2 | ~Stage 3 (Companions) | Gym 1 (Falkner) beaten |
| stage 2 | → GALEHAWK (3) | ~Stage 5 (Partners in Kind) | Gym 2 (Bugsy) beaten |

You catch FLITPECK, bond through real fights, and once you've *also* beaten Falkner, it evolves. It physically cannot reach stage 3 until Gym 2 is beaten — the level-cap-in-disguise.

## Worked example — the STARTERS (first evo gates on Gym 2, not Gym 1)

| Stage | Evolves to | Bond gate | Progress gate (cap) |
|---|---|---|---|
| KINDRAKE/GRUBLEAF/SILTSKIP (1) | → stage 2 | ~Stage 3 (Companions) | **Gym 2 (Bugsy) beaten** |
| stage 2 | → stage 3 | ~Stage 5 (Partners in Kind) | Gym 2 (Bugsy) beaten |

The starters' **first** evolution gates on **Gym 2 (HIVE)** — one badge *later* than the route mons' first evo. This is deliberate: anime-accurate late-evolving starters (line 41), and load-bearing for the **KAMON first-fight** at the Violet→Route 32 gate. That gate sits *after* ZEPHYR (Gym 1) but *before* HIVE (Gym 2), and its fairness is sim-gated on a **still-stage-1 starter lead** (`docs/kamon-rival-card-v2.md`, `src/sim/rivalCard.test.ts`). If the starter evolved at Gym 1 the gate would face a stage-2 lead and the authored 2-mon card would be mis-tuned — so the starter must hold at stage 1 until badge 2. (Only the starter lines moved; every other CH1 line keeps its Gym-1 first-evo gate.)

## Per-mon data

Every mon's evolution entry carries, per stage: **`evolvesTo`, `bondStage` (the gate), and `progressGate` (which boss/badge caps it).** Tunable per mon:
- **Starters** may gate their *final* evolution behind a later boss (so they evolve late — anime-accurate; Ash's Bulbasaur/Squirtle stayed first-stage for a long time). This is fine and intended.
- **Commons** may evolve earlier (lower bond stage / earlier badge).
- Pacing is sim/playtest-tunable.

## The Johto/Kanto structure (the evolution cap lifts at 8 badges)

- **Gyms 1–8 (Johto) are the evolution-gating arc.** Progress gates map to these 8 badges.
- **After 8 badges, the evolution cap is LIFTED — all further evolution is bond-only.** By 8 badges your team should be able to reach final forms; the Kanto half (gyms 9–16) is **Part 2 / post-game**, about *mastery and content*, not *unlocking evolutions*.
- **Consequence:** no mon's evolution is ever gated beyond Gym 8. Mons caught after all 8 Johto badges have **only the bond gate** (their progress gate is empty/auto-satisfied). This keeps the gating logic simple — you never map an evolution to Gym 12.

## Legibility — checking why a mon hasn't evolved (required)

The player must be able to see a mon's evolution readiness per-mon. Two surfacing methods (both flavored, not a raw number):

1. **The Academy instructor assesses it** — "Your partner's nearly ready. It just needs to see you earn the next badge." (Ties to `violet-academy.md`.)
2. **Ask your mon in the party menu** — a menu action where the mon *responds* in a flavored way reflecting its bond/readiness ("it nuzzles you — it trusts you completely" / "it's still a little wary"). Placeholder responses for now; the *idea* — querying the bond by talking to the mon — is deeply on-theme for a bonds game.

These reuse the party-menu summary BOND line + the Academy; no new engine.

## Relationship to levels — levels are GONE (or hidden)

- Evolution = bond + badge. **Moves** = bond + level-gated base kit (per move-pool) + trials. With evolution no longer needing a level number, Argent can **drop "level" as a player-facing concept entirely** — bond gates evolution, bond/story gate moves.
- *Open implementation detail (settle at the Phase 6 kickoff):* whether a hidden developmental counter still exists under the hood to pace base-moveset unlocks, or whether base moves also move to bond/story gating. Either way, **no player-facing level number, no grinding for power.** (This is the root resolution of the no-levels contradiction.)

## Build scope (Phase 6)

**Core:**
- The two-gate evolution check (bond stage + progress gate) firing at the end of a qualifying battle, with the evolution animation/beat (placeholder art fine).
- Per-mon evolution data (`evolvesTo`, `bondStage`, `progressGate`).
- The CH1 lines' evolution entries (starters + the route mons + Falkner's bird) converted from "16/34" to the bond+badge model.
- Legibility: the "ask your mon" menu action (placeholder responses) + the readiness line on the summary screen.

**Depends on:** bond existing as a tracked value. **NOTE:** bond's full build is later (Phase 8), so Phase 6 evolution needs *at least a minimal bond value tracked* even if the full bond-benefit system isn't built yet. **Interim (settle at the catching kickoff):** if true bond isn't trackable yet, the bond-gate falls back to a **hidden developmental counter** (accrued by the same quality play), swapped to true bond when bond lands in Phase 8. The swap is transparent to the player — the named stage is the UI either way.

## Sequencing

- **Design: locked now** (this doc). Supersedes 16/34 everywhere.
- **Build: Phase 6** (with catching), with the bond-tracking dependency flagged.
- Until built: mons don't evolve (the current demo state); the model layers in additively.
