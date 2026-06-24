# TODO (after Layer 4 Stage 1): Trainer Archetype Catalog

**Status:** to BUILD right after CC's Layer 4 Stage 1 lands + is feel-validated. Mathias's idea: a reference of all trainer profiles for (a) audit/build-checking, (b) matching to sprites later (Youngster, Bug Catcher, Policeman, Lass, Biker, etc.), (c) authoring the broader roster without hand-designing every trainer.

## Why it's bigger than an audit list (the insight)
Trainer CLASS, visual IDENTITY, and combat PROFILE should be designed TOGETHER — they're three expressions of one character. A Bug Catcher should PLAY differently than a Policeman, and the player should be able to READ the playstyle from the sprite (Bikers charge, Policemen brace, Youngsters are teaching-baselines). So the catalog maps:

   trainer CLASS  →  visual IDENTITY (sprite)  →  COMBAT PROFILE (the 7 dimensions)  →  typical MONS

## Three uses (all want the same catalog)
1. AUDIT/build reference — a clean table of every profile to check what's wired + verify CC's implementation vs design. (Mathias's first ask.)
2. SPRITE matching — each archetype needs a sprite AND a profile; the look telegraphs the playstyle. (Mathias's second ask — pairs with the sprite pipeline.)
3. AUTHORING template — archetype templates (a "Bug Catcher" profile) stamped onto trainers of that class with per-trainer tweaks, so the full roster scales without bespoke-designing each. (How Pokémon does it — all Youngsters feel similar.)

## What the catalog contains (per archetype)
- CLASS name (Youngster, Lass, Bug Catcher, Policeman, Biker, Hiker, Camper, Picnicker, gym-trainer types, etc.)
- VISUAL identity notes (for the sprite brief — what they look like, how the look signals the playstyle)
- COMBAT PROFILE: the 7 dimensions from trainer-combat-profiles.md (stance tendency, two-step tendency, bond level→Calls, Call behavior, info discipline, terrain affinity, adaptivity) — at least the Stage-1 dimensions (stance + two-step) first, richer ones as stages land
- TYPICAL MONS (which species/lines this class tends to field — ties to mon-manifest.csv)
- DIFFICULTY tier / where they appear (early route vs late vs gym)

## Sequencing (why AFTER Stage 1)
- Stage 1 PROVES the profile dimensions work in practice (don't over-catalog dimensions that need tweaking).
- The 2-3 Stage-1 trainers (+ Falkner) become the FIRST validated catalog entries (worked examples).
- The catalog then codifies the pattern for Stage 2+ AND the broader roster AND the trainer-sprite spec.

## Cross-ref
trainer-combat-profiles.md (the 7-dimension schema + decision tree), mon-manifest.csv (which mons), the sprite pipeline (trainer sprites per archetype), combat-focus-redesign / AS-BUILT (the combat model the profiles drive).
