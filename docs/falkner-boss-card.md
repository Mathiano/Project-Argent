# Falkner Boss Card v2 (CANON — supersedes v0.1 entirely)

Gym 1 · Violet rooftop · Reads 0% / 15% · Break bar 2 · Badge gift: first Trainer Call slot

The lesson: **the timeline has a rhythm, and you can read it.** Falkner is the metronome boss — every threat he poses is telegraphed by the arena itself.

## Arena — rooftop gusts (both sides)

- Every 3rd round is a **gust round**, telegraphed one round ahead ("The wind is rising…")
- During gusts: heavy moves cost +8 ST and weigh ×1.3 on initiative (for BOTH sides — diving into a gale is expensive for you too)

## The trait — GUSTBORNE (first species trait; engine hook at the Falkner sprint)

GALEHAWK and FLITPECK carry it: **on arena-rhythm rounds, damage ×1.3 and initiative ×1.25; no penalty off-rhythm.** Data-driven round-modifier hook — the same mechanism later powers Pryce's ice pulses and the moon-dragon's phase fight. Wild-caught birds keep the trait (it answers to any future arena/weather rhythm).

## Roster

| Mon | Level band | Stats | Kit | Notes |
|---|---|---|---|---|
| FLITPECK (lead) | route band | base | GUST RAKE, WING CUT | honest, 0 reads, pure tutorial |
| **GALEHAWK (ace)** | ace band | base × HP 1.15 | GUST RAKE, WING CUT, **DIVE BOMB** | boss-privilege heavy (players unlock it at L13 on capture) |

## Behavior script

- **Phase 1 (Break 0–1, reads 0%):** the metronome. DIVE BOMB *only* on gust rounds — gust telegraph + heavy intent = a fully readable kill window. Off-gust: lights/mids, Fluid-leaning stances. The player learns: Guard the gust, counter the dive, or Fluid only if faster.
- **Phase 2 (after first Break, reads 15%):** the metronome syncopates. He may WING CUT on a gust (bait) and holds his one Call — *"Now — full power!"* — for a gust-round DIVE BOMB when the player's ST is low. *(Leader Call deferred — see Bugsy slice; phase-2 swing carried by gust-round DIVE BOMB.)*
- **Break bar 2:** two read-wins → GALEHAWK is blown from the sky: loses a round, gust cycle resets, phase up.

## Scout report (prep phase, earned from the gym trainers)

SPD edge vs all three starters off-gust is his; *on* gusts he outspeeds everything. Habit line: "He strikes with the wind — count the rounds." ★ note: Catch Breath on the round before a gust is the safe tempo play.

## Matchup texture (typechart canon)

GALE hits SPROUT ×1.3 — the GRUBLEAF picker gets the classic hard first gym. TERRA (GRITHOAX, the cave line) hits back ×1.3 — the prep-loop catch. KINDRAKE walls him; SILTSKIP counters the dive.

## Sim targets (CC tunes levers to land these, n≥2000 per cell, vs each starter at band)

| Player archetype | Target win % |
|---|---|
| button-masher | 25–35 |
| brute (heavy spam) | 10–20 |
| naive-triangle | 55–70 |
| stamina-reader | 85–92 |
| human-ish (30% err) | 65–75 |

Tuning levers, in order of preference: GUSTBORNE damage mult (1.3 ±0.1) → DIVE BOMB usage rule strictness → ace HP mult (1.15 ±0.1) → Break bar threshold feel (2 fixed — do not change without design review).

## Engine hooks required (sanctioned additions at the Falkner sprint, sim-gated)

1. Arena rhythm schedule (round-modifier table on BossCard)
2. Species trait slot + GUSTBORNE implementation (conditional modifiers)
3. Break bar (fills on player read-wins; Break = lost round + phase flag)
4. Boss card loader driving stance/move policy + Call usage

## Gym room (P0 rule: the room teaches the leader)

Wind-current routing puzzle: timed gusts push the player on the rooftop walkways; crossing requires moving between pulses — counting the same rhythm the fight will demand.
