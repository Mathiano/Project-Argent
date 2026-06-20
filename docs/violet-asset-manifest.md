# Violet City — Asset Manifest & Atlas Spec (the beauty-proof art brief)

**Status:** PREP for the Violet Layer-1/Layer-3 beauty proof (`visual-north-star.md`). **No art, no swap this pass** — this is the inventory + the format contract every authored replacement must match, plus the reusable-vs-bespoke split and the swap checklist. Extracted from `src/game/maps/violet.json` + `assets/tilesets/outdoor_violet.tileset.json` (+ the interior `violet_academy.json`).

**The discipline (why this is safe):** every item below is a **data swap** on the existing data-driven engine — tileset JSON, prefab JSON, sprite sheets. No engine edits, no layout change. The map's tile *ids*, footprints, warps, spawns, and objects stay byte-stable; only the *pixels behind the ids* change. The current set is placeholder art that already proves the pipeline end-to-end (`tileset-format.md`).

---

## 0. The authoring format contract (what EVERY replacement must match)

| Asset class | Format the authored art must match |
|---|---|
| **Tile** | 16×16 px. Delivered in the tileset JSON as `rows` (16 strings × 16 chars) **or** a flat `pixels` string (256 chars). Char→color via the tileset `palette` (keys `0-9` then `a-z`; `' '` and `'.'` = transparent). Loader validates dims at load → a typo fails the page, never renders black. |
| **Palette** | One shared indexed palette declared per tileset JSON. Target = the **64-color master palette** (`visual-north-star.md`); the current placeholder declares **22** entries (keys `0–l`). Keep ONE cohesive Violet palette across the whole area set so tiles/props/buildings read as one place. |
| **Prefab (building)** | `assets/prefabs/<name>.prefab.json`: `width`, `height`, `anchor` (the cell that lands on the map's (x,y) — by convention the **door**), `tiles` grid of tile-ids, optional `collision` override grid. Redesign a building = edit one prefab; every map using it updates. |
| **Map** | `violet.json` is **frozen for the swap** — do not touch `cells`, `tileMap`, `objects`, `spawns`, `width/height`. (A redesign *may* migrate inline building footprints into `prefabs[]` — see §2 — but that's an opt-in structural change, separately reviewed.) |
| **Overworld character (NPC/player)** | 16 px wide cell, directional walk frames (3–4 per `visual-north-star.md` Layer 3). Engine hook (per `overworld.ts`): a **16×48 spritesheet JSON in the tileset format, frames read by id**. Today NPCs render as a flat 16px color marker; the player is drawn procedurally. |
| **Creature sprite (mon)** | Already solved by the Gemini pipeline (`sprite_ingest.py`): 48–56px native, front/back/icon, palette-quantized + outlined. Out of scope here except where a mon appears overworld (e.g. the feeder's FLITPECK), which renders in a 16px slot. |
| **Sign marker** | A `sign` object currently renders as a 2×4 gold tick. Authored upgrade = a real `sign_post` tile (already in the atlas, 16×16) placed under the object, or a per-sign prop tile. |

**Current placeholder palette (22 — `outdoor_violet`):**
`0`#0f1a14 `1`#1d4a26 `2`#3a6a32 `3`#6cad4f `4`#9ad470 `5`#c8e89a `6`#5a4128 `7`#8c6240 `8`#b08660 `9`#3a302a `a`#6c5a48 `b`#9c8a78 `c`#2a4a78 `d`#4880c0 `e`#88c0e8 `f`#caa148 `g`#7a3e0c `h`#d8c08a `i`#a78b54 `j`#1a1a22 `k`#7c4fa8 `l`#dde3c0

---

## 1. Tile inventory (18 distinct tiles Violet uses)

All 16×16. **R** = reusable temperate foundation (shared by every later town), **V** = Violet-bespoke (this city's identity). Tile id = the key in `outdoor_violet.tileset.json`; map char = the `tileMap` key in `violet.json`.

### 1a. Terrain foundation — REUSABLE
| Tile id | char | solid | role | split |
|---|---|---|---|---|
| `grass` | `.`/base | no | baseTile, fills the whole map | **R** |
| `path` | `p` | no | dirt walkways (the winding lanes) | **R** |
| `water` | `w` | yes | the valley below the lookout (already 2-frame animated) | **R** |
| `tree` | `T` | yes | the perimeter wall + clusters | **R** |

### 1b. Building shell kit — REUSABLE (material-tintable)
| Tile id | char | solid | role | split |
|---|---|---|---|---|
| `roof_l` | `N` | yes | house roof, left edge | **R** |
| `roof_m` | `M` | yes | house roof, mid | **R** |
| `roof_r` | `O` | yes | house roof, right edge | **R** |
| `wall_door` | `D` | no | house/Center/Mart doorway | **R** |

### 1c. Violet material identity — VIOLET-BESPOKE
| Tile id | char | solid | role | split |
|---|---|---|---|---|
| `plaster` | `B` | yes | **the Violet skin** — Center/Mart/house walls ("the colour of morning"). The per-city material slot (cf. Azalea plank, Goldenrod brick). | **V** |

### 1d. The Academy ancient-stone set — VIOLET-BESPOKE
| Tile id | char | solid | role | split |
|---|---|---|---|---|
| `academy` | `A` | yes | ancient weathered-stone wall, sky/wind motif carved in (the centerpiece) | **V** |
| `academy_door` | `C` | no | stone archway (enterable core) | **V** |

### 1e. The gym — REUSABLE GYM-KIT (ruled 2026-06-21; rides to every gym)
Author once; Falkner's gym is just the first instance. Per-gym identity later is a tint/banner pass, not a re-author.
| Tile id | char | solid | role | split |
|---|---|---|---|---|
| `gym_facade_l` | `h` | yes | gym wall, left edge | **R** (gym-kit) |
| `gym_facade_m` | `g` | yes | gym wall, mid | **R** (gym-kit) |
| `gym_facade_r` | `j` | yes | gym wall, right edge | **R** (gym-kit) |
| `gym_door` | `G` | no | gym entrance | **R** (gym-kit) |

### 1f. Detail / props (as tiles) — mixed
| Tile id | char | solid | role | split |
|---|---|---|---|---|
| `statue` | `S` | yes | the founding-pair monument (signature landmark) | **V** |
| `bell` | `E` | yes | the old Academy bell | **V** |
| `fence` | `F` | yes | the lookout railing | **R** (generic railing) |

### 1g. In the atlas but NOT used by Violet (shared foundation, available)
`tall_grass` (R, encounter), `wall_brick` (R), `cave_rock` (R), `cave_mouth` (R), `forest_floor` (R), `sign_post` (R — the authored home for `sign` objects).

---

## 2. Prefab / building inventory (footprints)

Violet currently **inlines** its buildings via `tileMap` footprints (not via the registered prefabs). Footprints below are read straight from `violet.json` `cells`. A redesign may either restyle the underlying tiles (zero structural change) **or** migrate these into `prefabs[]` (door = anchor) for reuse — recommended for the houses + the gym.

| Building | Footprint (W×H) | Door / anchor | Tiles used | split |
|---|---|---|---|---|
| **Academy** | **9×6** (cols 9–17, rows 22–27) | `academy_door` at (13,22), north face | `academy`, `academy_door` | **V** — the largest structure, the centerpiece |
| **Gym (Falkner)** | 5×2 (cols 7–11, rows 12–13) | `gym_door` at (9,12) | `gym_facade_l/m/r`, `gym_door` | **R (gym-kit)** — rides to every gym |
| **Center** | 3×2 (cols 3–5, rows 3–4) | `wall_door` at (4,4) | `roof_l/m/r`, `plaster`, `wall_door` | R shell + **V** plaster |
| **Mart** | 3×2 (cols 16–18, rows 3–4) | `wall_door` at (17,4) | `roof_l/m/r`, `plaster`, `wall_door` | R shell + **V** plaster |
| **House NW** | 3×2 (cols 2–4, rows 15–16) | `wall_door` at (3,16) | `roof_*`, `plaster`, `wall_door` | R shell + **V** plaster |
| **House E** | 3×2 (cols 20–22, rows 16–17) | `wall_door` at (21,17) | `roof_*`, `plaster`, `wall_door` | R shell + **V** plaster |
| **House SE** | 3×2 (cols 19–21, rows 24–25) | `wall_door` at (20,25) | `roof_*`, `plaster`, `wall_door` | R shell + **V** plaster |

> **Reconcile note:** the registered `house_violet.prefab.json` / `gym_violet.prefab.json` use `wall_brick`; Violet's inlined buildings use **`plaster`** + roofs. If the redesign moves to prefabs, author the Violet house prefab in **plaster** (the material identity), not brick, and the door cell as the anchor.

---

## 3. Prop + sprite inventory

### 3a. Landmark props (tile + interaction) — VIOLET-BESPOKE
| Prop | How it's built now | Authored target | split |
|---|---|---|---|
| **Founding statue** | `statue` tile (16×16, solid) + a `sign` object on it (founding lore) | a real monument sprite — gust-dancer mid-launch on a pedestal; reads at 16px, may want a 1×2 (16×32) tall variant | **V** |
| **Academy bell** | `bell` tile (16×16, solid) + `sign` (the ring line) | bronze bell on a frame; candidate for a 2–3 frame glint/sway (Layer 3) | **V** |
| **Concord kiosk** | `npc` object, cyan color marker (set-flag one-time) | a clean modern kiosk prop — deliberately out-of-place modern material vs the warm town | **FACTION-reusable** (appears wherever Concord seeds; not Violet-bound) |

### 3b. Detail props — REUSABLE
| Prop | Now | Authored target | split |
|---|---|---|---|
| **Signs (×9)** | `sign` objects → 2×4 gold tick | `sign_post` tile (16×16, in-atlas) or per-sign plaque | **R** |
| **Fences** | `fence` tile (lookout railing) | generic stone/wood balustrade | **R** |
| **Flowers** | **NOT PRESENT** | *to author* — flower-bed / planter tiles for "lived-in" detail density (`visual-north-star` Layer 1). Generic temperate detail; scatter in the square + by houses. | **R (to-add)** |
| **Wind life** | wind-vane is a `sign` (text only) | *to author* — banners / wind-vanes / wind-chimes as 2–3 frame animated tiles (the highland "sky/wind" identity); these can be **V**-flavored | R kit / **V** flavor |

### 3c. Characters (overworld sprites) — REUSABLE archetypes, Violet-cast
All are `npc` objects rendered as flat 16px color markers today (no `sprite` set). Authored target per §0: 16px directional walk-frame character sprites. **13 exterior NPCs + the player + 2 interior NPCs.**

| # | NPC (role) | placeholder color | class |
|---|---|---|---|
| 1 | Gym guide | `#3a7fbe` | functional |
| 2 | Academy keeper / old man (themed) | `#caa148` | townsfolk (elder) |
| 3 | Gust-dancer kid (themed) | `#88c0e8` | townsfolk (child) |
| 4 | Unbothered local (themed) | `#a8743a` | townsfolk (adult) |
| 5 | Concord rep | `#bfe6ee` | faction NPC (reusable) |
| 6 | Kite kid | `#b14e9c` | townsfolk (child) |
| 7 | Gust-dancer feeder | `#6c5a48` | townsfolk (adult) |
| 8 | Shopkeeper | `#8c6240` | functional |
| 9 | Old woman (lookout couple) | `#9c8a78` | townsfolk (elder) |
| 10 | Student 1 (yard) | `#6a8f3a` | townsfolk (youth) |
| 11 | Student 2 (yard) | `#9ad470` | townsfolk (youth) |
| 12 | DELL (spar-able student / trainer) | `#7c4fa8` | trainer |
| 13 | Concord kiosk (prop-as-NPC) | `#7fd4e0` | prop (see §3a) |
| — | **Player** | procedural | global — 16×48 sheet, directional |

> Most bodies are **reusable townsfolk archetypes** (elder / adult / child / youth / trainer); Violet's *identity* is in the palette tint + a couple of signature designs (the keeper, the gust-dancer kid). The Concord rep + kiosk are **faction-reusable** (travel with the Concord, not Violet).

### 3d. Academy interior (`violet_academy.json`) — addendum
Currently a **graybox inline tileset** (4 colors: `W` stone wall, `.` floor, `P` pillar, `d` archway) — NOT the data-driven tileset path. For the beauty proof, migrate the interior to a real **`indoor_violet` tileset** (ancient-stone walls, stone floor, carved pillars, the inscription as a wall prop). 2 interior NPCs (instructor, student). **V** (ancient-stone interior).

---

## 4. Reusable vs Violet-bespoke — the split + batching priority

Three buckets, ruled 2026-06-21. **Author in this order** (biggest carry-over first):

### Batch 1 — REUSABLE temperate foundation (biggest carry-over; every town reuses)
`grass · path · water · tree · tall_grass · forest_floor · wall_brick · cave_rock · cave_mouth` · the **roof/door building shell kit** · `fence` · `sign_post` · **flowers (to-add)** · the **townsfolk character archetypes** · the **player**.

### Batch 2 — REUSABLE KITS (author once, ride to every instance of their type)
- **Gym-kit:** `gym_facade_l/m/r` + `gym_door` — rides to every gym (Falkner = first instance; per-gym identity = a later tint/banner pass).
- **Faction (Concord) props:** the **kiosk** + the **rep** — ride to every Concord seed (not Violet-bound).

### Batch 3 — VIOLET-BESPOKE (last; the smaller, high-identity set that makes the proof read as *Violet*)
`plaster` (the material skin) · the **Academy set** (`academy`, `academy_door`, `statue`, `bell`, + the ancient-stone interior) · the **wind life** flavor (banners/vanes/chimes) · the signature NPC reads (keeper, gust-dancer kid).

> **Why this order:** Batch 1 pays off across all of Chapter 1 and is the bulk of what makes Violet stop reading as graybox; Batch 2 is build-once leverage that every later gym/Concord beat inherits for free; Batch 3 is the identity layer — smallest in count, highest in "this is unmistakably Violet."

---

## 5. Animated-tile candidates (Layer 3 — the world breathing)

The beauty proof = Layer 1 (environment) **+** Layer 3 (animated tiles). Cheapest high-impact motion for Violet:
- `water` — ripple (already 2-frame; restyle in place).
- `tall_grass` — sway (frames already supported) — not in Violet currently; add a patch if desired.
- `bell` — glint / gentle sway, 2–3 frames.
- **wind life** (new) — banners + wind-vanes waving, the highland signature — 2–3 frames each.
- **flowers** (new) — bob, 2 frames.
- Center healing machine / door-open — interior/warp polish (Layer 3, later).

All ship as the optional `frames` array in the tile JSON (same format as `water`/`tall_grass` today) — pure data, no engine change.

---

## 6. Swap checklist (when the art is authored — NOT this pass)

1. **Author the cohesive Violet palette** (≤64, master-aligned); declare it in `outdoor_violet.tileset.json` (and a new `indoor_violet.tileset.json` for the Academy core).
2. **Batch 1 — re-skin the reusable foundation tiles** (`grass/path/water/tree/roof_*/wall_door/fence/sign_post`) — same tile ids, new `rows`/`pixels`. → re-run the suite (tileset-format validation is load-time; `firstRoad.test.ts` loads the tileset).
3. **Batch 2 — author the reusable kits** (build-once, not Violet-bound): the **gym-kit** (`gym_facade_l/m/r`, `gym_door`) + the **Concord faction props** (kiosk, rep) — same ids.
4. **Batch 3 — author the Violet-bespoke set** (`plaster`, `academy`, `academy_door`, `statue`, `bell`) — same ids.
5. **Add new detail tiles** (flowers, banners/vanes) → add ids to the tileset AND to `violet.json` `tileMap` only if placed (placement = a reviewed map edit, not a pure swap).
6. **Add `frames`** to the Layer-3 animated candidates (§5) — pure tile-JSON additions.
7. **Author overworld character sheets** (player + townsfolk archetypes) as 16×48 frame sheets; wire NPC `sprite` ids (a map edit per NPC — reviewed).
8. **(Optional structural) migrate buildings to prefabs** — author `house_violet` in **plaster**, the Academy as a prefab; swap `violet.json` inline footprints for `prefabs[]`. Separately reviewed (changes `cells`).
9. **Migrate the Academy interior** to `indoor_violet` (graybox → data-driven tileset).
10. **GATES (every step):** `npm run typecheck` clean · full vitest suite green (esp. `firstRoad` / `firstRoadFixes` / `overworld` / `spine` / `intro`) · BFS walkability unchanged (no `cells` solidity drift unless intended) · **bit-identical** to engine/combat/save/gym.json.

**Invariants the swap must never break:** tile **ids**, the map **footprints/warps/spawns/objects**, the spine anchors (north exit `(9,0)`, gym door `(9,12)`), and tile **solidity** (re-skinning must preserve each tile's `solid` flag, or walkability shifts).
