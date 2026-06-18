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

> **Playtest lens (learned 2026-06-18):** nearly every "bug" the bond/combat playtest surfaced was a **legibility gap, not broken math** — the stance-penalty "asymmetry" (the triangle, mirror-test-proven symmetric), the "frozen" turn (EXH with no message), the "6-star" bond meter, "★ never charged" (losing reads, unlabeled). Default lens for a playtest "bug": **suspect the player can't SEE the mechanic before suspecting the mechanic is wrong.** Verify the math (a test), then fix the readout.

### Risk 3 — Bond is load-bearing for almost everything, and mostly unbuilt
Bond gates: evolution, the Call economy, Resolve/status-defense, "ask your mon," personality reactions, the Concord's thesis. *Everything* leans on bond — but bond runs on an *interim* value, full build is Phase 8. **If bond doesn't FEEL right when built (the "quality-earned, never grind" model could be unsatisfying or unclear), a huge amount of the game wobbles.** Concentration risk.
**Mitigation:** consider building + playtesting the **full bond system EARLIER than Phase 8** — precisely *because* so much depends on it. Prove bond *feels* good before more systems pile on top of it. (Flag for sequencing: bond may deserve to jump ahead of other Phase 8 work.)

### Risk 4 — Core fun is unproven at length (the deepest risk)
Great *moments* exist (beating Falkner prepared), but the game's never been played for *hours*. The "preparation is gameplay, no grinding" pillar is beautiful in theory — but **does it stay engaging across 42 hours, or does "no grinding" mean "not enough to do"?** Unproven.
**Mitigation:** this is exactly what a real, longer playable slice (Phase 7+) starts to test — which is *why building now matters more than designing more.* Treat the first multi-hour playable stretch as the real referendum on the core loop, and be willing to adjust the pillar if "no grind" reads as "too little to do."

### Risk 5 — Trainer AI is a stub: the read-war only exists vs. bosses (CC code audit)
**Every named trainer except Falkner currently runs the generic random wild-AI** (uniform-random move + stance). In a *read-war*, the opponent's intelligence IS the gameplay — so right now **non-boss fights are noise** (nothing to read, nothing to outwit), and the "every battle is a puzzle" pillar is true *only for boss fights.* This is a hole in the thing the game is *about*, not just polish.
**Mitigation:** trainer AI is a core-loop system, not a finishing touch — it belongs in the build+playtest priority ladder (alongside bond and status). It needn't be as deep as a boss card, but non-boss trainers need *some* readable intent/competence (a tier between "random" and "Falkner") so route battles are actual reads. Build incrementally; even a simple "competent but not perfect" AI transforms the route feel.

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
8. **AUDIO has no SEAM (CC audit).** ✅ **RESOLVED (commit 9e64fff).** Beyond audio being undesigned (gap #1), there *was* no hook in the code for it — no sound bus, no SFX/music event points. **Now reserved:** a typed game-event seam (`src/game/gameEvents.ts`) emits at the natural battle/UI/evolve points (battle-start/end, hit-landed, ko, catch-attempt/success, menu-move, stance-selected, move-resolved, evolve; status/wiggle/level reserved). Nothing subscribes yet — audio attaches later without re-plumbing. (The audio *direction/north-star* is still gap #1, undesigned.)
9. **The FEEL layer hasn't started (CC audit).** Three related gaps: the catch sequence resolves in one line of text (no wiggle/tension animation — visual-north-star flags catch-anim REQUIRED); battles have no move-connection animation (sprites don't animate on action); no audio (above). Collectively: **Argent is currently experienced as text + static sprites — alive to the mind, not the senses.** "Moves that connect" (animation + sound + juice) is the biggest available *feel* upgrade and hasn't begun. Deferred-fine individually; worth knowing it's the next big experiential leap after the systems are proven.
10. **Overworld encounter determinism (CC audit).** ✅ **RESOLVED (commit d3f8f63).** The combat engine is rigorously seedable; the overworld encounter roll *used* raw `Math.random()` (noted in save.ts). **Now fixed:** the encounter roll routes through the run's seeded RNG, so encounter sequences are deterministic and testable — aligned with the engine's seedable model.
11. **Save migrator (CC audit) — before players, not now.** Save is `version: 1` with no migrator; any schema change nukes old saves. Fine pre-release (we re-baseline freely), but a migrator is needed *before there are players* whose saves matter. Flag for the pre-release hardening pass.
12. **Sprite throughput (CC audit).** ~3 real sprites exist; everything else is the (now-distinct) placeholders. Front+back+icon × ~200 mons is a real art mountain, and the mon-design-template's front+back framing *doubled* the per-mon count. Not urgent (placeholders are fine for testing fun), but it's the largest single *art* task and the pipeline (Gemini) should ramp before the art-pass phase.

---

## How to use this doc
- **Before building a risky system** (status, bond), re-read the relevant Risk + mitigation.
- **When a gap becomes relevant** (e.g. approaching ship, or building the relevant area), pull it from Part B and design it *then* — not now.
- **Keep it short.** This is a watch-list, not a design doc. Update statuses; don't grow it into more work.
