# DECISION RECORD — Sprite canon: 112px native + per-mon palettes + Sprite Studio pipeline (v2)

**Status:** RULED by Mathias, 2026-07-03. Supersedes the sprite sections of
`sprite-pipeline-roles.md` and the palette/format sections of
`gemini-sprite-briefing.md` / `mon-commission-kit.md`. Thesis: "Argent can be
the game Silver never was."

## The three rulings

### 1 · Resolution law: sprites ship at 112px native
- Battle slot is 112; engine scales by `floor(slot/size)` (`sprite.ts` L75) —
  112 renders 1×, legacy 56 renders 2×. Identical on-screen footprint,
  4× pixel budget. Zero engine change.
- Measured basis: generated sources carry a real ~8–9px implied grid
  (autocorr 0.72) → ~136px native content. 56 destroys ~60% of placed pixels;
  112 ≈ native density. GBC→HGSS-era density = "Gen-2's soul at a fidelity the
  Game Boy never allowed," now in pixels as well as sound.
- Existing 56px mons (EMBERCUB, GRUBLEAF, KINDRAKE, FLITPECK, GALEHAWK,
  MARSHMASH, SILTSKIP + backs) remain valid (2× path) and get re-exported at
  112 from their source PNGs through Sprite Studio as convenient — not a blocker.

### 2 · Palette law: per-mon extracted ramps (Sprite Studio Mode 2)
- The global MASTER_PAL is retired as a creature-art constraint (it was never
  an engine constraint — each sprite JSON carries its own palette). Authentic
  Gen-2 discipline is a small palette PER SPRITE.
- Default: extract-from-source, ~8 colors (range 4–16), near-duplicates merged.
- Shared value discipline remains the cohesion rule across 200 mons:
  dark outline, mid body, light accent (tool hints, human enforces).

### 3 · Pipeline v2: the loop is two agents + one tool
```
GENERATE (Gemini/ChatGPT/any) → SPRITE STUDIO (Mathias: grid-snap,
extract ramp, touch-up, approve at true battle scale in-tool)
→ export NAME.sprite.json → CC (batched registry wiring in sprites.ts only)
```
- Chat (coordinator) authors briefs for new mons (real-animal anchors +
  "NOT this" lists still apply — they fix WHAT gets drawn; the tool fixes HOW
  it transfers) and audits CC's registry commits.
- CD's sprite role narrows further: palette ramps are now extracted from
  source; CD keeps type-mood reference boards only, on request.
- ChatGPT has no fixed pipeline role (generation alternative only).
- `sprite_ingest.py` is retired for daily use. Known latent bug logged:
  `fit()` offy underflow (slot-filling content wraps last row to top via
  Python negative indexing) — fixed in Sprite Studio, unfixed in the Python.
- Approval remains per-sprite, in-tool, by Mathias — at true game scale
  (112→1× / 56→2× mock), never at generation scale.

## Generation prompt addendum (replaces the "max 4 colors" clause)
- Keep: original creature, real-animal anchors, "NOT this", 3/4 battle pose,
  flat white/plain background, single creature, no text/watermark.
- Change: "GBC Gold/Silver style, max 4 colors" → "crisp pixel-art style on a
  visible uniform pixel grid, limited cohesive palette (~6–10 colors), dark
  outline, bold readable silhouette." Fine feather/scale texture is now
  ACCEPTABLE (112 holds it); mush risk is gone with grid-snap.
- KINDRAKE-recipe (big bold regions) remains recommended for Wall/Counter-tank
  archetypes as shape language, no longer as a technical survival requirement.

## Provenance
- Sprite Studio v1 `f27ed93`, v1.1 `bf46ae5`, v1.2 briefed (grid-snap + 112).
- A/B evidence: side-by-side area-pool-56 / grid-snap-56 / grid-snap-112 on the
  reference bird source; Mathias picked A (112 + grid-snap) on feel.
