# Combat — the FOCUS two-step REDESIGN (Monte Carlo validated)

**Status:** validated redesign of the two-step layer (supersedes the distinct-wind-ups Layer 2 if adopted). Sim: argent_combat_montecarlo_focus.py. Replaces "three distinct visible wind-ups (Charge/Hide/Feint)" with "a SHARED wind-up (Focus) + a HIDDEN round-2 release." Cross-ref combat-enrichment-roadmap, combat-case-reference.

## Why the redesign (the core rationale)
The shipped two-step layer forced the player to guess the opponent's move TWO turns out: you commit Charge in R1, but whether it lands depends on their R2 choice — which you're predicting a turn early, against your own telegraphed release. That's very hard to read (you're not reading their current tell, you're predicting their future reaction to your commitment).

**The Focus model collapses this into a clean ONE-turn read:** you Focus in R1 (a shared "gathering energy" wind-up — the opponent knows A release is coming but NOT which); on R2 BOTH choose simultaneously, so it's a normal one-turn read with higher stakes. Reads should be about the NEXT action, not the action-after-next.

## The model

### Round 1 — FOCUS (shared wind-up)
- You commit a Focus (internally tied to a stance for stability, but APPEARS to the opponent as generic "KINDRAKE is gathering energy").
- **You take damage / deal none this round — the guaranteed COST.** This is THE balance knob (sim-tuned, see below).
- The opponent sees a release is coming but not which one.

### Round 2 — the HIDDEN RELEASE, resolved vs the opponent's simultaneous single-step (the ROTATION TRIANGLE)
| Release ↓ / Their R2 → | BRACE | FLUID | AGGRESSIVE |
|---|---|---|---|
| **HEAVY** | ✅ CRUSH brace (dmg + daze/status) | ❌ dodged (little/no dmg) | ➖ neutral trade (both hit; you hit heavy) |
| **FEINT** | ❌ whiff (nothing to feint) | ➖ both hit (they take more) | ✅ they fall for it (miss + take dmg) |
| **HIDE** | ➖ stalemate (both defensive) | ✅ catch the dancer (slip + counter) | ❌ flushed out (aggression beats hiding) |

**Clean rotation: HEAVY > Brace, FEINT > Aggressive, HIDE > Fluid** (each beats one, loses to one, neutral on one). Thematic: Heavy crushes the turtle; Feint catches the aggressor; Hide catches the dancer.

### The risk/reward (self-balancing)
Pay a guaranteed cost (the focus round — take dmg, deal none) for a chance at an AMPLIFIED payoff (win the R2 read → damage + status/daze). The focus-round cost is what stops focus-spam — you bleed for every focus, so you can't default to it.

### Defender's CALL option (the synergy — Focus makes Calls clutch)
Because Focus telegraphs that A big release is coming (just not which), the defender gets a meaningful Call read:
- **HANG IN THERE** (can't drop below 1 HP this round) → if you think they'll go HEAVY (you'll survive it).
- **GET AWAY** (evade, no damage) → if you fear a HEAVY or want to dodge entirely.
Focus and the Call economy reinforce each other: Focus gives Calls something to respond to; Calls give Focus a counter-play.

### Both FOCUS (two-step vs two-step) — the flip still holds
When BOTH players Focus, the FLIPPED triangle applies (HIDE > HEAVY/CHARGE > FEINT > HIDE — the base triangle inverts when everyone escalates). The base single-step triangle (AGG > FLUID > GUARD, Fluid acts first) is UNCHANGED. So the two-layer structure is preserved; the redesign only changes the two-step-VS-single-step interaction (into a clean R2 read).

## SIM VALIDATION
Sweeping the FOCUS_COST balance knob (n=400-500/pairing):
| FOCUS_COST | spread | FocusLover (spam) | NoFocus (top) | Adaptive | #1 |
|---|---|---|---|---|---|
| 2.2 | 16.2pp | 42.2% | 58.4% | 55.0% | NoFocus (focus too costly) |
| 1.6 | 11.2pp | 44.9% | 56.1% | 55.1% | NoFocus |
| **~1.0-1.2** | **~10pp** | **~46%** | ~54% | **~56%** | **Adaptive ✓** |
| 0.8 | 6.6pp | 47.2% | 52.5% | 53.8% | Adaptive |

**At FOCUS_COST ≈ 1.0-1.2 (the sweet spot):**
- **Adaptive (reading + occasional focus) is #1** — the intended best strategy wins (the thesis: read + situational focus beats both pure-single-step and focus-spam).
- **FocusLover (focus-spam) ~46%, BELOW balanced play** — over-focusing loses.
- **NoFocus drops from dominant to merely-viable** — single-step is good but no longer best.
- **All three releases used near-equally** (~7.5% each) — no dominant release; the rotation triangle is balanced.
- **Tight ~10pp spread** — healthy.

**THE MASTER KNOB:** FOCUS_COST (the focus-round self-damage). Tune ~1.0-1.2. Too high → focus not worth it (NoFocus dominates); too low → focus-spam creeps up. Verify Adaptive tops + FocusLover sits below balanced before shipping.

## Round-by-round cases (the new model)
- **You Focus → Heavy; foe Braces R2:** crush the brace (+daze). ✓ (Focus's answer to a turtle.)
- **You Focus → Heavy; foe Fluids R2:** dodged — poor trade (you paid the focus cost for little). ❌
- **You Focus → Feint; foe Aggressives R2:** they fall for it — miss + take damage. ✓
- **You Focus → Feint; foe Braces R2:** whiff (nothing to feint) — you wasted the focus. ❌
- **You Focus → Hide; foe Fluids R2:** catch the dancer — slip + counter. ✓
- **You Focus → Hide; foe Aggressives R2:** flushed out — aggression beats hiding. ❌
- **Defender's Call:** seeing the Focus, spend ★ on Hang In There (survive a feared Heavy) or Get Away (evade).
- **Both Focus:** the flipped triangle (HIDE>HEAVY>FEINT>HIDE).

## Adopt vs current?
The current SHIPPED Layer 2 (distinct visible wind-ups) is also sim-balanced — but it has the "guess two turns out" readability problem this redesign fixes. RECOMMENDATION: adopt the Focus model (better readability, self-balancing cost, Call synergy) — but first PLAYTEST the current version to confirm the two-turn-read problem actually FEELS bad (it may, per the design logic). If it does, rebuild to this (sim-validated) model. The rebuild reuses most of the Layer-2 machinery (the winding state, the release resolution, the flipped triangle) — it changes the wind-up to shared/hidden and adds the R2 rotation triangle + the focus cost.

## Cross-ref
combat-enrichment-roadmap (the layer structure), combat-case-reference (update to this model if adopted), bond-track-v2 (the Call economy this synergizes with), argent_combat_montecarlo_focus.py (the validation).
