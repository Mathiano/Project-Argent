import type { ReleaseKind, Tier, TierName } from './types';

export const COMBAT = {
  dmgScale: 0.155,
  damageVarianceMin: 0.9,
  damageVarianceSpan: 0.1,

  // TTK tuning (sim-gated, 2026-06-15). A GLOBAL HP:damage-ratio knob — every
  // mon's maxHp is scaled by this at battle creation, lengthening fights so the
  // tactical layer (reads, comebacks, future status) has room to matter. It is
  // a LENGTH lever, not power: it applies broadly to all mons (never per-mon
  // bulk), so type/read relationships are preserved — only TTK changes. At 1.30
  // a typical even matchup runs ~6-7 rounds and an advantaged one ~5 (was ~4-5
  // / ~3-4). Damage stays "crisp" (dmgScale unchanged) per the kickoff. See
  // KICKOFF-ttk-tuning.md; both ladders re-baselined to this value.
  hpScale: 1.3,

  regen: 8,
  guardRegen: 6,
  fluidCost: 12,
  aggrCostMult: 1.15,

  winded: 25,
  restRegen: 25,
  exhTaken: 1.25,

  aggrDmg: 1.25,
  aggrTaken: 1.15,
  guardDmg: 0.75,
  guardTaken: 0.6,
  reflect: 0.5,
  openDmg: 1.15,
  openTaken: 0.85,

  // ── Combat Layer 1 — base-triangle fix (combat-enrichment-roadmap.md) ──
  // AGGRESSIVE now BEATS FLUID (was a Fluid dodge). When an Aggressive strike
  // lands on a Fluid defender it's a PUNISH — the dodger gets caught — dealing
  // punishMult× extra and charging the AGGRESSOR's ★ (the read-win flips with
  // the edge). This is the dominance fix: Fluid's old safety (the reliable
  // dodge) is gone, so spamming it is now punishable. Sim-gated (PureFLUID
  // collapses from dominant to a losing strategy).
  punishMult: 1.35,
  // THRICE-REPEAT SELF-DAZE: the same stance 3 rounds running makes the
  // repeater DAZED — it takes dazeTaken× extra that round (predictability
  // punished). Symmetric for player + foe.
  dazeTaken: 1.3,
  // (Legacy dodge knobs removed with the Layer-1 flip: Fluid no longer dodges
  // Aggressive — it gets punished. dodgeSlope/dodgeCap are gone.)

  // Phase 6b — Catch Breath restores 50% of the 100-ST cap (= +50), a
  // percentage so it scales with the full bar. Was +35 flat — a weak
  // trickle that caused catch-breath stalemates.
  catchBreathRestorePct: 0.5,
  // ★ momentum cap (sim-gated, 2→3 on 2026-06-27). The Call-economy throttle:
  // the most ★ a mon can bank. At 3, a mon can hold a 3rd charge → afford Full
  // Power (★2) with a charge to spare, or bank toward a future spend. The
  // 3-slot triangle meter (drawMomentum) now fills fully. SIM NOTE: every sim
  // bot gates its ★-spend on momentum ≥ 1 (call-greedy/stamina-reader Catch
  // Breath, reader Get Away) — none requires ≥2 or banks to the cap — so the
  // raise is behaviourally inert for the ladders (player-facing economy change).
  momentumCap: 3,
  // ── Behind-penalty (Spine-2, docs/combat-design-canonical.md §1) ─────────────
  // The ANTI-SNOWBALL: the more ★ the FOE holds over you, the less damage you
  // deal. behind = max(0, foe.momentum − self.momentum) ∈ {0..3} (bounded by
  // momentumCap); penalty = max(FLOOR, 1 − perStar × behind), a multiplier on the
  // attacker's OUTGOING damage applied last (after stance + type). behind=0
  // (even/ahead) → 1.0 → no penalty. Composes into BOTH damage functions so every
  // path (punish/opening/normal/focus-release/counter/mismatch) inherits it, and
  // the Guard counter-reflect (from preMit) is scaled too (being behind weakens
  // EVERYTHING you do). Status APPLICATION is NOT penalized — only chip damage is
  // scaled — so the trailing side keeps a comeback lane via the read-war.
  // ⚠️ PLAYTEST KNOBS: these are STARTING values (sim-sane); Mathias tunes by
  // feel. Snowball too hard → lower perStar and/or raise FLOOR.
  // SIM-GATED START (Spine-2, 2026-07-01): perStar TUNED 0.10→0.04. The design
  // wanted 0.10 (behind=3 → 0.70), but Spine-1's tier-gate is ALREADY the primary
  // anti-snowball, so the penalty is a SECONDARY nudge — and at 0.10 it compounds
  // with Falkner's banked 2★ opening (the player eats the penalty persistently)
  // and drops his GENTLE-tutorial fair cells below band (button-masher 34% vs the
  // 42% floor). 0.04 keeps every Falkner fair cell in-band (button 42.7) while
  // still nudging ★-differentials (behind=3 → 0.88). FLOOR 0.65 is the safety
  // clamp — inert for behind∈{0..3} at this X (min 0.88), it binds only if Mathias
  // raises perStar past ~0.12. Headroom to push perStar UP lives with a future
  // Falkner opening-★/band re-tune (a boss decision, not this increment).
  behindPenaltyPerStar: 0.04,
  behindPenaltyFloor: 0.65,
  staggerInitMult: 0.5,
  restInitiative: -1,

  // ── Call effects (Lane B — docs/call-effects-design.md) ────────────────
  // These power the three newly-built Calls. Each is gated by the player's
  // bond tier (game-side) and spends ★, so the ★ economy is their soft
  // throttle. SIM NOTE: sim bots never emit these Call actions (recover/dodge)
  // or a fullPower move, so every constant here is dead for the ladders →
  // bit-identical. Balance is the ★ economy + the bond gate, not a ladder
  // number — a Call-using sim archetype is the future stress-test (banked).
  // RECOVER (★1): heal this fraction of maxHp. HIGH stall-risk Call — the ★
  // cost + cap-2 momentum is the only throttle today (a hard cooldown is the
  // banked follow-up if it stalls in playtest).
  recoverPct: 0.5,
  // FULL POWER (★2): the next attack deals ×this, stacking multiplicatively
  // with the stance + triangle modifiers (it amplifies whatever the attack
  // would have done — including the counter-reflect it eats into a Guard).
  fullPowerMult: 1.5,
  fullPowerCost: 2,
  // GET AWAY GRAZE (★1, Fix 3): Get Away no longer fully negates the hit — you
  // jump away but the attack clips you for this fraction of its damage. Dodge
  // (★1, bond stage 4) stays the clean 0-damage evade, so the cheaper/earlier
  // Get Away is now the weaker escape (the intended progression). ⚠️ SIM-GATED:
  // unlike recover/dodge/fullPower (sim-unused → bit-identical), getAway IS used
  // by the call-greedy bond probe, so this knob MOVES the getAway cells — a
  // deliberate nerf, re-baselined in bondLadder.test.ts.
  getAwayGraze: 0.25,
} as const;

