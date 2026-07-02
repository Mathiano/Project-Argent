# DECISIONS — Focus/charge fixes (from Terminal B audit + playtest observations)
Append to combat-build-status.md. Two playtest catches, both real.

## Q1 — Techniques CANNOT be Focused/charged (guard, player + AI). FIXED.
Terminal B audit (read-only, @ be909a7) confirmed: a technique COULD be Focused, but the Focus path (rawHit-only) SILENTLY DISCARDS the technique's status effect — wasting the move. Root: the engine's "effects only in the single-step triangle" is a DOCUMENTED, intentional-for-now limitation (two-pool "double-gate" deferred per config.ts:326-329, resolveRound.ts:114-116). The missing piece was a player-side GUARD (the AI was already protected — it filters techniques out of damage/Focus selection).
FIX (Mathias): prevent charging a technique for BOTH player and AI — make the rule explicit + symmetric.
- Player: gate the Focus commit path (handleMoveInput committing-toggle + commit attach) on !isTechnique(moveName) (isTechnique already exported from state.ts). Technique can still CAST single-step (which correctly applies its effect); just can't CHARGE.
- AI: confirm/make-explicit the existing protection (same !isTechnique rule).
- NO engine effect-logic change — purely a guard. The underlying single-step-only-effects behavior stays (fixing that = the future two-pool increment).
Note: 2b-1 (UI) didn't create this — techniques were always Focusable; 2b-1 made them prominent (distinct pool + status chips), raising the odds a player hits the trap. Playtest surfaced it.

## Q2 — Release label → "HEAVY ATTACK" + show the charged attack's info (clarify the mental model). 2b-2 UI item.
Terminal B confirmed: the round-1 move DOES carry through the Focus release — its TYPE, TIER, damage, and initiative all carry (via focus.move → rawHit). Heavy/Feint/Hide sets ONLY the read-outcome multiplier (win/lose/neutral vs the opponent's stance), NOT the attack's identity or tier. So it's NOT a generic heavy — it's "your attack X, released with a Heavy/Feint/Hide read-multiplier."
THE PROBLEM: the label "HEAVY" misleadingly sounds like a damage TIER (a player reasonably reads it as "a heavy-tier hit"). This is the confusion Mathias hit ("is it just a basic heavy now?").
THE FIX (Mathias): the mental model is "any attack can be charged to a Heavy / Feint / Hide — those are just MULTIPLIERS on that attack." Make it legible:
- Label: "HEAVY ATTACK" (not just "HEAVY") — "attack" signals it's YOUR attack delivered heavy, not a generic heavy tier. (Same for Feint/Hide as applicable.)
- Show the charged ATTACK's info on the right-hand detail panel during the release step — so the player SEES which attack (name/type/tier) is being released, making concrete that their move carries through and Heavy/Feint/Hide is the read-modifier on it.
=> A 2b-2 UI item (the release-picker's label text + wiring the detail panel to show the charged attack). Teaches the mechanic through the UI rather than a vague rename.
(Also flagged by B, not being acted on now: technique effects don't carry through the Focus path — same root as Q1, addressed by the Q1 guard preventing the situation.)
