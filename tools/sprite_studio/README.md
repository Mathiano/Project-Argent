# Sprite Studio v1

A local browser tool that turns a generated pseudo-pixel-art creature PNG into a
grid-true, palette-locked **56px Argent sprite** — the daily-use replacement for
`tools/sprite_ingest.py`.

## Run

Serve the repo (same convention as `tools/argent_studio/`) and open the path:

```
npx serve .        # then open http://localhost:3000/tools/sprite_studio/
# or: npm run dev  (vite serves the repo root — same-origin, no CORS)
```

`file://` also works (the tool only reads dropped files + downloads exports — no
`fetch`), but the served path matches the Argent Studio convention.

## Pipeline (mirrors `sprite_ingest.py`)

drop PNG → **background flood-fill** (near-white or within a tolerance of the corner
colour, from the four corners — interior whites survive) → **mode-pool downscale**
(majority vote per cell; outline pixels excluded from the vote unless a cell is
≥70% outline — the GALEHAWK fix) → **despeckle** (connected non-outline islands
< N) + **outline pass** (`SOFT_EDGE` chars exempt) → **fit** (bottom-anchored,
horizontally centred into a square `size×size` slot).

## Palette mapping

Ships with `MASTER_PAL`. Click a source colour, then a ramp entry (or *transparent*
/ *outline*) to reassign; live re-render. Custom ramps add/remove entries and
import/export as JSON (no localStorage, per project rule).

## Palette modes (v1.1)

Three acceptance ranges on the same source — A/B them with **compare modes** and
pick by feel:

- **master / custom** (default) — the global `MASTER_PAL` (or a hand-edited ramp).
  Exactly the v1 behaviour.
- **extract from source** — median-cut the source's *own* colours into N ramp
  entries (**colours** slider, 4–16), so a slate-blue bird stays blue instead of
  collapsing to shared master greys. Keys are auto-assigned `a,b,c…` dark→light;
  the darkest is pre-selected as the outline char. The extracted ramp lands in the
  normal editor — fully remappable. A soft, non-blocking hint fires if the ramp
  lacks a dark outline / light accent (value discipline; never mutates the ramp).
- **raw (no quantize)** — pool the cell's average source colour directly. On export
  the distinct grid colours are collapsed to chars automatically (≤ 60 → direct;
  > 60 → median-cut down to 60 with a notice), so it still passes `validateExport`.

All three keep the same export invariants (every char ∈ palette ∪ `.`, square
`size×size`). v1 exports reproduce exactly in Mode 1.

## Export

`NAME.sprite.json` in the exact engine format `{ name, size, palette (used chars),
rows, facing }` + `NAME.preview.png` (4×). Validated before download: every char ∈
palette ∪ `.`, rows count == size, each row length == size (the `validateSprite`
shape). **Download-only** — registering the sprite into `src/game/sprites.ts` stays
a separate, human step.

## Not in v1

Dex-icon derivation, front/back paired sessions, animation frames, batch import,
a ramp-library UI beyond import/export.
