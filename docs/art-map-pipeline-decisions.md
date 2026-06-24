# Art & Map Pipeline — Architecture of Record

**Status:** DECIDED (architecture locked) / IN PROGRESS (tooling being built). This is the source-of-truth for how authored art and maps flow into the game, and how the visual map editor stays compatible with CC owning all game logic. Drop in `docs/`. Cross-ref: `phase7-tooling-map-editor-and-asset-sync.md`, `visual-ceiling-rse-2d.md`, `sprite-pipeline-roles.md`.

## The core problem this solves

Two questions, one architecture:
1. **"How does art I author become content CC builds with?"** — e.g. tell CC "build a route with Grass A" and it knows exactly which authored file that is.
2. **"Can a visual map editor (Tiled) coexist with CC owning story / spawns / scripts, fluently?"** — yes, via the layer-separation contract below.

Both reduce to the same pattern: **named things authored in a visual tool, resolved to definitions in CC-owned code.** Applied to tiles (the asset registry) and to map objects (the Tiled↔CC contract).

## The proven pipeline (evidence-based)

```
GPT/ChatGPT  →  HD reference art (mood/composition/color) — reference ONLY
                     │
              Argent Studio  →  author the actual ≤16-color tile by hand,
                                 tracing the reference on a dimmed underlay,
                                 palette-locked + grid-locked by construction
                     │
              tileset.json export (round-trip-verified format)
                     │
              Asset Registry  →  named, addressable tile assets in the repo
                                  ("Grass A" → a known file CC resolves)
                     │
              Tiled  →  paint the named tiles onto maps visually;
                        place TYPED OBJECT MARKERS (npc/warp/zone/trigger by name)
                     │
              CC importer  →  ingests the map; resolves each typed object
                              to its CC-owned definition (dialogue, battle, spawn table, flag)
                     │
              Game renders + runs
```

## Why AI cannot author the tiles (settled, with evidence)

Two AI paths were tested on Mathias's best assets and **both failed, on the record:**
1. **AI illustration → tile (clamp/downscale):** ChatGPT "Emerald" tiles measured **1254×1254, 29k–58k colors, no pixel grid, baked-in backgrounds.** To become a 16×16 ≤16-color tile = "reconstruction, not survival." 100% of cells fail ≤16.
2. **AI authoring tile *data* blind (indexed JSON grid):** rendered as **a rounded lump with a dark wedge — not grass**; tiled into a grid of seam-bordered clones. The model emits *plausible* tile data but cannot *see* what it draws, so it produces *a* shape, never *the intended* shape.

**Conclusion:** pixel art is a see-it-to-do-it visual craft. AI = reference/mood art ONLY. The hand-on-pixels step (a human placing pixels while watching the render) is **irreducible**. Mathias authors the tiles; Argent Studio's job is to make that as supported as possible (import-clamp + reference underlay), not to replace it.

## DECISIONS

### Authoring
- **Mathias hand-authors all game tiles** in Argent Studio. (Commissioning an artist for scale-out remains an open future option for CH2+, to be decided from experience after the first tileset.)
- **GPT/ChatGPT generates reference art only** — never source-of-truth assets.
- **Argent Studio is the tile foundry**: drop GPT reference → auto-clamp to master palette + fit to grid → edit on top with the HD reference dimmed underneath (trace) → export. Phase 1 (import + underlay) is built (commit de88dc9).

### Authoring unit — SHEETS sliced into tiles (confirmed)
- Mathias authors on a **sized workspace** (e.g. 128×128 = 8×8 tiles), painting a continuous **field or object** across it; Studio **slices the workspace into its component 16×16 tiles on export** (hence a grass field exports as `cols:8, rows:8, count:64`). This is the Emerald-style model (terrain is sheets referenced by tile index) and is the more powerful model.
- **Implication for the registry:** an asset has TWO granularities — the **named sheet** ("Grass A" / "Hearthwick Terrain") AND the **individual 16×16 cells** within it (referenced by index). The registry/manifest names the sheet; CC and Tiled reference cells by index. The registry brief is scoped to this.
- **Minor Studio bug logged:** the workspace-size dropdown showed `1×1 tile` while the actual workspace was `8×8` — a labeling/wiring mismatch to fix (folded into the registry brief as an if-cheap item).
- **First real asset is a POC/placeholder:** the first grass field is intentionally rough — it proves the *pipeline* end-to-end; craft refinement (less-patterned texture to hide the tiling repeat; a separate dense "tall grass" clump tile distinct from this flat ground tile) comes later, with reps. Don't gate the machine on perfect tiles.

### The export format (FIXED + verified — commit f2c420e)
- `tileset.json` is now **self-describing and round-trips losslessly**. Encoding is **positional base-N** (N = palette length): the char for index `i` is `keys[i]`, decode is `keys.indexOf(char)` — and this **matches the game's own decoder** (`tileset.ts:130`), so exports are game-loadable by construction.
- The file carries its own `encoding`, `keys` (alphabet sliced to palette length), and `transparent` sentinel.
- **Transparency is out-of-band**: there is NO transparent palette index (index 0 is opaque near-black `#092626`). `.` (or space) = transparent. The game decoder treats it identically.
- A **round-trip self-test** auto-runs on palette load and is wired to a button (export → decode → assert exact pixel equality), guarding against regression.
- **(Earlier bug, now dead):** the export previously wrote display `.key` chars instead of positional chars, with no legend — decoding produced phantom indices 54–61 (one-third of every tile rendered as magenta failure). Fixed.

