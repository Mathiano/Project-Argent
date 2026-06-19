import type { Stance, Tier, TierName } from './types';

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

// ── Combat Layer 2 — two-step plays (combat-enrichment-roadmap.md) ─────────
// Knobs for CHARGE/HIDE/FEINT. SIM-GATED (src/sim/twoStepBalance.test.ts):
// the PHASE-1 vulnerability is the master balance lever — tuned HARSH so that
// two-stepping is a real gamble and two-step-SPAM sits BELOW balanced play.
// Tuned 2026-06-19; do not tweak casually.
export const TWO_STEP = {
  // PHASE-1 vulnerability: a multiplier on the opponent's single-step strike
  // against a mon that is WINDING UP (exposed). ≥1 = extra damage. HARSH on
  // the hard-counter matchups, ~1 where the wind-up is safe vs that stance.
  // Keyed [twoStep][opponent base stance]. (Charge is interrupted by Aggressive
  // and poked by Fluid; Hide is cornered by Guard/Fluid; Feint is bulldozed by
  // Aggressive and out-waited by Guard.)
  // A wind-up is SAFE unless deliberately READ: harsh (≫1) only vs the one
  // hard-counter stance, ~neutral otherwise (a random single-stepper rarely
  // happens onto the read). This keeps two-stepping positive vs non-readers
  // and punished by readers (the design). Charge is interrupted by Aggression;
  // Hide is cornered by Guard; Feint is bulldozed by Aggression. Fluid punishes
  // nothing (it's initiative, not a punish).
  phase1Vuln: {
    charge: { A: 1.55, F: 1.0, G: 1.0 },
    hide: { A: 1.0, F: 1.0, G: 1.55 },
    feint: { A: 1.55, F: 1.0, G: 1.0 },
  } as { readonly [k in 'charge' | 'hide' | 'feint']: { readonly A: number; readonly F: number; readonly G: number } },
  // The one stance that PUNISHES (reads) each wind-up — it earns ★ and deals
  // the harsh vuln. Any other single-step only "survives" the wind-up (no ★).
  // (L2.7: surviving a non-punishing single-step is a GAMBLE, not a read.)
  punishedBy: {
    charge: ['A'],
    hide: ['G'],
    feint: ['A'],
  } as { readonly [k in 'charge' | 'hide' | 'feint']: readonly Stance[] },
  // RELEASE (phase 2) damage bonus — the boosted payoff strike that rewards
  // surviving phase 1.
  releaseMult: { charge: 1.8, hide: 1.7, feint: 1.95 } as {
    readonly [k in 'charge' | 'hide' | 'feint']: number;
  },
  // Incoming damage to a RELEASING mon this round — its committed blow's
  // momentum/follow-through blunts the counter-hit (Hide blunts most, struck
  // from concealment). Keyed by the releasing mon's step.
  releaseIncomingMult: { charge: 0.85, hide: 0.7, feint: 0.85 } as {
    readonly [k in 'charge' | 'hide' | 'feint']: number;
  },
  // FLIPPED triangle (both release) — SOFT tilt: winner's release ×flipWin,
  // loser's ×flipLose. HIDE>CHARGE>FEINT>HIDE.
  flipWinMult: 1.45,
  flipLoseMult: 0.68,
  // WIND-UP chip: a winding mon isn't a passive punching bag — it lands a
  // glancing poke (no read, no ★, no special effect) on the wind-up round,
  // softening the tempo cost of committing so two-stepping isn't self-defeating
  // vs a single-stepper. It STILL eats the phase-1 punish, so the gamble holds.
  windUpChipMult: 0.35,
  // SOFT counter: a single-step responding to a SEEN release tilts it down
  // (does NOT negate — a telegraphed two-step must stay viable, L2.5).
  softCounterMult: 0.7,
  // Which single-step stance SOFT-counters each releasing two-step (the seen
  // response that tilts the odds). charge↞Guard (brace the blow — though it
  // pierces, it blunts), hide↞Aggressive (chase the concealer), feint↞Fluid
  // (flow past the bluff).
  softCounterStance: { charge: 'G', hide: 'A', feint: 'F' } as {
    readonly [k in 'charge' | 'hide' | 'feint']: Stance;
  },
} as const;

// Nuke tier weight is not specified in CLAUDE.md or the spec — 1.30 is an assumption.
export const TIERS: { readonly [K in TierName]: Tier } = {
  light: { name: 'light', power: 55, cost: 12, weight: 0.85 },
  mid: { name: 'mid', power: 80, cost: 22, weight: 1.0 },
  heavy: { name: 'heavy', power: 110, cost: 35, weight: 1.15 },
  nuke: { name: 'nuke', power: 140, cost: 55, weight: 1.3, delayNext: true },
};
