# The Living World — design note + forward-compatibility (DESIGN ONLY, build Phase 8+)

**Status:** design locked, build deferred to **Phase 8+** (these are the "world is alive" layer — they go ON a finished chapter, not into the chapter-building itself). **The primary purpose of this doc is FORWARD-COMPATIBILITY:** these features are core to Argent's soul (the mon as a *someone*, bonds-over-strength shown not told), so the foundation we build now — the overworld, the catch system, the save schema, KAMON's encounters — must **keep the seams open** for them. This doc is less "how to build these" and more "**what these will need, so don't foreclose them.**"

**Why this doc exists (Mathias's principle):** we raise these features now NOT to build them now, but so the foundation doesn't get built in a way that makes them require tearing everything up later. Reserving a flag or a hook now is free; retrofitting it across a built world + 200 mons + every save is expensive. This is forward-compatible design.

---

## Feature 1 — The mon reacts to the world (the soul of Argent)

**The vision:** the lead mon (eventually walking behind the player) *reacts* to places and moments — pauses at a vista, gets uneasy near a cave, perks up entering its home route, hesitates before a place that scares it. Tiny, occasional, flavored by **bond stage** and the mon's **nature/species**. This is what makes a town feel like home and the mon feel like a *companion*, not a weapon. The anime's emotional weight comes from the creature *reacting*, not fighting.

**Why it's core:** it's the most direct expression of "the mon is a someone." Every feature Mathias has loved is about relationship/consequence; this is that, in the overworld.

**FORWARD-COMPAT — what to keep open NOW (so Phase 7's overworld doesn't foreclose it):**
- The overworld must be able to know **which mon is currently leading** and read its **bond value + species/nature** (the data exists post-6a; ensure the overworld layer can *access* party[0]'s bond + species at any tile/event).
- **Reaction triggers** should be expressible as **map/event data** (a tile or region or event carries an optional "mon-reaction" hook), so reactions are *authored content*, not hardcoded — same data-driven discipline as everything else. Reserve the *concept* of a tile/region/event having an attached reaction trigger, even if unused in Phase 7.
- A **"follower mon" rendering hook** (the lead mon walking behind the player) is the eventual vehicle. Phase 7 needn't build the follower, but the overworld's actor system shouldn't be built in a way that makes adding a follower-actor painful.
- Reaction *content* (what each mon does where) is authored per-chapter later — only the *hooks* are reserved now.

---

## Feature 2 — KAMON recurs, and his philosophy visibly fails

**The vision:** KAMON (the strength-over-bonds mirror, seeded in the opening) is not a single beat — he **recurs through the game**, and his team **visibly degrades the bond way.** Each meeting: his mons are stronger but *colder* — they obey through fear/power. Over the game the player *sees* the cost: a mon that flinches from him, eventually one that abandons him. He's a **living argument against the thesis that the player watches fail** — "bonds outlast strength" earned through story, not stated.

**Why it's core:** Mathias already loves that KAMON's philosophy is shown-not-told (the opening dialogue was rewritten for exactly this). This extends that across the whole campaign — the antagonist as a *demonstrated counter-example*.

**FORWARD-COMPAT — what to keep open NOW:**
- KAMON must be a **recurring, stateful character** — his encounters carry forward (which meeting #, his team's evolving roster, the "bond-decay" beats). The encounter/flag system should support a character who shows up multiple times with *evolving* state, not a one-shot NPC. (The flag system already supports persistent state; just ensure KAMON is modeled as a recurring entity with a progression, not a single encounter.)
- His **team's "coldness"** is the visible mechanic — reserve the idea that an NPC trainer's mons can carry a *low-bond / fear-obedience* characterization that's *shown* (flinch animations later, dialogue now). Don't foreclose NPC mons having a bond-characterization.
- The **bingo of beats** (flinch → hesitation → abandonment) is authored story content per-meeting, built later. Only the *recurring-stateful-character* structure is reserved now.
- Cross-ref `opening-design.md` (KAMON's seed) — this is the payoff of that seed.

---

## Feature 3 — The mon remembers how it was caught

**The vision:** a mon caught via the **mercy path** (Path 2 — spared and healed) vs. the **read path** (Path 1 — out-fought) has a faintly different relationship with the player. The mercy-caught one starts a hair *warmer*; the battle-caught one a touch more *respectful-but-wary*. It **remembers its origin** — your two catch paths gain *lasting emotional consequence*, not just mechanical difference. Rewards the mercy-choosing player with a subtly different companion.

**Why it's core:** it makes the two-path catch system (already built) *matter beyond the catch moment*, and it's pure Argent — relationship as consequence. Mathias: "keep it in if we can build it."

**FORWARD-COMPAT — what to keep open NOW (cheapest of the three to reserve):**
- **Set a `catchOrigin` flag at catch time** — `'read'` | `'mercy'` (and maybe `'starter'`, `'gift'`) — on every caught mon, stored in the save. **This is the key reservation:** if we don't record it now, we can't retroactively know how existing mons were caught. **RESERVE THIS FIELD NOW** even though nothing reads it yet — it's one field, set at the moment of catch (Path 1 vs Path 2 is already a known branch in catching.ts), and it's *impossible to backfill* later. This is the highest-value, lowest-cost reservation in this doc.
- What it *affects* later: a small starting-bond delta (mercy = +a little) and/or flavored "ask your mon" / dialogue lines that reference the origin. Built later; the *flag* is set now.

---

## The reservation summary (what to actually do NOW)

These are the cheap-now / impossible-or-painful-to-retrofit hooks. The features build in Phase 8+; the *seams* open now:

| Reserve now | For | Cost now | Retrofit cost if skipped |
|---|---|---|---|
| **`catchOrigin` flag** (read/mercy/starter/gift) set at catch | Feature 3 | 1 field, 1 line at catch | IMPOSSIBLE to backfill — must be set at catch time |
| Overworld can read **lead mon's bond + species** at any event | Feature 1 | small access hook | painful if overworld built blind to party |
| Tiles/regions/events can carry an optional **reaction trigger** (data) | Feature 1 | reserve the concept | painful to retrofit into map schema |
| **Follower-actor** doesn't get foreclosed by the actor system | Feature 1 | design the actor system to allow it | painful actor-system rework |
| **KAMON as a recurring stateful character** (not a one-shot) | Feature 2 | model him as recurring | painful to convert a one-shot NPC later |
| NPC mons can carry a **bond-characterization** (for KAMON's coldness) | Feature 2 | reserve the concept | moderate |

**The discipline:** reserve the *hooks/flags/concepts* now; author the *content* (reactions, KAMON's beats, origin dialogue) in Phase 8+ on a finished chapter. Don't build the features into Phase 7 — Phase 7's job is to prove the chapter-building machine, nothing more.

## Sequencing

- **Design: locked now** (this doc) — purpose is forward-compatibility.
- **Reserve now (cheap, in passing as relevant systems are touched):** the `catchOrigin` flag especially (set it at the next catching touch — it's impossible to backfill). The other hooks: honor them as Phase 7's overworld + any KAMON encounter get built, so they're not foreclosed.
- **Build: Phase 8+** — the "world is alive" layer, on a finished chapter.
- Cross-ref: catching-2-0 (the two paths Feature 3 reads), bond-track-v2 (the bond Feature 1 reads), opening-design (KAMON's seed for Feature 2), visual-north-star (follower + reaction animations are art-pass items).
