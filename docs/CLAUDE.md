# Project Argent

GBC-*descended* monster-battler: Pokémon Silver reimagined with Combat 2.0 — a stance read-war (stances, stamina, focus two-steps, reads). **320×180** logical resolution, integer-scaled. TypeScript + Vite + Canvas. No game framework — the engine runs headless.

> **This file is the builder's constitution: the current canon + the source-of-truth index. Refreshed 2026-06-20 from v0.3, which predated the Focus model, the two-step, the Layer-4 trainer system, and the 320×180 target. Constants marked ⟲ are carried from v0.3 — CC: reconcile against live code and flag any drift before committing.**

## Source of truth
`docs/` is the design bible. When code and docs conflict: **docs win.** Flag conflicts; never silently change design numbers. The current canon docs:
- **Combat:** `combat-focus-redesign.md` (the Focus two-step model) + `combat-2-0-spec.md` (base layer)
- **Trainers / AI:** `trainer-archetype-catalog.md` (profile library) + `trainer-combat-profiles.md` (the 8-knob schema)
- **World / content:** `world-scope-skeleton.md`, `main-story.md`, `opening-design.md`
- **Dex:** `mon-manifest.csv` + `mon-design-template.md`
- **Visual:** `visual-north-star.md` + `art-reference/hearthwick-overworld-target.png` (the canonical overworld look) + `environment-art-target-and-pipeline.md`
- **Audio:** `audio-north-star.md`
- **Reasoning archive:** `design-journal-session-combat.md` (the *why* behind the calls)

## Canon combat (sim-gated — do not tweak casually)

**Base stance layer** ⟲
- Stamina: tier costs 12/22/35/55; regen +8/round, +6 extra in Guard; Fluid surcharge +12; Aggressive cost ×1.15. Winded ≤25 → heavy/nuke locked. Exhausted ≤0 → forced rest (+25), ×1.25 that round. No affordable move → forced rest.
- Stances: Aggressive ×1.25 dealt / ×1.15 taken; Guard ×0.75 / ×0.60; Fluid neutral.
- Guard › Aggressive: counter 0.5× reflect + stagger (next-round initiative ×0.5), if defender survives. Fluid › Guard: opening ×1.15 through ×0.85 guard, Fluid acts first, no counter. Aggressive › Fluid: **PUNISH ×1.35** — the aggressor catches the committing dodger + ★ (Combat Layer 1; flipped from the v0.3 speed-gated dodge `p = clamp((spdDef/spdAtk−1)×2, 0, 0.9)`). Aggr › Aggr: clash (p ∝ stamina×speed; loser whiffs + staggered).
- Initiative: speed / move-weight (0.85 / 1.0 / 1.15); stagger halves it. **Evasion is emergent from SPD — there is no discrete evasion stat.**
- ★ Momentum: +1 on read-wins, cap 2. Calls spend ★ (Catch Breath = rest, +35 ST).

**Focus two-step layer** (the major addition since v0.3)
- Shared wind-up (R1) + hidden release (R2) via the **rotation triangle: Heavy › Brace, Feint › Aggressive, Hide › Fluid** (each release beats one R2 stance, loses one, neutral one).
- **Release variability** is a profile knob: fixed-Heavy at the teaching floor (JAY / Falkner) → variable (mixes Feint) from Gym 2. Focusers are **stamina-aware** (bank Catch Breath to fire signatures).
- **Info discipline (Layer 3.5):** one `infoLevel` (open / veiled / opaque) drives *both* the stance-tell and the focus-tell; per-axis override reserved for bespoke bluffers.

**Type chart** — **17 types**: BASIC / FLAME / AQUA / NATURE / SPARK / FROST / BRAWN / VENOM / TERRA / GALE / PSI / INSECT / STONE / SPIRIT / DRAKE / UMBRA / FORGE — dual-type multiplicative, in `typechart.json`. (Supersedes the old "13×13" plan. CC: confirm the chart is complete.)

**Bond** — horizontal; **never touches stats.** Challenge-scaled. Calls gated by the trainer's bond with their mon. Resolve = the ceiling-breaker (what manufactured loyalty can't replicate).

**Stats** — 4 axes: HP / ATK / DEF / SPD. Pillar #2: stat **SHAPE with a tradeoff, never raw total** (no power-creep).

## Trainer AI (Layer 4 — current)
A trainer = a profile of **8 knobs** (stance · two-step · release · bond→Calls · call-use · info · terrain · adaptivity), data-driven through the shared decision tree. Bespoke = a thin overlay only (Falkner's rhythm-gust). The archetype catalog is the profile library; CH1 generic trainers are floor stamps. Bosses are data-driven cards (the **Falkner card** is the format; "Whitney" was the old placeholder).

## The sim gate (non-negotiable)
Any change to combat numbers, AI, or a boss kit re-runs the relevant ladder before merge. The canonical yardstick is **`reader`** (`src/sim/archetypes.ts`, `docs/sim-archetypes.md`). Ladders are seeded regression tests, n ≥ 2000, tolerance bands. **Bit-identical isolation:** new systems sit beside the proven path; wild AI + bespoke fights stay bit-identical unless the change is *intended* (then re-baseline + flag). Never commit failing ladders.

## Architecture ⟲
- `src/engine/` — pure TS, zero DOM, deterministic (injected seedable RNG, never `Math.random`), headless.
- `src/game/` — rendering / input / scenes / audio; consumes the engine's public API; renders by replaying engine events.
- `src/sim/` — bots + ladder runner.

## Visual direction (320×180)
**GBC design *principles*, not GBC specs** — "Silver's soul at a fidelity the hardware never allowed": 320×180, 64-color master palette, the warm HGSS-descended look. The **canonical overworld target** is `art-reference/hearthwick-overworld-target.png`; the full spec + the four refinements live in `environment-art-target-and-pipeline.md` — **(1)** Argent center-glyph, *not* the Pokéball; **(2)** overworld creatures = manifest species; **(3)** per-city material identity; **(4)** darkness arrives via Layer-5 atmosphere, never by dimming. Sprites 48–56px native, front + back per mon, via the Gemini pipeline + `sprite_ingest.py`. **Art is a data swap (Phase 7+)** — placeholder now; never block a sprint on it.

## Pillars (reject features that violate these)
Every battle a puzzle. Prep is gameplay. No grind, no HM tax, instant retry. The read-war is the difficulty curve. Bonds over strength. No power-creep (shape, not stats). Earn every mechanic's slot.

## Commands ⟲
`npm run dev` · `npm test` (units + ladders) · `npm run sim`

## Conventions
TypeScript strict. Small modules, no cyclic deps. Conventional commits, one task per commit.
