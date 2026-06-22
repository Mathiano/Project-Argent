# Visual Ceiling — Ruby/Sapphire (GBA) capability, 2D, locked

**Status:** DECISION LOCKED. The project's art ceiling moves from authentic-GBC (≤4 colors/tile) to **Ruby/Sapphire (GBA) capability**: 2D tiles, 16×16, **≤16 colors/tile**, on an expanded master palette — **canvas and grid unchanged**. This is the *engine* target. **HeartGold/SoulSilver is the art *sensibility* (the visual bar), not a literal engine target** — HGSS renders its world in 3D, which is out of scope; we stay 2D. Supersedes the ≤4 ceiling in `tileset_rules.md`. Cross-ref: `visual-north-star.md` (the look this enables), `tileset_rules.md` (the rule being changed), `phase7-tooling-map-editor-and-asset-sync.md` (the studio/validator this retunes), `mon-aesthetic.md`.

## The decision in one line

**Target Ruby/Sapphire's engine capability — which is literally what we have (2D, 16×16 tiles, rich palettes) — and HGSS's art sensibility as the bar, rendered as 2D tiles.**

## Why this is the honest target (the hardware facts)

Pokémon's *map tiles* barely grew across generations. What grew was **color and shading per tile** — not tile size, and (for our purposes) not screen real estate:

| Reference | Screen | World rendering | Color budget | Engine class |
|---|---|---|---|---|
| GBC (old "limit") | 160×144 | 2D, 8/16px tiles | ~4/tile | 2D tile |
| **Ruby/Sapphire (GBA)** | 240×160 | 2D, 16px metatiles | **16/tile**, ~256 on-screen | **2D tile** |
| HeartGold/SoulSilver (DS) | 256×192 | **3D terrain** + 2D character sprites | thousands | hybrid 2D/3D |

Two facts settle the spec:

1. **Our 320×180 canvas already exceeds both GBA (240×160) and DS (256×192).** Matching either needs **no canvas or grid change** — the 32/64px-tile idea is fully retired. This is purely a color-and-art change.
2. **RSE is literally our engine; HGSS is a 3D world engine.** Matching RSE = unlock the color budget (zero architecture change). The subtle depth/tilt that defines the HGSS look is *3D geometry*, not tiles — replicating it literally means a 2D→3D renderer, a separate and far larger project. We take HGSS as the *aesthetic bar* and hit it with 2D tiles, which RSE proves is achievable.

## The spec (knobs)

| Knob | From | To |
|---|---|---|
| Tile size | 16×16 | **16×16** (unchanged — GBA's size too) |
| Per-tile color budget | ≤4 | **≤16** (GBA-faithful) |
| Master palette | 30 | **grow toward ~48–64**, additively |
| Canvas | 320×180 | **unchanged** (already beats GBA & DS) |
| Grid / camera / UI / sprites | — | **unchanged** (no rescale — the reason we stay 16×16) |
| Validator + studio | ≤4 enforcement | **retuned to ≤16** — palette discipline preserved, not retired |

## What the lift does — and doesn't

- **Does:** give *authored or curated* tiles the room to reach RSE/HGSS richness. At 4 colors that look was impossible; at 16 it's reachable.
- **Doesn't:** make raw AI textures stop being muddy. 16 colors is *headroom*, not quality. The source still has to be authored, packed, or a clean generation — but now, unlike at 4, it genuinely *can* hit the look. (This is why the earlier muddy macro texture stays blocked from the golden masters until visually vetted — passing the ≤16 budget is necessary, not sufficient.)
- **Palette coherence is now the real discipline.** RSE/HGSS palettes are deliberate, harmonious ramps. Growing the palette ad-hoc tile-by-tile risks an incoherent collage. The expanded palette should be **curated as a deliberate ramp** (an art-direction pass), not invented piecemeal. The studio's index-clamp keeps everything on-palette — exactly why it still matters at 16.

## Explicitly NOT changing

- Canvas resolution (320×180), tile grid (16×16), camera, UI, fonts, the 56×56 / 40×40 battle-sprite metrics.
- The 2D tile engine. The HGSS *3D-world* feel (tilted camera, real depth) is a legitimate but **separate, much larger future project** — not folded into this.
- The sprite pipeline (Gemini → `sprite_ingest.py`) — its own gated lane; this decision is about *terrain tiles*.

## Sequencing

- **Decision: locked now** (this doc).
- **Mechanical retune (CC, now):** budget ≤4 → ≤16; palette capacity raised additively; `tileset_rules.md` updated; suite stays green; the previously-over-budget tiles tracked as visual-rework candidates (advisory), not silently absolved.
- **Art-direction pass (Mathias/Fable, paired with the first richer masters):** curate the expanded palette ramp; author the first 16-color masters; vet whether any AI/packed source earns a place in the golden masters.
- The 4-color grass-master test is **superseded** — the target is deliberately richer now; no need to prove the 4-color floor.
