# The Opening — Argent's intro (Phase 3 design)

The first five minutes. The gate: a new player understands **who they are, where they are, and why they're leaving** — without a wall of text explaining it. Theme planted, not stated. Everything here is *scripted scenes* CC builds on the existing dialog/script/flag/warp verbs — no new engine systems.

**Naming note:** names marked ⟨placeholder⟩ are Silver-shaped working names, finalized in the rename pass before the repo goes public. KAMON (rival) is locked. The professor, town, and region names are working-only.

## The theme, in one line

**Bonds outlast strength.** The era of trainers is ending; an old professor entrusts you with a partner, hoping the tradition — and the bond between trainer and mon — outlives him. Your rival believes only raw strength endures and steals to prove it. The whole game is that argument, and the combat system *is* the argument (reads and bonds beat stat-checks). The opening plants the thesis in the first two conversations; the game spends 42 hours proving it.

## The tone

Quiet, warm, a little melancholy — NOT grimdark, NOT childish. Think the hush of a small town at dawn and an old man who knows he's passing something on. Gen 2 already had this autumnal "last game" feeling; we lean into it.

## The beats (room by room)

### Beat 1 — Your room (wake up, but with a hook)
- Player wakes in a small bedroom. A classic start — but on the desk is a worn letter from **Professor ⟨Larch⟩** asking you to come to his lab today: *"It's time. Before the season turns."*
- One object to interact with (the letter) seeds intrigue without exposition. Leaving the room is the player's choice — no forced corridor.
- **Plants:** something is ending ("before the season turns"), and you specifically were chosen.

### Beat 2 — The house (a parent, a goodbye that isn't said outright)
- Downstairs, a parent ⟨placeholder⟩ — warm, a little wistful. Not "go have fun!" but something quieter: they know this is the start of you leaving, and they're proud and sad at once. One or two lines, not a speech.
- The house is *furnished* (this is the "why am I in an empty house" fix — it's a home, with a table, a TV, plants, a parent who lives there).
- **Plants:** home is real and warm, which makes leaving it *mean* something later.

### Beat 3 — The town (small, dwindling, alive)
- ⟨New Bark analog / "⟨Hearthwick⟩"⟩ — a few houses, the lab, an NPC or two. One NPC line hints the town is quieter than it used to be: *"You're the first kid to take up training here in years."*
- **Plants:** the era is ending — concretely, not as narration. Trainers are rare now.

### Beat 4 — The lab (the inheritance, the choice)
- Professor ⟨Larch⟩: old, kind, tired. He doesn't say "pick a Pokémon!" He says something closer to: these three have been waiting for the right partner; the bond is what matters, not the type. He's entrusting you with one — a hope, not a gift.
- **The starter choice happens here, in context** — three mons (KINDRAKE / GRUBLEAF / SILTSKIP), each with the scout-style stat hint already built. Choosing is a small ceremony, not a menu.
- **Plants the thesis directly:** "Strength fades. The bond is what lasts." (His words become the game's whole argument.)

### Beat 5 — KAMON (the rival, the counter-thesis)
- KAMON is there, or arrives — and he's not a cartoon. He takes the starter that beats yours (the counter-type, per the demo canon), and his reason is a *belief*, not malice: he thinks the professor is sentimental and wrong — that strength, not bonds, is the only thing that survives. He's contemptuous of the "bond" talk.
- The demo already canonized his stolen starter *hesitates* (fights at 0.85) — that thread starts here: the mon doesn't trust him yet.
- **Plants the counter-thesis:** the argument the whole game settles. KAMON is you-if-you-believed-the-wrong-thing.

### Beat 6 — The push out the door
- Professor gives a first task with a reason to go: deliver something / meet someone in the next town (the Mr. Pokémon / errand analog), routed south through Route 31 — *which is the content you already have built.*
- **Plants:** a concrete reason to leave home, pointing at the gameplay that already exists.

## What this requires from CC (all existing verbs)

- Furnished interiors: the bedroom + the house (tile/prefab work — placeholder art fine, the *furniture as objects* is what matters).
- ⟨Hearthwick⟩ town map (small — a few houses + the lab + 2-3 NPCs), warping to the existing Route 31.
- The lab interior with the starter-choice ceremony (the starter pick already exists — this re-homes it into the lab with context).
- Scripted dialog sequences (the dialog/script verbs exist) for each beat, flag-gated so they fire once.
- KAMON's theft scene (auto-trigger script + flag) — the rival fight itself can stay where it is or move; the *theft* is the new beat.
- The "go south" task hand-off that connects the intro to Route 31.

## What this does NOT require (stay disciplined)

- No new engine systems. No combat changes. No save changes (Phase 2 covers it).
- No final art — placeholder furniture/town tiles; the art pass is Phase 7+.
- No final names — ⟨placeholder⟩ names now, rename pass later.
- The rival *fight* tuning (KAMON v2 card vs the new trio) is still queued separately — this beat is the *story* of the theft, not the rebalanced battle.

## The gate (Phase 3 done when)

A new player, dropped at the title with no outside explanation, can:
1. Start a new game and understand they're a kid in a quiet town, chosen by an old professor.
2. Walk through a *furnished* home and town that feels lived-in.
3. Receive a starter *in context* (an inheritance, not a menu).
4. Witness KAMON's theft and grasp the bonds-vs-strength tension.
5. Leave home with a clear reason, arriving at the existing Route 31.

If a playtester reaches Route 31 and can answer "who am I, where am I, why am I out here?" without us telling them — the gate is met.
