# Pilot Exit Decisions — v0.1

Three decisions that must lock before Sprint 1, because the renderer, content pipeline, and overworld architecture all build on them. Place in docs/, commit, and tell Claude Code to update CLAUDE.md's presentation section accordingly.

---

## 1. Art direction: "Silver's soul, not Silver's specs"

**Decision: 320×180 logical resolution, integer-scaled, pixel art under GBC design principles.**

Why 320×180: it is exactly ×6 = 1920×1080, so the most common display gets perfect integer scaling; 16:9 fits phones and desktops natively; it triples the GBC's working area so battle UI, intents, timeline, and prep cards stop fighting for pixels.

| Token | Rule |
|---|---|
| Logical canvas | 320×180, integer scale only, no smoothing |
| Tiles | 16px, camera-scrolled (20×11 visible + partials) |
| Battle mon sprites | up to 56×56 front, 40×40 back |
| Overworld characters | 16×16, 3-frame walk cycles |
| Master palette | one global 64-color ramp set ("SGB+") |
| Per-sprite discipline | ≤8 colors from master + dark outline (the GBC *principle*, kept) |
| Day/night | palette tint swap — Gen 2's clock soul, nearly free |
| UI | 4px grid, panel/ink style carried over from the demo |
| Shell | drop the handheld bezel; the game owns the screen now |

The demo's berry-pink GBC shell retires to the museum. The pixel style, panel language, and stance badges carry forward at the new scale.

---

## 2. The Dex: 151 originals — data-first, chapter-batched

**Core principle: a mon is a data row, not code.** The engine consumes `dex` data; adding species #87 never touches engine code. The sim can then fight the entire Dex against itself overnight — our balance methodology scales to a whole generation.

### Schema (one entry)

`id, name, types[], stats{hp,atk,dfn,spd}, archetype, learnset[{move,level}], evoLine{stage,evolvesTo,at}, dexEntry (2 lines), habitatTags[], encounterRarity, spriteRef`

> **Schema note (superseded by `evolution-design.md`):** `learnset[].level` is the **internal developmental band**, not a player-facing level (Argent shows no level number). `evoLine.at` is **NOT a level (16/34)** — replace it with the bond-gated/boss-capped pair **`{bondStage, progressGate}`** (whichever is satisfied second triggers the evo; cap lifts after 8 Johto badges). Update this schema when the dex slice is next touched.

### Archetype grid — design 151 by filling a matrix, not one-by-one

Stats come from archetype templates ± variance, so balance holds in bulk:

| Archetype | Identity | Stat shape |
|---|---|---|
| Dodger | Fluid; dodge-harvest | SPD↑↑, HP/DFN↓ |
| Wall | Guard; outlast | HP/DFN↑↑, SPD↓ |
| Counter-tank | Guard-counter engine | DFN↑, ATK mid |
| Brawler | Clash-winner | ATK↑, stamina-efficient |
| Glass nuke | Heavy/nuke tiers | ATK↑↑, HP↓ |
| Pacer | Stamina war | balanced, regen perk |
| Drainer | attacks foe stamina | mid stats (P1: needs engine hook) |
| Trickster | terrain/status play | mid stats (P1) |

151 mons ≈ **60 evolution lines** spread across types × archetypes. Naming rule: 4–9 chars, compound element+creature (EMBERCUB, SKYLANCE, FUZZLET pattern).

### Moves: shared pool, not per-mon

**~96 moves total**: per type ~5 (light/mid/heavy + 2 effect-flavored) + neutral set + signature moves reserved for starters and boss aces. Tier costs/weights stay canon; types and effects are data.

### Production order: the Dex follows the chapters

Never build 151 up front. Each chapter ships its local slice:

| Batch | Species | Contents |
|---|---|---|
| Chapter 1 | ~15 | starter lines (9), route bird/rodent/bug lines, Falkner's birds |
| Chapters 2–8 | ~12–15 each | local habitats + gym themes |
| E4/Kanto/legendaries | remainder | rares, cover legendaries, Mt. Silver |

### Sprites: the long pole — never block gameplay on art

Pipeline stages per species: (1) auto-generated placeholder silhouette from archetype shape + palette — playable day one; (2) pixel pass in chapter batches; (3) polish pass pre-release. Front + back + 24px dex icon per species. Decision on final art production (hand-pixel batches / artist / generated-then-cleaned) can wait until Chapter 2 — placeholders unblock everything.

Dex entries and lore: batch-written per chapter alongside the boss cards (2 lines each, habitat + one hook).

---

## 3. Overworld: a small kernel, data-driven maps

**Decision: maps are data (Tiled editor → JSON), the engine knows ~7 verbs.** Doors, signs, NPCs, and encounters are trigger objects in map data — never hardcoded scenes. "The list goes on" stays bounded because every interaction compiles down to the kernel verbs.

| Tier | Systems |
|---|---|
| P0 kernel (Sprint 3) | grid movement + collision, warps (doors/stairs/cave mouths), interactables (A on facing tile → dialog/script), encounter zones, script triggers (step-on, auto), camera follow, transitions |
| P1 | NPC walk paths + line-of-sight trainers, day/night tint, Phone 2.0 hooks, menus (party/dex/bag) |
| P2 | living-NPC AI, schedules, weather |

Tiled (free, standard) gives map editing with layers + object placement; Claude Code wires the JSON loader once.

---

## Revised sprint map

| Sprint | Deliverable | Spec source |
|---|---|---|
| 0 (now) | engine + sim ladders | KICKOFF-sprint-0 ✓ |
| 1 | renderer at 320×180: battle scene replaying engine events, panel UI, prep card | this doc §1 |
| 2 | Falkner vertical slice: full gym fight, Break bar, gust arena | falkner-boss-card.md |
| 3 | overworld kernel + Violet City/Route 31 slice (Tiled pipeline) | this doc §3 |
| 4 | dex pipeline + Chapter 1 species slice + catching | this doc §2 + chapter-1 dex doc |

Design-side deliverables feeding these (authored in claude.ai): Chapter 1 dex slice (15 species, full data rows), move pool v1, then boss cards onward.
