# Effect-Move Framework + Additions (design session, Mathias) — v2

**Status:** DESIGN — extends the LOCKED status design (`combat-depth-types-status.md`). Resolves the effect-move↔tier framework, two-step rules, adds momentum/Call-economy effects + buffs, and flags 2 OPEN questions (tempo/triangle, attack-slots). NOT built; all sim-gated. Drop in `docs/`.

## LOCKED this session

### Effect moves map to the TIER ladder by POTENCY
One ladder ranks BOTH damage moves (how hard) AND effect moves (how disruptive). Weak statuses (Daze) → low tier; game-warping ones (UMBRA Doubt, DRAKE Daunt, the new Silence/Echo) → tier-1+ AND require a read-win. Strong effects get a DOUBLE gate: momentum (tier) + read-win (application).

### One debuff at a time; multiple buffs stack
- **Only ONE debuff on a mon at a time** — a new debuff REPLACES the old. Debuffs are precious/focused (one read-war attack at a time; choose your disruption).
- **Buffs STACK** — self-improvement is cumulative (build your position).
- ⚠️ OVERRIDES the status doc's "negative cap = 3" → tightened to 1 negative. (Flag for reconciliation with combat-depth-types-status.md Part 4B.)

### Two-step = amplified one-step (LOCKED)
Two-steps amplify a one-step (tackle + heavy = tackle does more damage), NOT a separate move. A heavy land CAN apply ONE status, never double (no status×2, no status+huge-damage+momentum all at once). Heavy = more damage OR attack + one status.

### Read-win → status, NOT also a ★ (RESOLVED)
An effect move played into a read-win lands the STATUS *instead of* banking a ★ that turn. You do NOT get both (both = effect moves strictly better than attacks + double-reward). The fork: this turn, attack (toward ★/damage) OR effect-move (status, no ★). That choice is the game.

## Statuses that attack the MOMENTUM/CALL economy (the gap — highest value, Mathias's priority)

### Debuffs (attack their economy — the "Thunderclap" space)
- **SAP FOCUS** (locked) — foe loses a ★ / can't gain ★ for N turns. Sets back their tier access. The Thunderclap. Fit: SPARK/PSI.
- **SILENCE** (locked, replaces "Stalemate") — the foe's mon CAN'T HEAR the trainer's Calls for N turns. Severs the trainer-mon link (the bond/communication thesis). Devastating + on-theme — not "Calls disabled," but "your mon can't hear you." Fit: UMBRA/PSI.
- **ECHO** (locked, replaces flat "Call Lock") — foe is FORCED to repeat their last Call next round ("they think they're hearing their trainer's voice again"). A false echo of the trainer — flavor + mechanic (predictable forced Call → play around it). Fit: PSI/SPIRIT.

### Buffs (ease YOUR economy — positive mirror, fills the buff gap)
- **SECOND WIND** (locked) — gain a ★ instantly (advances your tier access). Rare/powerful, maybe bond-gated.
- **ATTUNEMENT** (locked) — your next Call costs less ★ (or free). Eases YOUR hold-vs-spend. The positive mirror of UMBRA Doubt — a BOND buff (mon trusts you, Calls flow).
- **AMPLIFY** (locked) — next read-win earns double ★. ⚠️ snowball risk — sim-gate hard.

## Other buffs (Mathias: "we need more buffs") — LOCKED
- **Stance buff = POKER** (the interesting version): a Brace-buff makes your Brace stronger BUT reveals you might Brace. Tell-for-power tradeoff — take the stronger telegraphed Brace, or stay hidden and weaker. Real read-war poker.
- **CLEANSE** (locked) — clear ONE debuff, low-to-NO damage. So debuff-counterplay isn't ONLY the rare bond-gated Resolve.
- **Counter-strengthen / Read-insurance** — possible additions (your counter hits harder / your next stance wins a tie). Lower priority.