// ── Combat FOCUS model (docs/combat-focus-redesign.md) ─────────────────────
// R1 = a generic Focus (release hidden); R2 = a chosen release resolving via
// the rotation triangle. SIM-GATED (src/sim/focusBalance.test.ts): the FOCUS
// COST is the master balance lever (design sweet spot ~1.0–1.2; tuned to 1.0
// here — too high → focus not worth it; too low → focus-spam creeps up). See
// docs/combat-focus-AS-BUILT.md. Tuned 2026-06-19; do not tweak casually.
export const FOCUS = {
  // R1 FOCUS COST (master knob): the focuser DEALS 0 and TAKES the opponent's
  // single-step strike ×this — the guaranteed cost of gathering energy.
  // RE-TUNED 1.0→0.6 (KICKOFF-focus-damage-bugfix.md, 2026-06-20): the Bug-1
  // releaseBase cut (1.7→1.3) lowered the release REWARD, so the R1 COST had to
  // follow to keep focusing worthwhile — else non-focusing single-step play
  // (BaseBalanced/FluidSpam) dominates and focus-spam falls BELOW mindless
  // spam, inverting the gate. At 0.6 the focusBalance sim's documented shape is
  // restored (Adaptive tops, focus-spam below balanced, FluidSpam loses
  // hardest, releases used ~equally). This is the master lever per design.
  focusCost: 0.6,
  // R2 release base damage multiplier (the payoff strike, before the rotation
  // outcome tilt). FEEL-TUNED DOWN 1.7→1.3 (KICKOFF-focus-damage-bugfix.md,
  // 2026-06-20): at 1.7 a landed HEAVY (esp. a super-effective one, or a crush
  // vs a Brace) one-shot foes — the sim validated STRATEGY balance but never
  // ABSOLUTE magnitude. At 1.3 a landed HEAVY is STRONG but proportionate
  // (~40% neutral / ~60% crush / ~20% dodged of a full-HP target), so the foe
  // survives a single landed Heavy at full HP in the normal case. Uniformly
  // scales every release outcome (rotation tilts unchanged) so the focus-
  // balance sim's strategy relationships hold; re-gated at this value.
  releaseBase: 1.3,
  // ROTATION outcome (R2 release vs the opponent's single-step):
  //   win  — releaser ×winDmg + its effect; the opponent's strike ×winFoe.
  //   lose — releaser ×loseDmg (blunted); the opponent's strike ×loseFoe.
  //   neutral — a trade: releaser ×neutralDmg, opponent normal.
  // winDmg (the HEAVY-crush reward) tuned 1.8→1.45 with the releaseBase cut so
  // a CRUSH is a big chunk (~60%) above neutral but not a one-shot.
  winDmg: 1.45,
  winFoe: 0.35,
  loseDmg: 0.5,
  loseFoe: 1.15,
  neutralDmg: 1.0,
  neutralFoe: 1.0,
  // FLIPPED triangle (BOTH release): winner ×flipWin, loser ×flipLose.
  // HIDE > HEAVY > FEINT > HIDE.
  flipWin: 1.45,
  flipLose: 0.62,
  // TIMING MISMATCH (F.4) — a release lands vs a still-FOCUSING opponent (who
  // deals 0, mid-gather). Multiplier on the releaser's strike by its release:
  // HEAVY devastates the gatherer, FEINT whiffs (they're committing not
  // defending), HIDE ~neutral.
  mismatch: { heavy: 1.7, feint: 0.4, hide: 1.0 } as {
    readonly [k in ReleaseKind]: number;
  },
} as const;

