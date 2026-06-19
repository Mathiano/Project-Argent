# KICKOFF — Playtest polish 3 (three quick fixes)

Three game-layer playtest fixes before Layer 2. All game-layer — no engine/
sim/ladder changes (confirm bit-identical if anything's near combat).

## FIX 1 — JAY snaps back to spawn when dialogue starts
SYMPTOM: JAY walks up to the player (good), but the moment his dialogue
triggers his sprite RESETS to his spawn tile (7,4) — looks like he teleports
back. FIX: JAY STAYS at the position he walked up to THROUGH the dialogue and
the battle (he's confronting you — he should BE there), not snap back. Visual
continuity: the walked-up position persists through the encounter.

## FIX 2 — battle text auto-advances TOO FAST (over-corrected)
SYMPTOM: the streaming text is smooth but so fast it's barely readable — key
beats fly by ("barely sees that a mon fainted"). FIX — balance it:
- SLOW the stream: ~56 cps → ~35-40 cps (readable).
- RESTORE a gentle CLICK-WALL on CONSEQUENTIAL beats (KO/faint, bond crossing,
  a Call firing, big moments) → WAIT FOR A PRESS (or pause markedly longer)
  instead of auto-flowing past. Routine text (normal hits, stance results)
  keeps the gentle auto-advance.
- Target: modern-Pokémon feel — routine flows, "FLITPECK fainted!" LANDS.
Keep the one-press-per-message advance from the last fix — just slow the rate
and make important beats wait.

## FIX 3 — momentum/★ visibility: hide the FOE's, label your OWN
DESIGN: foe momentum is HIDDEN (a bluff layer — you shouldn't know if the
opponent can Call). Your own stays visible but needs a clear label.
- HIDE the FOE's ★/momentum entirely — no ★ pips, no "MOM" on the foe panel.
- KEEP the PLAYER's ★/momentum visible, but LABEL it clearly ("★ MOMENTUM" /
  "MOMENTUM ★", whatever fits). "MOM" is too terse.
- Foe INTENT stays visible (the read-war — unchanged). Only foe RESOURCE-STATE
  (momentum) is hidden.
NOTE: foundation of a broader information-warfare layer (combat-enrichment-
roadmap.md, Layer 3.5) — opponents hide more post-gym-1. For now: hide foe ★,
label own ★. Also make momentum vs bond visually distinct if confusable.

## FIX 4 — two-step OUTCOME legibility (callouts)
Playtest: the two-step layer FEELS great but its outcomes aren't clear — the
player can't tell what happens when (a) the foe attacks during their charge
wind-up, (b) a Charge hits a one-stepping Guard, (c) a Feint hits a one-stepper
who didn't take the bait. The MECHANICS are correct; they're just invisible
(compounded by the too-fast text — Fix 2). Add clear outcome callouts (held as
consequential beats per Fix 2's click-wall):
- Charge release vs Guard → "CHARGE PIERCES THE BRACE!"
- Wind-up punished by a reading single-step → "WIND-UP PUNISHED — [mon] was
  caught charging!"
- Wind-up NOT punished (survived) → "[mon] finishes charging!" (then the big
  release beat).
- Feint vs a defensive reaction → "FEINT! [foe] took the bait — DAZED!"
- Feint vs a non-defensive one-stepper (whiffed) → "FEINT WHIFFED — [foe]
  didn't bite" (and the feinter is exposed).
- Flipped-triangle resolution (both two-step) → name the winner clearly
  ("HIDE slips the CHARGE!" etc.).
The player should be able to READ every two-step outcome. Same legibility theme
as EXH/stance-edges/★ — the math is right, surface it.

## GATE
JAY stays at his walked-up position through dialogue+battle (no snap-back);
battle text readable (~35-40 cps + click-wall on faints/KOs/key beats, routine
auto-flows); foe ★ hidden, own ★ clearly labeled, foe intent still shown; every
two-step outcome reads via a clear held callout (pierce/punished/survived/daze/
whiff/flip). Existing tests green; bit-identical near combat.
