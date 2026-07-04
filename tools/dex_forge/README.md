# Dex Forge v1

Mission control for dex production. One grid, one row per `docs/mon-manifest.csv`
slot, showing how far each mon has travelled down the pipeline:

**commissioned → identity → front art → back art → registered**

Replaces coverage-state that used to live in chat memory. Built for the CH1 push,
scales to every manifest slot (345 at time of writing).

## Run

Serve the repo and open the tool (same convention as the other studios):

```
npm run dev        # then open http://localhost:5173/tools/dex_forge/
```

**Read-only.** It never writes. It reads the repo through the dev server:
`/docs/mon-manifest.csv`, the batch JSONs, `/assets/sprites/*`, `/src/game/sprites.ts`,
and `GET /api/list-dir?dir=assets/sprites` (the read-only listing endpoint in
`tools/argent_studio/dev-save-plugin.ts`). Opened as a static `file://` it shows a
"serve via `npm run dev`" notice and does not crash.

## The grid

Per manifest slot: line / stage / name / bucket / types / archetype / rarity, plus
four status lights:

- **identity** — the name appears in a batch JSON (`BATCH_FILES` const; v1 = `docs/ch1-batch.json`; future batches are one line).
- **front art** — `assets/sprites/{NAME}.sprite.json` exists; the badge shows its size
  (**112** green "native" / **56** amber "legacy").
- **back art** — `{NAME}_BACK.sprite.json`, same treatment; a missing back on a
  commissioned mon shows amber "need". *(Foe-only "n/a" isn't derivable from the
  current manifest/batch fields, so every missing back reads amber — a v1.1 refinement
  if a player-side flag lands.)*
- **registered** — the name is a key in `REGISTRY` (and `+B` if in `BACK_REGISTRY`),
  parsed by regex from the dev-served (type-stripped) `sprites.ts`.

## Rollup + filters

Header rollup, per bucket: `id/slots · front/id · back/id · reg/id · N legacy-56`.
Filter by bucket / type / archetype / rarity / status (missing front art, legacy-56,
identity-not-registered, …).

## Collision scan

- **duplicate** manifest names,
- **name drift** — a manifest row whose name mismatches its batch identity at the same
  `line_id`+`stage`,
- **orphans** — sprite files with no manifest row (the FLITPICK class), caught
  structurally via the directory listing. Registered fixtures (e.g. `embercub` →
  `EMBERCUB`) are excluded.

## Sprite peek + line view

Click a row with art → its front/back render inline at 1×/2× on parchment
(paint-from-rows, the studios' pattern). The **line view** toggle groups rows by
`line_id` so an evolution family's stages sit side by side.

## Not in v1 (backlog)

Editing anything, brief generation, stat/sim views, icon coverage, cry coverage
(the column is reserved conceptually, not built).
