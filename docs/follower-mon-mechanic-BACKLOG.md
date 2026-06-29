# Follower Mon Mechanic — BACKLOG (a PILLAR mechanic, not yet built)

**Status:** BANKED — a SIGNATURE/PILLAR Argent mechanic, identified during the Route 31 lost-kid quest (PIP needed to follow the player, exposing that this core mechanic doesn't exist yet). Major design+build lane. Drop in `docs/`.

## What it is (the vision)
A mon that **walks behind the player in the overworld AND reacts to the world around it** — a core, signature Argent feature. Inspired by HG/SS's walking Pokémon, but RICHER: in HG/SS the follower mostly just trailed; Argent's vision is the follower **reacts** to the world (the environment, events, NPCs, locations, the mon's mood/bond). This ties directly to the bond-over-strength thesis — a partner that's *present* and *responsive*, not a pokéball abstraction.

## Why it's a pillar (not a nice-to-have)
- The bond thesis is the heart of Argent. A follower mon that's visibly *with* you and *reacting* makes the bond TANGIBLE in the overworld (not just a combat stat). It's the overworld expression of "your mon chose you."
- Connects to: the bond system (the follower could reflect bond state/mood), the read-win mon-reactions (already in combat — extend to overworld), the "mon character" design (`mon-character.md` if it exists).

## Scope (rough — needs a real design doc when engaged)
- **Core:** the lead party mon renders behind the player, follows the player's path (the classic trailing-follow — player moves, mon follows the previous tile), in the overworld.
- **Reactions (the rich part):** the mon reacts to the world — e.g. pauses at points of interest, reacts to certain tiles/locations/NPCs, shows mood (tied to bond?), little animations/behaviors. THIS is what makes it Argent vs. a generic walking-pet. Needs design: what does it react to, how, how much.
- **Rendering:** the follower is a sprite drawn in the overworld trailing the player — interacts with the layer system (does it go behind Overhead tiles like the player? yes — same walk-behind). Connects to the sprite pipeline + the overworld renderer.
- **Sprites:** needs overworld follower-sprites for mons (a sprite-pipeline concern — currently mons have battle sprites; follower needs an overworld walking sprite). May be a significant art-asset need.

## Interactions / where it touches
- **Quests** (like the lost-kid quest): once built, found/joined mons can follow (PIP could properly follow). Until built, quests use "stays put / narrative reunion."
- **Overworld renderer:** the trailing-follow + walk-behind (the Overhead layer system, already built for the player).
- **Bond system:** the follower could express bond state (mood, proximity, reactions) — the overworld face of the bond.
- **Sprite pipeline:** overworld walking-sprites for mons (new art need beyond battle sprites).

## Deferred until
After the current systems work (combat enrichment: status/moves/playstyles) AND likely needs its own design pass. NOT urgent, but it's a PILLAR — should be built before/as-part-of full world-building (a world full of areas wants the follower present). High value for the bond thesis.

## Immediate note (Route 31 lost-kid quest)
For the lost-kid quest NOW: PIP does NOT follow (the mechanic doesn't exist). PIP stays at its find-spot; reunion is narrative (the kid comes to it / "I'll take you to him"). Do NOT build a quest-specific follower hack — it'd be throwaway when the real mechanic lands. The quest works fine without physical following.
