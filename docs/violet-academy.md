# The Violet Academy — design note (DESIGN ONLY, build deferred to Phase 7)

**Status:** design locked, build deferred to Phase 7 (content authoring — it's a location with NPCs + scripted teaching, built on existing dialog/script/flag verbs, no new engine systems). Placed in **Violet City**, entered/triggered **after the first gym (Falkner)**. This is Argent's tutorial — but diegetic, optional-feeling, and thematically load-bearing: it converts "the player faced the first gym under-informed" from a flaw into the *intended* arc.

**Cross-references:** `BUILD-ROADMAP.md` (Phase 7 — where this is built) · `move-mastery-trials.md` (the trial system this hub introduces + surfaces) · `bond-track.md` / `bond-track-v2.md` (the bond context this hub frames) · `combat-2-0-spec.md` (the stance triangle it teaches).

## The core idea

The first gym is faced **semi-blind on purpose.** A new player walks into Falkner not yet understanding the stance triangle, the speed/dodge relationship, or preparation — and that's correct, because the *struggle is the hook.* After the gym (win or lose), a mentor sends the player to the Academy with a line that IS the game's thesis:

> *"This time you got lucky, kid. Or maybe you've got talent. But talent runs out — next time you'll need to understand what you're doing. Go see the Academy."*

The Academy then teaches the rules the player has been feeling but not seeing. This makes the difficulty curve a *narrative*: blind struggle → "you need to learn" → mastery → prepared for gym 2.

## What the Academy is (the full hub)

A building in Violet City with several functions, each its own NPC/room:

### 1. Mechanics teaching (the stance triangle)
The thing the player has been playing blind. An instructor explains, with interactive examples:
- The three stances (Aggressive / Guard / Fluid) and their damage trade-offs.
- The triangle: **Guard beats Aggressive (Counter), Fluid beats Guard (Opening), Aggressive beats Fluid IF faster (Dodge).**
- **The hidden variable is SPEED** — dodges only work when faster; speed sets turn order. This is the single most important thing to surface, because its invisibility is what makes combat feel "random" when it's deterministic.
- No random misses — outcomes come from reads, not luck.
- Ideally a safe practice fight where the player can try each stance interaction and SEE the result labeled.

### 2. Move-mastery trials (the home for that system)
Per `move-mastery-trials.md`: this is where a mon's marquee-move trials are **introduced and tracked.** An NPC (a move tutor / sage) examines a mon and teases what it could learn:
> *"Your partner's got fire in it. It could learn FLAME RUSH — but a move like that isn't taught, it's earned. Win three reads with your back against the wall, and it'll come."*
The Academy is where the player LEARNS a trial exists and what its goal is; the trial itself completes through play (per the trials doc). The "trial in progress" UI lives on the party-menu summary screen.

### 3. Training / bond context
Ties to `bond-track-v2.md` — the place that explains *why* training a mon matters (bond unlocks moves + Call economy, not raw stats). It frames the "preparation is gameplay" pillar explicitly: you don't grind levels, you build partnership and understanding.

## Placement & gating (the ruling)

- **Location:** Violet City (the hub town between Route 31 and the gym).
- **Trigger:** the player is **sent to the Academy after the first gym** — a post-Falkner scripted beat (the mentor line above). It is prominent/flagged after the gym, not before.
- **Before the gym:** the Academy building can exist/be enterable, but the player is NOT pushed into it — the first gym is meant to be faced semi-blind. (A curious player who explores in early can get a taste, but the designed flow is gym-first.)
- This is option B: semi-blind first gym → Academy as the post-gym bridge to gym 2. The difficulty curve as narrative.

## Why this is good (and safe)

- **It's the tutorial, made diegetic** — no intrusive popups; the player goes to a *place* to learn, with agency.
- **It turns the playtest pain point into the intended arc** — "I went in blind, it felt random, I couldn't win with one mon" becomes the designed hook, resolved by the Academy.
- **It's the home for three already-designed systems** — stance-triangle teaching, move-mastery trials, and bond context all get a physical place in the world instead of floating as abstract mechanics.
- **It's cheap** — built on existing dialog/script/flag verbs; the "safe practice fight" reuses the battle scene with scripted foes. No new engine systems.
- **It scales** — later cities can have their own advanced-technique tutors (the Battle Radio / advanced-tech idea from the feature scope can route through Academy-like NPCs).

## Build constraints (when this lands — Phase 7)

- Pure content: a Violet City building + interior, NPCs, scripted dialog/teaching sequences, a scripted practice fight, flag-gated so the post-gym trigger fires once.
- The stance-triangle teaching needs the combat-legibility presentation (contextual Counter/Opening/Dodge callouts + the speed readout) to exist as the thing it's teaching — that dependency is **in progress (the combat-legibility sprint)**, not yet fully landed; see below.
- Move-trial introduction needs the trial system (builds with bond, Phase 8) — until then the Academy can teach mechanics + bond context, and the trial-tutor room lights up when trials are built.

## Relationship to the combat-legibility pass (near-term)

The Academy is the *deferred, diegetic* teaching layer (Phase 7). But the player needs *some* legibility NOW (the current demo combat feels random). The near-term legibility is itself arriving in two waves:

1. **Shipped (earlier sprints):** the boss-mechanic legibility (the GUST ROUND banner, the labelled BREAK meter, the PHASE indicator) + the basic in-battle stance labels (the stance badge + the NEXT turn-order hint + the foe-intent readout). Landed across the feel-first and demo-fix sprints.
2. **In progress — the combat-legibility sprint (`KICKOFF-combat-legibility.md`):** the **explanatory** stance callouts that name the *rule* ("COUNTER! GUARD turns AGGRESSION back", "DODGE! it was faster", "Couldn't evade — too slow!"), the persistent **speed indicator** (FASTER / SLOWER), and the bedroom **magazine**. Built and committed; **landed once that sprint is signed off**. Until then this dependency is *in progress*, not LANDED.
3. **Phase 7 (this doc):** the Academy wraps that now-visible legibility in a *place and a story* — teaching it explicitly, hosting trials, framing preparation.

The near-term legibility is the *mechanic being visible*; the Academy is the *world teaching you to read it.*

## The teaching arc (magazine → semi-blind gym → Academy)

The Academy is the *end* of a three-beat arc, not a standalone tutorial:

1. **The magazine (bedroom teaser — in progress, the combat-legibility sprint).** "The Art of Combat," a glossy from the Violet Academy, sits on the desk beside Larch's letter in the starting bedroom. It teaches only the **very basics** — your partner fights three ways (Aggressive / Guard / Fluid), and what the *foe* picks matters too. A hook, not the triangle. (Built in the combat-legibility sprint, `KICKOFF-combat-legibility.md`; landed once that sprint is signed off.)
2. **The semi-blind first gym.** The player faces Falkner knowing *that* stances exist (from the magazine + the in-battle callouts) but not yet the full triangle/speed system — the struggle is the hook.
3. **The Academy (this doc, Phase 7).** The full lesson, in a place, after the gym.

The magazine's **origin is the Academy** — it's how the institution reaches a kid in the sticks before they ever arrive. That thread is the payoff when the player finally walks in: "oh — *this* is where that magazine came from."

## Sequencing

- **Design: locked now** (this doc).
- **Build: Phase 7** (content), with the in-battle legibility pass as a near-term prerequisite (its own ruling).
- Until built: the first gym is faced blind with only the basic in-battle labels; the "go learn" arc isn't yet scripted.
