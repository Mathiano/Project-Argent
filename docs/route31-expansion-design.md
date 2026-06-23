# Route 31 — expansion design (the first journey)

**Status:** design, FIRST PASS — for Mathias's review before CC. Job: **a calm, breathing-room first taste of the wild** — the decompression after the opening theft. Grown **~3x into a real journey with distinct sections**, carrying Hearthwick's warmth forward through **environmental storytelling + characterful NPCs/trainers + one landmark set-piece**. Critically: **carries forward ALL existing Route 31 content** (JAY, ROURKE/WREN/PAX, the PIP lost-mon chain, the encounter zones, the catch-tutorial guided catch) — this is expansion, not replacement. Cross-ref: `hearthwick-design.md` (the warmth this continues), `catch-tutorial-design.md` (the guided catch fires in Section 1 — a hard pin), `opening-design.md`, `main-story.md` (the first-bond myth the landmark seeds), `violet-city-design.md` (the destination).

## The feeling — breathing room

After the emotional gut-punch of the opening (KAMON's theft), Route 31 is where the player exhales. Calm, open, sunny — the first real taste of the wild with nothing demanding of them. **Not a gauntlet.** A gentle on-ramp where you catch your first mons, wander, read the world, and breathe before the gym. Trainers are **sparse and characterful, not a wall** — we add character and *space*, not density. Hearthwick's warmth doesn't end at the town line; it fades gently outward into the wider world.

## The structure — distinct sections (~3x length)

Length earns its keep through **rhythm**: four distinct zones, each with its own character and pace, so a longer route brings variety instead of a longer corridor. The existing encounter-zone flavors (meadow / forest-edge / pondside / cave-hollow) become the spine of this sectioning — they were already hinting at it.

| # | Section | Tone | Holds (existing content rehomed) |
|---|---|---|---|
| **1** | **Meadowgate** — open sunny meadow right out of Hearthwick | the calmest; pure breathing room | First grass → **catch-tutorial guided catch (PIN)**; FLITPECK; the fellow-first-timer intro |
| **2** | **The Wending Wood** — path under tree cover, dappled, gently enclosed | a touch more adventurous | FLITPECK/GALEHAWK; ROURKE + WREN (given character); travelers'-camp environmental beat; the GRITHOAX cave-hollow as an optional side-nook off the path |
| **3** | **The Wayside** — the landmark: shrine + overlook | contemplative pause | The shrine/overlook set-piece (below); the PIP lost-mon chain centers here; PAX nearby |
| **4** | **Pondside & the Violet approach** — path skirts the pond, then opens toward the city | the world widening | MARSHMASH pondside; **JAY** (the one beat of mild tension before town); the Route 31 sign + Violet's gate |

Arc: calm meadow → woods → contemplative landmark → pond/approach → Violet. The existing trainers and beats distribute naturally across the bigger canvas, keeping density *low*.

## The landmark — the Wayside Shrine & Overlook

One set-piece, double payoff:

- **The shrine:** worn stone older than the road, a contemplative spot where travelers pause. Its carving seeds the **first-bond myth** and the **silver moon-dragon** (the cover legendary) — early, light foreshadowing, no lore-dump. (See keystone text.) Ties the bond thesis *and* the endgame legendary to the very first route.
- **The overlook:** from the shrine, the land opens and the player **sees Violet City for the first time** — the journey made visible, the destination earned by reaching this point. A perfect "breathing room" beat: a place to stop and see where you're going.

## NPCs & trainers with character

We don't add trainer *density* — we add *character* and one recurring warm face.

- **The fellow first-timer (new, recurring).** A peer the player's age who also just started, nervous-excited, loves their mon, openly bad at battling — and *not in a hurry* about it. Introduced in Section 1, crossed again near Violet. A friendly mirror and a thesis echo (bond over winning; "not in a hurry" rhymes with Hearthwick's elder). The route's recurring warmth.
- **ROURKE / WREN / PAX (existing — give character).** Keep the combat profiles; add a line and a personality each so they read as people, not stat blocks. Spread across the sections.
- **JAY (existing — the mild-tension beat).** The down-on-his-luck roadside robber (his `approachOnEnter` forced-entry stays). The one rough edge on an otherwise gentle route — but *gentle*: more pathetic than menacing, the first hint the world has hard edges without darkness. (See keystone text for tone.)
- **PIP lost-mon chain (existing — enrich).** Someone who's lost their mon in the grass, frantic to find it. The thesis as a side-quest: losing a bonded mon is devastating; reuniting them is the warm payoff. Carries real stakes for a "calm" route without combat.

