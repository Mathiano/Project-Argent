# Call Menu — make CALL a proper menu with a shout

Fixes the silent / instant / no-exit Call. Selecting CALL currently fires the only unlocked Call **instantly**, with no text and no way to back out (a misclick trap), and the player never sees Calls are a **set** they grow into. Mostly presentation + menu UX. The Recover/Dodge Calls themselves stay **design-only** (build with the Call economy). **Engine untouched — no ladder re-baseline.**

## S1 — Call submenu (mirror the FIGHT → moves pattern)
- Selecting CALL opens a **submenu** listing the Calls — NOT an instant fire.
- Show the **full Call set** with LOCKED ones **greyed + cursor-skipped** (greyed for now; a later pass makes them invisible-until-unlocked — leave a code note). Currently only **Catch Breath** is unlocked; Recover, Dodge, and the rest (per the `combat-2-0-spec.md` Call set) show greyed.
- **B backs out** of the Call submenu to the main battle menu (fixes the misclick trap). **A** on an unlocked Call commits it; **A** on a greyed Call does nothing / a small "not unlocked yet" (or "not enough ★") toast.
- **★ cost** shown per Call; a Call the player can't afford (not enough ★) greys the same way an unaffordable move does (cursor can land, A toasts).

## S2 — The shout (make a Call FEEL like a trainer command)
- When a Call commits, show a **trainer-shout line** before/with its effect, e.g. Catch Breath → **"[MON], catch your breath!"** then the +ST effect. Use the mon's name. A Call should never be silent — this is the anime trainer-command beat. (Recover/Dodge get their shout lines when those Calls are built; the line **format** is spec'd now.)

## S3 — Spec the Call set (doc only)
- `combat-2-0-spec.md` lists the full Call set with: **name, ★ cost, effect, unlock source, shout-line format.** Catch Breath = **built**; Recover + Dodge = **designed** (per prior rulings), build with the Call economy. The submenu reads from this set, so adding a Call later is **data, not a rewrite.**

## Out of scope
Building Recover/Dodge **effects** (Call economy / Bugsy slice); the bond-gated Call upgrades (Phase 8). This sprint = the **menu, the exit, the shout, and Catch Breath working through the new menu.**

## Gate (done when)
- Selecting CALL **opens a submenu** (doesn't instant-fire); locked Calls show **greyed + skipped**; **B exits** back to the battle menu; committing Catch Breath shows a **named trainer-shout line** then applies +ST; **★ cost and affordability** shown.
- Engine untouched — **both ladders bit-identical.** Existing tests green.
- Tests: CALL opens submenu, B exits, greyed Call no-ops, Catch Breath commits with shout + effect, unaffordable greys.

## Report as audit.
