# Catch Tuning + Legibility (from playtest)

Mostly game-side numbers + text + a visibility fix. **Engine untouched (no ladder re-baseline)** unless flagged.

## S1 — Catch curve has teeth (Mathias's ruling: option C)
Common early mons stay easy (first-try on a Route 31 common *with a good window* is fine), but the curve must **scale sharply** — rarer mons and/or fewer badges clearly resist. Verify rarity scaling actually makes a **rare mon hard** (not first-try). Tune the rarity term so the **top of the curve has real teeth** (per-species rarity tiers; a rare mon stays hard even with a good window).

## S2 — HP thresholds (quantized)
Replace the mild continuous HP factor with **quantized thresholds at 100% / 75% / 50% / 25% remaining HP**, each a progressively better catch bonus. **Window quality stays the MAIN lever** (the read is what catches — protects the anti-"beat it senseless" design); HP is a meaningful **secondary** ("soften it below half" as a real sub-goal). Document the exact bonus per threshold in `catching.ts` + `docs/catching-2-0.md`.

## S3 — Refusal writing
The willing-join refusal lines are too on-the-nose ("it sensed your bond wasn't strong enough"). Rewrite them **evocatively** — the mon's POV, a felt moment, still hinting WHAT to improve without stating the mechanic flatly. A few **variant lines** (badge-gated vs bond-gated vs rarity refusal). Keep the "teaches a lesson" intent.

## S4 — Catch Breath legibility (a real gap)
Using Catch Breath, the player can't SEE how much stamina it restored. Surface it: a clear **held** beat ("[MON] catches its breath — stamina restored!") with the **ST bar visibly jumping**. **The actual restore value is `+35 ST`** (`COMBAT.catchBreathRestore`) — confirm it's documented in the Call spec.

## Out of scope (Phase 7+ visual pass — LOG, don't build)
**The catch animation** — the ball flying, the 2–3 wiggles of anticipation, the click/breakout. This is **essential** for catching to feel right (not optional polish) — add it to `docs/visual-north-star.md` Layer 4/5 as a flagged, required item. **Do NOT build it now.**

## Gate
- Rare mons are genuinely hard to catch (curve has teeth).
- HP thresholds (100/75/50/25) give escalating bonuses, with window quality still primary.
- Refusal lines read evocatively.
- Catch Breath shows its stamina effect; the value (+35) is documented.
- Engine untouched, both ladders bit-identical.
- Tests: rarity makes a rare mon hard; each HP threshold gives its bonus; Catch Breath effect renders.

## Report as audit + the Catch Breath ST value (= +35).
