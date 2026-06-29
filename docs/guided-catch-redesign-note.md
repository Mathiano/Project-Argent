# Guided-Catch Tutorial — Redesign Note (onboarding fix)

> **✅ DONE (2026-06-29, Option 1).** The guided catch now fires on the player's FIRST
> WILD ENCOUNTER on Route 31 (contextual), not on a grass step. Trigger:
> `shouldFireGuidedCatch(map, has)` in `tutorialCatch.ts` (ROUTE31 + `catch_lesson_done`
> + not `route31_guided_catch_done`), consulted by `main.ts`'s `onEncounter`, which
> wraps the encounter as `pushTutorialCatch()` (always a FLITPECK — reliable regardless
> of the rolled species) + sets the once-flag. The old `start-tutorial-catch` grass
> step-on was removed from `buildRoute31`. Tests in `route31expansion.test`. The lake
> sign was also fixed (its decor sprite was on the Collision layer in a STALE fixture
> snapshot; re-snapshotted from the corrected source → it renders on Props).
>
> **First-zone note (flag):** the first reachable grass zone from the north entrance is
> `encounter_route31a` = FLITPECK/GALEHAWK *mixed*. This does NOT affect the tutorial
> (the interrupt always shows a FLITPECK), but post-tutorial the first wild you meet
> could be a GALEHAWK. If you want the very first wild population pure FLITPECK for
> thematic transfer, make that first zone FLITPECK-only — optional, not a blocker.

**Status (historical):** DESIGN ITEM identified during the live Route 31 walkthrough.

## The problem (observed live)
The guided-catch tutorial currently fires on a **zone-entry step** in the Meadowgate grass (§1) — it triggers *spatially* (walk into the grass area) regardless of context. So it can fire "in the middle of the road with no context" — teaching catching when there's no wild mon present, no narrative reason. A tutorial firing in a vacuum feels like a bug even when working as coded. Teaching catching with nothing to catch is confusing + breaks immersion.

## The fix (Mathias's instinct — sound)
The guided-catch should fire on the player's **first actual wild encounter**, NOT on stepping into a grass zone. Rationale:
- Contextual — you learn to catch *when actually facing a catchable wild mon* (the lesson arrives at the moment of need).
- The natural teaching moment — the first wild encounter is exactly when "how do I catch this?" becomes a real question.
- Immersive — the tutorial is woven INTO the encounter, not bolted onto the terrain.

## The design decision nested inside (Mathias to decide)
**When/how exactly does it fire?** Options:
1. **Interrupt the first RANDOM encounter** — the first wild encounter triggers an interrupt ("here's how catching works") then proceeds as a guided fight. Lighter to build; but the mon is whatever the random roll gives (any route species).
2. **A DESIGNED scripted first-encounter** — the first "encounter" is a controlled, authored tutorial encounter with a CHOSEN gentle/catchable mon, distinct from random encounters, where catching is walked through. More polished (like many great games' first-encounter teaching), but more to build (a scripted first-encounter distinct from random rolls).
3. (Weaker) Fire AFTER the first encounter ends — teaches after the moment. Not recommended.

**Lean:** Option 1 or 2. Option 2 is most polished (controlled mon + moment) but more authored; Option 1 is lighter but still contextual. Mathias's call — it's onboarding-feel design.

## Build implications
- Move the trigger from zone-entry (spatial) to first-wild-encounter (event-based) — hook the encounter system's "first encounter" rather than a grass step-on.
- Gate stays `catch_lesson_done` (once).
- If Option 2: needs a scripted first-encounter (a chosen mon, distinct from the random encounter roll) — more engine work (a "scripted encounter" path vs. the random encounter path).
- Connects to: the encounter system (where encounters trigger), the catch system, the onboarding flow.
- Note: this is a Route 31 onboarding beat, but the PATTERN (tutorial-on-first-relevant-moment) is reusable.

## Also (minor, batch with corrections)
- Missing sign sprite by the lake (a sign_ marker's sprite didn't render) — small wiring/asset fix.
- (Any other minor visual corrections from the walkthrough.)
