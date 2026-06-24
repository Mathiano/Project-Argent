# Combat — Initiative as a Read (BACKLOG, not yet designed)

**Status:** IDEA logged for later — Mathias's direction. NOT a current build, NOT yet a full design. Capture-only, so it isn't lost and so whoever designs it later builds **on** the existing combat stack rather than restarting it. Cross-ref: `combat-2-0-spec.md`, `combat-focus-redesign.md`, `intent-tells-design-note.md`, root `CLAUDE.md` (Combat Layer 1 — the live triangle + SPEED model this extends), `combat-backlog-banked.md`.

## The idea (Mathias's framing)

Right now turn order is **emergent from SPEED** (Layer 1): the faster mon acts first, passively. The idea: layer a **player-influenceable initiative modifier** on top, so **who acts first becomes something you earn through correct reads — and forfeit when you misplay or forget.**

The point is to turn turn order from a *passive stat check* into an **active decision surface**:
- Acting first should be a thing you can *set up* by making the right call.
- Misplaying (or forgetting) hands initiative to the opponent — who then acts first / punishes you.
- So it's no longer "the faster mon always goes first, every time" — initiative becomes contestable.

## Why it fits (the thesis case)

This is **the read-war extended into the turn-order layer.** The game's whole pillar is *win by out-reading the opponent, not by out-statting them.* Initiative-as-a-read is that pillar applied to *who moves first* — you out-read them for the initiative, or you lose it. It's on-thesis by construction, which is why it's worth pursuing (vs. a generic "speed stat," which would just be more numbers).

## THE HARD CONSTRAINT (Mathias, explicit)

**Build on the existing combat mechanics. Do not restart, do not break what works.** The combat stack is sim-validated and feel-validated (the Focus two-step, the rotation triangle, Layer 4 trainer AI, the canonical reader bot at ~65–70%). This idea must **extend** that, not replace it. Specifically:
- It must compose with the **existing turn-order/SPEED model** (Layer 1), not override it wholesale.
- It must compose with the **Focus two-step** (R1 wind-up / R2 hidden release) — initiative likely lives *inside or adjacent to* that loop, not as a separate parallel system.
- Any change must be **sim-gated against the canonical reader** before merge (does it preserve the ~65–70% skill ceiling, or does it warp balance?).
- It must not invalidate the existing combat tests or the trainer AI tuning.

## Open design questions (for when it's actually designed — NOT now)

These are flagged so the eventual design pass starts from the right questions, not a blank page:
1. **What's the modifier?** A stance/release choice that grants initiative? A spent resource (★/Focus)? A successful read (winning the rotation triangle shifts who goes first next round)? A setup action that trades this turn's tempo for next turn's initiative?
2. **How is it surfaced?** The player must be able to *see* the initiative state and the consequence of losing it (consistent with the info-warfare vocabulary layer) — otherwise "you forgot and got punished" feels random, not earned.
3. **How much does going first actually matter?** Mathias noted "who acts first has a lot to say in some aspects of combat" — does first-action enable specific effects (interrupts? a release that only works if you're first?), or is it purely the tempo advantage it already is? This determines how *valuable* the modifier is and therefore how much it should cost.
4. **Where does it live in the loop?** Inside the Focus two-step (initiative resolved as part of the R2 release rotation), or as a layer around it? Leaning toward *inside* — extending the existing resolution, per the hard constraint.
5. **Does level/growth factor in?** Mathias floated "perhaps there should be some level" — i.e., does the initiative ceiling scale, or is it purely read-driven? (Read-driven is more on-thesis; a scaling component risks reintroducing the stat-check the idea is meant to escape.)

## Sequencing

- **Now:** logged only (this doc). No build, no design pass.
- **When picked up:** a proper design pass (this chat + Fable design authority), *then* sim-gate against the canonical reader, *then* a scoped CC build with explicit "extend, don't replace" fences — same discipline as every combat change to date.
- **Do not** let this jump ahead of CH1 art / the current frontier on impulse — it's a combat-depth enrichment, not a blocker. Bank it; build it deliberately when combat is the active lane again.
