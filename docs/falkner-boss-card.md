# Falkner Boss Card v2 (CANON — supersedes v0.1 entirely)

Gym 1 · Violet rooftop · Reads 0% / 15% · Break bar 2 · Badge: ZEPHYR

> **Call-unlock ruling (Mathias, 2026-06-15):** the first Trainer Call is **NOT** a badge gift. Design intent — the first Call unlocks from an *earned bond moment* (the mon reacts to the player / senses the stakes / shows trust), built with the bond system in Phase 8. It is **not** gated to this badge, and for the demo it is simply available (currently unlocked on the first wild win). See `src/game/main.ts` (`catchBreathUnlocked`) and the project memory note.

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

GALE hits NATURE ×1.3 — the GRUBLEAF picker gets the classic hard first gym. TERRA (GRITHOAX, the cave line) hits back ×1.3 — the prep-loop catch. KINDRAKE walls him; SILTSKIP counters the dive.

## Sim targets — PER-STARTER bands (demo-complete re-baseline)

> **Design ruling (Mathias, 2026-06-15):** the original single-band-per-archetype targets averaged across starters and never matched reality — the matchup spread between starters is *enormous* and **intended**. KINDRAKE walls GALE and SILTSKIP counters the dive (the **fair** demo paths); GALE hits NATURE ×1.3, so **GRUBLEAF alone is hard-mode**. The answer to GRUBLEAF-into-Falkner is **prepare — train, or catch a GALE counter (GRITHOAX, the cave line; once Catching 2.0 lands in Phase 6)** — *not* a GRUBLEAF solo buff. Falkner's levers are **not** retuned to flatten this; instead the bands are widened to accept the designed spread, and the ladder is re-locked to them (`src/sim/falknerLadder.test.ts`). Locked at gust=1.4 / ace-HP=1.15.

| Player archetype | Fair path (KINDRAKE / SILTSKIP) | Hard-mode (GRUBLEAF) |
|---|---|---|
| button-masher | 40–55 | 5–15 |
| brute (heavy spam) | 8–22 | 8–22 |
| naive-triangle | 62–80 | 30–45 |
| stamina-reader | 92–100 | 6–20 |
| human-ish (30% err) | 80–93 | 8–22 |

The **fair** columns are the demo's intended difficulty: a reading player on KINDRAKE/SILTSKIP clears the gym; a button-masher on the fair path lands ~50/50 (a real but beatable wall). The **hard-mode** column is GRUBLEAF without prep — survivable for a strong reader (stamina-reader/human-ish still pull it off some of the time) but a deliberate "go catch a counter / train" signal for everyone else.

Tuning levers (frozen for the demo; listed for the post-demo tuning pass only): GUSTBORNE damage mult (1.3 ±0.1) → DIVE BOMB usage rule strictness → ace HP mult (1.15 ±0.1) → Break bar threshold feel (2 fixed — do not change without design review).

## Engine hooks required (sanctioned additions at the Falkner sprint, sim-gated)

1. Arena rhythm schedule (round-modifier table on BossCard)
2. Species trait slot + GUSTBORNE implementation (conditional modifiers)
3. Break bar (fills on player read-wins; Break = lost round + phase flag)
4. Boss card loader driving stance/move policy + Call usage

## Gym room (P0 rule: the room teaches the leader)

Wind-current routing puzzle: timed gusts push the player on the rooftop walkways; crossing requires moving between pulses — counting the same rhythm the fight will demand.
