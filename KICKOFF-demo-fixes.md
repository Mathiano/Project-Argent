# Demo Fix Sprint — cold-spine playtest bugs + the Recover-Call ruling

Three bugs from the demo-complete cold-spine playtest, bundled into one fix sprint, plus a design note logged as canon. Engine math is **untouched** (the Falkner ladder is NOT re-baselined); the only spec change is the Call set (design only).

## BUG 1 (blocker) — the Violet exit is invisible
The Route 31 → Violet warp at `(9,13)` works but is a bare path tile with no visual cue — Mathias walked the east path (~`(15,9)`) and never saw it. Same class as the old gym-door bug: **a player can't use an exit they can't see.**

**Fix (systemic):** render a visible directional **exit marker** on every `warp` tile in the overworld (`drawObjectMarkers`) — pulsing arrow pointing the way out — so no warp is ever invisible (this + the Violet→gym door + every future exit). Plus a clear sign at the Route 31 exit approach.

## BUG 2 (blocker / logic break) — losing a fight advances you
Losing the gym trainer left the player with a fainted party in the gym, free to stumble into Falkner. Root cause: every overworld battle loss just `scenes.pop()`s back to the overworld with a **fainted party and no consequence** — there is no black-out.

**Fix:**
- **Wild / trainer loss → BLACK OUT:** heal the whole party and warp to the **last Pokémon Center** (Hearthwick Center for the demo). You never resume fainted in the field, and you can't walk into the next fight.
- **Boss (Falkner) loss → INSTANT RETRY** (honors the pillar "instant boss retry"): heal the party and re-open the prep → fight, in place — no long walk back, no softlock.
- **Add the LOSE-path test** the win-only spine test missed: lose the gym trainer → you do NOT reach Falkner (blacked out to the Center, healed, `gym_trainer_beaten` unset); lose Falkner → healed retry (prep re-opens), not a softlock.

## BUG 3 (identity-critical) — the boss mechanics are invisible
Falkner's gust rhythm / Break bar / phases are built + tested in the engine but barely surfaced. The metronome boss must *play* like one, not just compute like one. **Presentation only — no engine math change, no ladder re-baseline.**

Surface, at the boss layer (the same legibility pass we did for turn-order/stance labels):
- **(a) Gust round:** on the actual gust round, a clear "GUST ROUND" banner stating what changed (heavies cost more, the gale bites harder) — not just the round-ahead "wind is rising" telegraph.
- **(b) Break bar:** a labeled, legible BREAK meter that visibly fills on read-wins (counter / opening / dodge / clash), with a tick when it climbs.
- **(c) Phase:** a persistent PHASE indicator + a clear beat when Break fires and the phase shifts.

## DESIGN NOTE (canon) — Recover is a CALL, not an item
**Mathias's ruling:** mid-battle healing / status-cure comes from a **Call ("Recover")**, never from items. Anime-true (you call out to your mon; you don't spray a potion mid-fight) and bonds-over-stuff aligned. This **resolves the long-deferred "in-battle item use"** — we do not build it: **items heal in the OVERWORLD; Calls heal in BATTLE.**

- Add a **"Recover"** Call (heal and/or clear a status) to the Call set in `combat-2-0-spec.md`, alongside Catch Breath.
- Retire the "in-battle item use (needs an engine hook)" deferral notes — the canonical answer is now the Recover Call.
- **Build later** with the Call-economy work (Calls land in the Bugsy slice per ratification); this sprint only logs it as canon.

## Gate (sprint done when)
- Every overworld exit is visibly marked; the Violet exit is findable.
- A battle loss never leaves a fainted party in the field: wild/trainer black out to the Center healed; a Falkner loss heals + offers instant retry. Proven by a LOSE-path test (lose trainer ⇒ not at Falkner; lose boss ⇒ healed retry, no softlock).
- Falkner's gust round, Break bar, and phase are legible on screen.
- `combat-2-0-spec.md` lists the Recover Call; the in-battle-item deferral is retired in favor of it.
- Existing tests green; engine untouched; **both ladders bit-identical** (no Falkner re-baseline this sprint); build green.

## Report as audit + add the lose-path test.
