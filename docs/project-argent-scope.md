# PROJECT ARGENT — Scope v0.1

**Premise:** Pokémon Silver, rebuilt in 2026 by two people with a Fable-5-class AI on the cartridge and zero memory limits. Turn-based stays. Everything shallow goes.

**Tiers:** P0 = the game doesn't exist without it · P1 = the 2026 difference-makers · P2 = dream-tier

---

## Pillars

1. **Every battle is a puzzle, not a stat check**
2. **The world remembers you** — rival, leaders, NPCs run on real AI
3. **Preparation is gameplay** — scouting, ordering, loadouts are first-class mechanics
4. **Respect the player's time** — no grind, no HM tax, no missables

---

## What 2000 couldn't do → what we do

| 2000 constraint | 2026 answer |
|---|---|
| Kanto barely fit even after Iwata's compression miracle (Safari Zone cut, Cinnabar erased) | Full, uncut Kanto |
| Clock battery = simple day/night | Real NPC schedules, seasons, cycling events — nothing missable forever |
| Trainer AI = "pick the strongest move" | Fable-class opponents; difficulty = intelligence, never stat inflation |
| Spaceworld '97 map and species cut for space | Restored as a **Lost Dex** postgame region |
| GS was meant to be the *last* Pokémon game | Lean into the legacy theme: time, succession, Kanto three years later |

---

## Combat 2.0 (centerpiece)

Core stays: turn-based, 6v6, types/STAB intact.

| System | What it does | Why | Tier |
|---|---|---|---|
| **Action-speed turns** | Turn order is a visible timeline; heavy moves delay your next act, light moves come back sooner | Kills "Speed stat decides everything" | P0 |
| **Stamina replaces PP** | Move cost scales with power; regenerates on light turns; running dry = exhausted state | Spamming the nuke has a price; move variety matters | P0 |
| **Intent telegraphs** | Enemy intent fully visible on Normal, category-only on Hard, hidden on Champion | Prediction becomes learnable, then testable | P0 |
| **Real trainer AI** | Opponents predict, bait, sack, pivot; configurable ELO | A hard mode that is actually fair | P0 |
| **Boss mechanics** | Gym aces get phases, break bars, arena gimmicks; legendaries are raid-style fights | Set-piece fights, not stat-inflated trainers | P0 |
| **Pulled forward** | Abilities (visible), natures (trainable, not RNG), expanded held items | Build depth without RNG slavery | P0 |
| **Stances** | Aggressive / Guard / Fluid declared with your move; soft read layer vs enemy stance | Adds prediction skill without grids or reflexes | P1 |
| **Pivot token** | One free switch per battle that dodges the incoming move on a correct read | Switch prediction as explicit skill expression | P1 |
| **Field state** | Weather, terrain, hazards interact and chain | Board state worth fighting over | P1 |
| **Doubles / rotation ladders** | Alternate formats in postgame ladder only | Campaign stays singles, Silver's soul | P2 |

---

## Prep Phase (before every gym / E4 / rival fight)

| Element | Detail | Tier |
|---|---|---|
| **Scout report** | Leader's roster, ace, known patterns — earned via gym trainers and phone contacts; intel is a currency | P0 |
| **Order screen** | Drag team order; slot-1 matchup preview against their lead | P0 |
| **Loadout** | Held items + stamina plan locked before entry | P0 |
| **Mirror rule** | On Hard+, leaders scout *you* — they've watched your last 3 badges and adapt their team | P1 |
| **Instant retry** | Boss loss drops you straight back into Prep, no walk of shame | P0 |

---

## AI on the cartridge

| Feature | Behavior | Tier |
|---|---|---|
| **The Rival** | Remembers every battle against you; retools his team to counter your core; dialogue generated inside authored arc beats (theft → redemption) | P0 |
| **Living NPCs** | Real schedules (work, home, weekends), remember your actions, gossip propagates between towns | P1 |
| **Phone 2.0** | Contacts hold actual conversations, give true intel, generate sidequests with real rewards | P1 |
| **Battle coach** | Post-match analysis: the misplay, the line you missed (toggleable) | P1 |
| **Naturalist Dex** | Entries written from *your* observations — where caught, behaviors seen | P2 |
| **Radio** | Generated shows reference your actual run; news covers your badge wins | P2 |

---

## World & content

| Item | Scope |
|---|---|
| Regions | Johto + full Kanto (Safari Zone, Viridian Forest, Seafoam, a pre-eruption Cinnabar arc) |
| Roster | 251 original species, Gen-2 silhouette language; every line completable in one save; full balance pass — no dead weight |
| Clock | Real-time day/night/week + seasons; everything cycles, nothing permanently missable |
| Story | The legacy theme played straight; Mt. Silver as the thesis statement |

---

## Endgame & modes

| Mode | Description | Tier |
|---|---|---|
| **Mt. Silver superboss** | The Red-equivalent, full boss-mechanics fight | P0 |
| **The Gauntlet** | Roguelike node-map draft run: catch / trade / event / elite nodes, **forced trades**, permadeath, weekly seed | P1 — first post-launch priority |
| **Rematch ladder** | Leaders and E4 scale with real teams; full Prep Phase on both sides | P1 |
| **Nuzlocke-native** | Built-in ruleset toggles (permadeath, first-encounter, level caps) with run tracking | P1 |
| **Challenge seals** | Run modifiers (no items, monotype, half stamina) with leaderboards | P2 |

---

## Tedium kills (all P0)

- No HMs — field abilities are innate if any party member could learn the move
- Box access anywhere; Set mode default on Hard+
- Party XP share with per-mon toggle + optional level-cap mode: no grinding needed, no overleveling possible
- IVs gone; EVs visible and directly trainable
- Battle speed ×1 / ×2 / ×4; reusable TMs; free move relearner

---

## Non-goals

- **Not open world** — authored route order with gates is the point; Kanto's any-order 8 badges is the one controlled exception
- **No action combat** — depth comes from decisions, not reflexes
- **No roster bloat** — 251, each one viable
- **No online requirement, no monetization hooks** — the AI lives on the cartridge

---

## Build order

| Milestone | Contents |
|---|---|
| **M1 — Vertical slice** | Violet City arc: action-speed turns, stamina, intents, trainer AI, Prep Phase v1, first gym boss fight |
| **M2 — Johto** | 8 gyms, full rival AI loop, Phone 2.0, Elite Four |
| **M3 — Kanto** | Full Kanto, rematch ladder, Mt. Silver |
| **M4 — Endgame** | The Gauntlet, Lost Dex region, challenge seals |
