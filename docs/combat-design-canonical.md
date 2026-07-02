# Combat Design — Canonical Spec (the build reference)

**Status:** CANONICAL. The single source of truth for building combat enrichment. Consolidates the settled design from `combat-experience-vision.md` (the "why"/north star — still valid), `effect-move-framework-additions.md`, and `effect-move-roster-WIP.md` (now superseded by this doc for build purposes). States only SETTLED decisions — no open-then-resolved threads. Sim-gated throughout. Pairs with `combat-engine-extensibility-map.md` (engine hooks) + `status-engine-scope.md` (the built scaffolding, commit dadaa24).

---

## 1. THE CORE — momentum economy

Momentum (★, cap 3) is the ONE currency, earned by out-reading the opponent. It does double duty, and the tension between the two uses IS the game:
- **Gate:** ★ unlocks attack tiers (hold it → access better attacks).
- **Spend:** ★ pays for Calls + utility.
- **THE KEY TENSION:** HOLD ★ to keep powerful attacks unlocked, OR SPEND it on Calls — not both. Spending drops your tier access. "Should I spend or hold?" every turn. This is the heart.

**Phased unlock (HARD GATE):** attacks span tiers — T0 Basic (always available) → T1 Advanced (1★ held) → T2 Powerful (2★) → T3 Devastating (3★), IF the mon has learned them. Better attacks are LOCKED until you hold enough momentum. Attempting a move you can't afford FAILS meaningfully — you whiff/get-struck while "conjuring" it (the wind-up exposes you). UI warns; the Academy teaches. The gate has a fiction (building a bigger move takes earned momentum; attempting it unprepared exposes you) — so it's earned, not arbitrary.

**Behind-penalty (the simplified gap):** the more ★ the opponent holds OVER you, the less damage you deal — linear −X%/momentum-behind (% = sim-tune). Handles the matched standoff without full gap-scaling. Tiers have flat base damage; this is the only damage modulator. Self-anti-snowballing emerges free (ahead → full damage; as they claw back, your hits soften → fights stay close).

**Damage ceiling — NO one-shots:** even a T3 Devastating at full advantage does big (~70% HP, tune later) but never lethal-in-one. Every battle keeps a next beat (protects "every battle tells a story").

---

## 2. THE TWO-POOL MOVE MODEL

Every mon has TWO separate move-pools so coverage and utility don't compete for slots:
- **ATTACKS — 4 slots.** Purely offensive; type coverage lives here. Neutral/typeless moves (TACKLE) are off-type answers. **MUST include ≥1 Tier-0 Basic at all times** (a mon with no Basic CANNOT fight — the Basic is the momentum-independent floor). The rest span tiers (momentum-gated).
- **TECHNIQUES — 2 slots.** Effect/status/buff moves. Utility lives here; running a technique does NOT cost a damage slot. Solves "2/4 my attacks are FLAME vs an AQUA foe."

Total 6 moves, two purposeful pools. Keeps the read-war commitment (finite ATTACK pool → still must read/adapt). UI: two-row layout (ATTACKS row + smaller TECHNIQUES row), interacts with the m3x6 battle UI (a UI design task at build).

---

## 3. EFFECT MOVES (TECHNIQUES) — rules

- **Map to the tier ladder by POTENCY:** one ladder ranks both damage moves (how hard) and effect moves (how disruptive). Mild statuses (Daze) → low tier; game-warping (Silence, Sap Focus, Daunt, Frozen) → tier-1+ AND require a read-win (DOUBLE gate).
- **Cast IN A STANCE (the read-war unification):** every action — attack OR technique — is performed in one of the 3 stances (Aggressive/Fluid/Brace). Casting a technique commits you to a stance, so you're still in the read-war, still punishable by your cast-stance (Aggressive cast → weak to Brace, etc.). Casting is NOT a safe escape from the triangle. Reuses the existing stance resolution.
- **Debuffs (target foe):** land ONLY if your cast-stance WINS the read. Lose the read → countered, status FIZZLES, you deal only the effect move's chip damage. (This IS the status economy's "land only through a read-win" lever.)
- **Buffs (target self):** ALWAYS land (self-cast), BUT you're exposed in your cast-stance → the opponent can punish the timing. Buffs aren't free; exposure is the cost.
- **Effect moves DEAL (reduced) chip damage** + apply status on a read-win — so a miss isn't a dead turn.
- **Read-win → status, NOT also a ★:** an effect move on a read-win lands the status INSTEAD of banking a ★ that turn. Not both (else effect moves strictly better than attacks). The fork: attack (toward ★/damage) OR technique (status, no ★).
- **No-super-punish (balancing principle):** a failed technique takes the SAME consequence as losing a read while attacking in that stance — NOT more. No pile-on (no failed-read AND counter AND lost-momentum AND self-status). The inherent cost is "you didn't attack + you're exposed." Keeps techniques viable (else nobody uses them, the layer dies). Symmetric — the AI is exposed when IT casts; you can punish its casts. Sim-gate so technique-use is viable, not dominant, not dead.
- **One debuff at a time** (new replaces old — debuffs precious). **Buffs STACK** (cumulative self-improvement). ⚠️ This OVERRIDES the status doc's "negative cap 3" → tightened to 1 negative (reconcile in combat-depth-types-status.md).
- **Two-step = amplified one-step:** (tackle + heavy = tackle does more damage). A heavy land CAN apply ONE status, never double (no status×2, no status+huge-damage+momentum at once).

