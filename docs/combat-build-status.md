# Combat Build — Status & Next Steps (session checkpoint)

**Status:** The mechanical combat **SYSTEM is COMPLETE.** The effect-move/status layer, the momentum spine (Spine-1 phased-unlock + Spine-2 behind-penalty — Spine-3's hard ceiling was DROPPED, folded into HP-tuning), the two-pool move model (Part A), and Updraft are all shipped and sim-gated; tempo (UPHEAVAL/TREMOR) is CUT. Everything remaining is **content, UI, and tuning**: the 640×360 battle UI, the stat-foundation (which now also carries one-shot prevention), and the holistic balance pass. This doc is the running checkpoint; **the ordered plan lives in `docs/combat-roadmap.md`** (this doc is the "what happened + why + what's banked" companion).

**Source-of-truth reminder:** `docs/combat-design-canonical.md` = the canonical spec; live knobs in `src/engine/config.ts`; `combat-focus-AS-BUILT.md` = the two-step code-truth. Docs win over code; flag conflicts, never silently change design numbers.

---

## What's BUILT (all sim-validated, committed, on master)

### The effect-move / status layer (Waves A–C)
- **`dadaa24`** — status-engine scaffolding (inert plumbing: `SideState.debuff/buffs`, `Move.effect`, status BattleEvents, resolve CallKind, STATUS constants). Bit-identical.
- **`2fbf82b`** — effect-move MECHANISM + 3 samples (SEAR/Burn, STATIC HAZE/Daze, BULWARK/buff). The core: techniques cast-in-a-stance (flow through the triangle, caster punishable by the cast-stance); debuffs land on a read-win (A>F / F>G) else fizzle+chip; buffs self-apply with cast-stance exposure as the cost; **status replaces ★ on a read-win (no double-win)**; reduced chip; full status lifecycle. SIM-VALIDATED (SEAR-spam 0%). *Playtest question (see roadmap ▶ NOW): does the no-double-win tradeoff feel fair, or do techniques feel unrewarding vs. banking ★ toward big attacks? Confirmed intended for now (keeps attacks relevant); revisitable if playtest says it feels bad.*
- **`09f8c3b`** — Wave A: 8 momentum/Call-economy effects (Sap Focus, Silence, Call Lock, Doubt, Echo, SECOND WIND/+★, Attunement, Amplify). Self-bounding in the pre-spine economy (see the reader-yardstick lesson below — this "self-bounding" finding was partly a yardstick artifact).
- **`0178cfa`** — Wave B: 6 control/resource effects (Frozen, Inception, Taunt, Drained, Sap, Corrode). Control is ESCAPABLE (stance-locks bind only moves, DR resists chain-locking; freezes land ~20% of rounds yet freezer wins 0%).
- **`2dfd363`** — Wave C: 11 buffs/heals/cleanse (TIDE MEND, UNDERTOW, SIPHON, ENTANGLE, WANE, STEADY, REFORGE, VEIL, SET STANCE, FOCUS UP, GLASS EDGE). Heal-turtle found + magnitude-fixed once (tideMend 0.30→0.10 etc.) — but see #5: the phased-unlock economy re-broke these.

~32 of the roster built. GALE UPDRAFT is now built (see the Updraft sign-off below); TERRA tempo (UPHEAVAL/TREMOR) is CUT (not unbuilt — see the tempo-cut decision); GALE WING FLARE (STATIC HAZE stands in) + DRAKE DREAD GAZE/PRIMAL ROAR remain unbuilt.

### The momentum-economy spine
- **Spine-1 — `f53fdf3`** — phased-unlock: ★ gates attack tiers via a legality FILTER (unaffordable tier = locked/not-offered, not backfire — backfire would also make the AI fumble). `MOMENTUM_REQ_BY_TIER` (light:0/mid:1/heavy:2/nuke:3) on the existing `Move.tier`, alongside the stamina/winded gates. Attacks-only (techniques ★-exempt). Falkner adapted to the ★-economy (banked 2★ opening, hold-vs-spend Catch Breath, breakBar 2→4, tuned reads) → a fair gentle Gym-1 boss. **Independently audited GREEN by Terminal B** (reproduced to the decimal; 0 draws / 30k).
- **Spine-2 — `f99bf40`** — the behind-penalty (anti-snowball): `damage × max(FLOOR, 1 − perStar × momentum-behind)`, `behind = max(0, foe.momentum − self.momentum) ∈ {0..3}`. Composed LAST in the attacker-outgoing block of BOTH `rawHit` + `resolveStrike` (every path inherits it). **`behindPenaltyPerStar` = 0.04, `behindPenaltyFloor` = 0.65** — sim-tuned DOWN from the brief's 0.10 (at 0.10, Falkner's banked 2★ opening dropped his fair cells below band). Spine-1's tier-gate is the PRIMARY anti-snowball; the behind-penalty is a SECONDARY nudge. Two intentional composition calls: the **Guard counter-reflect IS scaled** (being behind weakens everything); **status application is NOT penalized** (only chip damage scales — the comeback lane).
- **Spine-3 — the damage ceiling — DROPPED (reframed).** The hard ~70% cap is cut; one-shots are prevented via HP-tuning instead (see the Spine-3 reframe under Session design decisions). The momentum spine is COMPLETE at Spine-1 + Spine-2.

