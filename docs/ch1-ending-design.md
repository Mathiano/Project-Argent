# CH1 Ending — design (the chapter close)

**Status:** design, FIRST PASS — for Mathias's review before CC. The capstone beat of CH1. Locked direction: lands **after the KAMON gate fight**; closes on **quiet resolve — bond reaffirmed**; **light weight — a stinger/hook, depth saved for CH2**. Cross-ref: `the-concord.md` (the antagonist this stings toward), `main-story.md`, the KAMON gate fight (`violet` 6,28), `hearthwick-design.md` (the hearth/bond frame this echoes), `route31-expansion-design.md` (the first-timer's bond echo).

## The shape

The chapter closes on the **rival reckoning**. After the KAMON gate fight (both win/loss advance), a short, restrained beat: KAMON — rattled either way — glimpses the bond he doesn't have, deflects toward a shortcut, and heads up the road. The player's quiet resolve answers it: their bond held. Then the chapter card, as you step onto the road KAMON took.

**Two moments, two locations:**
1. **At the gate** (post-fight): the KAMON exchange + the Concord stinger + he leaves north.
2. **On entering Route 32**: the quiet-resolve beat + the chapter-end card (replacing the current "End of the current chapter" placard).

## The emotional core — the first crack

KAMON's mon hesitates (the locked **0.85 bond-factor**) — and whether he won or lost, *he felt it*. This is the **first crack** in his strength-only worldview: not a conversion (that's his CH2+ arc), just a flicker he can't yet name or admit. The player's bond, by contrast, held — their mon fought *with* them, not merely *for* them. That contrast **is** the chapter's thesis, paid off through the character you're most invested in. Restraint is everything here (the tone target): a flicker and a deflection, never a monologue or an epiphany.

## The stinger — the Concord, through KAMON (recommended; see flag)

KAMON, unsettled by the hesitation, reaches for the shortcut: he's heard the **Concord** can give you a partner that *never* hesitates — loyalty without the wait. He brushes it off and heads north. This **pays off the Concord seed already planted in Violet** (the kiosk / rep / doctrine-in-a-student's-mouth, confirmed present in B's audit) by making it *personal*: the rival who can't earn the bond is exactly who the counterfeit tempts. It plants the central conflict (earned bond vs. manufactured loyalty) **and** KAMON's CH2 arc in one light line — and makes CH2 something you *want* (will he take the offer? can you reach him before he does?). **Light: a rumor-level line, not a Concord scene.** What the Concord actually is, and whether KAMON falls, is CH2.

## Branch-awareness (win / loss — both advance)

Both branches converge on the same deflection + stinger; only KAMON's opener differs (he noticed the bond gap whether he won or lost).

## Keystone text (the lines)

Restrained register; KAMON deflects, never monologues. `[player]` / `[starter]` = name tokens.

**KAMON — opener, WIN branch (you beat him):**
> KAMON: "...How? I trained harder. I *know* I did."
> *(He looks at his mon.)*
> KAMON: "It pulled back. Right at the end — held its strike. Like it wasn't sure it wanted to win."
> *(He stops himself.)*

**KAMON — opener, LOSS branch (he beat you):**
> KAMON: "Ha. *Stronger.* Told you."
> *(But he's not smiling. He looks at his mon — then at yours, still standing close to you.)*
> KAMON: "...Yours didn't fight like mine. Yours fought like it *wanted* to be there."

**KAMON — converged deflection + Concord stinger (both branches):**
> *(He shakes it off.)*
> KAMON: "Whatever. Doesn't matter. There's people up north — the Concord. They give you a partner that doesn't hesitate. Doesn't hold back. Just wins."
> *(He's already moving toward the road.)*
> KAMON: "I'm done waiting around. See you out there, [player]."
> *(And he's gone — north, up the road you're about to take.)*

**The quiet-resolve beat (on entering Route 32):**
> *([starter] steps up beside you. It doesn't hesitate. It never has.)*
> *(The road runs north — the same way he went. You're ready for it.)*

**The chapter card:**
> CHAPTER ONE
> *Kindled*
> To be continued.

## Build notes

- **Trigger:** the KAMON exchange fires after the gate fight resolves (`kamon_beaten` set). KAMON's existing despawn (via `kamon_beaten`) *is* his "leaving north." The quiet-resolve beat + card fire on entering Route 32.
- **Movement is narrated, not animated.** The current script verbs have no `move-npc` (flagged in A's engineering scan) — so KAMON "turning toward the road / and he's gone" is narrated dialog + the existing despawn, exactly as the theft is narrated. Fine for a light beat; no new cutscene verbs needed.
- **Branch-awareness needs a win/loss signal.** KAMON's opener differs by outcome, so a flag set on the *win* branch (e.g. `kamon_won`) is needed to pick the line. Small addition; if it proves invasive in the resolve, fall back to a **single branch-agnostic converged exchange** — but the branch-aware version is much stronger and is the preferred build.
- **The chapter-end card** is a light, reusable text beat (full-screen "Chapter One — *Kindled* / To be continued") replacing the Route 32 boundary placard. Minimal implementation; reusable for future chapter ends.

## Open flags for Mathias (decide before CC build)

1. **The Concord stinger (recommended) vs. a vaguer hook.** Recommended: KAMON reaches toward the Concord (pays off the existing seed, personalizes the antagonist, sets his CH2 arc). Alternative: a vaguer close — KAMON just chasing "stronger" up the road, his CH2 path left unattached to the Concord for now. **My lean: the Concord stinger** — it's the strongest, most on-thesis close, and the seed's already planted. The alternative keeps KAMON's arc open if you want flexibility. This is the one real story decision in the beat.
2. **Chapter title.** *"Kindled"* — the hearth/bond callback (the Hearthwick founder's marker reads "kindled, year one"; warmth + first-bond-lit in one word). Or your pick. The card can ship with a placeholder if you want to decide later.
