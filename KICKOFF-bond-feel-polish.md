# KICKOFF — Bond Feel Polish

The bond feel-test is CLOSE but not landing — two playtest issues. Goal:
make bond FELT (the stage-crossing beat) and resolve the momentum/Calls
confusion.

## ISSUE 1 — bond stage-crossing has NO MOMENT (clear fix)
Crossing into a new bond stage (e.g. Wary→Warming) happens SILENTLY —
Mathias only noticed by checking the summary AFTER. A relationship
milestone needs to be ANNOUNCED, like a level-up. This is the missing
emotional payoff that makes bond FELT.

FIX:
- A PROMPTED message when a mon crosses a bond stage — right AFTER the
  battle ends (not mid-fight). Like a level-up notification.
- A BEAT the player witnesses: e.g. "KINDRAKE feels closer to you!" + the
  transition "(Wary → Warming)".
- IDEALLY personality-filtered (use the reserved personality field if
  wired); if not wired, a single good generic line is fine — note it for
  personality-filtering later.
- The stage-crossing flavor beat flagged earlier as a "cool idea" — now
  confirmed ESSENTIAL. Build it.
- Use the gameEvents bus (the bond-stage-cross is a natural emit point).

## ISSUE 2 — momentum/★ + Calls confusion (INVESTIGATE, then fix/explain)
Mathias: "no momentum gathered during the fight, and no starting momentum
after the bond increased — surely a bug?" Determine BUG vs LEGIBILITY gap.

A) HOW does momentum/★ accrue? Trace it. Was "★ stayed at zero the whole
   fight" correct behavior or a bug? If he won stance exchanges and ★ didn't
   accrue → BUG. If ★ only builds from a specific action → working but
   UNEXPLAINED.
B) The Tier-I jumpstart: confirm it does NOT grant momentum at battle START
   — it grants a bonus ★ on the FIRST read-win post-Warming + fires the
   bondJumpstart message. Verify it fires + is visible when triggered.
C) LEGIBILITY (propose, don't build yet): a clear ★/momentum indicator; a
   legible reason when a Call is unavailable ("needs ★" / "needs higher
   bond"). Same theme as the EXH/stance-edge legibility work.

## REPORT
1. Stage-crossing message: built + fires after a bond-stage cross.
2. Momentum/★ root cause: how it accrues; BUG or unexplained — the specific
   answer.
3. Jumpstart: confirmed firing + visible on first read-win post-Warming.
4. A LEGIBILITY proposal for the ★/Call economy (follow-up).

If Issue 2 is a bug, fix it (sim-gate if it touches combat — run both
ladders, report). If working-but-unexplained, the fix is the 2C proposal.
Existing tests green.
