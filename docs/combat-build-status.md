# Combat Build — Status & Next Steps (session checkpoint)

**Status:** The combat SPINE is largely built. The effect-move/status layer, the momentum-economy phased-unlock + behind-penalty, and the two-pool move model (Part A) are all shipped and sim-gated. What remains is the damage ceiling, the deferred specials, the 640×360 battle UI, the stat-foundation, and the holistic balance pass. This doc is the running checkpoint; **the ordered plan lives in `docs/combat-roadmap.md`** (this doc is the "what happened + why + what's banked" companion).

**Source-of-truth reminder:** `docs/combat-design-canonical.md` = the canonical spec; live knobs in `src/engine/config.ts`; `combat-focus-AS-BUILT.md` = the two-step code-truth. Docs win over code; flag conflicts, never silently change design numbers.

---

## What's BUILT (all sim-validated, committed, on master)

### The effect-move / status layer (Waves A–C)
- **`dadaa24`** — status-engine scaffolding (inert plumbing: `SideState.debuff/buffs`, `Move.effect`, status BattleEvents, resolve CallKind, STATUS constants). Bit-identical.
- **`2fbf82b`** — effect-move MECHANISM + 3 samples (SEAR/Burn, STATIC HAZE/Daze, BULWARK/buff). The core: techniques cast-in-a-stance (flow through the triangle, caster punishable by the cast-stance); debuffs land on a read-win (A>F / F>G) else fizzle+chip; buffs self-apply with cast-stance exposure as the cost; **status replaces ★ on a read-win (no double-win)**; reduced chip; full status lifecycle. SIM-VALIDATED (SEAR-spam 0%). *Playtest question (see roadmap ▶ NOW): does the no-double-win tradeoff feel fair, or do techniques feel unrewarding vs. banking ★ toward big attacks? Confirmed intended for now (keeps attacks relevant); revisitable if playtest says it feels bad.*
- **`09f8c3b`** — Wave A: 8 momentum/Call-economy effects (Sap Focus, Silence, Call Lock, Doubt, Echo, SECOND WIND/+★, Attunement, Amplify). Self-bounding in the pre-spine economy (see the reader-yardstick lesson below — this "self-bounding" finding was partly a yardstick artifact).
- **`0178cfa`** — Wave B: 6 control/resource effects (Frozen, Inception, Taunt, Drained, Sap, Corrode). Control is ESCAPABLE (stance-locks bind only moves, DR resists chain-locking; freezes land ~20% of rounds yet freezer wins 0%).
- **`2dfd363`** — Wave C: 11 buffs/heals/cleanse (TIDE MEND, UNDERTOW, SIPHON, ENTANGLE, WANE, STEADY, REFORGE, VEIL, SET STANCE, FOCUS UP, GLASS EDGE). Heal-turtle found + magnitude-fixed once (tideMend 0.30→0.10 etc.) — but see #5: the phased-unlock economy re-broke these.

~31 of the 34-technique roster built (TERRA tempo UPHEAVAL/TREMOR, GALE UPDRAFT/WING FLARE, DRAKE DREAD GAZE/PRIMAL ROAR still unbuilt).