---

## 4. STATUSES — shared vocabulary (NOT type-exclusive)

There's a shared vocabulary of effects. Each type has a SIGNATURE anchor (its locked status from `combat-depth-types-status.md`) but that's thematic, NOT exclusive — a status can come from multiple types; a type's 2 techniques can mix from the pool. (Richer, less one-trick, better coverage.)

**Signature statuses (the anchors, per combat-depth-types-status.md — LOCKED design):**
FLAME→Burn(DoT) · AQUA→Recover(heal) · NATURE→Drain(lifesteal) · SPARK→Daze(unreliable tell) · FROST→Frozen(stance-lock) · BRAWN→Taunt+Daze · VENOM→Drained(stamina-bleed) · TERRA→Stunned(tempo) · GALE→(stat-shape, no lingering status) · PSI→Inception(force-repeat-stance) · INSECT→Sap(burst stamina-drain) · STONE→Brace-buff · SPIRIT→Shrouded(hide tell) · DRAKE→Daunt(no Aggressive) · UMBRA→Doubt(Calls cost more ★) · FORGE→(stat-shape) · BASIC→(none, honest floor).

**Momentum/Call-economy effects (the highest-value layer — the core is otherwise barely touched):**
- SAP FOCUS (foe loses ★/can't gain) · SILENCE (foe's mon can't hear Calls) · ECHO (foe forced to repeat last Call) · CALL LOCK (foe can't spend ★ on Calls).
- SECOND WIND (gain a real ★) · ATTUNEMENT (next Call cheaper) · AMPLIFY (next read-win double ★, ⚠️snowball) · UPDRAFT (act as if +1★ for TIER-ACCESS this turn, without real ★ — a temporary tier-jump, GALE).

**3 anti-spam levers (design INTO these — from the status doc):** (1) application cost — most land only via read-win; (2) diminishing returns — re-applying the same status fades 3→2→1→resists; (3) counterplay — stance-break clears, Resolve (bond-gated Call: clears + brief immunity, unlocks bond Stage 4).

