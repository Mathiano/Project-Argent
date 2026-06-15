# KICKOFF — Intent Language (honest-partial model)

**Type:** combat-feel refinement. Supersedes the feint/best-guess model from the
first 6.7-A pass with a cleaner **honest-partial** model.
**Presentation only** — engine untouched, ladders bit-identical (same separate
display-RNG guarantee; the foe's true committed stance is unchanged).

## The model

Intent is **honest but PARTIAL**; vagueness narrows to two stances; resolution
confirms in plain language. A higher tier shows *less*, never something false.

### Intent display, by reliability tier

- **HONEST** (wild, easy trainers) — plain-language EXACT stance:
  "FOE INTENT: GALEHAWK attacks aggressively" (Aggressive) / "…braces" (Guard) /
  "…strikes with agility" (Fluid). Full clarity. **Replaces the cryptic F/A/G +
  "MD ATTACK" codes everywhere** (a pure legibility win — applies to all fights).
- **AMBIGUOUS** (harder trainers, gym leaders incl. FALKNER) — an honest hint
  that **narrows to two stances** (never a lie, always halves the guess):
  - "intends to attack" → Aggressive **or** Fluid (not Guard)
  - "looks focused" → Guard **or** Fluid (not Aggressive)
  - "is hard to read" → Aggressive **or** Guard (not Fluid)
  The shown hint's pair always CONTAINS the true committed stance; pick uniformly
  among the hints whose pair contains it, so each hint stays a genuine 50/50 (a
  fixed per-stance mapping would collapse one hint into a perfect tell). The
  player reads a real 50/50, never deceived.
- **OPAQUE** (Elite Four, Champion, late bosses) — **no indicator at all**
  ("FOE INTENT: ———"). Pure cold read. The hook exists; this just shows nothing.

### Resolution confirmation (always, all tiers — the teaching loop)

When the move resolves, the log confirms in plain language what the stance WAS:
"GALEHAWK attacks aggressively!" / "GALEHAWK braced." / "GALEHAWK struck with
agility." So the player learns whether their read was right. **This is what makes
the ambiguous/opaque tiers learnable.**

## Wiring

- Reuse the `intentReliability` field (honest/ambiguous/opaque) from last sprint.
  FALKNER stays ambiguous; default wild = honest.
- The narrowing logic + plain-language strings are **pure presentation over the
  true committed stance**. Same separate display-RNG / engine-integrity guarantee
  as last sprint — ladders bit-identical, the byte-identical-resolution test holds.
- The FOE INTENT bar is a **sentence now, not a badge** — make sure it fits / no clip.

## Seam (forward design, do not build)

Build the intent presentation **action-type-agnostic** — an intent is "an action
being telegraphed"; stance is one kind, a **Call** is another. Keep the seam open
so a future enemy-Call telegraph ("the leader reaches for something…", narrowed/
hidden by tier) and the player's own Call-confirmation flow through the same path
without a rewrite. Don't build Call-intent now.

## Doc

Update `docs/intent-tells-design-note.md` to this honest-partial model (it
supersedes the cruder feint approach): the reliability ramp now =
honest(exact) → ambiguous(narrow-to-2) → opaque(nothing), plus an always-on
plain-language resolution confirmation.

## Gate (done when)

- Honest tier shows the exact plain-language stance.
- Ambiguous shows a narrow-to-2 hint that ALWAYS contains the true stance (never lies).
- Opaque shows nothing.
- Resolution always confirms in plain language.
- The bar fits the longer text (no clip).
- Engine untouched + ladders bit-identical (report).
- Tests green: each tier's display; the hint always contains the true stance;
  resolution confirmation fires; engine integrity (byte-identical resolution across tiers).

## Feel sign-off

Re-fight Falkner — the hint should halve your guess honestly (no more feeling
lied to), and the resolution confirmation should teach you whether you read right.
