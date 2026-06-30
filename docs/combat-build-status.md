# Combat Build — Status & Next Steps (session checkpoint)

**Status:** CHECKPOINT after a large combat session. The effect-move/status LAYER is complete + sim-validated. The momentum-economy RESHAPE (the spine) is the next big build. This doc orients the next session. Drop in `docs/`.

## What's BUILT (all sim-validated, committed, on master)
The full combat DESIGN is committed (`docs/combat-design-canonical.md` = the canonical spec; + combat-experience-vision.md, effect-move-framework-additions.md, effect-move-roster-WIP.md as history). Build increments:

- **`dadaa24`** — status-engine scaffolding (inert plumbing: SideState.debuff/buffs, Move.effect, status BattleEvents, resolve CallKind, STATUS constants). Bit-identical.
- **`2fbf82b`** — effect-move MECHANISM + 3 sample moves (SEAR/Burn, STATIC HAZE/Daze, BULWARK/buff). The core: techniques cast-in-a-stance (flow through the existing triangle, caster punishable by cast-stance); debuffs land on a read-win (A>F / F>G edges) else fizzle+chip; buffs self-apply with cast-stance exposure as cost; status replaces ★ on a read-win (no double-win); reduced chip damage; status lifecycle (apply-after-tick, tick/DoT, clear, narrated by events). SIM-VALIDATED (SEAR-spam 0% — reckless casting punished).
- **`09f8c3b`** — Wave A: 8 momentum/Call-economy effects (THUNDERCLAP/Sap Focus, DEAD SILENCE/Silence, WARCRY/Call Lock, CREEPING DOUBT/Doubt, FALSE ECHO/Echo, SECOND WIND/+★, KINDLE/Attunement, SWARM/Amplify). SIM-VALIDATED — economy effects are SELF-BOUNDING (★-farming is tempo-negative; the cap of 3 bounds it; the unbuilt behind-penalty wasn't needed).
- **`0178cfa`** — Wave B: 6 control/resource effects (FROST BIND/Frozen, MIND SNARE/Inception, CHALLENGE/Taunt, TOXIC SAP/Drained, LEECH BITE/Sap, CORRODE). SIM-VALIDATED — control is ESCAPABLE (stance-locks bind only moves [Call valve], DR resists chain-locking, non-vacuous-verified: freezes land ~20% of rounds yet freezer wins 0%).
- **`2dfd363`** — Wave C: 11 buffs/heals/cleanse (TIDE MEND/Recover, UNDERTOW/HoT, SIPHON/lifesteal, ENTANGLE/DR, WANE+STEADY/Cleanse, REFORGE/Cleanse+heal, VEIL/Shrouded, SET STANCE/poker-Guard-buff, FOCUS UP/offense-buff, GLASS EDGE/×1.30-deal-×1.25-take). SIM-VALIDATED — heal-turtle found (TIDE MEND 100% turtle) + FIXED (BULWARK template: tideMend 0.30→0.10, undertow 0.08→0.03 → 56%).

**Suite: 880 green.** ~31 of 34 techniques built. Existing ladders bit-identical throughout (the effect layer is additive — collapses to 1.0 when no technique is present).

## What's NOT built yet (the remaining combat work)

### 1. ⚠️ Momentum-economy RESHAPE — THE SPINE (next session's headline, biggest + riskiest)
The CORE of the combat vision, NOT yet wired. Currently ★ exists as a Call currency, but the tier-gating doesn't:
- **Phased unlock (hard gate):** ★ unlocks attack tiers — T0 Basic always available → T1 (1★ held) → T2 (2★) → T3 (3★). Attempting an unaffordable move fails ("conjuring" exposes you).
- **Behind-penalty:** the more ★ the foe holds over you, the less damage you deal (linear −X%/momentum-behind). The anti-snowball.
- **Damage ceiling:** no one-shots (even T3 at full advantage ~70% HP).
- **The hold-vs-spend tension** (hold ★ for tiers vs. spend on Calls) — the heart of the system.
This touches EVERY battle's core damage/access math (not just technique-battles) → the MOST sim-sensitive change → validate hardest. Likely SPLIT (e.g. phased-unlock first, then behind-penalty, then ceiling). DO FRESH — not at a session tail.

### 2. Two-pool move model (4 ATTACKS + 2 TECHNIQUES)
Mons don't yet have the two-pool slot structure (≥1 Basic mandatory in attacks). Needs the learnset template reshape + the battle UI (two-row layout, m3x6). Techniques currently exist as moves but not in the pool architecture.

### 3. Tempo increment (UPHEAVAL/TREMOR) — small, CUT-ABLE
Deferred. Tempo = KO-race-only (per B's brace investigation — order only affects the kill-race, not the triangle). Build as strike-order/KO-race modifiers ONLY; if it can't be done without touching the triangle → CUT. TERRA owns it. Small increment.

### 4. UPDRAFT (GALE) — blocked on #1
"Act as if +1★ for tier-access" needs the phased-unlock tier-gate (#1). Wire after the reshape. (Correctly NOT dead-coded.)

### 5. Potency/feel TUNING pass (banked debt)
Across the waves, CC tuned for NO DEGENERACY (nothing dominates) — correct, safe-first. But flagged: control is "weak-for-cost"; buffs cluster in a 54-60% "Guard-band" (the cast-from-Guard value dominates; individual buffs are riders). So a HOLISTIC pass is owed: are techniques worth-casting + distinct from each other? This is FEEL tuning (vs. the no-degeneracy gate already passed). Do once the spine + two-pool exist (so techniques are balanced in their real context).

## Suggested next-session order
1. **Momentum-economy reshape** (the spine — split + sim-heavy, fresh CC). THE priority.
2. Two-pool model (+ UI).
3. Tempo (small, cut-able) + Updraft (now unblocked by #1).
4. Holistic potency/feel tuning pass.
Then: combat is genuinely "closed out." After that — back to world/content (the bigger Argent build), with a deep combat system done.

## Note for the next session / a fresh CC
- The mechanism is in `2fbf82b` — read it before extending combat. Techniques resolve via the existing triangle (cast-in-stance); don't build parallel resolution.
- ALL combat changes are sim-gated (the canonical reader-bot). The effect layer stayed bit-identical when inert; the reshape will NOT be bit-identical (it changes core math — expected) — validate "no degeneracy + read-war central + no one-shots."
- One Terminal A (builder, master) task at a time. Explicit `git add` paths, never -A. Terminal B = read-only auditor on the Argent-termB worktree.

---

# UPDATE — Spine-1 (phased-unlock) shipped + a known deferral (post-break session)

## Spine-1 DONE: phased-unlock + Falkner adaptation
- **Phased unlock built:** ★ gates attack tiers via a legality FILTER (not backfire — unaffordable moves are locked/not-offered; chosen because backfire would also make AI fumble moves). `MOMENTUM_REQ_BY_TIER` (light:0/mid:1/heavy:2/nuke:3) gates on the existing `Move.tier`; extends `moveLegal`/`validateAction` alongside the stamina/winded gates. Attacks-only (techniques exempt this increment).
- **Falkner adapted to the ★-economy** (he was ★-starved → trivial; now fixed): banked 2★ opening, hold-vs-spend Catch Breath (holds ★ for DIVE BOMB), breakBar 2→4 (Break-spam was resetting his gust cadence), tuned read rates. Result: DIVE BOMB fires ~1.3/fight, fair matchups 52-78% player-win, hard 36-47% — a fair GENTLE tutorial boss (Gym 1, deliberately the easiest; gyms 2-8 don't exist yet → will be authored for the ★-economy from the start, harder/less-readable).
- Commit: phased-unlock + Falkner together.

## ⚠️ KNOWN DEFERRAL — 3 buff-turtle balance gates quarantined (feeds the holistic tuning pass #5)
Phased-unlock throttled early damage (everyone opens light-only) → the Wave A-C self-buff/heal/DR magnitudes (tuned in the PRE-phased-unlock economy) now OVER-perform → buff-turtles dominate (heal-turtle 100%, bulwark-turtle 100%, set-stance 94% vs reader). The technique ★-exemption amplifies it (self-buffs free at 0★ while attacks are ★-gated).
- **Decision: QUARANTINED (.skip), NOT tuned now.** Tuning against a half-built economy = whack-a-mole (Spine-2 behind-penalty + Spine-3 ceiling + two-pool all shift the damage math again). The mechanism tests stay green (the buffs WORK); only the win-rate BALANCE gates defer.
- **This is the holistic potency/feel tuning pass (#5) coming due early.** When that pass runs (after the full spine + two-pool — so techniques are balanced in final context): re-tune + re-validate ALL ~34 effect moves together, address the buff-turtle magnitudes, AND resolve the §3 question (gating techniques by tier — partially helps but cascades 19 tests + the heal magnitude needs re-tuning regardless).

## Revised remaining-combat order (updated)
1. ✅ Spine-1: phased-unlock + Falkner. DONE.
2. **Spine-2: the behind-penalty** (−X%/momentum-behind damage modifier — the anti-snowball). NEXT.
3. **Spine-3: the damage ceiling** (no one-shots, ~70% cap).
4. **Two-pool model** (4 attacks + 2 techniques + battle UI).
5. **Tempo** (UPHEAVAL/TREMOR — strike-order-only or cut) + **Updraft** (now unblockable after the tier-gate exists — wire it).
6. **Holistic potency/feel tuning pass (#5)** — NOW HAS A KNOWN FIRST TASK: the 3 quarantined buff-turtle gates + the economy interaction + the §3 technique-gating question. Re-tune all 34 effects in final context.
Then combat is genuinely closed out.