**Display (LOCKED):** 3-letter tags (BRN/FRZ/DAZ/…) + battle-log sentence; negatives take inflicting-type color; positives green; (per this doc's override: 1 negative, buffs stack separately).

---

## 5. TEMPO — **CUT** (no design hole; 2026-07-02, `9b7c83d`)

Per B's brace investigation: in the simultaneous triangle, action ORDER only affects the KO-RACE (who strikes first when both could be lethal), NOT the triangle outcome (the Brace counter is a resolution rule, fires regardless of order). So tempo was NARROW — a KO-race-only finisher/denial tool. Per Mathias's standing caveat ("if the narrow version can't work without touching the triangle → CUT tempo entirely"), **it was CUT**: the tempo techniques are gone, TERRA no longer owns a tempo axis, and there is no design hole (the read-war carries the depth). Recorded here for history; there is nothing to build.

---

## 6. THE MOVE ROSTER (2 techniques/type planned; **29 built** in data.ts)

> Count note (doc-audit 2026-07-03): this is the DESIGN roster (up to 2 techniques × 17 types). The BUILD ships **29 moves-with-effect** (`src/engine/data.ts`) — TERRA's tempo pair was CUT (§5) and a few remain unbuilt. "29" is the canonical built count (was mis-stated as 34).

| Type | Technique 1 | Technique 2 |
|---|---|---|
| FLAME | SEAR — Burn (DoT 2-3rds), T0-1 | KINDLE — Attunement (next Call cheaper), T1, Buff |
| AQUA | TIDE MEND — Recover (self-heal), T1, Buff | UNDERTOW — 2nd sustain/defensive (HoT or Drained), T1 |
| NATURE | SIPHON — Drain (lifesteal dmg+heal), T1 | ENTANGLE — 2nd sustain/root/dodge-buff, T1 |
| SPARK | STATIC HAZE — Daze, T0-1 | THUNDERCLAP — Sap Focus (foe loses ★/can't gain 2rds), T1-2, read-win |
| FROST | FROST BIND — Frozen (stance-lock 1-2rds), T2, read-win | GLASS EDGE — self-buff: next attack harder but more exposed, T1, Buff |
| BRAWN | CHALLENGE — Taunt (force Aggressive 1rd) + Daze, T1 | WARCRY — Call Lock (foe can't spend ★ 1-2rds), T2, read-win |
| VENOM | TOXIC SAP — Drained (stamina-bleed 2-3rds), T1 | CORRODE — foe's next technique costs more/fizzles, T1-2 |
| TERRA | — (tempo CUT §5; TERRA techniques TBD) | — (tempo CUT §5; TERRA techniques TBD) |
| GALE | UPDRAFT — act as if +1★ for tier-access this turn, T1, Buff | WING FLARE — Daze (buffet), T1 |
| PSI | MIND SNARE — Inception (force-repeat-stance), T1 | FALSE ECHO — Echo (force-repeat-Call), T1-2 |
| INSECT | LEECH BITE — Sap (burst stamina-drain), T1 | SWARM — Amplify (double-★-next-read), T2, Buff, ⚠️snowball |
| STONE | SET STANCE — Brace-buff = poker (stronger Brace, reveals you might Brace), T0-1, Buff | SECOND WIND — gain 1★, T1-2, Buff, maybe bond-gated |
| SPIRIT | VEIL — Shrouded (hide own tell 2-3rds), T1, Buff | WANE — Cleanse (clear one debuff), T1, Buff |
| DRAKE | DREAD GAZE — Daunt (foe can't enter Aggressive 1-2rds), T2, read-win | PRIMAL ROAR — gain ★ + presence, T2, Buff |
| UMBRA | CREEPING DOUBT — Doubt (Calls cost more ★), T1 | DEAD SILENCE — Silence (foe's mon can't hear Calls), T2, read-win |
| FORGE | BULWARK — take 25% less damage 2-3 turns, T1, Buff | REFORGE — Cleanse + minor heal (or 2nd buff), T1-2, Buff |
| BASIC | FOCUS UP — generic self-buff, T0-1, Buff | STEADY — generic minor Cleanse, T0-1, Buff |

Naming law: 1-2 words ALL CAPS, status-readable, distinct from the 43 damage names. (Damage names in move-pool.md.)

**Open tuning bits (finalize at wiring/sim — anchors are set):** AQUA UNDERTOW exact (HoT vs Drained); NATURE ENTANGLE exact (sustain/root/dodge); FORGE REFORGE exact; whether INSECT SWARM/Amplify needs bond-gating or higher tier (snowball).

---

## 7. AI / TRAINER STRATEGIES (at build)
Trainers get 2-3 strategies each (NOT know-it-alls). Consolidate with `trainer-combat-profiles.md` (8-knob schema). Weaker trainers allowed irrational randomness (e.g. a FLAME mon using a VENOM technique pointlessly). Stronger trainers play the momentum/technique economy well; weaker ones don't. Type-as-counter-to-strategies is also the boss-adjustment answer (can't beat a boss → bring different-typed mons whose techniques counter its strategy).

---

## 8. BUILD SEQUENCE (all sim-gated except #0)
0. ✅ Status-engine scaffolding (dadaa24 — inert plumbing, bit-identical). DONE.
1. Wire statuses + effect moves into the scaffolding (the 29 built moves-with-effect, the read-win application, cast-in-a-stance, effect-move damage). FIRST sim-gated combat increment — Monte Carlo validation, no degenerate line dominates, read-war + hold-vs-spend stay central.
2. Two-pool move model (learnsets + battle UI).
3. Momentum-economy reshape (phased-unlock gate, behind-penalty, hold-vs-spend, damage ceiling).
(Order of 1-3 TBD at build — some interleaving likely. Each its own sim-gated increment.)

Deferred (Phase 8): terrain/environment layer (the ice/slide situational unlocks — no substrate exists; net-new engine work).
