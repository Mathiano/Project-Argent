# Mon Character — Personality, Preferences & Quirks (DESIGN ONLY, build Phase 8+)

**Status:** design locked, build deferred to **Phase 8+**. Like `living-world.md`, the primary purpose is **FORWARD-COMPATIBILITY** — these are per-mon *character* properties that many future features read (world-reactions, "ask your mon," catch-origin flavor, KAMON's coldness, possibly a light bond mechanic). They are a **shared substrate**, so the schema fields must be **reserved NOW** so ~200 mons aren't retrofitted later. The *content* (which mon has which) is authored per-chapter as the world builds; only the *fields + the archetype set* are locked now.

**The core idea:** a mon should feel like **a *someone*** — not just a statline and a type, but a creature with a **temperament** (how it sees the world), **things it loves** (small affinities), and a **unique tic** (what makes *this* one individual). This is the emotional core of Argent — every feature Mathias gravitates toward is about the mon-as-a-person. These three properties are that, made into data.

**Critical discipline:** this is DESIGN + SCHEMA RESERVATION only. We are NOT building reaction systems, preference-bonding, or quirk-behaviors now. We reserve the *fields* so Phase 7's foundation doesn't foreclose them, and bank the *design* so Phase 8 can build the alive-layer on a finished chapter.

---

## Property 1 — Personality archetype (`personality`)

**What it is:** one archetype per mon, fixed to the species (or individual), describing **how it sees and reacts to the world.** It's the lens through which ALL its reactions/dialogue/bond-flavor are filtered — same trigger, different reaction per personality. A timid mon cowers at a cave; a bold one charges in; a proud one is unimpressed; a gentle one worries about *you*.

**The archetype set (~8 — small, enumerable, covers the emotional range, maps onto mon design):**

| Archetype | Worldview | Example reaction (cave) | "Ask your mon" flavor lean |
|---|---|---|---|
| **Timid** | cautious, easily spooked | cowers, hangs back | seeks reassurance |
| **Bold** | fearless, eager | charges ahead, excited | restless, wants action |
| **Gentle** | caring, worries about you | checks on *you*, protective | warm, attentive |
| **Proud** | dignified, self-assured | unimpressed, aloof | expects respect |
| **Loyal** | devoted, steady | follows your lead trustingly | deeply bonded-leaning |
| **Wild** | untamed, instinctive | alert, predatory, twitchy | independent, slow to trust |
| **Serene** | calm, wise, unshakeable | unbothered, observant | patient, knowing |
| **Imperious** | superior, commanding (LEGENDARY slot) | *contemptuous* of danger, never afraid | aloof even at high bond |

- **Imperious** is the legendary/prestige slot — it reacts from *superiority*, never fear (solves the "a legendary wouldn't cower at a cave" problem Mathias flagged).
- The spread covers the axes: fearful↔fearless, self-focused↔you-focused, wild↔serene.

**THE TWO-AXIS MODEL (important):** reaction = **personality × bond stage.** Personality is *who the mon is* (fixed); bond is *how close you are* (grows). A Proud mon at high bond is still proud — just *proud and devoted* rather than *proud and aloof*. A Timid mon at low bond hides; at high bond it's still cautious but *braver because you're there.* This two-axis interaction is what makes reactions rich rather than flat. Bond already exists (6a); personality is the axis to reserve.

---

## Property 2 — Environment preferences (`preferredEnvironment` / `dislikedEnvironment`)

**What it is:** small, specific affinities — a NATURE mon lights up in forests, a FROST mon in snow, an AQUA mon is unhappy in deserts. Tags for environments a mon *loves* and *dislikes*.

**What it feeds:**
- **World-reactions (Feature 1 of living-world):** this is *why* a mon perks up on its home route or gets uneasy in a hostile biome — the reaction system needs this data anyway.
- **A possible light bond mechanic (later, optional):** a mon in its preferred environment might bond *slightly* faster (it's somewhere it loves) — a gentle, on-theme nudge, never a grind. Design-flagged, not committed.

**Reserve now:** `preferredEnvironment` + `dislikedEnvironment` tags on the mon schema. Populate per-mon as the world's biomes are defined. (Note: distinct from any generation-side `habitatTags` — this is the mon's *emotional* affinity, not its spawn table.)

---

## Property 3 — Quirk (`quirk`)

**What it is:** one small **unique behavioral signature** per mon — not a whole personality, a single memorable tic. *This* mon always shakes off water; *that* one hoards shiny objects; this one sleeps curled a specific way; that one is afraid of one specific thing. The difference between "a Timid mon" and "*my* Timid mon who's specifically scared of GALE types."

**What it's for:** the **individual** touch — what makes a *specific* companion feel uniquely yours beyond its species archetype. It's the detail players form attachment to.

**Reserve now (lightly):** a `quirk` field (a flavor string / small structured tic). This is **more content than schema** — it's authored later (per-species, or even rolled per-individual for extra uniqueness) — so the reservation is light: just ensure the schema has somewhere to put it. Don't author quirks now; keep the door open.

---

## Reservation summary (what to do NOW)

All three are cheap-now / painful-to-retrofit-across-200-mons. **Schema reservation only — no behavior built now.**

| Reserve now | Property | Read by (later) |
|---|---|---|
| `personality` (one of ~8 archetypes) | Temperament | world-reactions, ask-your-mon, catch-origin flavor, KAMON-coldness |
| `preferredEnvironment` / `dislikedEnvironment` (tags) | Affinities | world-reactions, possible light bond nudge |
| `quirk` (flavor string / small tic) | Individual signature | reaction flavor, ask-your-mon, the "uniquely mine" feeling |

**The discipline:** reserve the *fields + the archetype enum* now; author the *content* (which mon is which, the quirks, the per-environment reactions) in Phase 8+ on a finished chapter. The features that READ these are in `living-world.md` (world-reactions, KAMON) and the existing systems (ask-your-mon, catch-origin) — this doc is the *substrate* they read.

## Sequencing

- **Design: locked now** (this doc) — the archetype set + the two-axis model are final; the schema fields are the reservation.
- **Reserve now (in passing, when the mon schema is next touched):** `personality`, `preferredEnvironment`/`dislikedEnvironment`, `quirk` — optional fields, populate-later, so 200 mons aren't retrofitted. (Same class as `catchOrigin`.)
- **Build: Phase 8+** — the reaction/preference/quirk *behaviors*, on a finished chapter, reading this substrate.
- Cross-ref: living-world.md (the features that read personality — reactions, KAMON), bond-track-v2 (the bond axis that personality multiplies with), catching-2-0 (catch-origin pairs with personality for caught-mon character), evolution-design ("ask your mon" reads personality for flavor).
