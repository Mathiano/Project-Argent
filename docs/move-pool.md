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
| NATURE | THORN FLICK | LEAF LASH | VINE SLAM |
| AQUA | RIPPLE CUT | BUBBLE JET | TIDE CRASH |
| BASIC | PAW JAB | BODY SLAM | STAMPEDE |
| GALE | GUST RAKE | WING CUT | DIVE BOMB |
| VENOM | VENOM BARB | TOXIN FANG | SLUDGE BURST |
| TERRA | PEBBLE SHOT | ROCK MAUL | QUAKE STOMP |
| SPARK | SPARK JAB | SPARK LASH | STORM CRASH |
| FROST | FROST NIP | ICE LANCE | GLACIER RAM |
| SPIRIT | WISP TAP | HAUNT CLAW | SOUL REND |
| BRAWN | QUICK JAB | ROUNDHOUSE | MOUNTAIN FIST |
| FORGE | IRON FLICK | STEEL BASH | ANVIL DROP |
| DRAKE | FANG RAKE | DRAKE CLAW | WYRM FURY |
| **PSI** ⚠ | MIND JAB | PSY PULSE | MIND CRUSH |
| **INSECT** ⚠ | STING | BUG BITE | SWARM RUSH |
| **STONE** ⚠ | SHARD FLICK | STONE EDGE | BOULDER CRASH |
| **UMBRA** ⚠ | SHADE NIP | DARK LASH | NIGHT CRUSH |

⚠ **The 4 new types' (PSI/INSECT/STONE/UMBRA) trio names are PROPOSED — pending Mathias's pick.** Alternatives offered for approval (see KICKOFF-type-system-canon.md / audit): PSI = MIND JAB/PSY PULSE/MIND CRUSH **or** KINESIS/MIND WARP/PSYBURST · INSECT = STING/BUG BITE/SWARM RUSH **or** SKITTER/PINCER/SWARM CRUSH · STONE = SHARD FLICK/STONE EDGE/BOULDER CRASH **or** PEBBLE SPIT/CRAG SMASH/ROCKFALL (must stay distinct from TERRA's PEBBLE SHOT/ROCK MAUL/QUAKE STOMP) · UMBRA = SHADE NIP/DARK LASH/NIGHT CRUSH **or** SPITE/FERAL BITE/NIGHTMAW. These are doc-only; no moves.json entries until a mon carries the type.

## Reserved tiers

- **Nukes (55 ST)**: never pool moves. Reserved for stage-3 starter signatures, boss aces, and legendaries — authored individually on boss cards / batch sheets. (DIVE BOMB stays heavy; GALEHAWK's gym-fight identity comes from GUSTBORNE + the gust rhythm, per the Falkner card.)
- **Effect moves (status/terrain/drain, 8 ST class)**: P1, blocked on engine hooks (status states, terrain flags, stamina-attack). Two per type are budgeted in the ~96-move final pool; Drainer/Trickster archetypes run on template stats until then. **The status/effect design that fills this hole is now locked: `docs/combat-depth-types-status.md`** (per-type mechanical identity + the deterministic status economy; build Phase 6-8).
- ✅ **Type names: RESOLVED — 17-type canon (2026-06-15).** This table, `typechart.json`, `ch1-batch.json`, `mon-manifest.csv` and `combat-depth-types-status.md` all use the canonical 17 (BASIC/FLAME/AQUA/NATURE/SPARK/FROST/BRAWN/VENOM/TERRA/GALE/PSI/INSECT/STONE/SPIRIT/DRAKE/UMBRA/FORGE). Renames applied: FIELD→BASIC, VOLT→SPARK, SPLASH→AQUA, SPROUT→NATURE. PSI/INSECT/STONE/UMBRA are the 4 new types (trios above, ⚠ PROPOSED). See `combat-depth-types-status.md` for identities, `type-chart.md` for the matchup grid.

## Learnset derivation template (per slot — batch sheets apply this mechanically)

| Stage | Levels |
|---|---|
| Stage 1 | L1: TACKLE + type light · L7: type mid · L13: HEADBUTT |
| Stage 2 (evo ~16) | inherits · L16: type heavy · L24: second neutral or type2 mid |
| Stage 3 (evo ~34) | inherits · L34: signature/nuke slot (authored) · L40: type2 heavy if dual |

Archetype nudges: Brawler/Glass nuke learn their heavy 3 levels early; Wall/Pacer 3 levels late (stamina curve protection); singles (no evolution) compress the whole ladder by stage band. Dual-types swap one neutral for the second type's trio entries.

## Validation hooks
Batch sim runs use derived learnsets at the encounter's level band — a mon whose available kit can't afford its own stamina curve at its band (softlock-prone) gets flagged automatically by the existing exhaustion-rate stat.