## ⚠️ OPEN QUESTION 1 — Tempo (act first/last) vs. the triangle
Mathias flagged: "would it make sense to Brace first, then be attacked after?" Resolution (proposed): in the simultaneous-triangle system, **tempo affects the KO-RACE / lethal-resolution order, NOT the triangle outcome.** Brace's counter is a resolution rule (fires regardless of order — confirmed by the brace-acts-last investigation), so tempo is IRRELEVANT to Brace. Tempo matters for the kill window with AGGRESSIVE/finisher moves:
- **Tempo BUFF (act first / "Quicken")** — your potentially-lethal hit resolves before theirs. A FINISHER tool. No synergy with Brace (don't pair them).
- **Tempo DEBUFF (act last, = TERRA Stunned)** — they can't out-race you to the kill. Defensive denial.
- So tempo = KO-race tool, paired with finishers, NOT a general "go first" buff. **NEEDS MATHIAS CONFIRMATION that this framing is right** (vs. tempo being a bigger deal in some way we're missing).

## ⚠️ OPEN QUESTION 2 — Attack slots: 4 vs 6 vs "4 + utility"
The tension: effect moves in limited slots WEAKEN a mon (2 of 4-6 slots reserved for situational statuses crowd out damage). Mathias floated 6 slots ("a Pokémon move would never").
- **FOR 6:** Argent's combat is deeper than Pokémon's; effect moves need room to be VIABLE alongside attacks (else players won't run statuses, and the whole status layer dies). 6 enables the depth.
- **AGAINST 6:** more paralysis, UI complexity (6 moves on 320×180 / m3x6 layout?), balance surface; risks diluting the READ-WAR COMMITMENT (4 slots FORCE reading/adapting since you can't cover everything; 6 tips toward "an answer for everything" = less reading).
- **MIDDLE PATH (Claude's suggestion):** 4 ATTACK slots (damage + commitment) + a SEPARATE 1-2 UTILITY/TECHNIQUE slots for effect moves. Effect moves don't compete with attacks (solves the "wasted slots" worry) without bloating to 6 equivalent options (preserves commitment). "4 attacks + 2 techniques."
- **BIG decision — reshapes every mon's build. NOT locked. Decide deliberately.** (Also a UI question — interacts with the m3x6 battle layout.)

## Still open / to resolve
- The 2 open questions above (tempo framing, attack slots).
- Which TYPES host the new momentum/Call effects (SPARK/PSI/BRAWN/UMBRA/SPIRIT likely).
- Exact tier per effect move (potency → tier).
- Reconcile the "1 debuff" rule with the status doc's "3 negative cap."
- ALL sim-gated (status×type cross-product, no all-upside type; momentum-economy effects especially touch the core loop).

---

# RESOLVED (continued) — Attack slots + effect-move damage

## TWO-POOL MOVE MODEL (LOCKED — replaces the 4-vs-6 open question)
Every mon has TWO separate move-pools, so damage-coverage and utility DON'T compete for slots:

- **ATTACKS — 4 slots.** Purely offensive. Type coverage lives here, uncontested by utility. Neutral/typeless moves (TACKLE etc.) serve as off-type answers. **MUST include ≥1 Tier-0 Basic at all times** (the always-available, momentum-independent floor — a mon with no Basic CANNOT fight). The rest span tiers (gated by momentum).
- **TECHNIQUES — 2 slots.** Effect/status/buff moves (Sap Focus, Silence, Echo, Attunement, stance-buffs, Cleanse). Utility lives here, uncontested by damage. Running a status does NOT cost a damage slot → solves "2/4 my attacks are FLAME vs an AQUA foe, I'm screwed."

**Total 6 moves, but in 2 purposeful pools** — solves coverage-vs-utility (they don't compete), KEEPS read-war commitment (finite ATTACK pool → still must read/adapt, can't cover everything), UI-legible (two visually-distinct groups, not 6 identical buttons).

### Why two pools beat flat 5/6
The real problem was never "too few slots" — it was damage and utility FIGHTING for the same slots. More flat slots (5/6) eases but doesn't FIX the fight (still agonize "5th damage type or 2nd status?"). Separate pools STOP them competing. Mathias reasoned to this from the coverage problem.

### Example (FLAME mon)
- ATTACKS (4): CINDER FLICK (FLAME light/Basic) · EMBER SNAP (FLAME mid) · FLAME RUSH (FLAME heavy) · TACKLE (neutral = off-type answer)
- TECHNIQUES (2): [a FLAME status move] · [Attunement or a stance-buff]
- vs an AQUA foe: FLAME attacks weak, but TACKLE still works + techniques intact → disadvantaged (type matters, correct) but not helpless, WITHOUT sacrificing a technique slot for coverage.

### UI implication
Two-row battle layout: ATTACKS row (the main thing) + a smaller TECHNIQUES row/section. More legible than 6 identical buttons. (Mathias intuited "move 4 up, slot others below" — that's this, as two pools.) Interacts with the m3x6 battle UI — a UI design task when built.

## Effect moves DEAL DAMAGE (LOCKED)
Effect moves deal (reduced) damage AND apply their status on a read-win. Rationale: a MISS (failed read-win) must still accomplish something (chip damage) — else a miss is double-punished (no status AND no ★ AND a dead turn). So effect moves are ALWAYS worth throwing, just better on a read-win. (Combined with "read-win → status, not ★": effect move on read-win = reduced damage + status, no ★; effect move on a miss = reduced damage only.)

## Mandatory Basic (LOCKED)
Every mon MUST always have ≥1 Tier-0 Basic attack in its ATTACKS pool. A mon with no Basic cannot fight (no momentum-independent move to act with at 0★ / when higher tiers are locked). The Basic is the reliable floor.

## Build/downstream impact (this reshapes)
- The learnset derivation template (move-pool.md) → needs a 2-pool structure (attacks vs techniques), guaranteeing a Basic in attacks.
- Every mon's kit → 4 attacks + 2 techniques.
- The battle UI → two-pool layout (m3x6).
- Sim → bots need to use the 2-pool structure; effect-move damage + status are new sim-exercised math (re-baseline).

## Tempo (Q1) — framing CONFIRMED by Mathias (with a caveat)
Tempo affects the KO-race / lethal-resolution order, NOT the triangle outcome (Brace counters regardless of order). Tempo = finisher/denial tool, paired with aggressive moves, not a general "go first" buff. **Caveat (Mathias): only if CC can make it work without breaking the triangle/game** — so tempo's exact implementation is sim-gated + must preserve the triangle; if it can't be done cleanly, tempo may be cut. Flagged for the build.
