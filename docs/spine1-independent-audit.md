# Spine-1 — Independent Verification Report (Terminal B)

**Auditor:** Terminal B (read-only, `Argent-termB` worktree, detached @ `f53fdf3`)
**Subject:** commit `f53fdf3` — phased-unlock (★ gates attack tiers) + Falkner ★-economy adaptation
**Builder:** Terminal A (did not build this; independent check on A's own validation)
**Date:** 2026-06-30
**Method:** read the 19-file diff cold; re-ran the committed suite; wrote my own instrumented drivers (deleted after) to reproduce Falkner, un-skip the quarantines, and prove the no-soft-lock floor.

## Verdict: GREEN — ship as-is

Every re-baseline is the **expected phased-unlock ramp, not a hidden regression**. The 3 quarantines fail for the **stated economy-interaction reason, with mechanisms intact** — not a masked bug. My independent Falkner reproduction matches A's bands **to the decimal**. The gate is sound, attacks-only, soft-lock-free, and isolated to combat. One **commit-message prose error** found (cosmetic, not code) — see §3.

Committed suite reproduced exactly: **878 passed / 3 skipped / 82 files.**

---

## 1. Re-baseline legitimacy — per ladder

### Rival ladder (`ladder.test.ts`, 15 cells) — LEGITIMATE (expected ramp)
Setup: player = archetype bot, foe = fixed weak `kamonRivalBot` (a non-reading aggressor), `wins` = player wins. The decisive evidence that this is the ramp and **not** a uniform damage bug is that the shift is **differentiated by archetype in the theory-predicted direction**:

- **Readers (naive/stamina/human) rise toward 100%** — they snowball ★ off the weak rival into a runaway tier lead (naive/stamina hit 2000/2000 on the favored paths). Even the type-disadvantaged hard cell (EMBERCUB→AQUAFIN staminaReader) climbs 805→1974 — a perfect reader snowballs past the type wall vs a rival that *can't* snowball back.
- **Turtle (staticGuard) rises** (144→586, ×4; 1253→1605; 1184→1620) — it survives the rival's now light-gated, throttled early offense much longer.
- **Brute is the lone non-riser** (362→392, 275→241, 343→328 — flat/down). Brute depends on early heavy-spam, which the ★-gate throttles, so it gains no relative advantage.

A hidden regression (e.g. the rival bot stuck resting, or a global damage break) would push **all** archetypes the same way. The differentiated, theory-matching spread — and the fact that brute still *beats the rival's defense to 16–20%* (so the rival is fighting, not idle) — rules that out. **Expected ramp.**

### Falkner ladder (`falknerLadder.test.ts`) — LEGITIMATE (intended pushover→boss)
All bands dropped (readers ~92–100% → ~50–85% player-win). This is the **designed** effect of the four Falkner levers turning a 100%-pushover (DIVE BOMB never fired) into a contesting boss — player wins *less* because the boss now works. Fair-vs-hard contract intact: every fair cell ≫ its hard cell; mashing stays below reading on the hard path. Independently reproduced to the decimal (§3).

### starterMirror — LEGITIMATE (modest)
Band 44–56 → 43–57 (±1pp each side). KINDRAKE (the bulky Wall) favored at 56.0% vs 46.5/46.5 — light-only openings throttle offense, which advantages bulk. Spread 9.5pp still honors the <10pp tight contract. Small, directional, sound.

### rivalCard — LEGITIMATE (modest)
Upper band 73→78; measured 70.5/70.8/76.3, spread 5.8pp. Same reader-★-snowball thesis as the rival ladder, vs the weak fixed rival. Modest magnitude.

**No re-baseline reads as breakage-smoothed-over.**

---

## 2. Quarantine legitimacy — GENUINE economy-interaction, mechanisms intact

I copied both sim test files to scratch, flipped `test.skip`→`test`, and ran them. The 3 gates fail **exactly** as A described:

| Gate | Measured win% | Assert | Verdict |
|---|---|---|---|
| heal-turtle | **100.0%** | <60 | over-performing sustain |
| bulwark-turtle | **100.0%** | <62 | over-performing DR |
| set-stance | **93.8%** | <62 | over-performing conditional DR |

These are the "94–100% vs reader" A cited. The decisive point: **the failure is selective, not blanket.** In the *same files*, every non-free-value gate still PASSES — glass-cannon 0%, siphon-reader 32.9%, sear-spammer 0%, sear-reader 50.9%, reader-mirror 49.8%. Only the **free-value self-sustain/DR turtles** over-perform — precisely the stated mechanism: techniques are ★-exempt (free at 0★) while attacks are ★-throttled, so in the low-early-damage economy passive sustain/DR out-paces the throttled offense. A masked bug would fail indiscriminately or crash; this is theory-consistent selective failure.

**Mechanisms still work (only balance deferred):** the engine-level mechanism suites — `src/engine/{sustainEffects,effectMoves,economyEffects,controlEffects,callEffects}.test.ts` — pass **51/51 green**. Heals heal, buffs apply, DR is real; only the win-rate balance gates defer to the holistic pass (checkpoint #5), correctly so given Spine-2/3 + two-pool will keep shifting the damage economy. **Genuine quarantine, not masking.**

---

## 3. Independent Falkner reproduction — MATCHES A to the decimal

My own instrumented driver (mirroring the harness call order, seed `0x1f`, n=2000/cell, `gustBorneDmgMult: 1.4`, `hp 1.15`, `breakBar 4`, `openingMomentum 2`), measuring DIVE BOMB fires + max foe momentum directly off the chosen action / side state:

- **DIVE BOMB fires in 100% of fights**, global **1.21/fight** (fair cells ~1.3) — matches A's "~1.3/fight."
- **maxFoeMom = 3 in every cell** — matches "maxMom 3" (cap is 3, raised 2→3 on 2026-06-27; CLAUDE.md's "cap 2" is stale).
- **0 draws across 30,000 matches** — strong soft-lock disproof.
- **Win% reproduced to the decimal**: e.g. naive/KIND 78.2, naive/SILT 56.7, naive/GRUB 16.5; stamina 75.3/56.6/14.4; human 78.3/58.3/14.7; button 63.0/47.8/8.8; brute 50.6/47.1/5.0 — identical to A's band-comment values. (My first pass used `LEGACY_TRAIT_TABLE` at 1.3 and drifted ~1–2pp but still landed in-band; switching to the real 1.4 gust made it exact — confirming the harness is fully deterministic and the committed numbers are real, not hand-edited to pass.)

**⚠ One discrepancy — commit-message prose, not code:** the commit message claims "hard (GRUBLEAF) **36–47%**." The actual hard-cell player-win is **5.0–16.5%** (brute/GRUB 5.0 … naive/GRUB 16.5). The hard path is considerably *steeper* than the prose states. The **committed test bands are correct** (`hard: [1,12]`…`[10,24]`), and a competent reader on the wrong-type starter wins ~12–16% — this is the intended fair-vs-hard contract (prep-phase pillar: bring the right starter), so it's not a regression. But the "36–47%" figure in the commit body is wrong and should be corrected to avoid future confusion. Fair cells are also ~47–78%, not "52–78%" (brute/SILT 47.1, button/SILT 47.8 sit below 52).

**Beatable-not-trivial:** confirmed on the *fair* matchups (47–78%, winnable-if-competent / losable-if-careless). The *hard* matchup is deliberately punishing by design.

---

## 4. Gate soundness, isolation, no soft-lock

- **Attacks-only (techniques exempt):** confirmed — `tierMomentumLocked` returns `false` for any `move.effect !== undefined` before the ★ check. The effect-move layer is untouched.
- **Soft filter + hard gate, symmetric:** filtered from `affordableMoves` (so neither player nor AI can pick it) and re-thrown in `validateAction`, alongside the existing stamina/winded gates. Applied to both sides identically.
- **Basic/T0 floor genuinely universal:** my data-driven check loaded **all 15 CH1 species** and asserted a fresh 0★ side has a non-empty `affordableMoves` — every species carries **TACKLE + a typed light** (e.g. CINDER FLICK / RIPPLE CUT / GUST RAKE). Fixtures (EMBERCUB/SPROUTLE/AQUAFIN/FUZZLET) carry TACKLE/SCRATCH. No mon is all-mid+.
- **No new soft-lock vector:** light is *always* ★-free, so the ★-gate can never empty the move list on its own. Stamina-floor cases (light unaffordable) route to the **pre-existing** `forcedAction` rest guard (recovers ST), unchanged by Spine-1. Empirically: 0 draws in 30k Falkner matches + no draws in the rival ladder. The "200-game trace" risk is covered at 30k.
- **`momentumCap = 3` makes hold-vs-spend live:** Falkner's `momentum > MOMENTUM_REQ_BY_TIER.heavy` (= ≥3) branch is reachable (opening 2★ + one read-win → 3), so he Catch-Breaths only at the cap, never dropping below the 2★ DIVE BOMB gate. `bossAI.test.ts` adds a direct test of this (holds at 2★, spends at 3★).
- **Bit-identical for non-boss sides:** `createSide` with `openingMomentum` omitted → `?? 0` → unchanged shape; the conditional spread adds no field. Only the boss path differs. The gate math itself is intentionally *not* bit-identical (that's the ramp).
- **Isolation — non-combat untouched:** the only `src/game` change is `main.ts buildFalknerTeam` (boss-card config propagation — correctly mirrors the sim into the *shipped* in-game Falkner: breakBar 4 + opening ★ on both mons). No overworld/map/menu/audio/catching/evolution/bond/PC-box code touched. The remaining 12 test files are setup-only ★-grants that preserve each test's original intent.

---

## Findings summary

| # | Item | Verdict |
|---|---|---|
| 1 | Rival / Falkner / starterMirror / rivalCard re-baselines | ✅ Expected ramp (differentiated, theory-consistent) |
| 2 | 3 quarantined buff/heal/DR gates | ✅ Genuine economy-interaction; selective failure; 51/51 mechanism tests green |
| 3 | Falkner reproduction (DIVE BOMB, maxMom, win%) | ✅ Matches A to the decimal; 0 draws / 30k |
| 4 | Gate soundness / floor / isolation | ✅ Attacks-only, universal light floor, no new soft-lock, combat-isolated |
| ⚠ | Commit-message prose "hard 36–47%" / "fair 52–78%" | Wrong (actual hard 5–16.5%, fair 47–78%) — cosmetic, fix the commit body; bands & code correct |

**Nothing reads as breakage-being-hidden.** The single actionable item is correcting the hard-cell figure in the commit narrative (the enforced test bands are accurate).

— Terminal B → Terminal A
