# KICKOFF — Type System Canon Lock (17-type roster)

**Type:** foundational data/doc reconciliation (rename + 4-type expansion + identity
assignment). Closes BUILD-ROADMAP Phase 6.7-C.
**Risk:** nearly everything references the type table — done carefully, grep-clean,
ladders confirmed bit-identical. Content questions FLAGGED, not invented.

## The final 17 (canonical)

BASIC(Normal) · FLAME(Fire) · AQUA(Water) · NATURE(Grass) · SPARK(Elec) ·
FROST(Ice) · BRAWN(Fighting) · VENOM(Poison) · TERRA(Ground) · GALE(Flying) ·
PSI(Psychic) · INSECT(Bug) · STONE(Rock) · SPIRIT(Ghost) · DRAKE(Dragon) ·
UMBRA(Dark) · FORGE(Steel)

## What shipped

**Renames (repo-wide, word-boundary; SPROUTLE + legacy fixtures untouched):**
FIELD→BASIC · VOLT→SPARK · SPLASH→AQUA · SPROUT→NATURE. (VENOM/SPIRIT/TERRA/FLAME/
FROST/BRAWN/GALE/DRAKE/FORGE unchanged.) Applied to `typechart.json`,
`ch1-batch.json`, `mon-manifest.csv`, `ch1-batch-sheet.md`, **`moves.json` (move
TYPE fields — critical: move.type feeds the effectiveness lookup)**, `sprites.ts`
(type→color map), `maps/*.json` + `intro.test.ts` (starter dialog), and all design
docs. The move `VOLT LASH` → `SPARK LASH` (unused by any mon).

**4 new types added** (PSI/INSECT/STONE/UMBRA): each gets a row+column in
`typechart.json` (13×13 → 17×17) and a damage trio in `move-pool.md`.

**Identities locked** in `combat-depth-types-status.md` (build later with status):
BASIC neutral-floor · FLAME Burn · AQUA Recover · NATURE Drain · SPARK Daze · FROST
Frozen · BRAWN Taunt+Daze · VENOM Drained · TERRA Stunned · GALE TERRA-immune
glass-cannon · PSI Inception · **INSECT Sap (NEW)** · **STONE Brace (NEW)** ·
**SPIRIT Shrouded** · DRAKE Daunt · **UMBRA Doubt** · FORGE tank.
**SPIRIT (Ghost) and UMBRA (Dark) are now SEPARATE** — SPIRIT=Shrouded (hide own
intent), UMBRA=Doubt (attack the bond). The doc that conflated them is fixed.

## Chart integrity (verified)

- The existing **13×13 sub-grid is byte-identical** under rename (generator asserted
  169/169 cells via strict equality before writing).
- Starter triangle **FLAME>NATURE>AQUA>FLAME** holds (all 1.3); **DRAKE neutral to
  NATURE/AQUA** both directions holds.
- Only the 4 new types add rows/cols. They're **inert** (no mon carries them) — zero
  sim impact.

## Sim gate

- A consistent key-rename is mathematically bit-identical. **Confirmed empirically:**
  all 15 Falkner cells reproduce their pre-rename win% exactly (e.g. KINDRAKE/brute
  167/2000 = 8.35%); rival ladder unaffected (legacy fixtures); ch1Batch green.
- (The critical catch: `moves.json` move TYPES had to be renamed too — otherwise
  move.type lookups fell back to neutral against the renamed chart, silently
  breaking effectiveness. Bands had masked it; fixed and re-verified.)

## ⚠️ FLAGGED for Mathias — approve / adjust

**(1) The 4 new types' move-trio names** (PROPOSED in `move-pool.md`; pick one):
- PSI: `MIND JAB / PSY PULSE / MIND CRUSH` · alt `KINESIS / MIND WARP / PSYBURST`
- INSECT: `STING / BUG BITE / SWARM RUSH` · alt `SKITTER / PINCER / SWARM CRUSH`
- STONE: `SHARD FLICK / STONE EDGE / BOULDER CRASH` · alt `PEBBLE SPIT / CRAG SMASH /
  ROCKFALL` (must stay distinct from TERRA's PEBBLE SHOT/ROCK MAUL/QUAKE STOMP)
- UMBRA: `SHADE NIP / DARK LASH / NIGHT CRUSH` · alt `SPITE / FERAL BITE / NIGHTMAW`

**(2) The 4 new types' type-chart matchup rows/columns** (PROPOSED, Gen-2-mapped to
the gentle [0.7,1.3] band; in `typechart.json` now, inert; full list in
`type-chart.md` "Proposed new-type matchups"):
- PSI att: S vs BRAWN, VENOM; r by PSI, FORGE, UMBRA.
- INSECT att: S vs NATURE, PSI, UMBRA; r by FLAME, BRAWN, VENOM, GALE, SPIRIT, FORGE.
- STONE att: S vs FLAME, FROST, GALE, INSECT; r by BRAWN, TERRA, FORGE.
- UMBRA att: S vs PSI, SPIRIT; r by BRAWN, UMBRA, FORGE.
- (Defender columns derived symmetrically — see `type-chart.md`.)

**(3) Two pre-existing chart notes flagged for the same review:** the GALE-immune-to-
TERRA *identity* vs the chart's TERRA→GALE=1.3; and the "no immunities" rule (Gen-2
zero-matchups mapped to 0.7, not 0).

**(4) Starter dialog** now says "NATURE"/"AQUA" (was "SPROUT"/"SPLASH") for grep-clean
consistency — flavor wordsmithing optional (e.g. lab.json "That NATURE of yours —").

## Gate (done when)

Old names grep-clean ✅ · 4 new types in move-pool (trios flagged) + typechart (matchups
flagged) ✅ · identities recorded, SPIRIT/UMBRA separated ✅ · existing 13×13 unchanged
(169/169) ✅ · starter triangle holds ✅ · naming note → resolved ✅ · ladders
bit-identical ✅ · tests + build green ✅.
