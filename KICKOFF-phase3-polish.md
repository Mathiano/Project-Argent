# Phase 3 polish — dialogue rewrite + system hard-gate

Phase 3 follow-up. **No new engine systems** — dialogue data + existing flag/warp gating only. Closes the two real gaps from cold-start playtest: KAMON's motive and Larch's framing both need to LAND from the lines themselves.

## Part 1 — Dialogue rewrite

Use these lines (tune length to the text-box; keep the intent).

### LARCH (pre-starter, the "why you / why now")
- "You're the last one who answered. Years ago there'd be a line of children at my door on a morning like this. Now... just you."
- "I'm not giving you a partner — I'm asking you to carry something. The way of the trainer, before it's gone for good. These three have been waiting. Not for the strongest hand. For the right one."

### LARCH thesis (kept, at the moment of choice)
- "Strength fades. The bond is what lasts. Prove me right."

### KAMON theft scene
KAMON must SHOW his belief, not just grab and go:
- "Sentiment. He hands the future to a kid because of 'bonds.'"
- "Strength is the only thing that's ever lasted. Not feelings. Not some old man's hope."
- (takes the counter-type starter) "I'll prove it with the one that beats yours. Don't take it personally — I intend to be right."
- (stolen mon hesitates, per 0.85 canon) "...It'll learn."

### Optional (approved): Larch names the player's starter
A small `if-flag` branch in the post-theft / post-pick dialog: "That FLAME of yours..." / "That SPROUT of yours..." / "That SPLASH of yours..." — makes it personal.

## Part 2 — Gating (soft for story, HARD for system-critical)

### HARD-GATE
The player CANNOT leave Hearthwick south into Route 31 until they have a starter (flag `player_has_starter`). Block the south warp / edge with an NPC or sign that turns the player back:
- e.g. town-edge NPC: "Heading out? Not without a partner, you're not. See the Professor first."
- Remove the block once `player_has_starter` is set.

**Rationale:** prevents a starterless player reaching wild encounters they can't fight. This is a system necessity, not just story.

### SOFT-GATE everything else
Letter, Mom, town NPCs stay reachable-but-skippable (player agency for narrative). Do NOT force-read those.

KAMON theft already requires `player_has_starter` — keep that.

## Gate (done when)
- A new player cannot reach Route 31 without a starter.
- KAMON's belief and Larch's framing are legible from dialogue alone.
- Existing tests green; both ladders bit-identical; CI green.
- Add a test asserting the south exit is blocked pre-starter and open post-starter.

## Report as audit
Feel sign-off: Mathias replays the cold intro and confirms KAMON's motive + the why-you-pick-a-mon now land.
