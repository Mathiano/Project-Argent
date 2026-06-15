# Move Pool v1 (CANON) — 43 moves, all damage-tier; effect moves deferred to P1

Tier canon (already engine law): light 12 ST / w0.85 · mid 22 / w1.0 · heavy 35 / w1.15 · nuke 55 / w1.30. Type multiplier from `typechart.json` applies after stance modifiers. Machine-readable: `moves.json`.

> **"Level" / "level band" below = the INTERNAL developmental band, not a player-facing level** (Argent shows no level number). It paces base-moveset unlocks only. **Evolution is bond-gated + boss-capped — NOT level 16/34** (see `evolution-design.md`); signature/coverage moves are bond-gated (see `bond-track-v2.md`).

## Naming law
1–2 words, ALL CAPS, element + strike-verb pattern (EMBER SNAP, DIVE BOMB). Demo-era names are grandfathered in where listed.

## Neutral set (typeless — every species' floor)

| Move | Tier |
|---|---|
| TACKLE | light |
| SCRATCH | light |
| HEADBUTT | mid |
| HEAVY SLAM | heavy |

## Typed damage trios (light / mid / heavy)

| Type | Light | Mid | Heavy |
|---|---|---|---|
| FLAME | CINDER FLICK | EMBER SNAP | FLAME RUSH |
| SPROUT | THORN FLICK | LEAF LASH | VINE SLAM |
| SPLASH | RIPPLE CUT | BUBBLE JET | TIDE CRASH |
| FIELD | PAW JAB | BODY SLAM | STAMPEDE |
| GALE | GUST RAKE | WING CUT | DIVE BOMB |
| VENOM | VENOM BARB | TOXIN FANG | SLUDGE BURST |
| TERRA | PEBBLE SHOT | ROCK MAUL | QUAKE STOMP |
| VOLT | SPARK JAB | VOLT LASH | STORM CRASH |
| FROST | FROST NIP | ICE LANCE | GLACIER RAM |
| SPIRIT | WISP TAP | HAUNT CLAW | SOUL REND |
| BRAWN | QUICK JAB | ROUNDHOUSE | MOUNTAIN FIST |
| FORGE | IRON FLICK | STEEL BASH | ANVIL DROP |
| DRAKE | FANG RAKE | DRAKE CLAW | WYRM FURY |

## Reserved tiers

- **Nukes (55 ST)**: never pool moves. Reserved for stage-3 starter signatures, boss aces, and legendaries — authored individually on boss cards / batch sheets. (DIVE BOMB stays heavy; GALEHAWK's gym-fight identity comes from GUSTBORNE + the gust rhythm, per the Falkner card.)
- **Effect moves (status/terrain/drain, 8 ST class)**: P1, blocked on engine hooks (status states, terrain flags, stamina-attack). Two per type are budgeted in the ~96-move final pool; Drainer/Trickster archetypes run on template stats until then. **The status/effect design that fills this hole is now locked: `docs/combat-depth-types-status.md`** (per-type mechanical identity + the deterministic status economy; build Phase 6-8).
- ⚠️ **Type-name drift (reconcile — its own cleanup, BUILD-ROADMAP Phase 6.7-C):** this table + `typechart.json` use `FIELD/VENOM/VOLT/SPIRIT`; the newer `combat-depth-types-status.md` uses `TOXIN/SPARK/UMBRA` (for VENOM/VOLT/SPIRIT) and adds **PSI**. Clean renames: VENOM→TOXIN, VOLT→SPARK, SPIRIT→UMBRA. **Unresolved:** `FIELD` ↔ `PSI` is a set mismatch, not a rename (TERRA is unchanged in both). Don't rename mid-other-work; docs win but flag the FIELD/PSI call first.

## Learnset derivation template (per slot — batch sheets apply this mechanically)

| Stage | Levels |
|---|---|
| Stage 1 | L1: TACKLE + type light · L7: type mid · L13: HEADBUTT |
| Stage 2 (evo ~16) | inherits · L16: type heavy · L24: second neutral or type2 mid |
| Stage 3 (evo ~34) | inherits · L34: signature/nuke slot (authored) · L40: type2 heavy if dual |

Archetype nudges: Brawler/Glass nuke learn their heavy 3 levels early; Wall/Pacer 3 levels late (stamina curve protection); singles (no evolution) compress the whole ladder by stage band. Dual-types swap one neutral for the second type's trio entries.

## Validation hooks
Batch sim runs use derived learnsets at the encounter's level band — a mon whose available kit can't afford its own stamina curve at its band (softlock-prone) gets flagged automatically by the existing exhaustion-rate stat.