### The momentum-economy spine
- **Spine-1 — `f53fdf3`** — phased-unlock: ★ gates attack tiers via a legality FILTER (unaffordable tier = locked/not-offered, not backfire — backfire would also make the AI fumble). `MOMENTUM_REQ_BY_TIER` (light:0/mid:1/heavy:2/nuke:3) on the existing `Move.tier`, alongside the stamina/winded gates. Attacks-only (techniques ★-exempt). Falkner adapted to the ★-economy (banked 2★ opening, hold-vs-spend Catch Breath, breakBar 2→4, tuned reads) → a fair gentle Gym-1 boss. **Independently audited GREEN by Terminal B** (reproduced to the decimal; 0 draws / 30k).
- **Spine-2 — `f99bf40`** — the behind-penalty (anti-snowball): `damage × max(FLOOR, 1 − perStar × momentum-behind)`, `behind = max(0, foe.momentum − self.momentum) ∈ {0..3}`. Composed LAST in the attacker-outgoing block of BOTH `rawHit` + `resolveStrike` (every path inherits it). **`behindPenaltyPerStar` = 0.04, `behindPenaltyFloor` = 0.65** — sim-tuned DOWN from the brief's 0.10 (at 0.10, Falkner's banked 2★ opening dropped his fair cells below band). Spine-1's tier-gate is the PRIMARY anti-snowball; the behind-penalty is a SECONDARY nudge. Two intentional composition calls: the **Guard counter-reflect IS scaled** (being behind weakens everything); **status application is NOT penalized** (only chip damage scales — the comeback lane).
- **Spine-3 — the damage ceiling — NOT YET BUILT** (roadmap #1; playtest-independent; ~70% no-one-shot cap; finishes the spine).

### The two-pool move model — Part A — `c7e2c67`
4 ATTACKS (no `effect`, ★-gated by tier) + 2 TECHNIQUES (with `effect`, cast-in-stance, ★-exempt), partitioned from the flat `species.moves`. Accessors `attackPool`/`techniquePool`/`affordableAttacks`/`affordableTechniques`; `movePoolIssues()` enforces ≥1 light Basic / ≤4 attacks / ≤2 techniques (`twoPool.test.ts`, 6/6). Techniques equipped on all 15 CH1 mons (FLAME SEAR+KINDLE, NATURE SIPHON+ENTANGLE, AQUA TIDE MEND+UNDERTOW; **GALE STATIC HAZE+SECOND WIND and TERRA BULWARK+TOXIC SAP are STAND-INS** — their real roster is unbuilt). GALEHAWK+MARSHMASH trimmed of the redundant neutral HEADBUTT → uniform 4+2. AI: `trainerPolicy` gains a technique-cast branch (0.25 rate); `wildFoeAI` already random-picks the full pool; **Falkner kept bit-identical** (his pickers filter to attacks; his techniques sit in-pool, his bespoke gust-AI plays his kit). **Part B = the 640×360 visual UI** (roadmap #3).

### The dev combat-log — `1bb2302` (+ `7338829` layout fix)
Toggleable event log (`?log=1` / backtick) so the invisible depth (status ticks, read-wins, ★ swings) is legible **at dev time**. NOT the shipping status readout (see the invisible-status gap).

**Current suite: 884 pass / 6 skip.** The 6 skips = deferred balance (all → #5, below).

**The full depth (spine + techniques + statuses) is LIVE and playable now** (rough dev-UI, log via `?log=1`); the depth playtest — is the read-war fun + legible? — is the GATE on all further combat work (Spine-3 onward). Note: the 6 quarantined balance issues will feel off in play (heals / SECOND WIND / KAMON) — that's known-deferred, not new bugs.

---

## The 6 quarantined gates (all → holistic tuning pass #5)
Balance deferrals, NOT structural bugs — the mechanisms all pass; only the win-rate gates are skipped.
1–3. **Buff-turtle magnitudes** — heal-turtle (TIDE MEND) 100%, bulwark-turtle (BULWARK) 100%, set-stance 94% vs the reader. The Wave-A–C magnitudes were tuned in the pre-phased-unlock economy; phased-unlock throttled early damage + the technique ★-exemption made self-buffs free at 0★ → they over-perform.
4. **`second-wind-nuke`** (SECOND WIND→FULL POWER = 100%) — a STRUCTURAL degeneracy, distinct from the magnitude class (see the lesson below).
5–6. **`rivalCard`** (WINNABLE-BUT-TENSE + TIGHT) — the buff-turtle quarantine bleeding through the trainer AI: KAMON now casts the quarantined TIDE MEND heal, swinging the fight (spread 8pp→26.5pp; one pick 58.6% < the 62 floor). Re-settles when the magnitudes are tuned.

---

## The reader-yardstick lesson (this session's biggest process finding)
A "validated" sim result was a **measuring-instrument artifact.** Under phased-unlock, at low ★ the mid/heavy ATTACKS are ★-locked but a mid TECHNIQUE is ★-exempt — so the reader's `find(tier==='mid')` damage-picker was grabbing the technique and **the pure-damage yardstick was silently casting SECOND WIND / heals.** The old Wave-A "SECOND WIND is tempo-negative, 6.2%, self-bounding" pass was FALSE — both sides were farming ★. The honest reader (pickers → attacks-only, shipped in two-pool Part A) reveals the **true 100% domination.** Takeaway: **a sim-gate is only as good as the measuring bot** — B's independent audits + honest re-measurement are what catch this. The yardstick fix is a correct bug fix and is kept.

---

## Banked decisions & future work (not yet built)

### Stat-foundation increment (roadmap #4; separable)
- **(a) Per-mon stamina** — today stamina is a GLOBAL 100 and Catch Breath is a flat +50 (`catchBreathRestorePct` 0.5 of the global cap). Add `Species.stamina` + a per-mon `maxSt`; make Catch Breath restore % of the mon's OWN max. (HP/ATK/DEF/SPD are already per-mon; stamina is the lone uniform axis.)
- **(b) Evolution-stage scaling** — phase-3 > phase-1 across stats; single-phase legendaries EXEMPT.
- **(c) Profile-matched stat sets** — each mon's stats deliberately match its archetype (tank / speedy-attacker / etc.), extended to stamina.

### The double-throttle resolution
Spine-2 recon flagged a compounding risk: the trailing side is BOTH tier-gated (fewer moves, Spine-1) AND deals less (behind-penalty, Spine-2). **Resolution: the COMEBACK LANE, not a mandated debuff.** Status application is unpenalized when behind (Spine-2), so the trailing player fights back via the read-war / disruption rather than raw damage. Keeping the behind-penalty modest (0.04, a secondary nudge) is the other half. We did NOT mandate a Sap-Focus-style comeback tool; the lane is the design answer.

### The Blissey no-repeat lever (candidate #5 fix)
A single mechanism may collapse two of the #5 problem classes: **restrict repeated same-buff/heal casts** — hard no-repeat / cooldown / diminishing-returns (the DR machinery may already exist via refresh-not-stack + control-status fade) / escalating cost. This plausibly fixes BOTH the buff-turtle magnitudes (i) AND the SECOND WIND ★-farm (ii) — a reliable *repeatable* no-read generator/heal is the shared root. Decide the flavor in #5.

### The 640×360 battle-UI direction (roadmap #3)
The battle UI rebuilt at **640×360** (the overworld + rest of the game STAYS GBA 320×180) — the read-war (6 moves, stances, momentum, 34 statuses) is too dense for 320×180. Carries: the two-row ATTACKS/TECHNIQUES layout, **locked-attack greying** (★-locked attacks visibly dimmed — a playtest legibility need), and **player-facing status indicators on the mons** (the shipping fix for the invisible-status gap). Mathias's visual domain (likely functional structure CC + look Mathias/Claude Design). Scope its requirements FROM the depth playtest.

### The invisible-status gap
Statuses currently have NO player-facing indicator — the dev-log is dev-only. The shipping solution is status icons/indicators on the mons in the 640×360 UI. Until then the depth is real but illegible to a player.

---

## The holistic potency/feel tuning pass (#5) — scope
Runs LAST, once the economy stops changing (spine + two-pool + stats settled — tuning earlier = whack-a-mole). Re-tune + re-validate ALL ~34 effects in the final economy and un-skip the 6 gates. Known scope:
- **The 3 problem classes:** (i) buff-turtle MAGNITUDES; (ii) SECOND WIND STRUCTURAL degeneracy (likely a DESIGN fix — the Blissey lever — not a number); (iii) rivalCard trainer-tech bleed (re-settles once i/ii land).
- **The §3 question** — gating techniques by tier (the "double-gate"): partially helps (ii) but cascades ~19 tests; the heal magnitudes need re-tuning regardless.
- **The Call-rebalance** — equalize Full Power / Dodge (Get Away) / Recover / Catch Breath (the weak-Catch-Breath finding); this connects to the stat-foundation (Catch Breath scaling to a bigger per-mon pool helps).

---

## Design principles holding this together (learned this session)
- **Difficulty self-scales with team size** — a struggling player brings more mons; late-game leaders carry 5–6 → don't over-tune single battles.
- **Land sim-sane, tune in playtest** — sim proves "not broken"; Mathias playing proves "feels right." Keep the levers as config knobs (X, FLOOR, hpScale, dmgScale, tier powers, Catch Breath %).
- **Defer balance to the settled economy** — quarantine, don't chase, while the economy still shifts.
- **Split builds so each ladder-shift is diagnosable** — Falkner, the buff-turtles, and SECOND WIND were each caught in isolation because increments were small.
- **A sim-gate is only as good as the measuring bot** — the SECOND WIND find was a yardstick artifact; honest re-measurement + independent audits catch this.
- **Design / implementation separation** — CC builds systems that consume design-authored assets; the visual/aesthetic calls are Mathias's.

---

## Note for the next session / a fresh CC
- The mechanism is in `2fbf82b`; the spine in `f53fdf3` (Spine-1) + `f99bf40` (Spine-2); two-pool in `c7e2c67`. Read before extending. Techniques resolve via the existing triangle (cast-in-stance) — don't build parallel resolution.
- ALL combat changes are sim-gated against the canonical `reader`. Post-spine the ladders are NOT bit-identical (core math changed — expected). Validate "no degeneracy + read-war central + no one-shots."
- **The ordered plan is `docs/combat-roadmap.md`.** Next up: the depth playtest (the gate on everything after), then Spine-3.
- One Terminal A (builder, master) task at a time. Explicit `git add` paths, never `-A`. Terminal B = read-only auditor on the `Argent-termB` worktree.
