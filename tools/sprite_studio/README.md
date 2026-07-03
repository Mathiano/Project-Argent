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

## Export

`NAME.sprite.json` in the exact engine format `{ name, size, palette (used chars),
rows, facing }` + `NAME.preview.png` (4×). Validated before download: every char ∈
palette ∪ `.`, rows count == size, each row length == size (the `validateSprite`
shape). **Download-only** — registering the sprite into `src/game/sprites.ts` stays
a separate, human step.

## Not in v1

Dex-icon derivation, front/back paired sessions, animation frames, batch import,
a ramp-library UI beyond import/export.
