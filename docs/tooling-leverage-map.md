# Tooling Leverage Map — vibe-coded tools across Argent (BANKED)

**Status:** backlog + assessment, banked 2026-07-03. Sprite Studio v1 (`f27ed93`)
proved the pattern: single-file browser tool, scope-fenced CC brief, reads/writes
the exact data the game consumes. This doc maps where the pattern applies next.
Cross-ref: `sprite-pipeline-roles.md`, `animation-pipeline-plan.md`,
`audio-north-star.md`, `phase7-tooling-map-editor-and-asset-sync.md`.

## The two rules (why this is safe to scale)
1. **Tools read/write the same data files the game consumes.** No parallel
   formats. Repo stays the single channel.
2. **Tooling commits run parallel to feature beats** — fenced to `tools/` or
   dev-flag overlays, so bit-identical gates are never at risk.

## Backlog — general tools (banked, not scheduled)

| # | Tool | Kills | Build when |
|---|---|---|---|
| 1 | **In-game dev menu** (dev-build overlay: spawn matchups, set bond stage, grant mons/items, RNG seed, teleport) | Feel-test setup cost — any state reachable in seconds | Highest priority of the set; accelerates every feel gate |
| 2 | **Anim Studio** (preview harness + timeline scrubber, live-edit easing/frames, writes animation JSON) | CD round trips per motion tweak | With the animation pipeline (after interpreter exists) |
| 3 | **Tile Studio** (fold tile_ingest + rotation-synth + seam test into Argent Studio: drop master → live 13-piece autotile + seam check) | CLI-blind tile pipeline | When artist master tiles arrive |
| 4 | **Dex Forge** (manifest + identity JSON + sprite coverage in one grid) | Coverage state living in chat memory | Before CH1 batch commissioning |
| 5 | **Trainer Forge** (form-driven boss card builder; can run browser-side ladder against the real TS engine) | Markdown→CC translation; slow balance feedback | With the trainer archetype catalog sprint |

## The three hard hitters — assessments

### Audio
- Event bus verified (~18 kinds, zero subscribers); SFX slice already planned.
- **Sound Board** (new): browser tool — load candidate SFX, map to real event
  names, trigger/replay events, A/B by ear, export event→sfx mapping JSON.
- **Cry Studio** (later): ~200 cries = the sprite problem again. Generate
  anywhere → trim/pitch/normalize/preview → export + assign. Sprite Studio's sibling.
- **Not a tooling problem:** hero music sourcing/IP. The north-star's guard
  stands (original melodies, license verification, human pass on AI drafts).

### Animations / attacks
- Banked pipeline (interpreter → JSON → harness) is already the tooling answer.
- Upgrade: harness grows into **Anim Studio** (#2 above) once the interpreter
  ships. Sequencing unchanged: interpreter → 3–5 anim proof batch → Anim Studio.
- Attack pose frames route through **Sprite Studio v1.2 "frame variant" mode**
  (load approved sprite → edit pose copy → export NAME_ATK1) — small add,
  infrastructure exists. Choreography JSON stays CD's lane via Anim Studio.

### World / map builder
- Phase-7 doc holds: **Build B (visual map editor) stays deferred** — its pain
  (many new areas) arrives at Routes 32+; wants a frozen tile vocabulary.
  Vibe-coding lowers its cost, not its dependency.
- **Build A (dev-only `/api/save-asset` endpoint, ~30 LOC) is pulled forward
  in principle:** it now serves Sprite Studio (exports land in assets/sprites/),
  future Sound Board mappings, anim JSONs, and tiles — the whole tool family.
  Dev-server-only, never in production builds. Mathias's approval gate is
  unaffected (approval happens in-tool before export; commits stay with CC).

## Decisions pending (Mathias)
- Green-light dev menu (#1) — recommended next tooling build.
- Green-light Build A endpoint pull-forward.
- Sprite Studio v1.1 A/B verdict → palette law → pipeline-roles v2 rewrite
  (includes ChatGPT role clarification / removal).
