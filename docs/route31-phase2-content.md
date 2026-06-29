# Route 31 — Phase 2 content (Jay, flavor NPCs, lost-kid quest)

**Status:** BUILT (Jay + flavor NPCs) + **PROPOSED** (the lost-kid reward). 2026-06-29,
Terminal A. Wires the real DEFs (the *what*) for Mathias's markers (the *where*) on
`__ROUTE31_BIG__`. All DEFs live in `tiledWiring.ts` `DEFAULT_DEFS`. Tone: mature,
TW3/Mass-Effect — darker-but-cheerful, characterful. Mathias curates.

## Jay — the Calls-unlock beat (THE key interaction)

`npc_jay` (carried-forward canon, given the Phase-2 payload): `approachOnEnter` robber
→ on entry he walks up, the gentle-robber pitch ("You've barely got anything… Battle
me anyway"), then `start-trainer-battle` (FLITPECK, winFlag `r31big_jay_beaten`,
reward 500). Post-win (`interactAfterFlag`): the mon *stepped in front of you, took the
hit FOR you* → "that's a partner who chose you… lean on it, call to it, and it'll
answer." The bond-defends-you thesis made literal.

### Calls-unlock audit — hooks the EXISTING mechanism (no parallel flag)
- Calls gate on `callsUnlocked() = run.catchBreathUnlocked || hasJumpstart(partyBond[0])`
  (main.ts) — passed to the battle scene as `catchBreathUnlocked`, read by `callUnlocked()`.
- Jay's win sets **`run.catchBreathUnlocked = true`** — the *existing* run flag — via
  `pushTrainerFight`'s `onResolve`: `if (CALLS_UNLOCK_ON_WIN.has(winFlag)) run.catchBreathUnlocked = true`.
  `CALLS_UNLOCK_ON_WIN` (exported from `tiledWiring.ts`) = `{'r31big_jay_beaten'}` =
  Jay's winFlag. Single source of truth; the test asserts Jay's def winFlag ∈ the set.
- Set **after** `awardBondForFight`, so a natural bond crossing into Warming can still
  show its own "Calls unlocked" beat; the flag *guarantees* the unlock regardless. The
  narrative is the wrapper; the flag is the payload.
- Isolated from the live Route 31 (which uses `route31_trainer_beaten`) — no live
  behaviour change. At the Phase-4 swap, point the set at the live winFlag.

## Flavor NPCs (CC drafts — curate the tone)

- **`npc_birdwatcher_1`** — obsessive, precise; his GALEHAWK count dropped 43→41 and it
  unsettles him ("Birds don't just leave. Something moved them on."). A faint seed of
  the route's wrongness, not "I love birds."
- **`npc_afraid_of_stones`** — the Matko register: irrationally terrified of the cave
  rocks, but the kernel is real — GRITHOAX camouflage means you genuinely can't tell
  which stone is alive ("That's the whole PROBLEM, isn't it. Which ones aren't?").
- **`npc_healer`** — a weary field-medic of the dying era ("I've set more bones this
  year than the ten before. The roads turned hard."). Heals via the EXISTING
  `heal-party` verb, then "mind WHO you trust out here — not everyone asks as kindly as
  you did." NOTE: "ask nicely" is in the *writing* — the script system has no in-dialog
  choice yet, so it's framing, not a branch. (A real politeness choice needs a dialog-
  choice mechanism — flagged, not in scope.)

## Lost-kid / PIP quest — PROPOSAL (for approval before finalizing)

Mathias placed both markers: `npc_lost_kid` (15,21) + `mon_lost_bird` (18,29, the find
location). Wired a clean **working** version now; the **item reward is proposed** (it
needs a code-authored step-on script — see below).

**The quest (wired):**
1. **Talk to the kid** (`npc_lost_kid`): "Have you seen PIP? A FLITPECK… sings three
   notes, can't hold a fourth… he's never been alone." (Teaches the whistle.)
2. **Find PIP** (`mon_lost_bird`, a wary FLITPECK sprite under a root): it won't let you
   near *until you whistle the three notes* → it hops toward you. Sets `r31big_pip_found`.
3. **Return to the kid** (now flips to `interactAfterFlag`): the reunion — "PIP! …
   singing its whole song at once, fourth note and all. I won't forget this. Not ever."

Mechanism: `blockedUntilFlag: 'r31big_pip_found'` flips both NPCs (the proven PIP
pattern); the bird's find-interact sets the flag once (flag-flip = one-time). No repeat
bugs.

**PROPOSED additions (need Mathias's OK):**
- **Item reward.** The reunion is dialogue-only as wired (no repeat-give bug). To add a
  one-time item (e.g. `SUPER POTION ×1`, "Mum keeps these for the rough days"), it needs
  a code-authored **step-on `script`** at the kid's tile (`requiresFlag: r31big_pip_found,
  once, flag: r31big_pip_rewarded` → `give-item`) — exactly the live Route 31 pattern.
  Scripts are code-authored (not Tiled markers), so this is a CC add once approved.
- **The bird "follows" to the kid.** As wired, PIP stays at its find spot (the reunion
  fires when you walk back to the kid). A true follower needs a follow mechanic (out of
  scope). Acceptable as-is; flag if you want the bird to physically relocate.
- **Species/reward/flavor** — all tunable; FLITPECK matches PIP canon.

## Removed
- `npc_trainer_1` (the kitchen-sink "Youngster Joey" placeholder at (10,4)) — removed
  from the Route 31 snapshot (test scaffolding, not real content). Mathias: delete the
  marker in Tiled + re-export so the source matches.

## Mechanism notes
- New marker prefix **`mon_<id>`** → `MON_DEFS` → an overworld creature (a sprite `npc`),
  used by `mon_lost_bird`. Added to the wiring convention.
- All DEFs use existing systems: inline `MapObject`s, `heal-party`, the `catchBreathUnlocked`
  Call gate, `blockedUntilFlag`/`interactAfterFlag`/`set-flag`/`if-flag`. No
  combat/AI/sim/Calls-engine changes.
