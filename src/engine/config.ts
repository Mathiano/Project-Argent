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
  momentumCap: 2,
  staggerInitMult: 0.5,
  restInitiative: -1,
} as const;

// ── Combat FOCUS model (docs/combat-focus-redesign.md) ─────────────────────
// R1 = a generic Focus (release hidden); R2 = a chosen release resolving via
// the rotation triangle. SIM-GATED (src/sim/focusBalance.test.ts): the FOCUS
// COST is the master balance lever (~1.1 — too high → focus not worth it; too
// low → focus-spam creeps up). Tuned 2026-06-19; do not tweak casually.
export const FOCUS = {
  // R1 FOCUS COST (master knob): the focuser DEALS 0 and TAKES the opponent's
  // single-step strike ×this — the guaranteed cost of gathering energy.
  focusCost: 1.0,
  // R2 release base damage multiplier (the payoff strike, before the rotation
  // outcome tilt).
  releaseBase: 1.7,
  // ROTATION outcome (R2 release vs the opponent's single-step):
  //   win  — releaser ×winDmg + its effect; the opponent's strike ×winFoe.
  //   lose — releaser ×loseDmg (blunted); the opponent's strike ×loseFoe.
  //   neutral — a trade: releaser ×neutralDmg, opponent normal.
  winDmg: 1.8,
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

// Nuke tier weight is not specified in CLAUDE.md or the spec — 1.30 is an assumption.
export const TIERS: { readonly [K in TierName]: Tier } = {
  light: { name: 'light', power: 55, cost: 12, weight: 0.85 },
  mid: { name: 'mid', power: 80, cost: 22, weight: 1.0 },
  heavy: { name: 'heavy', power: 110, cost: 35, weight: 1.15 },
  nuke: { name: 'nuke', power: 140, cost: 55, weight: 1.3, delayNext: true },
};
