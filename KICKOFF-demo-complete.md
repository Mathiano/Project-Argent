# Demo Complete — close the demo-readiness audit gaps

Closes the gaps the demo-readiness audit surfaced after Phase 5b, so the demo is **genuinely** complete, not just structurally wired.

**Gate:** a cold-start run (NO skip flags) goes intro → Route 31 → Violet City → gym → beat the gym trainer → beat Falkner → receive a badge with a real beat — and it is **provable as one continuous integration test**.

## D1 — Violet City: RULED (Mathias, 2026-06-15)

**Build a Violet City hub.** A new `VIOLET` map sits between Route 31 and the gym: Route 31 → Violet City → gym door → `GYM`. The BUILD-ROADMAP demo definition ("…Route → Violet City → Falkner") stays as written — no amendment. This also fixes B1 by moving the gym door out of the Route-31 `gym_violet` prefab (whose solid-override made the door unreachable) onto a plain, walkable Violet tile.

## B1 (BLOCKER) — the gym was unreachable

The audit's predicted integration break: on Route 31 the gym door at (11,13) is stamped under the `gym_violet` prefab and isn't a reachable walkable warp. **Fix (via D1):** the gym is entered from Violet City, not Route 31. Route 31 gets a clear, walkable south exit → `VIOLET`; Violet has a plain walkable gym-door tile → `GYM`; the `GYM` exit returns to `VIOLET`. The Route-31 prefab gym + dead warp come out.

## S1 — Badge payoff

Beating Falkner from the overworld must award a badge with a real beat:
- A **badge** (`ZEPHYR`) added to a persisted `run.badges` (additive save field, version stays 1).
- A **victory/fanfare** beat — a dedicated badge-award scene, wired into the **real overworld win path** (not just `?skip=falkner`).
- The badge **visible** — a BADGES line on the pause menu (trainer-card stand-in) + named in the award screen.

## S2 — Full-spine integration test (most important deliverable)

ONE continuous test, mirroring `coldstart.test.ts`'s harness pattern but extended to the badge: intro end-state flags (`player_has_starter`, starter seeded) → Hearthwick → Route 31 → Violet City → gym trainer fight (win) → Falkner prep → Falkner boss (win) → **badge awarded**. Retires the "never walked end-to-end" risk and guards it forever. (The pre-starter intro internals stay owned by `intro.test.ts`; this test composes from the playable-overworld start, the same altitude `coldstart.test.ts` uses — documented explicitly, not a hidden skip.)

## S3 — Falkner tuning (per Mathias's design ruling)

GRUBLEAF-into-Falkner being hard is **INTENDED** — the answer is *prepare* (train / catch a GALE counter), not "make GRUBLEAF solo-viable." So:
- **Do NOT retune Falkner** to flatten the GRUBLEAF difficulty (no lever changes; engine untouched).
- **Widen the boss-card target bands** to accept the intended starter spread (KINDRAKE/SILTSKIP fair; GRUBLEAF hard-mode), and document in the card that the intended GRUBLEAF path is a GALE counter (GRITHOAX, once catching lands in Phase 6).
- **Re-lock `falknerLadder.test.ts`** to the widened (designed) bands so the sim gate is **met-as-designed**. Measured win% are unchanged (engine bit-identical) — only the accepted bands widen. Report this re-baseline explicitly per the sim gate.

## S4 — Call unlock (design intent, log; build later with bond, Phase 8)

The first Trainer Call currently unlocks on the first wild win — wrong long-term. **Design intent:** the first Call unlocks from an EARNED BOND MOMENT (the mon reacts to the player / senses the stakes / shows trust), not a win counter; **not** gated to the badge either — it's its own beat. For the DEMO: leave it simply unlocked (don't block the demo on the bond system). Log the designed answer (memory + code comment) for Phase 8.

## S5 — Gym trainer AI (minor, log)

The gym trainer uses the generic wild AI (random move pick). Fine for the demo; note that named trainers should eventually have distinct AI so they fight like people, not wild mons.

## Gate (demo complete when)
- Cold-start NO-skip run reaches Falkner, beats the gym, gets a badge with a real beat.
- The full-spine integration test is green.
- Falkner's ladder re-locked to widened (designed) bands; sim gate met-as-designed.
- Existing tests green; both ladders bit-identical **except** the intentional Falkner re-baseline (bands widen; measured numbers unchanged) — reported explicitly.

## Report as audit.