// ── Status engine scaffolding (docs/status-engine-scope.md) ────────────────
// PLACEHOLDER tunables for the status system. NOTHING reads these this
// increment (no active status is wired) — they are inert until the effect-move
// wiring increment, when real values arrive WITH a sim re-gate. Centralized
// here so they're sim-tunable from one place, like COMBAT/FOCUS.
export const STATUS = {
  // Base duration (rounds) a freshly-applied status lasts before it clears.
  baseDuration: 3,
  // Short-duration (control-class, e.g. a Taunt) statuses last this long.
  shortDuration: 1,
  // Diminishing-returns curve: successive applications of the SAME status to
  // the same mon shorten its duration (3→2→1 rounds); applications beyond the
  // array length RESIST (rejected → a `statusResist` event). Indexed by the
  // prior application count.
  diminishingDurations: [3, 2, 1] as readonly number[],
  // Effect moves deal REDUCED damage (× this) vs a pure attack, so a missed
  // read still chips ("a miss isn't a dead turn"). The Move.effect descriptor
  // may override per-move via `damageFactor`; this is the fallback.
  effectMoveDamageFactor: 0.5,
  // ── Per-status effect magnitudes (Increment 1a sample wiring — PLACEHOLDER,
  // sim-tuned) ──────────────────────────────────────────────────────────────
  // Burn (SEAR): DoT per tick = this fraction of maxHp, each round the status
  // is active (over baseDuration rounds). 0.08 → a landed 3-round Burn ≈ 24%
  // maxHp, enough that a read-won Burn is a real reward (sim-tuned vs reader:
  // makes occasional technique use viable rather than a tempo trap).
  burnDotPct: 0.08,
  // Bulwark (BULWARK buff): the bearer takes this fraction of incoming damage
  // (= 15% less). SIM-TUNED (effectMoves.test.ts): a persistent buff cast safely
  // in Guard has near-zero exposure cost, so its DR compounds over long attrition
  // fights — at 0.75 a buff-turtle beat the reader 100%. 0.85 keeps BULWARK a
  // real buff (a dedicated buff-user gets a ~56% edge) without dominance.
  // Re-applying the SAME buff REFRESHES (diminishing-returns, applyPendingEffect)
  // rather than stacking a 2nd multiplier; DISTINCT buffs still stack.
  bulwarkDamageTaken: 0.85,
  // ── Momentum / Call-economy effect magnitudes (Wave A — PLACEHOLDER,
  // sim-tuned). These manipulate ★ + Calls, the hold-vs-spend core. ───────────
  // Sap Focus (THUNDERCLAP debuff): the foe loses this many ★ instantly on a
  // read-win (the cleaner of "lose ★" vs "can't gain"; instant + self-bounding).
  sapFocusAmount: 1,
  // Second Wind (STONE buff): self-gain this many ★ (capped at momentumCap).
  secondWindAmount: 1,
  // Amplify (SWARM buff): the next read-win banks this many EXTRA ★ (so a +1
  // read-win becomes +2). ⚠️ snowball-watched; bounded by momentumCap.
  amplifyBonus: 1,
  // Doubt (CREEPING DOUBT debuff): the foe's Calls cost this much extra ★ while
  // active (a Call can be negated if they can't afford the inflated cost).
  doubtSurcharge: 1,
  // Attunement (KINDLE buff): the next Call costs this much less ★ (1 → free).
  attunementDiscount: 1,
  // Per-status durations (rounds); kinds absent here use baseDuration. Silence /
  // Call Lock are bounded short (the foe can still ACT, only not Call — never a
  // stun-lock); Echo is a single next-round re-map. CONTROL stance-locks
  // (Wave B) are bounded short for escapability: Frozen/Inception ≤2, Taunt 1.
  statusDurations: {
    silence: 2, callLock: 2, echo: 1, frozen: 2, inception: 2, taunt: 1,
    // Wave C: GLASS EDGE is a SHORT risk/reward window (you're fragile while it
    // lasts); the rest (undertow/shrouded/setStance/focusUp) use baseDuration.
    glassEdge: 2,
  } as { readonly [k: string]: number },
  // ── Resource effects (Wave B) ──────────────────────────────────────────────
  // Drained (TOXIC SAP): stamina bled per round while active (offsets +8 regen
  // → real pressure, but not an instant softlock).
  drainedStaminaDot: 10,
  // Sap (LEECH BITE): instant burst stamina-drain on the read-win.
  sapStaminaBurst: 20,
  // ── Sustain / buff / cleanse magnitudes (Wave C — PLACEHOLDER, sim-tuned) ───
  // The buffs/heals/cleanse layer. The watch-item is "FREE VALUE": a buff/heal
  // doesn't disrupt the opponent, so the only degeneracy is SELF-value (an
  // infinite-sustain turtle, an all-upside glass cannon). Each magnitude is
  // bounded so heal-per-turn < safe-damage-per-turn (no turtle) and every
  // tradeoff costs something. Sim-gated in src/sim/sustainEffects.test.ts.
  //
  // TIDE MEND (AQUA Recover): instant self-heal = this fraction of maxHp. A
  // no-★ technique heal — bounded by the cast-stance EXPOSURE (you DON'T act,
  // you cast in a stance the foe can punish) + magnitude, so a heal-turtle can't
  // out-sustain a reader's damage. Smaller than the RECOVER Call (0.5) which
  // costs a ★ but negates nothing extra.
  // SIM RE-TUNE 0.30→0.10: at 0.30 (and even 0.16) a no-★ heal cast safely in
  // Guard out-sustained the reader (heal-turtle won 100% — the BULWARK-turtle
  // lesson, amplified: a heal converts any fight into a won attrition war).
  tideMendHealPct: 0.1,
  // UNDERTOW (AQUA HoT): heal this fraction of maxHp each round it ticks (a
  // REGENERATING counter-tank, distinct from BULWARK's flat DR). A lingering
  // buff → refresh-not-stack DR + duration bound the total. SIM RE-TUNE
  // 0.08→0.03: the HoT heals EVERY round (incl. rests) → the worst free-value
  // offender; kept small so it's a trickle, not a sustain engine.
  undertowHealPct: 0.03,
  // SIPHON (NATURE Drain/lifesteal): READ-WIN-gated self-heal = this fraction of
  // maxHp. Offensive sustain — on a read-win the chip lands AMPLIFIED (punish/
  // opening) AND you steal life; lose the read → chip only, no heal (the
  // lifesteal fizzles, like a debuff). The read-gate is the cost.
  siphonHealPct: 0.16,
  // ENTANGLE (NATURE): defensive self-buff (vine-guard) — take this fraction of
  // incoming damage while active (NATURE's defensive sustain partner to SIPHON's
  // offense). Reuses the BULWARK DR mechanism with a milder magnitude; DISTINCT
  // from bulwark so the two stack (a double-DR turtle is sim-gated).
  entangleDamageTaken: 0.9,
  // REFORGE (FORGE): cleanse + this fraction of maxHp minor heal (fortress
  // endurance — clears a debuff AND patches a little HP).
  reforgeHealPct: 0.15,
  // FOCUS UP (BASIC): generic self-buff — the bearer's strikes deal ×this while
  // active. A small PURE-UPSIDE offense buff (BASIC's honest floor), tuned weak
  // + duration-bound so it is not free value.
  focusUpDamageDealt: 1.1,
  // GLASS EDGE (FROST glass-cannon): while active the bearer's attacks deal
  // ×Dealt BUT it takes ×Taken incoming. The extra-damage-taken is the REAL,
  // sim-measurable cost (not an ignorable flavour tell) — risk/reward, never
  // all-upside.
  glassEdgeDamageDealt: 1.3,
  glassEdgeDamageTaken: 1.25,
  // SET STANCE (STONE poker): while active, BRACE (Guard) takes ×this EXTRA
  // mitigation — CONDITIONAL on actually bracing (a stronger Brace, not a flat
  // DR). The "reveal you might Brace" downside is the GAME-side tell cost; the
  // sim can't see a tell, so this is tuned non-dominant even ignoring it.
  setStanceGuardTaken: 0.8,
  // ★ cost to apply a status via a technique (placeholder — the two-pool /
  // momentum-economy increment sets the real economy).
  applicationCost: 1,
  // RESOLVE Call (bond Stage-4, STUBBED this increment): rounds of status
  // immunity granted after it clears a status. Inert until there's a status
  // to defend against.
  resolveImmunityRounds: 2,
} as const;

