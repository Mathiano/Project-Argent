# KICKOFF — Intent Reliability Ramp (enforce the read-difficulty curve)

**Type:** combat-feel fix, load-bearing. Near-term sprint (BUILD-ROADMAP Phase 6.7-A).
**Sources:** `docs/intent-tells-design-note.md`, `docs/combat-depth-types-status.md` Part 5 Issue A.

## Why (the playtest finding)

Intent is shown **fully honest everywhere** — including Falkner. So optimal play is
"read the tell → pick the hard counter → always win," which collapses the stance
triangle into a solved puzzle. Mathias could perfectly counter Falkner. The fix:
**intent gets LESS reliable as the stakes rise.**

This is *enforcing what's already designed* (the intent-tells ramp), not new design.

## The ramp (a per-encounter reliability level, data-driven)

**TIER 0 — HONEST** (early wild mons, the tutorial floor)
Intent shown truthfully, 1:1, as now. Easy is fine — these teach the triangle.
(`FOE INTENT: G MD ATTACK` = it really will.)

**TIER 1 — AMBIGUOUS** (trainers, early gym leaders incl. FALKNER)
Intent shown but NOT certain. The player reads **probabilities, not certainties** —
often right, not always. "Always counter" stops working. Implementation: the shown
stance is sometimes a **feint** (shows one stance, commits another) and is **never
presented as certain** (the display carries an uncertainty signal). The move-tier tag
(MD/HV) and the SPD readout stay honest — only the **stance** intent is unreliable.

**TIER 2 — OPAQUE / LYING** (late bosses, Champion-tier — DESIGN-READY, minimal now)
Stance hidden / actively deceptive (Koga-tier). Build the **hook + a basic version**
(hide the stance, show `???`); full late-game tuning (consistent per-pattern lying) is
Phase 8. Don't paint into a corner.

## Wiring

- `intentReliability?: 'honest' | 'ambiguous' | 'opaque'` on the battle scene opts,
  **defaulting HONEST** (so wild mons + every existing caller are unchanged).
- The renderer reads it and **degrades the FOE INTENT display** accordingly.
- Set **FALKNER** (real path + `?skip=falkner`) to AMBIGUOUS — the concrete playtest fix.
- This is **PRESENTATION over the foe's TRUE committed stance**. The engine still
  commits a real stance (unchanged `foeAction` → `resolveRound`); we only change what
  the PLAYER is shown. So: **engine math untouched, ladders bit-identical.** The feint
  roll uses a **scene-local display RNG**, independent of the engine RNG stream, so it
  cannot perturb foe AI or resolution. (Sim bots read TRUE engine state, never the
  rendered tell — confirmed; if that ever changes, it's the one thing to re-check.)

## Legibility (ambiguity must read as DESIGN, not a bug)

- When intent is ambiguous/opaque the display **signals uncertainty** — a
  `— HARD TO READ` tag (and `???` when the stance is hidden), not a silent lie. The
  player understands "this foe is harder to read," not "the game glitched." (This is
  exactly what the Phase-7 Academy will teach: reading gets harder.)
- The **SPD indicator + turn-order preview stay honest** — speed isn't the thing being
  hidden; the foe's STANCE intent is.

## Gate (done when)

- Wild mons show honest intent (unchanged).
- FALKNER shows AMBIGUOUS intent → blind-countering no longer always wins.
- The ambiguity is **signaled** (reads as "hard to read", not a glitch).
- The OPAQUE tier **hook exists** (basic hide-the-stance version).
- Engine untouched + **ladders bit-identical** (report any bot-reads-display impact).
- Existing tests green.

**Tests:** the reliability field degrades the display per tier; honest tier unchanged;
ambiguous tier never shows a certain counterable stance; the true committed stance is
unaffected (engine integrity — honest vs ambiguous resolve to identical final state).

## Feel sign-off

Mathias re-fights Falkner — it should no longer be perfectly counterable; the reads
should feel like reading a real opponent who's hiding from you.
