# KICKOFF — Trainer Archetype engine (Layer 4, continued)

Read `docs/trainer-archetype-catalog.md` first (locked profile library + CC
handoff). The six kickoff calls are settled; this is **implementation —
engine/infra only**. No specific trainer data yet; wild AI stays bit-identical;
Falkner's feel-validated fixed-Heavy gust is the Gym-1 exception (don't touch).

Build in order; **sim-gate before wiring anything**.

## 1. Canonical yardstick
Graduate the in-line fair-fight reader (`readingPlayer` in `trainerProfiles.ts`)
to a NAMED shared sim bot alongside the `sim-archetypes.md` bots, documented.
Everything downstream gates against it.

## 2. Generic-tree absorption
The tree expresses all **8 profile knobs as data** (Stance · Two-step ·
Release · Bond→Calls · Call-use · Info · Terrain · Adaptivity). Bespoke = thin
overlay only; keep Falkner's rhythm-gust as an overlay, don't fold it in.
(Live now: stance, two-step, release, info + stamina-aware behavior. The other
knobs are declared as forward-compatible data with hooks — behavior is later
stages, per the catalog's mid/elite tiers.)

## 3. New knobs
- **release**: `fixed-Heavy | variable{feintRate}` — honor in the R2 release
  pick. Floor + Falkner = fixed-Heavy; varies (mixes FEINT, which beats
  Aggressive → bounds the masher) only for Gym-2+ profiles. The focus TELL's
  lens must stay truthful for a variable release (a {signature,feint} set maps
  to the lens that contains BOTH → a genuine 50/50, consistent across phases).
- **Stamina-aware focusers** — the tree banks stamina (catch-breath when
  winded, gated on ≥1 ★ since the engine doesn't validate foe actions) to set
  up a signature, so a Charger fires reliably.
- **infoLevel**: `open | veiled | opaque` — ONE param drives BOTH the
  stance-tell and the focus-tell; per-axis override flag reserved (Bluffer
  only, later). ('vague' → 'veiled' to match catalog vocab.)

## 4. Sim-gate
Confirm a REPRESENTATIVE profile per new knob is fair-but-distinct vs the
yardstick (test fixtures, not shipped trainer data).

## Scope guards
- Falkner stays the fixed-Heavy Gym-1 exception — don't touch his gust.
- Hold for the CH1 trainer-data hand-off; don't author trainer data unprompted.
  (The existing youngster/jay/lass floor profiles migrate to the new schema but
  stay floor; no NEW trainers.)
- Wild AI bit-identical; engine math / RNG / ladders unaffected (the tells +
  release pick are policy/presentation).

## REPORT
Audit + the yardstick doc + per-knob sim results + confirmation
ladders/wild/rival/bond bit-identical.
