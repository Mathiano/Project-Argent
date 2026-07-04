# Phase 7 Tooling — Visual Map Editor + Argent Studio Asset Sync (BANKED, build deferred to Phase 7)

**Status:** scoped, DEFERRED to Phase 7 (the content-authoring-tools phase, per `BUILD-ROADMAP.md`). Banked here so the spec exists when the phase arrives — this is NOT a current build request. Covers two related tools: (1) closing the argent_studio export→repo sync gap, and (2) a full visual map editor for routes/towns. Cross-ref: `BUILD-ROADMAP.md` (Phase 7 = content authoring tools), `visual-north-star.md` (Layer 1 environment art = Phase 7+), `pilot-exit-decisions.md` §3 (the original Tiled-editor plan), `WORKING-AGREEMENT.md` (the everything-is-data principle these tools depend on).

## Why this is banked, not built

The critical path is **Foundation → Content → Polish**, in dependency order. We are finishing the demo (through Phase 5). These are authoring/polish tools — Phase 7 by the roadmap. Building them now jumps ahead of their dependency (a finished, frozen chapter to author *against*) and pulls time from the demo.

There is also **no current bottleneck** that needs them:

- The only pending art work — the 16 over-budget Violet tiles — is already doable in argent_studio as it stands (it loads tiles, enforces ≤4-color, exports). The single friction point is a manual file-copy on export: a once-in-a-while annoyance, not a blocker.
- Map editing is not currently painful. Route 31 + Violet are authored, and `gen_route31.mjs` is safe to regenerate (post-4520386). The pain a map editor solves — hand-editing JSON across *many* new areas — only arrives at Phase 7, when Routes 32+, the gym interiors, and the later cities get built.

## How argent_studio works TODAY (the finding)

argent_studio is a standalone, zero-dependency HTML/JS pixel workbench served by the dev server. It is a **16×16 tile painter, not yet connected to the repo**:

- **Palette** — index-clamped to the 30-color `argent-master.palette.json` (live-loaded). No off-palette paint is possible, so exports pass `validate_assets.mjs` by construction.
- **Budget** — ≤4 colors per 16px tile, enforced live (the per-tile counter blocks the 5th color).
- **Preview** — 3×3 live tiling to catch seams / graph-paper lines.
- **Workspaces** — 1×1 up to multi-tile (e.g. the 2×3 `tree_big`).
- **Load IN** — "load .json…" fetches an existing tileset from the dev server (same-origin), so a tile can be pulled in to edit.
- **Export OUT** — "PNG sheet" / "tileset.json" / "prefab.json" download to the browser's Downloads folder, **and (Build A, shipped) also save straight into the repo via the dev endpoint.**

**The sync gap (now CLOSED — Build A shipped, see below).** The *old* round-trip was:

```
paint in Studio → export to Downloads → manually copy PNG + JSON into
assets/tilesets/ → CC validates + commits
```

The "load .json…" half of the loop works; the "save back" half **now works too — a dev-only save endpoint writes exports straight into the repo (Build A).**

## The two Phase 7 builds (specs reserved)

### Build A — Asset sync endpoint — ✅ SHIPPED (66cc8bc general endpoint + 298a421 list-dir)

Dev-only Vite middleware (`tools/dev-save-plugin.ts`, `apply:'serve'` → never in a production build). **As built:** `POST /api/save-asset { dir, filename, content, encoding }` — an allowlist of dirs (`assets/{sprites,tilesets,prefabs,anim,palettes}`), writes the file, reports `{ path, overwrote }`; a legacy `{ name, tileset }` branch keeps Argent Studio's tileset+manifest save; `GET /api/save-asset/ping` for feature-detection; and a read-only `GET /api/list-dir?dir=…` (added for Dex Forge). Sprite Studio + Argent Studio have "save to repo" buttons — **export in Studio = file lands in repo**, no manual copy. Original design below (the cheap unlock, ~30 min CC):

Add a dev-only `POST /api/save-asset` handler to the Vite dev config (Node middleware, ~30 LOC). Studio POSTs the exported JSON/PNG; the handler writes it straight into `assets/tilesets/` (or `assets/prefabs/`). Then **export in Studio = file lands in repo**, no manual copy. Dev-server-only, never in a production build. This is the first thing to build when Phase 7 art work begins — it makes every subsequent tile/prefab edit frictionless.

### Build B — Visual map editor (the larger build)

A route/town editor in the same standalone-HTML spirit as argent_studio. Requirements:

- **Load a map** — pick `route31.violet.json` / `violet.json` / etc. from the dev server.
- **Render the grid** at tile-texture fidelity (cell IDs → tileset lookup, ~40×40).
- **Layer switcher** — base cells / `layer1_fringe` / `layer2_props`, each editable independently.
- **Tile palette** — click a tile, paint onto the grid; stamp multi-tile prefabs (trees) as units.
- **Event overlay** — see/place/edit the object layer: trainer positions, encounter zones, warps, signs, `approachOnEnter` hooks. *This is exactly what Tiled gives "for free" and what JSON-by-hand makes painful.*
- **Save back** — POST to the same `/api/save-asset` endpoint (Build A), writing the map JSON to `src/game/maps/`.

**Critical constraint — the generator relationship.** `route31.violet.json` is generator-owned (`gen_route31.mjs`, authoritative post-4520386). The editor must not silently fight the generator. Either (a) the editor only writes hand-authored maps that have no generator, or (b) for generator-owned maps, the editor edits the generator's *input data*, not the emitted JSON — otherwise we recreate the exact footgun we just defused this session. Decide at build time; flagged here so it isn't forgotten.

### Build-vs-buy note (from `pilot-exit-decisions.md` §3)

The original plan was **Tiled** (free, mature, standard) — "Claude Code wires the JSON loader once." Tiled gives layered tile editing + object placement out of the box, which is ~80% of Build B. The Phase 7 question is whether a bespoke editor (perfectly matched to our schema, palette enforcement, and prefab system, in-repo) is worth building over adopting Tiled + an export script. Both paths are viable:

- **Bespoke advantage:** native palette/budget enforcement and prefab-aware stamping, matched to our pipeline.
- **Tiled advantage:** it already exists.

Resolve at Phase 7, not before.

## Sequencing

- **Design:** captured now (this doc).
- **Build:** Phase 7 — Build A first (frictionless export), then Build B (or Tiled adoption) once authoring Routes 32+ and the later cities makes hand-JSON painful.
- **Until then:** argent_studio with the manual-copy step covers the only current need (the 16-tile rework); map editing stays hand-JSON plus the now-safe generator.
