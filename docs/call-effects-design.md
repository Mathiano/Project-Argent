# Call Effects — Design (Lane B)

**Status:** DECIDED (effects + dependencies); BUILD is a sim-gated combat sprint. Wires real engine effects into the three currently-locked Calls + repurposes one built Call. Drop in `docs/`. Cross-ref `bond-track-v2.md` (Call economy + bond-tier unlocks), `combat-focus-redesign.md` (the combat model these spend into), the B Call-set audit (verified `CALL_SET` @ battle.ts:467).

## ⚠️ This is COMBAT-ENGINE work, not UI

Unlike Lane A (display), Lane B adds **real combat effects** (a 50% heal, a full evade, a +50% damage burst). Each ripples through sim-validated balance. **Every effect MUST be sim-gated** — trainer profiles are balanced against the *current* toolkit; adding these Calls changes the player's (and eventually trainers') power. If any new Call shifts a ladder beyond the fair-but-distinct band, that's a **tuning conversation, not a silent ship**. Treat this with the full combat-change discipline: build → sim-gate → stop-and-flag if balance moves unexpectedly.

## The verified Call set (CALL_SET, battle.ts:467) + decisions

The data-driven `CallDef.built` flag is the single source of "built vs design-only." Locked Calls are cursor-skipped, greyed, and `fireCall` no-ops them.

| Call | ★ | Current | DECISION (the effect to build) | Buildable now? |
|---|---|---|---|---|
| Catch Breath | 1 | ✅ +50 stamina | keep as-is | — |
| Get Away | 1 | ✅ negate incoming hit | keep as-is | — |
| **Recover** | 1 | 🔒 locked, no effect | **Heal 50% HP** | ✅ YES |
| **Dodge** | 1 | 🔒 locked, no effect | **Evade the attack COMPLETELY** (full, guaranteed) | ✅ YES (evade-only) |
| **Full Power** | 2 | 🔒 locked, no effect | **+50% damage on next attack** (select Full Power → return to attack menu → pick one of 4 attacks → it gets the buff) | ✅ YES (needs two-step UI) |
| **Shake It Off** (repurpose of Hang In There) | 1 | ✅ built: survive-at-1HP | **Clear a status effect** | ❌ NO — needs status system |

## Per-Call build notes

### Recover (★1) — heal 50% HP — BUILD NOW
- Restores 50% of max HP. Needs a `CallKind` value + action mapping + the heal effect in resolveRound; flip `built: true`.
- **Balance risk: HIGH.** A repeatable 50% heal can stall fights / make the player (or a trainer) very hard to kill. **Sim-gate hard.** This is the Call most likely to need the *cooldown system* (see banked item) — flag if the ladder shows stalling.

### Dodge (★1) — full evade — BUILD NOW (evade-only)
- Evades the incoming attack **completely** (full, guaranteed no-hit).
- **KNOWN temporary overlap with Get Away** (which also negates the hit). Accepted as playtest scaffolding. The *distinguishing* benefit (likely **evade + a counter-window** — "evade and punish") is a **FUTURE designed addition** — Mathias hasn't settled how to build the counter correctly yet. Dodge is the "aggressive evade" slot; for now it ships evade-only.
- **Future tradeoff (banked):** there will later be **unevadable attacks** in the game, giving full-evade a real counterplay/cost. So "evade completely" is intentionally strong now because its counter (unevadable moves) comes later.

### Full Power (★2) — +50% next attack — BUILD NOW (two-step UI)
- The only ★2 Call. Selecting it does NOT resolve immediately — it **buffs the next attack**: select Full Power → return to the attack menu → choose one of the 4 attacks → that attack deals +50%, ignoring/within stance modifiers (define exact interaction with the triangle when building).
- **Build note:** this is a *two-step selection flow* (Call → back to attack menu → attack), unlike Calls that resolve in one step. Wire the buff-pending state + the return-to-attack-menu flow.
- **Balance risk: MEDIUM-HIGH.** A +50% burst can swing exchanges. Sim-gate; confirm it doesn't make aggressive-burst dominant.

### Shake It Off (★1) — clear status — BLOCKED, stays locked
- Repurposes the Hang In There slot. **The old survive-at-1HP effect is BAD DESIGN and should NOT be preserved** (Mathias's reasoning: continuous combat has no rest period, so surviving one round at 1 HP just means losing the next — spending a round for nothing). So Hang In There is being *replaced*, not kept.
- **BUT Shake It Off (clear a status effect) needs the status-effect system, which is RESERVED/designed-only.** Can't clear a status that doesn't exist.
- **Resolution:** Shake It Off **stays a `built: false` locked placeholder** until the status system lands. Do NOT wire the survive-at-1HP effect. When status effects are built, Shake It Off gets its clear-status effect. (It's bond-tier-gated anyway, so being non-functional/locked early is invisible.)

## Unlock gating — REAL bond-tier gating vs. DEV early-unlock

**Critical for balance:** Calls unlock at **bond tiers** (the real, shipping rule — per `bond-track-v2`'s tier ladder). **Trainer AI profiles are balanced against the bond-gated toolkit** — if the player has all Calls early, fights balanced against a smaller toolkit break. AND the gating affects *which Calls trainers themselves can use* (their profiles assume the schedule).

So:
- **Real rule:** each Call unlocks at its designated bond tier. This MUST hold for sim/balance.
- **Dev/playtest override:** unlock Calls early *for testing them now* (same pattern as the dev-skip system — the real rule is bond-gated, a dev path overrides). Mathias wants to playtest the effects without all-unlocked being the shipping state.
- **Do NOT ship with everything unlocked** — that would invalidate the trainer-profile balance.
- The bond-tier → Call mapping needs defining (which Call at which tier) — partly in `bond-track-v2`'s ladder; confirm/extend when building.

## Build sequencing
1. **Buildable now (this sprint):** Recover (50% heal), Dodge (full evade), Full Power (+50%/two-step). Each = new engine effect + `CallKind`/action mapping + `built: true` + the bond-tier unlock (with dev-override).
2. **Sim-gate the whole set** — rerun all ladders after wiring. The new Calls change the toolkit; confirm fair-but-distinct holds. Stop-and-flag any ladder swing.
3. **Shake It Off** — stays locked; built when the status system lands.

## Banked dependencies / future lanes (from this design)
- **Call cooldown/throttle system** — prevent a Call (esp. Recover) being used more than once every 2–3 rounds, or fights stall. Likely needed once Recover is live. Combat-design, sim-gated, future.
- **Dodge counter-window** — the distinguishing benefit that separates Dodge from Get Away. Future designed addition.
- **Unevadable attacks** — the counterplay to full-evade. Combat-design lane.
- **Status-effect system** — gates Shake It Off (and `statusTendencies`, Resolve, etc.). Reserved/designed-only; a future build lane.
- **Stronger-attack access** (soft/medium/hard, possibly progressive in-encounter, gated by reads/Calls) — separate combat-design lane; connects to bond-gated moves.
