# Boss Card — FALKNER (Gym 1, Violet City)

Template: Whitney card (combat-2-0-spec.md). Status: v0.1, sim targets unvalidated — tune via ladder before shipping.

**Teaches:** the action timeline (his signature breaks the heavy-is-slow rule), Guard-counter as the answer to faster foes, Break bar debut, first arena rhythm.
**Core lesson in one line:** *your dodge fails against faster foes — read the timeline, counter instead.*

## Team (fought sequentially, no heal between)

| Mon | HP | ATK | DFN | SPD | Stance mix | Notes |
|---|---|---|---|---|---|---|
| GUSTLING | 44 | 80 | 76 | 95 | 50A/30G/20F | Warm-up: honest, readable |
| SKYLANCE (ace) | 60 | 96 | 80 | **118** | 40A/20G/40F | Faster than every starter; Break bar 2 |

SPD 118 means: no starter can Fluid-dodge him (player spd < his ⇒ dodge p = 0), while his Fluid stuffs slow attackers (vs Aquafin's Aggressive: p = 0.9). The matchup *is* the lesson.

## Signature — DIVE BOMB (SKYLANCE)

Heavy tier (power 110, cost 35) with **weight 0.85 instead of 1.15** — a heavy that acts *first*. Intent shows HV as normal; the order preview shows him jumping the queue. First use is the timeline tutorial moment.

## Arena — Rooftop Gusts

Every 3rd round is a **gust round**, telegraphed one round ahead ("The wind is rising…"). During a gust: heavy moves cost +8 stamina and their weight is ×1.3 (Dive Bomb included — gusts are when you can outpace him). Teaches planning around a rhythm; Pryce later weaponizes the same idea.

## Reads, Calls, Break

| Difficulty | Read rate | Leader Calls | Intent info |
|---|---|---|---|
| Normal | 0% | 0 | Full (stance + tier) |
| Hard | 15% | 1 ("Full power!") | Full |

Break bar: 2 on SKYLANCE only (debut size). Fills on player read-wins (counter/opening/dodge/clash-win). On Break: staggered + Fluid locked for 2 rounds ("wings tire") — his dodge game shuts off, the burst window is obvious.

## Player assumptions

Solo starter (lv-curve natural), prep phase shown before the fight (scout card: SPD 118 — FASTER, habit FLUID-heavy, plan: Guard-counter + strike on gusts), 1 potion (30% heal) on Normal, 0 on Hard. ★ Calls available (Catch Breath unlocked pre-gym).

## Sim targets (N / H), n ≥ 2000 seeded

| Archetype | Target win % |
|---|---|
| Static-guard | 55 / 45 |
| Brute (aggro-spam) | 25 / 18 |
| Naive triangle | 50 / 40 |
| Human-ish (30% err) | 80 / 70 |
| Stamina-reader + Call | 92 / 88 |

Gym 1 shape: the teacher, not the wall. Everyone who engages with the systems clears in ≤2 attempts; pure stat-checking (brute) is the only hard fail. Expected fight length 10–14 rounds vs ace.

## Tuning levers (in priority order)

1. SKYLANCE Fluid rate (40% ±10) — controls how punishing slow-aggression is
2. Dive Bomb weight (0.85 ±0.1) — controls timeline-lesson sharpness
3. Gust cadence (every 3rd ↔ 4th round) — controls burst-window frequency
4. GUSTLING chip damage — controls how much HP/stamina the warm-up taxes before the ace
