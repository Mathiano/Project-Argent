# Project Argent — World Scope Skeleton ("Perfect Silver 2.0")

**Status:** the master content-scoping doc. Bounds the world's SHAPE and SIZE so downstream work (trainer profiles, environments, mon distribution, sprites, the difficulty curve) has a target. Structure is COMMITTED; Chapter 1 is DETAILED; later regions are bounded PLACEHOLDERS (built as we go). Cross-ref trainer-combat-profiles, the trainer-archetype-catalog (TODO), mon-manifest.csv, combat-enrichment-roadmap (environments/Layer 3), the-concord.

## The pitch / scope vs Silver
**"Perfect Silver 2.0"** — a TIGHT mirror of Johto in STRUCTURE (8 gym cities, Elite Four, Champion, Kanto post-game), but with:
- **More DEPTH per area** than Silver — sub-areas, side activities, richer cities, more to DO. (The scope delta vs Silver: same skeleton, more meat.)
- **Best-of-Gen-1-4 BIOMES** — Silver's areas UPGRADED by borrowing the best version of each idea from across the franchise (a fuller frozen region; a volcano WITH hot springs à la Ruby/Sapphire; etc.). Curated proven ideas, unified into one cohesive world.
- **Original geography/cities/story** within the Johto-shaped container — full creative freedom over WHAT'S in it; the container just bounds HOW BIG.

## Committed STRUCTURE (the bounded container)
- **8 GYM CITIES** (the backbone — 8 gyms, 8 badges, the progression spine).
- **Routes + towns + landmarks** connecting them (roughly Johto-sized: the structure is the scoping bound).
- **ELITE FOUR** journey → **CHAMPION** (the main-arc climax).
- **KANTO** as post-game (built AFTER all of Johto is done — a known expansion, not now).
- **THE ANIME CHAMPIONSHIPS** — the bond-thesis CAPSTONE (see below).

## THE ANIME CHAMPIONSHIPS — the thematic destination (a real pillar, not filler)
The game's entire thesis is BONDS OVER STRENGTH (bond system, Calls, the Concord's no-true-ceiling manufactured loyalty, the "your mon steps in front of you" opening). The anime's Pokémon League/Championships are THEMATICALLY about exactly that — the relationship between trainer and mon as the thing that wins (the underdog who wins through connection, not raw power).
- So the Championships are the MECHANICAL + THEMATIC PAYOFF of everything: the gyms TEACH the system, the Elite Four TESTS mastery, the Championships PROVE that earned bond is the highest ceiling.
- **Contrast with the Concord:** Concord = manufactured loyalty, no true ceiling-breaker. The Championships = earned bond, the highest ceiling. The endgame literally demonstrates the thesis.
- Structural placement (post-game vs main-arc tail) is TBD, but its THEMATIC weight is central — treat it as a destination the whole game builds toward, not a bonus mode.

## BIOMES (derived from mon batches + earn-their-slot for combat)
Each biome must (a) house mons we're making (the mon batches imply required homes) AND (b) make a distinct COMBAT ENVIRONMENT (a terrain tilt — Layer 3). Biomes earn their slot by serving BOTH.
- **REQUIRED (from the mon batches):** the biomes our created mons need homes in — incl. a HOT/VOLCANO region (+ hot springs, Ruby/Sapphire-style) and a FROZEN MOUNTAIN region (built out FULLER than Silver's). [Full list to derive from mon-manifest.csv batches.]
- **Best-of-franchise upgrades:** pull the best version of each biome's IDEA from Gen 1-4 (the richest ice zone, the volcano+springs, the best cave/forest/water ideas).
- **Nice-to-have biomes (e.g. Jungle):** include ONLY if they (a) house mons we want to make AND (b) create a distinct combat-terrain feel. Earn-their-slot — don't add biomes that serve neither.
- Each biome → a combat ENVIRONMENT (Layer 3 terrain tilt) + a trainer-terrain-affinity (trainers there play to the terrain — a frozen-region trainer avoids Brace, etc.).

## DETAILED — Chapter 1 (the part we know + are building)
- **HEARTHWICK** (home town — bedroom/house, the lab + starter ceremony, KAMON theft).
- **ROUTE 31** (the JAY robber / bond-saves-your-mon hook; the first trainers — being wired now in Layer 4 Stage 1).
- **VIOLET** (first gym city — center, mart).
- **THE GYM** (Falkner / ZEPHYR badge — Gale/flying; the first real combat test; now Focuses in Layer 4).
- Trainers here: the Stage-1 profiled set (a Balanced route trainer, an Aggressor, Falkner). Mons here: the 15 CH1 playable species (ch1-batch.json).
- This is the proven vertical slice — end-to-end completable.

## PLACEHOLDERS — later regions (bounded, sketched, built as we go)
- **Gyms 2-8:** 7 more gym cities, each with its biome/environment, trainer archetypes, and gym leader. TBD geography/theme/leader — but BOUNDED (we know there are 7 more, Johto-sized).
- **The biome assignments:** map the required biomes (volcano, frozen, etc.) onto the gym-city regions as the world's geography is decided.
- **Elite Four + Champion:** bespoke elite trainers (unreadable, hard — see the archetype catalog's elite tier).
- **The Championships:** the bond-thesis capstone arena.
- **Kanto:** post-game, after Johto is complete.
- These are SKETCHED (bounded scope) not DETAILED (specifics decided as each region is built).

## How this scopes the other work
- **Trainer profiles:** count = the distinct ARCHETYPES across all areas (templated, readable — Youngster/Bug Catcher/etc.) + the BESPOKE elites (gym leaders' high end, Elite Four, Champion, Concord). The archetype catalog (TODO) enumerates these; this skeleton bounds how many areas they populate.
- **Environments (Layer 3):** count = the distinct biomes (each a terrain). The biome list bounds it.
- **Mon distribution:** which mons appear in which biome/area (ties mon-manifest.csv to geography).
- **Trainer sprites:** one per archetype + bespoke elites.
- **Difficulty curve:** areas are ORDERED (gym 1→8→E4→Champion→Championships) → profile complexity + environment + info-discipline ramp with progression (Layer 3.5: opponents hide more post-gym-1).

## Cross-ref
trainer-combat-profiles (the 7-dimension profiles), trainer-archetype-catalog-TODO (class→sprite→profile→mons, incl. the archetype-vs-elite two tiers), mon-manifest.csv (the roster + biome homes), combat-enrichment-roadmap (environments/Layer 3 + info-warfare/Layer 3.5), the-concord (the thematic foil to the bond endgame).
