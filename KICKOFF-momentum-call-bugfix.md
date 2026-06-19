# KICKOFF — Momentum/Call accrual bug + stamina + daze legibility

## BUG 1 (PRIORITY) — momentum announced but not accrued; Calls never usable
SYMPTOM (playtest): the player WON reads — Brace vs foe Aggressive (Counter),
Fluid vs foe Guard (Opening) — and the text CLEARLY stated momentum gained
(the "(+★ you!)" read-win callout fired). BUT the ★ meter did NOT go up, and
CALL was never usable, across the first battle (the robber) and after.

NOT "wasn't winning reads" — they won, the game ANNOUNCED the gain, but
usable ★ didn't increment. DISCONNECT between the read-win event/callout and
the ★ resource that gates Calls.

INVESTIGATE the path: read-win → gainMomentum → ★ counter → Call availability.
- Does gainMomentum increment stored ★, or only fire callout/event?
- Is the callout's ★ the SAME ★ the Call system reads, or two drifted counters
  (display vs gating)?
- Did the Layer-1 ★-award flip (L1.3) break accrual — announce but not persist?
Confirm EXPECTED: winning reads accumulates usable ★; once ★ (+ bond-unlock)
suffice, CALL becomes selectable AND usable, within/after the first battle.
FIX so a read-win increments usable ★, the meter reflects it, Calls unlock.
Test: a read-win increments the usable ★ pool (not just the callout); a Call
becomes available once ★ threshold + bond-unlock are met.
(Likely explains BOTH "no momentum builds at bond 2" AND "no calls even when
momentum builds" — same disconnect.)

## BUG 2 — stamina not recovering between fights
ST not recovering after a fight (or only partially). INTENDED: a mon recovers
ST between battles (full/mostly-full) so each fight starts fresh. Confirm
current behavior (0%/50%/none?), then restore between-fight recovery (full or
near-full). Report any design reason for partial.

## BUG 3 — Daze legibility
Thrice-repeat Daze fires but the player can't tell what it DOES. Make it
legible: a clear message + indicator stating the effect ("X is DAZED — takes
extra damage this round"). Same principle as EXH/★.

## REPORT
1. Bug 1 root cause (announce-vs-accrue disconnect) + fix; confirm read-win
   increments usable ★ and Calls usable when ★+bond suffice.
2. Bug 2 current behavior + fix (ST recovers between fights).
3. Bug 3 Daze shows what it does.
Sim-gate anything touching combat math (run ladders, report). Tests green.
