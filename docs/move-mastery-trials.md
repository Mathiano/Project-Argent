# Move Mastery Trials — design note (DESIGN ONLY, build deferred)

**Status:** design locked, build deferred. Layers on top of the two existing move-unlock mechanisms (levels gate base moves; bond tiers gate signature/coverage moves — see `bond-track-v2.md`). This adds a THIRD, selective mechanism for a small number of marquee moves. Builds alongside the bond system (P1, after Calls + save/load), since it shares the event-stream + per-mon-progress infrastructure.

## The principle

Most moves come from **levels** (base kit) and **bond** (signature/coverage). That stays. Move Mastery Trials are a **selective garnish, not a tax** — only a handful of *marquee* moves (starter ultimates, legendary signatures, a few iconic line moves) are gated behind a small thematic trial instead of (or in addition to) a bond tier. The trial makes earning that specific move feel like the anime moment where a mon masters its defining technique through a *specific kind of struggle*, not a counter ticking up.

**The discipline (load-bearing):** if every move had a trial, it would be a chore. The rule is **rarity** — a trial is reserved for moves whose identity is worth a story. Target: ~1 trial per starter line (its stage-3 ultimate), the cover legendary, the three Stance Beasts, and a small handful of hand-picked iconic moves. NOT coverage moves, NOT pool moves, NOT most signatures.

## How a trial works

A trial is a **thematic micro-goal** tied to the move's identity — you unlock the move by demonstrating the *spirit* of it in battle. The trial is:
- **Legible:** the player is told the goal when the trial unlocks ("Your partner is ready to learn FLAME RUSH — but it must be earned. Win 3 reads while below half HP.").
- **Quality-gated, never grind-gated:** like bond, trial progress comes from *meaningful* play (reads, boss fights, specific tactical situations), never from farming weak encounters.
- **Per-mon:** the trial tracks on the individual mon, using the same event-stream the bond system already reads.
- **Permanent once earned:** the move is learned for good; the trial never repeats.

## Example trials (flavor — final list authored per line)

| Move | Owner | Trial (the thematic micro-goal) | Why it fits |
|---|---|---|---|
| FLAME RUSH (ultimate) | fortress-drake stage 3 | Win 3 reads while below half HP across any battles | The desperate, all-or-nothing fire move — learned under pressure |
| TIDE CRASH (ultimate) | mudskipper stage 3 | Land 2 counters in a single battle | The counter-tank's identity made into its ultimate's gate |
| VINE SLAM (ultimate) | leaf-gecko stage 3 | Win 5 dodges total (the Dodger's patience) | Mastery through evasion — the move rewards the playstyle |
| Stance Beast signatures | the 3 legends | Beat the Beast using its OWN stance against it | Thematic: you prove you understand the stance to earn its move |
| Cover legendary signature | moon-dragon | Land one read-win in each stance (A, G, F) in its fight | The all-stance boss demands all-stance mastery |

## Interaction with levels + bond

- **Levels:** still gate the base kit. Unchanged.
- **Bond:** still gates most signature/coverage moves (the general "training reveals the kit"). Unchanged.
- **Trials:** a *replacement* gate for the specific marquee move — instead of "reach bond tier IV," it's "complete the trial." A move is gated by AT MOST ONE mechanism (level OR bond OR trial), never stacked, so the player always knows the single thing to do.
- A trial may have a **bond prerequisite** (the mon must be bond tier ≥N to even start the trial — "it must trust you before it can attempt this"), but the trial is the active goal, not a second counter.

## Why this is good (and safe)

- **It's the anime moment, mechanized:** "to learn its ultimate, the partner must face a specific trial" is exactly the training-arc beat — earned through a *kind* of fight, not a number.
- **It deepens "preparation is gameplay":** a player chasing a trial plays *differently* on purpose (seeking low-HP reads, hunting counters) — the trial shapes tactics, which is the whole pillar.
- **It's anti-grind by construction:** quality-gated, rare, never repeatable, never farmable.
- **It's cheap to build:** it rides the SAME event stream + per-mon progress the bond system already records. A trial is a predicate over battle events + a per-mon completion flag. No new combat systems.

## Build constraints (when this lands)

- Trials are **data on the move/species**, not hardcoded — a trial = {moveId, predicate over the event stream, optional bond prerequisite, flavor text}.
- Shares the bond system's per-mon progress store + the event stream the renderer already replays. No new engine systems.
- The dex/move schema needs a `trial?` field on the gated move entry — flag for whenever the dex/move schema is next touched (same touchpoint as bond's `bondTier` field).
- UI: a "trial in progress" line on the mon's summary screen (party menu, Phase 4) showing the goal + progress. Until built, gated marquee moves simply aren't available (additive — nothing breaks).

## Sequencing

- **Design: locked now** (this doc), as a selective layer (option C).
- **Build: with the bond system (P1, after Calls + save/load).** Trials and bond share infrastructure; build them together.
- Until built: marquee moves fall back to bond-tier or level gating (whichever the move sheet specifies as the interim gate). The trial layer is purely additive — shipping without it costs nothing but the flavor.

**In-world home:** trials are introduced and surfaced to the player at the **Violet Academy** (the post-gym teaching hub) — see `violet-academy.md`. The Academy names the concept and signposts which mon has a trial waiting; the trial itself still completes through play, per this doc.
