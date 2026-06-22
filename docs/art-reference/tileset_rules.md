# Tileset Art Rules — the asset spec + validation contract

**Status:** the art-direction constraints every tile/prop/sprite asset must satisfy before it ships into a tileset. Enforced by `tools/validate_assets.py` (and its runnable Node twin `tools/validate_assets.mjs` — see "Running the validator"). Cross-ref `visual-north-star.md` (the look), `tileset-format.md` (the data format), `violet-asset-manifest.md` (the Violet batch pipeline).

**Why this exists:** the engine + layered renderer work, but the tile *art* reads flat and grid-bound — directional textures seam when tiled, props are drawn flat side-on instead of with depth, and AI art arrives anti-aliased instead of hard-indexed. These rules are the floor that fixes that.

---

## Rule 1 — 16-colour budget per 16×16 tile (RSE/GBA ceiling)

Every 16×16 tile texture uses **at most 16 colours** (transparent pixels don't count).

**Why 16 (and why the tile is still 16×16):** the art ceiling moved from authentic-GBC (≤4 colours/tile) to **Ruby/Sapphire (GBA) capability** — 2D, 16×16 tiles, **≤16 colours/tile**, on an expanded master palette (`docs/visual-ceiling-rse-2d.md`, DECISION LOCKED). Crucially this is a **colour-and-art change only**: the **320×180 canvas, the 16×16 grid, camera, UI, fonts, and sprite metrics are unchanged** — we deliberately *stay* 16×16 to avoid any rescale. HGSS is the art *sensibility*; RSE is the literal engine capability we now target. At 4 colours the RSE/HGSS richness was impossible; at 16 it's reachable.

- A tile may use **fewer** than 16 (a flat ground tile is often 2–3, a clean prop 4–6). Sixteen is the ceiling, not a quota.
- **Colour *headroom* ≠ quality.** Sixteen colours gives an authored or curated tile room to breathe; it does **not** make a raw AI texture stop being muddy. The source still has to be authored, packed, or a clean generation. The new discipline is **palette coherence** — the expanded palette is curated as a deliberate ramp (an art-direction pass), not invented piecemeal per tile.
- The project's **~64-colour master palette** is the *cross-tileset* ceiling (`argent-master.palette.json`, grown additively toward ~48–64); **per tile** the cap is 16.

> **Advisory — hand-rework candidates:** tiles that pass ≤16 but exceed the **legacy ≤4 GBC budget** (the AI-ingested high-colour transitions that the ceiling move makes "compliant") are flagged by the validator as a **non-failing advisory**. Budget-compliant ≠ visually vetted — they stay tracked as rework candidates (perspective/seam/muddiness unfixed), not silently absolved. The validator never auto-resolves or redraws them.

## Rule 2 — hard-indexed pixels (no anti-aliasing)

Every pixel snaps to exactly one palette colour. **No partial alpha** (a pixel is fully opaque or fully transparent) and **no soft/AA edges** (no in-between blend pixels ringing a shape). AI generators love to anti-alias; that art must be quantized + hard-edged on ingest, never shipped soft. Symptom the validator catches: many near-duplicate colours in one tile (a gradient/AA ramp) or any partial-alpha pixel.

## Rule 3 — ¾ top-down projection (vertical depth, never flat side-on)

The world is **¾ top-down** (classic GBC RPG), not pure overhead and not side-scroller. Every prop and sprite must show **vertical depth** — you see the *top surface AND a hint of the front face*:

- **Trees:** canopy seen from above-and-front; the **trunk is visible below the canopy** (not a flat circle).
- **Buildings:** the **roof** plus a **front wall face** with the door on it.
- **Characters:** head-on ¾ view with visible body height (the existing player sprite is the reference).
- **Banned:** flat pure-overhead blobs and flat pure-side elevations. If it has no front face, it's wrong.

## Rule 4 — non-directional base ground

Base ground textures (**grass**, dirt, sand, etc.) must tile **seamlessly in every direction** — **no directional lighting, gradient, or oriented streaks** that create a visible seam or repeating "grid" when the tile is laid consecutively. Use symmetric / blue-noise-style scatter whose pattern doesn't line up at the tile borders. Test: a field of the tile must read as continuous ground, not a checkerboard of squares.

---

## Running the validator

```
# Node (runnable in CC's sandbox — Python isn't installed here):
node tools/validate_assets.mjs <path ...>
# Python (same rules, for the design machine):
python tools/validate_assets.py <path ...>
```

Accepts **`.tileset.json`** files (checks each tile's `rows` against Rules 1–2) and **`.png`** sheets (scans on a 16×16 cell grid; checks colour count + soft/alpha edges). Exits non-zero if any asset breaks a rule, so it can gate a content batch. It is a **standalone art lint** — not part of `npm test` (the engine suite stays green independently).

What it reports per tile/cell: unique-colour count (vs the **16** ceiling), partial-alpha pixels (AA), near-duplicate colours (gradient/AA smell), and whether a `#000000` outline is present. A tile **over the legacy ≤4 budget but within ≤16** is printed as a **`⚠` non-failing advisory** ("hand-rework candidate") and tallied in the summary, but does **not** change the exit code. Rules 3–4 (projection, non-directional) are **human review** items — the doc is the checklist; the validator covers the mechanically-checkable Rules 1–2.
