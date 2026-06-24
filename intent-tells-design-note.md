# Design Note — Intent Tells (the read-the-body-language system)

**Status:** design locked. Build deferred to the information-hiding tier work (Phase 8, debuts mechanically at Morty per the boss ladder; the *presentation* described here replaces the plain label across all tiers when built). Supersedes the plain "FOE INTENT: A MD ATTACK" label as the long-term presentation of foe intent. Until built, the current plain label stands.

## The core idea

Foe intent is never a spreadsheet line — it is **body language you read**. The same tell-vocabulary runs the entire game; what changes with difficulty is how **reliably** a tell maps to the stance behind it. This makes even Normal mode teach the read-skill the whole game is built on, and turns the difficulty ramp into a *reading-difficulty* ramp rather than an information on/off switch.

## The vocabulary (fixed across the game)

Each stance has a family of tells — short, evocative, animation-flavored lines. Examples (final wording per species/flavor pass):

| Stance | Tell family (examples) |
|---|---|
| **Aggressive** | "leans forward", "coils to strike", "bares its fangs", "digs in to lunge" |
| **Guard** | "plants its feet", "raises its guard", "braces", "hunkers down" |
| **Fluid** | "takes a breath", "shifts its weight", "circles lightly", "rolls its shoulders" |

The player learns this vocabulary in early-game (Normal), aided by the stance legend on-screen.

## The reliability ramp (this is the difficulty curve)

| Tier | Tell behavior | Read demand |
|---|---|---|
| **Normal** (early) | **1:1 and honest.** "Leans forward" always = Aggressive. The tell is a reliable cipher; memorize it and you can read every foe. | Learn the vocabulary |
| **Hard** (mid) | **Many-to-one / ambiguous.** A tell narrows it to two stances; disambiguate using stamina, arena rhythm, and the foe's habit history. | Read context, not just the animation |
| **Champion / late bosses** (Will onward, Red) | **Opaque or misdirecting.** Tells like "looks to its trainer" carry little stance info; you read the foe's *situation*. Koga-tier bosses give tells that **lie** (~30%) — verify before trusting. | Read the mind behind the mon |

This maps onto the existing spec tiers (Normal intent visible → Hard category-only → Champion hidden) but renders *every* tier as tells rather than labels, so the world always feels alive and the early game still teaches.

## Why this is better than plain labels

- **Normal still teaches the skill** — a player reading "leans forward → Aggressive → I should Guard" is doing the core loop from battle one, instead of reading a category code and looking it up.
- **The ramp is continuous** — the same vocabulary just gets less reliable, so there's no jarring jump from "told everything" to "told nothing." The player's *literacy* grows to meet it.
- **It's the anime** — "Read it! It's going to dodge!" is the whole fantasy, and it's now mechanical from the first fight.

## Build constraints (when this lands)

- Tells are **data on the species/stance**, not hardcoded — a tell-table keyed by stance, with per-species flavor variants where worth it (a bird "rides the updraft", a bruiser "rolls its shoulders").
- The reliability ramp is driven by the existing difficulty/information tier already on the boss card / difficulty setting — no new difficulty system, just a new *render* of the intent the engine already commits.
- Engine already commits the foe's true stance each round; this is purely a presentation layer over existing data. No combat-math change, no sim re-baseline.
- The stance legend (what-beats-what) ships alongside Normal-tier tells as the training wheels; it can fade on higher difficulties.

## Sequencing

Design: locked now. Build: with the Phase 8 information-hiding tier (Morty's arena debut → Champion). Until then, the plain label stays. Logged as the canonical presentation of foe intent so the info-hiding work renders tells, not a blanked box.
