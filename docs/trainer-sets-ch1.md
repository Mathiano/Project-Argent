# CH1 Trainer Sets — the trainer-data hand-off (Route 31 + Violet)

**Status:** the trainer-data hand-off CC was holding for. Stamps the catalog's FLOOR profiles onto CH1's classes, fielding the CH1 mon pool. Engine is built + sim-gated (Layer 4 continued) — these are **pure data to wire**. Cross-ref `trainer-archetype-catalog.md` (the profiles), `monmanifest.csv` (CH1 pool), `opening-design.md` (the CH1 flow), `falkner-boss-card-v2.md` (Falkner's build).

## Scope + rules
- **Generic trainers only.** **KAMON** (rival), **JAY** (Route-31 robber), and **Falkner** are bespoke and already in the system — referenced here, not respecced. *CC: don't re-author them.*
- **Floor tier = Single-only.** Every generic CH1 trainer is a floor stamp: no two-step, no-bond (no Calls), Open info, Fixed, no terrain. The only fixed-Heavy focusers in CH1 are the bespoke JAY + Falkner (the player's two-step intro). **Variable release starts Gym 2 — nothing here mixes Feint.**
- **Names are ⟨placeholder⟩** (per opening-design's rename pass; only KAMON is locked).
- **Levels are suggested bands** — CC tunes to the curve and sim-gates the set against the reader.
- **Existing vs new** is marked — the youngster + lass are already wired (migrated to the 8-knob schema); the rest are new stamps to add.
- **CH1 pool is intentionally tiny** — L008 (GALE), L023 (TERRA·Trickster), L027 (SPLASH·Brawler). Differentiation comes from the **profiles**, not the roster: the same three lines produce three distinct fight-feels (Greenhorn reads clean, Bruiser punishes passivity, Skirmisher first-strikes). That *is* the catalog working — and the proof the slice needs.

## ROUTE 31 (Hearthwick → Violet) — lv ~6–10
| Trainer | Class | Profile | Mons (line·stage, ~lv) | Status |
|---|---|---|---|---|
| ⟨existing youngster⟩ | Youngster | GREENHORN | L027·1 (lv6) | existing |
| ⟨existing lass⟩ | Lass | GREENHORN | L023·1 (lv6) | existing |
| ⟨Rourke⟩ | Camper | BRUISER | L027·1 (lv8) | new |
| ⟨Wren⟩ | Bird Keeper | SKIRMISHER | L008·1 FLITPECK (lv8) | new |
| ⟨Pax⟩ | Youngster | GREENHORN | L023·1 (lv9) + L027·1 (lv9) | new |
| **JAY** | — (robber) | **bespoke** — fixed-Heavy focus, the bond-saves-your-mon beat | *(already built)* | bespoke |

## VIOLET CITY — lv ~9–10  *(light — the Academy coach is a deferred one-off)*
| Trainer | Class | Profile | Mons (line·stage, ~lv) | Status |
|---|---|---|---|---|
| ⟨Dell⟩ | Schoolkid | GREENHORN | L023·1 (lv10) | new (optional) |

## VIOLET GYM — ZEPHYR badge, Gale — lv ~10–13
| Trainer | Class | Profile | Mons (line·stage, ~lv) | Status |
|---|---|---|---|---|
| ⟨Skye⟩ | Bird Keeper | SKIRMISHER | L008·1 FLITPECK (lv11) | new (gym chaff) |
| ⟨Gust⟩ | Bird Keeper | SKIRMISHER | L008·1 FLITPECK (lv11) ×2 | new (gym chaff) |
| **FALKNER** | Gym Leader | **bespoke** DUELIST (Evader/Gale) + fixed-Heavy gust overlay | ace GALEHAWK L008·2 *(see boss card)* | bespoke |

## CC wiring notes
- **GREENHORN already exists** (it's the youngster's profile generalized). **Define BRUISER + SKIRMISHER from `trainer-archetype-catalog.md`** (floor versions — Aggressor/Single-only and Evader/Single-only respectively), then stamp.
- Stamp the named profile onto each generic trainer — pure data; the 8 knobs come from the profile.
- Mons by line ID + stage; levels per the suggested bands, tuned to the curve.
- All generic CH1 = Single-only floor — the two-step branch never fires for them.
- **Sim-gate the new generic trainers + gym chaff** against the reader (fair-but-distinct, in band) before sign-off.
- KAMON / JAY / Falkner unchanged.

## What this unlocks
The first end-to-end-populated slice: Hearthwick → a Route 31 of *distinct* generic fights → Violet → a gym with chaff + Falkner. Every fight in CH1 is now a real profile (not the old random wild stub), and the floor tier is proven in place — the precondition for opening Gym 2 (where variable release + the mid-tier profiles come in).
