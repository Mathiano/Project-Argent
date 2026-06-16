# Phase 7 · Sprint 1 — "The First Road" (Hearthwick → Violet City)

The first CONTENT sprint: the world stops being a skeleton and becomes a **place**. The gate is **"does this slice feel good to BE in,"** not just "does it work." This sprint builds the **chapter TEMPLATE** (route-as-stage + town-functional + art-proof) once — it does **not** build the whole world.

## The discipline (content is unbounded — DONE is explicit)
Scope is TIGHT. **Route 31 is the centerpiece** (the bulk of the work). **Violet is functional-not-lavish.** **Hearthwick is as-is.** When the DONE line is met, **STOP** — later sprints replicate the template. Out of scope is enforced below.

## The pillar — "JOURNEYS, NOT CORRIDORS"
Routes are anime-style **STAGES FOR EVENTS**, not trainer gauntlets. The space between cities is where the world feels alive. **Every future route is built as a potential stage** (recorded in BUILD-ROADMAP as a content pillar). This first route proves it with **one** small "something happens" beat.

---

## THE HEART — Route 31 made real (data-driven `ROUTE31`, the live map)
> The live `ROUTE31` resolves to the data-driven map (`route31.violet.json`); the graybox `route31.json` stays a `?graybox=1` debug fallback (smaller, legacy — not the shipped route).

- **S1 — Real length & shape.** Rebuild from the one-screen stub into a multi-screen **journey** (the camera already scrolls + clamps): a winding path that travels north→south from Hearthwick toward Violet. ~3 screens of travel, not a box.
- **S2 — Varied terrain.** Much more tall grass; a **FOREST** stretch you path through (tree cover); **WATER as scenery/border** — a pond/stream, **WALK-AROUND ONLY this sprint (NOT crossable)**. Build the water *anticipating* crossing later: a visible area beyond it you can't yet reach (the deferred-traversal seam).
- **S3 — Easy trainers.** A handful of low-stakes trainers (youngster / bug-catcher / lass equivalents), placed **approachable** (walk up + A — the existing system; no line-of-sight build), so the player **sees and chooses** to engage. Enough to feel inhabited, not a gauntlet. Existing trainer-battle verb + small rewards.
- **S4 — Terrain-varied encounters.** Several CH1 species, **varied by terrain** so the route TEACHES that different places hold different mons: open grass → **FLITPECK** (GALE); pondside → **MARSHMASH** (AQUA — a water mon by the water); forest → FLITPECK + a rare **GALEHAWK**; the cave hollow → **GRITHOAX** (TERRA, the existing Falkner counter). Existing encounter-zone system.
- **S5 — Discoverable bits + reaction-ready.** One or two items tucked **off the main path** (hidden ground items — a reason to explore), via a small new `give-item` verb. Build tiles/regions so they **CAN** later carry mon-reaction triggers (living-world.md's reserved seam) — don't build reactions, just don't foreclose them.
- **S6 — THE SEED EVENT (the pillar, proven small).** One small vignette: a **LOST MON** — a worried NPC who lost their companion, the frightened mon found off-path, reunited for a thank-you + small reward. A few dialog beats + a simple flag chain, **NOT a questline**. Built on existing dialog/script/flag verbs (+ `give-item`). This proves route-as-STAGE (events, not just encounters).

## THE ENDPOINTS — functional, not lavish
- **S7 — Hearthwick: AS-IS.** House count is fine. Cheap polish only; not the focus.
- **S8 — Violet City: FUNCTIONAL + clearly a CITY** (currently a stub). Rebuild data-driven so it reads as a city:
  - The **GYM as a real building** the player ENTERS — the gym-door warp into the `GYM` interior already exists; make the *facade* read as a real gym structure (not a flat wall block), badge flow intact.
  - The **Pokémon Center and Mart as real, enterable buildings** — new `VIOLET_CENTER` (heal + PC) and `VIOLET_MART` (shop) interiors, warped from city buildings.
  - Enough structure/buildings that it **reads as a city**.
  - **FULL POPULATION is DEFERRED** (lots of NPCs/houses/interiors/side-content) — functional now, rich later.

## THE ART PROOF — one slice (S9)
Prove the visual-north-star is achievable on **ONE** slice (Route 31 + Violet), placeholder/first-pass fine — the point is to **SEE** that "beautiful Argent" works:
- **Animated tiles** (the enabling tech is missing — add it): the data-driven tile path gains multi-frame animation. **Grass sway** + **water ripple** on Route 31 → the world *breathes* (visual-north-star Layer 3).
- **Violet's per-city material identity**: a **plaster** building material on Violet's structures (visual-north-star Layer 1).
- ONE slice as PROOF — not art everywhere.

## FORWARD-COMPAT (honor, don't build)
As the overworld is built, don't foreclose the reserved seams (living-world.md + BUILD-ROADMAP Phase 8): the overworld **can read the lead mon's bond/species**; tiles/events **can carry reaction triggers**; the actor system **doesn't foreclose a follower mon**. Don't build these — just don't block them.

## OUT OF SCOPE (defer)
Violet's full population; crossable water / traversal mechanics; the follower mon; mon-reactions (keep the seam only); the Concord / any antagonist content; new gyms past Falkner; art beyond the one proof slice; any new combat systems.

## Engine discipline
Content + overworld only. **Combat engine + ladders UNTOUCHED** (no combat math) — confirm **bit-identical**. The only non-content code is overworld-layer plumbing: the `give-item` verb + the animated-tile render path. Engine (`src/engine/`) is not touched.

## THE DONE LINE (Sprint 1 complete when)
The player can walk from Hearthwick through a **real, populated, varied, multi-screen Route 31** — fight easy trainers, find varied mons by terrain, discover an item, and hit **one** small event — into a **functional Violet City**, enter the gym as a **real building**, and beat Falkner. The route **feels like a place worth exploring** (the feel gate), and one slice shows the art target. The chapter **TEMPLATE** is proven. **THEN STOP** — Violet's richness + more routes are later sprints.

## Tests
Existing green; engine/ladders bit-identical. New: the route's maps **load + connect** (every warp target resolves, both directions); trainers/encounters/items **present**; the seed event **fires + completes** (flag chain); Violet's **gym-as-building entry** works; the **badge flow** still completes end-to-end (gym trainer → Falkner → ZEPHYR).

## Report as audit.
Feel sign-off: Mathias walks Hearthwick→Violet and confirms Route 31 feels like a **real, alive first area** (not a corridor).