## Environmental storytelling (the Hearthwick method, on the road)

Same registers — evidence of life, history, the thesis whisper — adapted to a travelled route: cold campfire remains and a rest-log worn smooth by passing trainers, a berry bush someone tends, a signpost with hand-added notes, animal tracks at the pond, a wild mon nest tucked off-path. And the thesis whisper continues — wild mons at ease near the trail, a traveller sharing food with one. Each is placement + one examine line.

## Keystone text (the lines that set the tone)

Canonical; CC matches the register for the rest. Restrained, warm, a thread of wonder — no saccharine.

**The fellow first-timer — first meeting (Section 1):**
> "You started today too? ...Me too. I haven't actually battled anyone yet — [mon]'s not really a fighter. But we're not in a hurry."

**The fellow first-timer — near Violet (Section 4):**
> "You made it! I knew you would. ...I lost my first three battles. Doesn't matter. [mon] and I had a good day."

**The Wayside Shrine (the landmark plaque):**
> "Worn stone, older than the road. The carving shows a small figure and a great winged shape, side by side, beneath a crescent. The words have mostly weathered away — only '...the first to be trusted...' remains."

**The Overlook (first sight of Violet):**
> "The land opens, and you see it for the first time — a town in the distance, a tower rising over it. Violet City. Where you're going."

**JAY (the gentle robber — tone anchor):**
> "Hand over your — ...huh. You've barely got anything, have you. Just started. ...Forget it. Battle me anyway. A guy's got to win at *something* today."

**PIP (lost-mon chain — the stakes):**
> "Have you seen them? We got split up in the grass and I can't — please, if you see a [mon], they answer to Pip—"

## Pins (preserve) & hand-off

**Hard pins — must survive the expansion (carry forward, do not wipe):**
- **The catch-tutorial guided catch** must still fire on first entry into Section 1's grass (the tutorial is built and green).
- All existing **encounter zones** (FLITPECK / GALEHAWK / GRITHOAX / MARSHMASH and the tutorial zones), rehomed into the sections.
- **JAY's `approachOnEnter`**, **ROURKE/WREN/PAX** profiles, the **PIP chain** — preserved, given character.
- The **spine traversal** (Hearthwick → Route 31 → Violet must stay walkable end-to-end; spine.test walks it — the ~3x length must not break it).
- The south entrance (`fromHearthwick`) and the north exit to Violet — endpoints unchanged.

**Hand-off:**
- **Route 31 is generator-owned** (`gen_route31.mjs`, resynced) — **extend the generator**, don't hand-edit the JSON or wipe content on regen.
- **CC build (content/layout/interactions):** placeholder art / the autotiled terrain + RSE palette — warmth is placement + examine-text, buildable now. Content first, beautify later. **Isolated from** combat, trainer AI, KAMON, Hearthwick, Violet.
- **Art dependency (separate):** the rich tiles (woods, shrine, pond, overlook) ride the first-masters art pass alongside Hearthwick's enlargement.

## Open flags for Mathias (decide before CC build)

1. **The shrine's lore depth.** This pass seeds the first-bond myth + the moon-dragon *lightly* (a weathered plaque, more mystery than exposition). Confirm that's the right touch, or say if you want the legendary kept fully off-stage until later.
2. **JAY's tone.** Drafted as pathetic-not-menacing (the gentle first rough-edge). Confirm, or pitch him with a bit more genuine threat if you want the route's one tense beat to bite harder.
3. **Section count.** Four feels right for ~3x with rhythm. If you want it even longer / more sections, or tighter to three, say so — it scales.
