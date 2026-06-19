# Combat — the FOCUS model AS BUILT (code-truth reference)

**Status:** the IMPLEMENTED two-step layer, shipped 2026-06-19 (KICKOFF-combat-focus-rebuild.md, commit `4771fba`). This is the **code-resident** companion to the design doc `combat-focus-redesign.md` — it documents exactly what the engine does, with the live config knobs, so the in-repo canon matches the build. Where this and the design doc differ, the design doc is the intent and this is the truth; they currently agree (the design's sweet-spot FOCUS_COST ~1.0–1.2 is implemented as 1.0). Pending Mathias's feel sign-off.

**Source files:** `src/engine/resolveRound.ts` (the focus branch), `src/engine/config.ts` (`FOCUS` block), `src/engine/types.ts` (`ReleaseKind`, `releaseVsStance`, `flipBeats`, `defaultReleaseForStance`, `SideState.focus`, the `release` action), `src/engine/events.ts` (`focus`/`release`/`flipResolve`), `src/sim/focusBalance.ts` (the gate), `src/engine/focus.test.ts` (unit tests), `src/game/scenes/battle.ts` (input + callouts).

## The model (two rounds)

### R1 — FOCUS (a generic, shared wind-up)
- Initiated by a `move` action with `commit: true` (the commit-modifier — ←/→ in the move menu toggles it). It is tied internally to the chosen base stance (`SideState.focus = { stance, move }`) but **appears generic** to the opponent ("FOCUSING" — they know *a* release is coming, not which).
- The focuser **deals 0 this round** and is exposed: a single-stepping opponent's strike lands on it ×`focusCost` (the guaranteed cost). No ★ is awarded in R1 (nothing to read — the wind-up is generic).
- Emits a `focus` event (`{ side, costDamage }`); the focuser carries `focus` into next round.

### R2 — the HIDDEN RELEASE (player-chosen now, not predetermined)
- The focusing mon RELEASES. The player **chooses** the release this round (`{ kind: 'release', release }`, picked from the R2 release menu — HEAVY/FEINT/HIDE). A focusing mon that submits any other action releases its **default** (`defaultReleaseForStance`: A→HEAVY, F→HIDE, G→FEINT).
- It resolves vs the opponent's **simultaneous single-step** via the **ROTATION TRIANGLE** (`releaseVsStance`):

| Release ↓ / opponent → | BRACE (G) | FLUID (F) | AGGRESSIVE (A) |
|---|---|---|---|
| **HEAVY** | ✅ win (crush the brace) | ❌ lose (dodged) | ➖ neutral (trade) |
| **FEINT** | ❌ lose (whiff) | ➖ neutral (both hit) | ✅ win (they fall for it) |
| **HIDE**  | ➖ neutral (stalemate) | ✅ win (catch the dancer) | ❌ lose (flushed out) |

Clean cycle: **HEAVY > Brace, FEINT > Aggressive, HIDE > Fluid** (each beats one stance, loses to one, neutral on one).
- Damage: `rawHit × releaseBase × {winDmg | loseDmg | neutralDmg}`; the opponent's counter-strike is scaled `× {winFoe | loseFoe | neutralFoe}`. Emits a `release` event (`{ side, release, outcome, damage, effectiveness, vsStance, vsFocus }`).
- ★: **win → releaser; lose → opponent; neutral → nobody** (★ follows the read-winner).

### Both FOCUS → the FLIPPED triangle
When both sides release the same round, the base triangle inverts: **HIDE > HEAVY > FEINT > HIDE** (`flipBeats`). The flip winner's release is ×`flipWin`, the loser's ×`flipLose`; the flip winner earns ★. Emits `flipResolve` (`{ winner, winnerRelease, loserRelease }`). Mirror (same release) → no winner, no ★.

### Timing mismatch (F.4) — a release vs a still-FOCUSING opponent
If one side releases (R2) while the other is initiating a Focus (R1, deals 0), the release lands on the gatherer ×`FOCUS.mismatch[release]`: **HEAVY devastates** (win), **FEINT whiffs** (lose — committing, not defending), **HIDE ~neutral**. The focusing side still carries its focus into the next round. ★ follows the outcome (HEAVY→releaser, FEINT→focuser, HIDE→none).

### Calls (the synergy) — the only escape from a committed release
A defender facing a feared release spends ★ on a Call (unchanged from the prior layer): **GET AWAY** (guaranteed no-hit this round) or **HANG IN THERE** (can't drop below 1 HP). A focusing/releasing mon cannot Call (it's committed). `getAway` negates the release entirely; `hangInThere` floors HP at 1.

## Config knobs (`src/engine/config.ts` → `FOCUS`) — live values

| Knob | Value | Meaning |
|---|---|---|
| `focusCost` | **1.0** | R1: the focuser deals 0 and takes the opponent's strike ×this. **THE master balance lever** (design sweet spot ~1.0–1.2). |
| `releaseBase` | 1.7 | R2 release base damage multiplier (the payoff). |
| `winDmg` / `winFoe` | 1.8 / 0.35 | rotation WIN: releaser ×1.8, opponent's counter ×0.35. |
| `loseDmg` / `loseFoe` | 0.5 / 1.15 | rotation LOSE: releaser ×0.5, opponent's counter ×1.15. |
| `neutralDmg` / `neutralFoe` | 1.0 / 1.0 | rotation NEUTRAL: a straight trade. |
| `flipWin` / `flipLose` | 1.45 / 0.62 | both-release FLIP: winner / loser release multipliers. |
| `mismatch` | heavy 1.7 / feint 0.4 / hide 1.0 | F.4: release ×this vs a focusing foe. |

## Preserved (unchanged by the rebuild)
The base single-step triangle (AGGRESSIVE > FLUID > GUARD, Fluid acts first), the thrice-repeat self-daze, and the Call escapes are untouched. The single-step resolution path is RNG- and event-identical to before, so the AI ladders are **bit-identical** (the bot archetypes never focus).

## Sim gate (`src/sim/focusBalance.test.ts`, SPROUTLE mirror, n=400/pair, as built)
Adaptive (reading + occasional focus + clutch calls) **tops (~67%)**; BaseBalanced (pure single-step reading) ~62%; the focus-spammers (FocusLover/Heavy/Feint/Hide) cluster **46–55%, all below balanced**; FluidSpam (predictable single-spam) floors (~22%, base triangle preserved). The **three releases are used ~equally** (~12% each — no dominant release). Full spread ~45pp / competitive (excl. the FluidSpam strawman) ~21pp — wider than the design's abstract ~10pp because the engine's hard counters are decisive (FluidSpam's deserved collapse + pool stance-skew); the structural relationships (reading tops, focus-spam below balanced, releases equal, no dominant strategy) all hold. FOCUS_COST is the lever to re-tune if feel demands it.

## Game-layer behavior (`src/game/scenes/battle.ts`)
- R1: the commit-modifier shows `▶FOCUS` in the move preview; the HUD shows a generic **FOCUS** tag on the focusing mon (the foe's view reveals only that it's focusing, never the release).
- R2: a **release menu** (HEAVY/FEINT/HIDE with rotation hints) — the player picks the hidden release.
- Callouts (held beats): `FOCUSING — gathering energy`, then per outcome — HEAVY `CRUSHES THE BRACE` / `DODGED`, FEINT bait / `WHIFFED`, HIDE `SLIPS IN` / `FLUSHED OUT`, the flip winner named, the mismatch `CATCHES … MID-FOCUS`.
