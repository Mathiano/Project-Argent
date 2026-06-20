# KICKOFF — Focus-tell phase clarity

Small Foe Intent legibility fix: the trainer Focus tell currently shows the
SAME phrase on the wind-up round (R1) and the release round (R2), so the
player can't tell which phase they're in. Fix by distinguishing the VERB
while keeping the LENS vocabulary intact.

## THE CHANGE
The Foe Intent line for a focusing trainer changes per phase, keeping the
narrowing-lens (attack/outwit/move fast) consistent so the LEARNED VOCABULARY
isn't disturbed. Only the verb changes.

**R1 (WIND-UP — committed to focus, not yet releasing):**
- open: "<foe> is charging to attack" (Heavy/Feint) / "...to outwit"
  (Hide/Feint) / "...to move fast" (Heavy/Hide)
- vague: "<foe> is gathering intently"
- opaque: "<foe> is gathering..."
- no-info legacy fallback: "<foe> is gathering"

**R2 (RELEASE — resolution is THIS round; EXISTING phrases, unchanged):**
- open: "<foe> focuses to attack" / "...to outwit" / "...to move fast"
- vague: "<foe> is focusing intently"
- opaque: "<foe> FOCUSING"
- no-info legacy fallback: "<foe> is focusing"

Wind-up gets the NEW "charging / gathering" vocabulary; release keeps the
EXISTING "focuses / focusing" vocabulary. Learned vocabulary preserved; phase
signal added.

## WHY THIS MATTERS (not just legibility)
The wind-up round is the FOE'S VULNERABILITY WINDOW — the player can interrupt
with Aggressive ("WIND-UP PUNISHED"). Currently invisible in the tell: the
player can't tell wind-up from release, so they don't know to use the punish
window. The "is charging to..." verb is a TACTICAL INVITATION. Cheap UI fix,
real tactical depth.

## WIRING
- battle.ts `focusIntentTell` / `FOCUS_NARROW_HINTS` / `degradeIntent` — extend
  so routing picks the WIND-UP phrase set or the RELEASE phrase set per the
  focus phase.
- The lens (attack/outwit/move fast) and discipline (open/vague/opaque) are
  unchanged. Only a phase flag (wind-up vs release) is new to the routing.
- Same name-salted consistency: a trainer's lens is the same across both phases
  of one Focus ("JAY is charging to attack" → "JAY focuses to attack").

## SCOPE (do NOT change)
- Player-side own Focus HUD labels ("FOCUSING" / release menu) — leave as-is.
  Foe-side tells only.
- The lens vocabulary — unchanged.
- The discipline tiers — unchanged structurally; just extended to phase-aware.
- Engine math / focus mechanic / RNG / ladders — UNAFFECTED. Pure presentation.

## GATE
- Foe Intent shows "is charging to X" (wind-up) and "focuses to X" (release)
  (open), lens X consistent per trainer across both phases.
- Vague: "is gathering intently" (R1) → "is focusing intently" (R2).
- Opaque: "is gathering..." (R1) → "FOCUSING" (R2).
- Engine RNG / ladders / sim balance — bit-identical (UI text). Confirm.
- Existing tests green + new tests: per-phase routing on each tier, lens
  consistency across the two phases of one Focus, wind-up phrases truthfully
  contain the chosen release per the lens.

## REPORT
Audit + test additions + confirmation ladders are bit-identical.
