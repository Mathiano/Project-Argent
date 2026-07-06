# Cry Forge v1

A procedural mon-**vocalization** workbench. Every mon gets a voice, **synthesized —
no recorded audio, ever** (the licensing discipline holds). The Forge seeds a
starting cry from the mon's own data, you sculpt it with sliders and audition at
real volume, then save a plain `Patch` JSON to `assets/cries/`.

The shipped artifact is the **feel-gated JSON**. The generator is a tool-side
starting point only — never a runtime system.

## Run

```
npm run dev        # then open http://localhost:5173/tools/cry_forge/
```

Cry Forge reads the mon roster (`/docs/mon-manifest.csv`, `/docs/ch1-batch.json`),
auditions through the **real** synth (`/src/game/sfx/synth.ts`, imported as a module),
and saves via the dev endpoint. Opened as a static `file://`: mon data + audition are
unavailable, but the editor still works in free mode and **save falls back to a file
download**.

## Zero drift by construction

- **Cry format = the shipped `Patch` schema** (`src/game/sfx/patches.ts`) verbatim,
  saved as `assets/cries/<MONNAME>.cry.json` (UPPERCASE, matching sprite/manifest
  naming). An optional `"seed"` field records the generator inputs — the game ignores
  it.
- **Audition runs the real `AudioEngine`** (`synth.ts`, dynamic-imported — it has only
  a type-only import, so it transforms to a self-contained module). No ADSR/sweep math
  is re-expressed in the tool, so what you hear is exactly what the game plays.

## The seed generator (deterministic)

A **pure function** of the mon's data — same mon in → identical patch out, always (no
randomness). Directional intent (constants live at the top of the tool, tune freely):

- **mass** = `hp + dfn` → base frequency, inverse (heavier mon = lower voice). For
  manifest-only mons with no stats, mass is **stage-derived** (later evolution stage =
  heavier) and speed defaults neutral — the UI flags this.
- **element (type1)** → timbre recipe, one per the 17 canonical types
  (`BASIC/FLAME/AQUA/NATURE/SPARK/FROST/BRAWN/VENOM/TERRA/GALE/PSI/INSECT/STONE/SPIRIT/
  DRAKE/UMBRA/FORGE`, verified against `typechart.json`): waveform + an optional harmony
  voice + a sweep bias.
- **spd** → gesture duration (faster = shorter cry) and sweep magnitude.
- **archetype** → envelope shape (Wall groans with a slow attack; Glass nuke punches
  hard and short; Trickster darts with a delayed double-tap; …). One per the 8
  archetypes.

Contrasting examples (real batch data): KINDRAKE (FLAME/Wall) → sawtooth ~187 Hz, ~0.57 s
groan · FLITPECK (GALE/Glass nuke) → sine ~405 Hz, ~0.14 s punch · GRITHOAX (TERRA/
Trickster) → triangle ~346 Hz, ~0.26 s + double-tap. Different waveform, pitch,
duration, structure — the seed makes identity audible before you sculpt.

## Editor / audition / save

- **Editor** — per-voice fields for every `Voice` property + patch gain; add / delete /
  duplicate voices (≤ 6). Values clamp to sane audio ranges on input (freq 40–4000 Hz,
  times 0–2 s, dur ≤ 1.5 s — a cry is a cry, not a song).
- **Audition** — big play button (a user gesture inits the AudioContext), replay-on-change,
  and an A/B hold slot to compare against a previous version.
- **Save / load** — validate against the `Patch` shape, then POST to `/api/save-asset`
  (`assets/cries/`, reports `{ overwrote }`); reload existing cries via `/api/list-dir`.
  Save refuses on a shape violation with a visible reason. Without the dev server, save
  downloads the `.cry.json` instead.

## Verification

The generator + validator are verified via a headless probe of the tool's own functions
(all 17 type recipes / 8 archetype envelopes present, determinism, audibly-distinct
contrasting mons, in-range values, bad-shape rejection). The `assets/cries` allowlist +
its guards are covered by `tools/dev-save-plugin.test.ts`.

## Not in v1 (banked)

In-game cry playback / event wiring (encounter, send-out, KO); a coverage grid;
evolution-line voice continuity; any batch generation without a per-cry feel-gate.
