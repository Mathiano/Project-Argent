# Project Argent — Remaining Combat Roadmap (ordered)

The full sequence from "now" to "combat is done," consolidating this session's decisions. Ordering rationale: (1) finish the sim-validated engine spine, (2) validate feel via playtest, (3) rebuild the UI for the complex system, (4) settle balance LAST (once the economy stops changing), (5) content/AI once the system is frozen.

---

## ✅ DONE (this session — the engine skeleton + muscle)
- **Effect-move layer** — scaffolding → mechanism → Waves A/B/C (economy/control/resource/buffs-heals), ~31 techniques, all sim-validated.
- **Spine-1** — phased-unlock (★ gates attack tiers via legality filter) + Falkner ★-economy adaptation. Independently audited GREEN by Terminal B.
- **Spine-2** — the behind-penalty (−X%/momentum-behind damage modifier, X=0.04 gentle-secondary-nudge, tunable).
- **Two-pool Part A** — 4 attacks + 2 techniques slot structure, techniques equipped on all 15 CH1 mons, AI uses techniques.
- **Dev combat-log** — toggleable event log (`?log=1` / backtick) so the invisible depth is legible.
- **Updraft (GALE)** — "act as if +1★ for tier-access," self-buff, **sim-capped to MID** (uncapped early-heavy access was degenerate); GALE loadout now STATIC HAZE + UPDRAFT.

**The mechanical combat SYSTEM is COMPLETE.** The momentum spine is done at **Spine-1 + Spine-2** — Spine-3's hard ceiling was DROPPED (one-shots prevented via HP-tuning; folds into stat-foundation + #5) and tempo (UPHEAVAL/TREMOR) was CUT (no design hole). Everything below is content / UI / tuning.

Current suite: 891 pass / 6 skip (the 6 = deferred balance, see #5).

---

## ▶ NOW — the depth playtest (the gate on everything after)
With the dev-log fitting, Mathias plays the read-war for the first time. THE question: is the technique/status depth FUN + legible? Sub-questions: does the technique-vs-★ tradeoff (no-double-win) feel fair, or do techniques feel unrewarding? Is the read-war engaging or fiddly?
**This playtest can reshape the order below.** Findings slot in as: feel-tuning (→ knobs now / #5 later), UI requirements (→ the 640×360 scope), or design revisits (→ before proceeding).

---

## THE REMAINING BUILD ORDER
*(Spine-3 and Tempo are GONE from the sequence — Spine-3 dissolved into HP-tuning, tempo cut. Updraft is DONE. See ✅ DONE above + the build-status decisions.)*

### 1. The 640×360 battle UI  [playtest-informed — scope AFTER the depth playtest]
The battle UI rebuilt at 640×360 (overworld + rest of game STAYS GBA 320×180). Reason: the read-war (6 moves, stances, momentum, 34 status effects) is too complex/rigid for 320×180. Replaces the current battle UI if it works.
- Includes: the two-row ATTACKS/TECHNIQUES layout, **locked-attack greying** (the playtest bug — ★-locked attacks visibly dimmed), and **player-facing status indicators/icons on the mons** (the shipping solution to the invisible-status gap — the dev-log is only the dev-time version).
- Mathias's VISUAL domain (CC can't see) — maybe Claude Design. Likely splits: functional structure (CC) + the look (Mathias/CD).
- Scope its REQUIREMENTS from the playtest (how much status info must show, how the read-war must read). **Button placement doesn't matter until this** — don't invest in the 320×180 battle UI.
- Sub-item (open question): an attack/technique EXPLAINER (the 34 effects need to be legible) — location TBD (menu/overworld/battle-UI).

### 2. Stat-foundation increment  [separable; now ALSO carries one-shot prevention]
Per-mon stat depth (the behind-penalty doesn't depend on it, so it's flexible in order):
- **(a) Per-mon stamina** — add Species.stamina + per-mon maxSt (today stamina = global 100; Catch Breath = flat +50). Make Catch Breath restore % of the mon's OWN max.
- **(b) Evolution-stage scaling** — phase-3 > phase-1 across all stats; single-phase legendaries EXEMPT.
- **(c) Profile-matched stat sets** — each mon's stats deliberately match its archetype (tank/speedy-attacker/etc.); extends the existing HP/ATK/DEF/SPD spread to stamina + makes it deliberate.
- **(d) One-shot prevention (from the Spine-3 reframe)** — HP pools (per-mon HP + stage scaling) big enough that a single hit realistically can't reach 100% in normal play. NO hard clamp; one-shots don't happen because of the MATH, and a rare genuinely-earned huge hit is allowed to land.
Connects to the Call-rebalance (Catch Breath scaling to a bigger pool helps equalize Calls).

### 3. THE HOLISTIC POTENCY/FEEL TUNING PASS ("**#5**" — the stable name used across the docs + code)  [LAST — needs the settled economy]
Re-tune + re-validate ALL ~34 effects in the FINAL settled economy (after the spine + two-pool + stats stop changing — tuning earlier = whack-a-mole). **The GOAL is NOT "make all 34 effects equal"** — metas are a feature (see the balance philosophy). It's: **eliminate the GAME-BREAKING degeneracies and otherwise let the meta breathe.** Also **validates no-one-shots-in-normal-play** (hpScale/dmgScale balanced — the Spine-3 reframe's tuning gate). The deferred balance lives here. THREE known problem classes:
- **(i) Buff-turtle magnitudes** (heal-turtle/bulwark-turtle/set-stance) — MAGNITUDE tuning.
- **(ii) SECOND WIND→FULL POWER = 100%** — a STRUCTURAL degeneracy (reliable no-read ★-farm → burst), likely a DESIGN fix not a number. **Candidate lever: the "Blissey" no-repeat rule** (restrict repeated same-buff/heal casts — hard no-repeat / cooldown / diminishing-returns [DR machinery may already exist via refresh-not-stack + control-status fade] / escalating cost). This ONE lever may also fix (i) — collapses two classes into one mechanism. Decide the flavor here.
- **(iii) rivalCard trainer-tech bleed** — the buff-turtle quarantine via KAMON's AI; re-settles when (i)/(ii) are tuned.
Plus: the §3 question (gating techniques by tier — partially helps (ii), cascades 19 tests); the Call-rebalance (equalize Full Power/Dodge/Recover/Catch Breath — the weak-Catch-Breath finding).
The 6 quarantined test gates get un-skipped + re-validated here.

