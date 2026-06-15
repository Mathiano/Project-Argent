import type { Tier, TierName } from './types';

export const COMBAT = {
  dmgScale: 0.155,
  damageVarianceMin: 0.9,
  damageVarianceSpan: 0.1,

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
  dodgeSlope: 2.0,
  dodgeCap: 0.9,

  // Phase 6b — Catch Breath restores 50% of the 100-ST cap (= +50), a
  // percentage so it scales with the full bar. Was +35 flat — a weak
  // trickle that caused catch-breath stalemates.
  catchBreathRestorePct: 0.5,
  momentumCap: 2,
  staggerInitMult: 0.5,
  restInitiative: -1,
} as const;

// Nuke tier weight is not specified in CLAUDE.md or the spec — 1.30 is an assumption.
export const TIERS: { readonly [K in TierName]: Tier } = {
  light: { name: 'light', power: 55, cost: 12, weight: 0.85 },
  mid: { name: 'mid', power: 80, cost: 22, weight: 1.0 },
  heavy: { name: 'heavy', power: 110, cost: 35, weight: 1.15 },
  nuke: { name: 'nuke', power: 140, cost: 55, weight: 1.3, delayNext: true },
};
