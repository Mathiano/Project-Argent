# Phase 6a — Catching 2.0 (both paths)

Build the two-path catch system from `docs/catching-2-0.md`. Evolution is **6b** (next sprint). **Gate:** the player can catch a wild mon by **(Path 1)** winning a read to open a window and throwing a ball, OR **(Path 2)** sparing a fainted wild mon with medicine and it joining willingly.

This touches combat (a catch attempt is a battle action). **Engine-hook discipline:** the catch *math* lives game-side; only the turn mechanics may need the engine. A new `throwBall` Action kind is a **sanctioned** addition — sim-gate it: both ladders must stay **bit-identical** (the sim bots never throw, so a catch action can't move them). Report the hook + ladder impact in the audit.

## Path 1 — the read window
- **S1 — Windows open on read-wins.** Winning a read against a wild mon opens a 1-round **CATCH WINDOW**: counter, opening (Fluid-vs-Guard), dodge, or clash-win. Per Mathias: a **GUARDING foe is hard to catch** — you must hit it with Fluid for an **OPENING** to expose it (Guard foe with no read-win = no window; opening/counter/dodge = a real window). An **EXHAUSTED** foe = a standing stronger window; a **BROKEN** foe (if it carries a Break bar) = the best window.
- **S2 — Throwing.** During a window, a **THROW BALL** action attempts the catch. Catch chance = species rarity × window quality (read-win ×1.0 / exhausted ×1.5 / Broken ×2.0) × ball type × mild HP factor. Throwing **outside** a window auto-fails and raises **WARINESS**.
- **S3 — Wariness + flee telegraph.** Failed out-of-window throws raise Wariness; high Wariness → the mon telegraphs it will flee next round (a readable "it's looking for an escape" line), then flees — never instant-poof RNG.

## Path 2 — the willing join (mercy)
- **S4 — Spare a fainted mon.** A fainted wild mon can NOT be ball-caught (protects Path 1). But the player may **use medicine on the fainted wild mon** → a **WILLING-JOIN roll**, gated **primarily by badge count** (+ the mon's level/rarity as difficulty), with the active mon's **bond** as a **bonus** modifier (interim bond per S7; if untrackable, badges + rarity alone, bond bonus = 0).
- **S5 — Refusal teaches.** On refusal the mon leaves but gives a **hint** ("it didn't yet trust a trainer with so few badges" / "it sensed your bond wasn't deep enough yet") — a lesson, not just a loss. Refused = gone for THIS encounter (can respawn).

## Shared
- **S6 — Caught/joined mons enter the party** (or box if full — minimal box-add fine; full box UI stays Phase-4-deferred). The Mart gains a basic **BALL** item (the ball pocket declared since 5a now populates). New Game / early game grants a few starting balls so catching is testable immediately.
- **S7 — Bond-tracking interim (the flagged dependency).** Introduce a minimal **per-mon bond value NOW** — a tracked number, quality-earned (read-wins / boss-clears bump it; no farming). No Phase-8 benefit system — it just **exists + persists** (via save) so Path 2's bond bonus and (6b) evolution's bond gate have something real to read. Keep it simple; the full system layers on later.

## Playtest hooks
`?skip=` into a catchable wild encounter; `?bag=` can seed balls; a fast way to test both paths. Update `docs/playtest-hooks.md`.

## Out of scope (later)
Crafted bands, the Preserve, Marked-mon catches, the let-them-out-of-the-ball flavor, the Distract Call (Call economy), full bond benefits (Phase 8), evolution (6b).

## Gate (Phase 6a done when)
- **Path 1:** win a read vs a wild mon → a window opens → throw a ball → catch (chance scales with window); throwing outside a window fails + raises Wariness + flee telegraph.
- **Path 2:** spare a fainted wild mon with medicine → badge/bond-gated willing-join → joins or refuses-with-a-hint.
- Caught mons enter party/box; balls in the Mart + starting bag; minimal bond value tracked + persisted.
- Existing tests green; **both ladders bit-identical** (report any catch-action engine hook + its ladder impact).
- Tests: window opens on each read type, catch-chance math, out-of-window fail + Wariness, willing-join acceptance/refusal by badge/bond, bond value persists.

## Report as audit.
Feel sign-off: Mathias catches a mon both ways, and confirms catching feels like a READ (Path 1) and like MERCY (Path 2).