### The asset registry (BUILT — commit 3a1e25f)
- **Persistence: dev-server endpoint** (leaning) — a `POST /api/save-asset` writes authored tiles to the repo as real files (treats the growing content pile as real repo files; survives refresh/browser; already specced in `phase7-tooling-map-editor-and-asset-sync.md`). Chosen over browser-storage (fragile, single-browser, forbidden in some contexts) and library-file (manual-save risk).
- **Naming contract:** authored tiles get **stable, human names** ("Grass A", "Snow B") that CC resolves to files. **GAP TO FIX:** Studio currently auto-names everything `tile` / `tile_000…` — it must let Mathias name an asset on export (or a naming layer is added) so "use Grass A" resolves deterministically. The registry brief addresses this.
- Scope the registry brief **only after** a fixed-format tile is visually confirmed (so it's built against the real artifact, not a guess).

### Registry — operational rules (BUILT)
- **Name-on-export is required** — Studio coerces "Grass A" → `grass_a`, validates filesystem-safe, blocks all export/save until valid. The name is both the filename and the `tileset.json` `name`. (No more `"tile"`.)
- **Dev-server save:** `POST /api/save-asset` (Vite middleware, `apply:'serve'`, dev-only, zero build/prod effect) writes `assets/tilesets/<name>.tileset.json`; `GET /api/assets` returns the manifest. Tightly scoped — writes only inside `assets/tilesets/`, rejects path-traversal + bad names, refuses clobber without `overwrite:true` (409 → Studio confirms).
- **THE MANIFEST IS LAW** (`assets/tilesets/manifest.json`): CC resolves an asset name (e.g. "Grass A") to its file **through the manifest**. **Assets MUST be added via the Studio "Save to project" button** — hand-dropping a file into `assets/tilesets/` does NOT register it in the manifest, so CC can't resolve it. Studio Save = the only valid way an asset enters the registry.
- Manifest entry: `name`, `file`, `tilesize`, `cols`, `rows`, `count`, `description`. Saved files are the exact f2c420e round-trip format, game-loadable (verified live: 0 mismatches).

### The map editor — Tiled (DECIDED: off-the-shelf, not bespoke)
- **Use Tiled** (free, mature, industry-standard for 2D tile maps) rather than building a map mode into Argent Studio. Rationale: Tiled already provides visual tile-painting, layers, and object placement; building that from scratch rebuilds a mature free tool. CC's job shrinks to **one Tiled-export → Argent-map-format importer**. Tiled not enforcing the palette/≤16 rules doesn't matter at the map layer — tiles are already palette-locked when they leave Studio; Tiled only arranges them.

### The Tiled ↔ CC contract (the assurance Mathias required)
**Requirement:** story, mon spawns, dialogue, scripts, flags must stay 100% in CC's hands; Tiled and CC must interact fluently.

**Architecture — layer separation:**
| Tiled owns (the "where") | CC owns (the "what it does") |
|---|---|
| Tile placement (the visual map) | Story, dialogue, battle definitions |
| Collision (solid flags) | Encounter tables / spawn logic |
| **Positions + type-names** of objects (npc/warp/zone/trigger) | What each object *type* actually means/does |
| The look of the world | The behavior of the world |

**The mechanism:** in Tiled, Mathias places a **typed object marker** on an objects layer — e.g. an object named/typed `npc_kamon` at a coordinate, or a rectangle `zone_flitpeck`, or `warp_violet`. Tiled exports the **position + name/type only**. CC's importer reads the marker and resolves it to the **CC-owned definition** (KAMON's dialogue + battle card + flags; the FLITPECK encounter table; the Violet warp target). **Mathias never authors logic in Tiled; CC never authors tile placement.** They meet at the typed-object naming contract.

**Why it's fluent:** the two tools never write the same data. Tiled says "an NPC of type `kamon` is here"; CC says "here's what `kamon` does." Same pattern as the asset registry (named thing in the visual tool → definition in CC code), applied to map objects. This is the standard architecture for Tiled-based 2D games.

**The one discipline it requires:** a **maintained object-naming contract** — a marker named `kamon` in Tiled must have a `kamon` definition in CC. The Tiled-importer brief will make CC enforce/validate this (flag any unresolved marker on import). This is the same *kind* of naming contract the registry needs.

## SEQUENCE (current)
1. ✅ Studio Phase 1 — import + reference underlay (de88dc9).
2. ✅ Studio export format — round-trip fix (f2c420e).
3. ✅ Format PROVEN — Mathias re-exported a tile from fixed Studio (commit f2c420e); Claude decoded it from JSON and it rendered as the authored grass with **0 BAD chars, no magenta**. The round-trip holds on real exports. Format is trusted.
4. ✅ Asset-registry built (3a1e25f) — naming-on-export + dev-server save + manifest. The bridge exists.
5. **→ NOW:** Mathias browser-checks the registry, then authors a small POC tileset (grass / path / tree / water) — named + saved through the Studio Save button — so Tiled has real tiles to paint with.
6. **Then:** Tiled-integration brief — the importer, built around the typed-object contract above (so story/spawns stay in CC).
7. **Then:** Mathias paints the first real Hearthwick screen in Tiled; CC resolves the objects; the game renders it.

## OPEN ITEMS
- **Studio naming-on-export** (the registry gap) — must be added so tiles get human names, not `tile_000`.
- **Hearthwick + Academy map enlargements** — still deferred; ride this art pass (don't re-lay maps twice).
- **Commission-vs-self-author for CH2+ scale-out** — decide from experience after the first tileset.
- **Mon sprite pipeline** — separate track (Gemini → `sprite_ingest.py` → 56px), not covered here.