// Nuke tier weight is not specified in CLAUDE.md or the spec — 1.30 is an assumption.
export const TIERS: { readonly [K in TierName]: Tier } = {
  light: { name: 'light', power: 55, cost: 12, weight: 0.85 },
  mid: { name: 'mid', power: 80, cost: 22, weight: 1.0 },
  heavy: { name: 'heavy', power: 110, cost: 35, weight: 1.15 },
  nuke: { name: 'nuke', power: 140, cost: 55, weight: 1.3, delayNext: true },
};

// ── Phased-unlock (Spine-1, docs/combat-design-canonical.md §1) ──────────────
// Held ★ gates ATTACK TIERS: an attack is legal only if its user holds at least
// this many ★, ALONGSIDE the existing stamina + winded gates (all must pass).
// One axis with the damage tier per the spec (a heavy costs 35 ST AND 2★) — maps
// the existing Move.tier, no new per-move metadata. T0/light = 0★ is ALWAYS
// available, so a mon at 0★ can always act its Basic (no soft-lock — every mon
// carries a light). A SOFT FILTER: an under-★ attack is simply not offered (not
// a backfire) — the player can't select it and the AI won't pick it (both
// choose from affordableMoves). SIM NOTE: this is NOT bit-identical — battles
// now open light-only at 0★ and unlock mid/heavy as ★ accrues (the intended
// ramp); the ladders move accordingly. SCOPE: gates ATTACKS only (moves with no
// `effect`); TECHNIQUES keep their current availability — the effect-move layer
// is untouched. (Canonical §3 puts effect moves on the same ladder via the
// two-pool "double-gate"; deferred to the two-pool increment.)
export const MOMENTUM_REQ_BY_TIER: { readonly [K in TierName]: number } = {
  light: 0,
  mid: 1,
  heavy: 2,
  nuke: 3,
};
