# Design Risks & Gaps — a watch-list (NOT new design work)

**Purpose:** capture the known *risks* in the design and the *gaps* not yet covered, so they're monitored rather than discovered late. **This doc adds NO features and NO complexity** — it's a watch-list and a set of *mitigations* (guidance for how to build what's already planned). Its value is making future build decisions easier and catching problems early. When a risk is addressed or a gap is filled, note it here. Keep this doc SHORT.

---

## Part A — Design risks (things to watch as we build)

These are real risks in an otherwise strong design. Each has a **mitigation** that's *guidance*, not new work.

### Risk 1 — Design-to-build ratio is lopsided
~14 design docs; the playable world reaches one gym. Correct so far (foundation-first), but the more we design before building, the higher the chance a system doesn't survive contact with reality.
**Mitigation:** bias toward *building and playtesting* over more design-banking from here. The design is deep enough; the world needs building (Phase 7+). Trust the playtest over the doc.

### Risk 2 — Combat complexity is compounding (the biggest combat risk)
A player must eventually track: stances (triangle), speed, stamina, intent-reliability tier, up to 3 status tags, the Call economy, bond stage, 17×17 type matchups, and SCAN info. Each is individually justified and legible — but *together* they risk overwhelming. **The risk isn't that combat is too simple; it's that it becomes too much to hold in your head.**
**Mitigation:** (a) the Academy + the difficulty/intent ramp introduce complexity *gradually* — lean on them hard. (b) When building status, **be willing to CUT** a status or mechanic if the whole proves heavier than the sum. Restraint may be a feature. (c) Watch total cognitive load as a first-class metric in playtests, not just per-feature legibility.

### Risk 3 — Bond is load-bearing for almost everything, and mostly unbuilt
Bond gates: evolution, the Call economy, Resolve/status-defense, "ask your mon," personality reactions, the Concord's thesis. *Everything* leans on bond — but bond runs on an *interim* value, full build is Phase 8. **If bond doesn't FEEL right when built (the "quality-earned, never grind" model could be unsatisfying or unclear), a huge amount of the game wobbles.** Concentration risk.
**Mitigation:** consider building + playtesting the **full bond system EARLIER than Phase 8** — precisely *because* so much depends on it. Prove bond *feels* good before more systems pile on top of it. (Flag for sequencing: bond may deserve to jump ahead of other Phase 8 work.)

### Risk 4 — Core fun is unproven at length (the deepest risk)
Great *moments* exist (beating Falkner prepared), but the game's never been played for *hours*. The "preparation is gameplay, no grinding" pillar is beautiful in theory — but **does it stay engaging across 42 hours, or does "no grinding" mean "not enough to do"?** Unproven.
**Mitigation:** this is exactly what a real, longer playable slice (Phase 7+) starts to test — which is *why building now matters more than designing more.* Treat the first multi-hour playable stretch as the real referendum on the core loop, and be willing to adjust the pillar if "no grind" reads as "too little to do."

---

## Part B — Uncovered gaps (not in any doc/sprint yet)

Real omissions. None are urgent (all "before ship," not "before Phase 7"), listed by priority. **Do NOT design these now** — this is just the inventory so they're not forgotten.

1. **AUDIO (the biggest gap).** Zero mention anywhere. Music + SFX are HALF of game feel — Silver's soundtrack is iconic; battle/UI sound is huge for impact. We have a full *visual* north-star and *no* audio plan. Deserves its own doc eventually (an "audio north-star": music direction, battle/UI SFX, the role of sound in combat legibility — e.g. a status could have an audio cue too).
2. **Economy depth.** Money/Mart/payouts exist, but what do you *spend* on across 42 hours with no grinding + limited items? Risk: money becomes irrelevant. Define the sinks.
3. **End-game / post-game.** The "16 gyms, Kanto = Part 2" structure exists, but what does a player *do* after the Champion? Replayability, post-game content — undefined.
4. **Difficulty / accessibility options.** No difficulty settings discussed. A complex read-war especially benefits from adjustability for players who find it too hard (or too easy).
5. **The meta-game shell.** Save slots, options menus, controls remapping, the frame around the game — partially built, not designed holistically.
6. **World writing VOICE.** The opening is well-written, but there's no established *voice* for incidental writing (NPC dialogue tone, item descriptions, flavor). Matters enormously for a world that wants to feel alive and anime-storied. (Ties to the "journeys not corridors" pillar — the events need a consistent voice.)
7. **Learning the 17×17 type chart.** The Academy teaches *stances*; a 17-type matchup chart is a lot to learn. SCAN helps, but how does a player learn matchups without memorizing a grid? Worth a deliberate answer when type-teaching is built.

---

## How to use this doc
- **Before building a risky system** (status, bond), re-read the relevant Risk + mitigation.
- **When a gap becomes relevant** (e.g. approaching ship, or building the relevant area), pull it from Part B and design it *then* — not now.
- **Keep it short.** This is a watch-list, not a design doc. Update statuses; don't grow it into more work.
