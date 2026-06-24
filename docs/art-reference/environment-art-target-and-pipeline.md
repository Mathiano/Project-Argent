# Environment Art — Target + Pipeline (Hearthwick first) — BANKED, Phase 7

**Status:** banked reference for the Phase-7 Layer-1 environment pass. This is a TARGET, not a build — and specifically **not a CC build-input now** (visuals are deferred behind systems per BUILD-ROADMAP; CC is on the trainer engine). Companion to `visual-north-star.md` (Layer 1). The reference mockup (Gemini-generated) lives at `docs/art-reference/hearthwick-overworld-target.png` — keep it; it's the style bible for this area. The **Pipeline** section below is the general rule for *every* area mockup, not just Hearthwick.

---

## What the mockup establishes (approved as target — ~90% locked)
A warm, dense, cohesive HGSS-descended overworld: multi-tile buildings with real architecture, smooth grass→path→water transition tiles (no hard rectangle seams), high detail density (flowers, hedges, lily-pad pond, signage). This is the Layer-1 thesis — *"Silver's soul at a fidelity the hardware never allowed"* — landing. Use it as the frozen bar for the Hearthwick / early-Route-31 look.

## The 10% — refinements to bake into the tileset/prefabs when authored
1. **Argent center-glyph, NOT the Pokéball.** Original IP — the heal-center wears Argent's own capture-glyph, not Nintendo's mark. Design the Argent ball/center glyph; it becomes the franchise's repeated identity mark (every town's center carries it). A branding asset, not just a fix.
2. **Overworld creatures = manifest species.** The pond creature (and any overworld-visible mon) must be an Argent species (e.g. an early GALE/SPLASH line), not a generic bird. Ambient-only wildlife is fine but must not read as a Pokémon mon.
3. **Per-city material identity.** Lock this as *Hearthwick's* signature, distinct from Violet plaster / Azalea plank / etc. Don't let it become the generic-town palette reused everywhere.
4. **Darkness arrives areationally, via Layer 5 — not by dimming this.** The warm home-town read is correct (open in warmth). The "darker tone" expresses through Layer-5 atmosphere (dusk tints, fog, low-key palettes) at the Concord zones / Burned Tower — never by making the opening moodier.

---

## Pipeline — how this actually gets built (the important part)

**The mockup is a REFERENCE / style bible, not a consumable asset.** CC's engine renders *data* — a tileset, a tilemap, prefabs, sprites — not a flat painting. A Gemini scene also does **not** slice into a clean tileset (AI scenes aren't tileable: the grass varies pixel-to-pixel, nothing sits on a grid). So the build flow is:

```
mockup (frozen target)
  → author a tileable TILESET + PREFABS + SPRITES in this style
  → lay out the TILEMAP (Hearthwick/Route-31 as tile data)
  → CC's data-driven engine renders it
```

- **Tileset** — grass variants, path, water + full edge/transition tiles, tree variants, cliffs/ledges, flowers/clutter — (re)drawn to grid so they tile cleanly, then ingested the way sprites go through `sprite_ingest.py` (a **tile-ingest analog** may be worth building: palette-quantize → grid-snap → atlas).
- **Prefabs** — the Center (with the Argent glyph), houses, the lab — as multi-tile objects.
- **Sprites** — player, NPCs, overworld creatures (manifest species).
- **Tilemap** — the actual layout, authored in a map editor (Tiled or equivalent) and exported to the engine's map format.

**CC consumes the tileset + tilemap + prefabs + sprites — never the mockup.** The mockup's only two jobs: (a) freeze the target, (b) be the look the authored assets are matched against.

---

## Authoring reference — tile/prop/animation inventory + layer model

Sourced from the Gemini "tileset spec & atlas" sheet (saved at `docs/art-reference/hearthwick-tileset-spec-reference.png`). **Same rule: this is a DECOMPOSITION reference, not an asset** — it's an infographic *of* a tileset (title bar, legend, drawn-on grid), not a sliceable atlas, and its `PIDGEY_FLY` bird + the Pokéball-on-the-Center are the known violations to fix (see the 10% above). Use it as the *checklist* for what the real authored tileset must contain.

### Tile inventory (author these, clean-to-grid)
- **Grass** — base + 2–3 subtle variants + decorated variants (flower/clutter overlays).
- **Path/dirt** — base + full grass↔path edge & corner set.
- **Water** — body + full grass↔water edges/corners + features (lily pads, the stair/dock descent).
- **Trees** — full multi-tile tree + standalone trunk tile + canopy variants.
- **Hedge** — straight + corner tiles (the garden maze / soft borders).
- **Ledge** — jump-down ledge tiles (one-way, interactable).
- **Cliff / plateau** — edge tiles for raised ground (Layer-2 plateaus).

### Props (each with a collision mask)
Potted plants / planters, flower clusters, signs, fences/railings — mask each as solid vs walk-through.

### Animation sheets (Layer-3 work, per visual-north-star)
- **Player walk** — directional, ~3–4 frames/direction.
- **Overworld creature** — ~4-frame cycle, **a manifest species** (not "Pidgey") — e.g. an early GALE line for the pond.

### Layer + collision model (adopt this — it's how the map should be structured)
- **Layer 1 — Ground:** dirt / grass — the traversable floor.
- **Layer 2 — Foliage & plateaus:** tree canopy, cliff tops, anything drawn *above* the ground plane.
- **Layer 3 — Solids, NPCs & encounters:** building/tree-trunk collision, NPC sprites, wild-encounter spots.
- **Collision map:** SOLID (buildings, trunks, walls) · INTERACTABLE (signs, ledges) · TRAVERSABLE (grass, path).

*(CC's engine likely already has a layer/collision model — this is the content spec to fill it, and a check that the model lines up.)*

---

## Sequencing
- **Now:** banked only. **No CC action** — visuals are Phase 7, CC is on the trainer engine. The current placeholder tileset stays.
- **Phase 7:** author the Layer-1 tileset/prefabs in this style + the Hearthwick/Route-31 tilemap, with the four refinements baked in. *That* is the CC-buildable deliverable.
- Everything stays a **data swap** on the existing engine (per visual-north-star.md) — no engine re-architecture.

## Cross-ref
`visual-north-star.md` (the five layers + labor map), `world-scope-skeleton.md` (Hearthwick / Route 31 / Violet), `monmanifest.csv` (overworld creature species), the sprite pipeline / `sprite_ingest.py` (the ingest pattern the tileset would mirror).