### 4. Trainer AI remodel  [AFTER the combat system is frozen]
All trainer AIs remodeled for the FINAL system — ONCE, after everything above (don't iterate AIs while rules still shift). Connects to the trainer-archetype-catalog (class → sprite identity → combat profile → typical mons). Each trainer gets 2-3 strategies; weaker trainers allowed irrational randomness.

---

## PARALLEL / SEPARATE WORKSTREAMS (not blocking the above)
- **Call expansion** (live in a Fable/design chat) — anime-inspired bond-gated Calls (Read Them!/Switch It Up!/Last Stand!/Together!/etc.). "Read Them!" fills a real gap (no Call touches the read-war). Some (Switch It Up!/Last Stand!/Together!) would ALSO help the double-throttle comeback. Its own design+build; slot in when ready.
- **Wild Card mons** (banked, big) — low-bond mons sometimes ignore Calls (the "mon that doesn't listen yet" — anime authenticity). Its own conversation.
- **In-battle animation lanes** (banked) — the major post-systems visual lane.

## DESIGN PRINCIPLES HOLDING THIS TOGETHER (learned this session)
- **Metas are a FEATURE; target GAME-BREAKING, not inequality.** Perfect balance is a mirage AND undesirable — in a deep system some lines WILL be stronger, and the joy is DISCOVERING them. The line that matters is FUN-STRONG vs. DOMINANT (no-counter auto-win). Tuning targets DEGENERACY, not parity (exactly what the sim-gate checks). Play → report → patch; Mathias is the feel-authority (finds "cheap"/"boring-strong" the sim can't).
- Difficulty self-scales with team size (struggling player brings more mons; late-game leaders carry 5-6) → don't over-tune single battles.
- Land sim-sane, tune in playtest (sim = "not broken"; Mathias playing = "feels right"). Keep knobs as config (X, FLOOR, hpScale, dmgScale, tier powers, Catch Breath %).
- Defer balance to the settled economy (quarantine, don't chase, while the economy still changes).
- Split builds so each ladder-shift is diagnosable (caught Falkner, the buff-turtles, SECOND WIND each in isolation).
- A sim-gate is only as good as the measuring bot (the SECOND WIND find was a yardstick artifact — honest re-measurement + B's independent audits catch this).
- Design/implementation separation (CC builds systems that consume design-authored assets; the visual/aesthetic calls are Mathias's).
