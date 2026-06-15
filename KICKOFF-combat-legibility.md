# Combat Legibility (light) — make the deterministic combat readable

The stance triangle is mechanically correct but **invisible**, so outcomes feel random when they're deterministic. This pass surfaces the **WHY**. **PRESENTATION ONLY** — no engine math, no ladder re-baseline. Plus one small story object.

## S1 — Contextual stance-interaction callouts (the core fix)
When a triangle interaction resolves, show a clear callout that names **what happened and the rule behind it**, not just the event:
- Guard vs Aggressive → **"COUNTER! GUARD turns AGGRESSION back"**
- Fluid vs Guard → **"OPENING! FLUID slips past GUARD"**
- Aggressive vs Fluid + dodge → **"DODGE! FLUID evaded — it was faster"**
- Aggressive vs Fluid + NO dodge (attacker faster) → **"Couldn't evade — too slow!"**

These partially exist as log labels; make them **explanatory** (name the rule) so the player learns the triangle by playing, and add the missing "couldn't evade" case. Surface the callout prominently (a banner during resolve), readable at the current text pace.

## S2 — Speed indicator (the hidden variable)
Speed decides **dodges AND turn order** — the single most important hidden variable. Surface the player-vs-foe speed relationship as a persistent **FASTER / SLOWER / EVEN** readout during the decision phases (the turn-order preview already computes the comparison; this makes the underlying speed relationship explicit and always-visible while choosing).

## S3 — "The Art of Combat" magazine (story seed)
An interactable in the player's **BEDROOM** (alongside the LARCH letter): a magazine, **"The Art of Combat,"** from the Violet Academy. Reading it teaches the **very basics only** — your partner can fight three ways (Aggressive / Guard / Fluid), and what the **foe** chooses matters too. A teaser, not the full triangle. Readable anytime.
- Note in `docs/violet-academy.md`: the teaching arc is now **magazine (bedroom teaser) → semi-blind first gym → Academy (full lesson)**, and the magazine's origin is the Academy (threads them).

## Out of scope
The persistent on-screen stance-triangle **legend** (that's the fuller version + the Phase 7 Academy teaches it properly); move trials; bond display.

## Gate (done when)
- A player can read **why** each stance outcome happened (Counter / Opening / Dodge callouts explain the rule; the "too slow" case is covered).
- The **speed relationship** vs the foe is visible.
- The **magazine** exists in the bedroom and teaches the basics.
- Engine untouched — **both ladders bit-identical** (no re-baseline). Existing tests green.
- Tests: callouts fire on each interaction type; the speed indicator reflects the matchup; the magazine interactable is present.

## Report as audit.