### The two-pool move model — Part A — `c7e2c67`
4 ATTACKS (no `effect`, ★-gated by tier) + 2 TECHNIQUES (with `effect`, cast-in-stance, ★-exempt), partitioned from the flat `species.moves`. Accessors `attackPool`/`techniquePool`/`affordableAttacks`/`affordableTechniques`; `movePoolIssues()` enforces ≥1 light Basic / ≤4 attacks / ≤2 techniques (`twoPool.test.ts`, 6/6). Techniques equipped on all 15 CH1 mons (FLAME SEAR+KINDLE, NATURE SIPHON+ENTANGLE, AQUA TIDE MEND+UNDERTOW; **GALE is now STATIC HAZE+UPDRAFT** — UPDRAFT is the real GALE technique, the SECOND WIND stand-in removed, STATIC HAZE still stands in for WING FLARE; **TERRA BULWARK+TOXIC SAP remains a STAND-IN** — tempo is cut, so TERRA keeps these). GALEHAWK+MARSHMASH trimmed of the redundant neutral HEADBUTT → uniform 4+2. AI: `trainerPolicy` gains a technique-cast branch (0.25 rate); `wildFoeAI` already random-picks the full pool; **Falkner kept bit-identical** (his pickers filter to attacks; his techniques sit in-pool, his bespoke gust-AI plays his kit). **Part B = the 640×360 visual UI** (roadmap #1).

### Updraft (GALE) — `f5094df`
The GALE identity technique — a self-buff granting "act as if +1★ for tier-ACCESS" (**capped to mid**; heavy/nuke still need the real ★). Surgical: touches ONLY the phased-unlock gate — no actual ★ granted, no behind-penalty effect. GALE loadout is now STATIC HAZE + UPDRAFT. See the Updraft sign-off (the mid-cap is an APPROVED deviation — do not revert it).

### The dev combat-log — `1bb2302` (+ `7338829` layout fix)
Toggleable event log (`?log=1` / backtick) so the invisible depth (status ticks, read-wins, ★ swings) is legible **at dev time**. NOT the shipping status readout (see the invisible-status gap).

### The 640×360 battle UI — BUILT (Parts 1 / 2a / 2b-1 / 2b-2)
The battle scene now renders at **640×360**; the overworld + everything else STAYS GBA **320×180** (the identity boundary, per `battle-ui-spec-decisions.md`). Built in diagnosable parts:
- **Part 1 — per-scene canvas resolution** (`af2fa58`, + `cececb6` display-scale fix). A `Scene` can declare its own logical size; the shared canvas swaps to it on scene-change and restores 320×180 on exit. The battle fills the overworld's physical footprint — the display scale is derived from the BASE resolution (the fix for the real-screen "battle rendered quarter-size" bug; the mocked-DOM harness couldn't see it — verified on the real screen).
- **Part 2a — layout skeleton** (`a4fd5db`). The 6 layout constants + every existing HUD draw re-authored to FILL 640×360 in the classic arrangement: foe panel upper-left / foe sprite upper-right / player sprite mid-left / player panel mid-right / full-width bottom.
- **Part 2b-1 — CD-format elements** (`be909a7`). The **2×3 move grid** (4 ATTACKS + 2 TECHNIQUES — the two pools, visually apart), tier badges + ST cost + technique effect tags, **locked-attack greying** (`NEEDS ★★` / `WINDED` / `LOW ST`, read from engine truth via `moveLegal`/`tierMomentumLocked`), a move-detail **SELECTED** panel, the **A/G/F stance selector**, and **status chips on the mons** (the shipping fix for the invisible-status gap). Menu → **FIGHT / CALLS / MONS / BALLS / RUN**; the BASE SPD line dropped (the per-move `NEXT:` preview carries turn order).
- **Part 2b-2 — the warm-artifact skin + tune** (`27fc034`, `a8c1dc3`). The battle's own palette (warm parchment / silver inlay + rivets / gold ★ / velvet tech cells / jewel tier badges / soft-green arena; **semantic bars untouched**) — see `battle-ui-spec-decisions.md` → "The battle UI has its OWN palette". Status chips moved ONTO the mon panels. Final tune: FOE INTENT width (clears the sprite), BREAK pips → gold (ruby read as brown), punchier gold ★, panel/selection contrast.
- **Technique Focus-guard** (`42940d3`) — see Focus fixes below.

Deferred to **2b-3**: the **swappable-background slot** (grass → snow/cave/water by location; grass hardcoded for now); folding the **DAZE/STAG/EXH/FOCUS header tags** into the chip system (they stay as panel-header tags); the **Q2 "HEAVY ATTACK" release label** + charged-attack detail wiring (see Focus fixes — NOT yet shipped; the release picker still reads HEAVY/FEINT/HIDE).

### Focus/charge fixes (`42940d3`) — see `focus-technique-and-label-decisions.md`
- **Q1 — techniques CANNOT be Focused/charged. FIXED (guard; player + AI symmetric).** A technique COULD enter the two-step, where the Focus path (rawHit-only) **silently discards its status effect**. Fix = a player-side GUARD (`handleMoveInput`: the charge toggle + commit-attach gated on `!isTechnique`; the ▶FOCUS indicator hides on a technique). A technique still CASTS single-step (which applies its effect) — it just can't charge. The AI was already protected (every commit/Focus path pulls from `affordableAttacks`, which filters techniques) → confirmed symmetric, no AI change. **No engine effect-logic change** — the "effects only in the single-step triangle" behaviour is the DEFERRED two-pool "double-gate" limitation, unchanged.
- **Q2 — the round-1 move DOES carry through a Focus release** (its TYPE / TIER / damage / initiative all carry via `focus.move → rawHit`; Heavy/Feint/Hide sets ONLY the read-outcome multiplier, NOT the attack's identity or tier). So it's "your attack X released with a Heavy/Feint/Hide read-multiplier," not a generic heavy — the label "HEAVY" misreads as a damage TIER. Fix = label **"HEAVY ATTACK"** + show the charged attack's info in the detail panel during the release step. **NOT yet shipped → a 2b-3 UI item** (the release picker still reads HEAVY/FEINT/HIDE).

**Current suite: 892 pass / 6 skip** (the +1 over the pre-UI 891 is the technique-Focus-guard test; the battle-UI rebuild is rendering-only — position/label test updates flagged per part, no behaviour assertions changed). The 6 skips = deferred balance (all → #5, below).

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

## Session design decisions (2026-07-02)

### Spine-3 (damage ceiling) — REFRAMED: no hard cap; prevent one-shots via HP-tuning
The original Spine-3 (a hard ~70% single-hit cap) is **DROPPED** as a mechanic. The no-one-shot rule was a GUIDELINE about FEEL ("battles take several turns"), not the mechanism — and a hard cap PUNISHES earned success (under phased-unlock + the behind-penalty, engineering a one-shot is HARD and, if pulled off, EARNED; capping it away betrays the skill-rewarded thesis). The RIGHT prevention is HP POOLS: if stronger mons have large enough HP that a single hit realistically can't reach 100%, one-shots don't happen BECAUSE OF THE MATH (not a rule), and the rare genuinely-earned huge hit is ALLOWED to land + feel spectacular.
- NO hard clamp is built — an earned massive hit lands.
- One-shot prevention becomes a TUNING outcome — folds into the **stat-foundation** increment (per-mon HP + evolution-stage scaling) and the **holistic pass #5** (hpScale/dmgScale balanced so no-one-shots holds in normal play).
- OPTIONAL soft backstop (a very-high ~95–100% single-hit clamp) is available but NOT chosen — revisit only if a degenerate trivial turn-1 one-shot ever surfaces.
=> The momentum SPINE is **COMPLETE at Spine-1 + Spine-2**; the "third vertebra" dissolves into HP-tuning (one fewer core-math mechanic to build/sim-gate).

### Tempo (UPHEAVAL/TREMOR) — CUT. No design hole.
Tempo is **CUT**, not built. High-risk (must not corrupt the triangle — the read-war IS the triangle) for narrow payoff (a KO-race strike-order effect that rarely fires, since HP-tuning makes both-would-KO situations rare). Confirmed NO hole: TERRA's identity (earth/tank — defense, attrition, endurance) is intact via its already-built non-tempo techniques (BULWARK/DR, TOXIC SAP/attrition); the core loop (triangle + momentum + techniques) is validated fun WITHOUT tempo (the Falkner playtest had none); tempo wasn't a counter to anything, so cutting leaves nothing unanswerable. "Cutting" = UPHEAVAL/TREMOR simply never get built (TERRA draws from the non-tempo roster) — nothing removed from code, zero risk. If the speed-in-a-kill-race dilemma ever feels missing in play → find a more elegant solution THEN, don't pre-solve it. => The remaining "specials" work was JUST Updraft (now done).

### Balance philosophy — metas are a FEATURE; target GAME-BREAKING, not inequality
Standing principle for all tuning (esp. #5): perfect balance is a mirage AND undesirable — in a system this deep (34 techniques, 6-move loadouts, stances, momentum) some moves/combos WILL be stronger, and that's GOOD (the joy is the player DISCOVERING strong lines; flattening to equal kills discovery). The line that matters is **FUN-STRONG vs. GAME-BREAKING**: a move being better = fine (rewards knowledge); a move being DOMINANT (no-counter auto-win, e.g. SECOND WIND) = the problem. That distinction is DEGENERACY, not inequality — exactly the line the sim-gate already draws (it checks for domination / 100%-no-counterplay, NOT parity). The cycle: Mathias PLAYS → finds strong/broken lines (and "feels cheap" / "boring-strong" — a human signal the sim can't) → reports → we patch. => #5's job is NOT "make all 34 effects equal." It is "**eliminate the GAME-BREAKING degeneracies** (the 6 quarantined gates + whatever sim/playtest surfaces) and otherwise **let the meta breathe**."

### Updraft — SHIPPED (`f5094df`) + THE MILESTONE
Updraft (GALE — "act as if +1★ for tier-access") is DONE. The GALE loadout is now **STATIC HAZE + UPDRAFT** (the SECOND WIND stand-in removed). ⚠️ The **mid-cap is an INTENTIONAL, APPROVED deviation** from the literal "+1★" spec: uncapped, early HEAVY access was DEGENERATE (a 0%-win aggressive strategy → 74% off early DIVE BOMBs in the fragile glass-mirror); capping the boost to MID access kills it (74% → 0%) while keeping the identity (throw your typed mid a beat early; pure use ~29%). **Do NOT "fix" it back to uncapped.** Surgical scope holds (no actual ★ granted, no behind-penalty effect). — With Updraft in and tempo cut, **the mechanical combat SYSTEM is now COMPLETE: everything remaining is content, UI, and tuning.**

---

## Banked decisions & future work (not yet built)

### Stat-foundation increment (roadmap #2; separable; now also carries one-shot prevention)
- **(a) Per-mon stamina** — today stamina is a GLOBAL 100 and Catch Breath is a flat +50 (`catchBreathRestorePct` 0.5 of the global cap). Add `Species.stamina` + a per-mon `maxSt`; make Catch Breath restore % of the mon's OWN max. (HP/ATK/DEF/SPD are already per-mon; stamina is the lone uniform axis.)
- **(b) Evolution-stage scaling** — phase-3 > phase-1 across stats; single-phase legendaries EXEMPT.
- **(c) Profile-matched stat sets** — each mon's stats deliberately match its archetype (tank / speedy-attacker / etc.), extended to stamina.

### The double-throttle resolution
Spine-2 recon flagged a compounding risk: the trailing side is BOTH tier-gated (fewer moves, Spine-1) AND deals less (behind-penalty, Spine-2). **Resolution: the COMEBACK LANE, not a mandated debuff.** Status application is unpenalized when behind (Spine-2), so the trailing player fights back via the read-war / disruption rather than raw damage. Keeping the behind-penalty modest (0.04, a secondary nudge) is the other half. We did NOT mandate a Sap-Focus-style comeback tool; the lane is the design answer.

### The Blissey no-repeat lever (candidate #5 fix)
A single mechanism may collapse two of the #5 problem classes: **restrict repeated same-buff/heal casts** — hard no-repeat / cooldown / diminishing-returns (the DR machinery may already exist via refresh-not-stack + control-status fade) / escalating cost. This plausibly fixes BOTH the buff-turtle magnitudes (i) AND the SECOND WIND ★-farm (ii) — a reliable *repeatable* no-read generator/heal is the shared root. Decide the flavor in #5.

### The 640×360 battle-UI direction (roadmap #1) → **BUILT** (see "The 640×360 battle UI — BUILT" above)
DONE — the battle UI was rebuilt at **640×360** (overworld + rest of the game stays GBA 320×180) in Parts 1 / 2a / 2b-1 / 2b-2, carrying the two-pool ATTACKS/TECHNIQUES grid, locked-attack greying, on-mon status chips, and the warm-artifact skin. Spec: `battle-ui-spec-decisions.md`. Remaining: the 2b-3 deferrals (swappable background; DAZE/STAG/EXH/FOCUS-into-chips; the Q2 "HEAVY ATTACK" release label). The read-war-forward center-duel layout is banked as a future player-selectable option (not a fork).

### The invisible-status gap → **ADDRESSED** (2b-1 status chips, on-panel in 2b-2)
Statuses now show as **chips on the mon panels** (the effect-layer debuff + stacking buffs, from live engine state) — the shipping fix. The dev-log stays a dev tool. Remaining 2b-3 piece: fold the DAZE/STAG/EXH/FOCUS combat-flag header tags into the same chip system (they're still separate panel-header tags today).

### Playtest banks (from live play)
- **Foe momentum now SHOWN** (shipped this session, current UI): the player's own ★ read well, but the foe's was hidden — a load-bearing gap, since the mechanics run on the momentum DIFFERENTIAL (the behind-penalty = how far behind you are → your damage reduction; phased-unlock = the foe's tier access, e.g. is Falkner climbing toward DIVE BOMB's 2★?). The foe's ★ meter now mirrors the player's (same visual language, display-only — reads existing momentum, no combat-logic change). REVERSES the earlier "hidden for bluff tension" call — legibility of the load-bearing differential wins; the info-warfare layer keeps its other hidden info (foe bond, intent tells). Sibling to the invisible-status gap.
- **Readability-spectrum testing** — the read-war only BITES vs. hard-to-read opponents; testing only vs. a readable trainer doesn't stress it. Test across readable → semi-readable (Falkner: banked ★ + gust cadence) → Elite-tier (unbuilt — comes with content / the AI-remodel). Falkner is the testable "semi-readable" case now. (KAMON/rival is also less-readable but is a quarantined swingy fight — not a clean test.)
- **Reassess feel post-animation** — the read-war mechanically WORKS (playtest-validated), but moment-to-moment feel resolves instantly (mechanical) → the full feel-reassessment wants the in-battle animation lane (banked). Don't force a feel-verdict on an unanimated system.

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
- **The ordered plan is `docs/combat-roadmap.md`.** The **640×360 battle UI is now BUILT** (Parts 1 / 2a / 2b-1 / 2b-2 — see above; remaining = the 2b-3 deferrals). Next up: the depth playtest (the gate on everything after), then the stat-foundation (the mechanical system is complete — Spine-3 dropped, tempo cut, Updraft done).
- One Terminal A (builder, master) task at a time. Explicit `git add` paths, never `-A`. Terminal B = read-only auditor on the `Argent-termB` worktree.
