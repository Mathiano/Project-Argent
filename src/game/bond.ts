// Bond GROWTH model — CHALLENGE-scaled, renewable forever, HORIZONTAL.
// Build to docs/bond-track-v2.md + docs/bond-growth-refinement.md (the
// refinement REVISES the growth model and supersedes it here).
//
// The display model (hidden 0–100 value → 7 named stages) lives in
// catching.ts; this module owns HOW the value grows and the one combat
// effect's unlock threshold. Pure + game-side — the engine never imports
// this (it stays bond-agnostic; see SideState.jumpstartArmed).
//
// ABSOLUTE RULE (encoded by omission): nothing here touches HP/ATK/DFN/SPD.
// Bond is horizontal. powerIndex READS stats to measure challenge; no
// function returns a stat or a stat multiplier. Max-bond's reward is a
// transformed tactical toolkit (the deferred Call/Resolve/move unlocks),
// never numbers — so there is deliberately no stat path in this file.

import type { Species } from '../engine';
import { BOND_MAX, BOND_MIN, BOND_STAGES, bondStage } from './catching';

// ---- Challenge, relative to THIS mon ------------------------------------

// A mon's combat-power index. Argent has NO levels (stats are species-
// static), so "how strong is this fight FOR THIS MON" is measured as the
// foe's power vs the mon's own power. This is the renewable axis: a weak
// mon always has parity opposition available (a real challenge), and a
// strong mon trivialises the same foe (no challenge) — exactly the
// anti-grind firewall the refinement describes.
//
// Used ONLY to scale bond XP. It never feeds back into combat stats.
export function powerIndex(sp: Species): number {
  return sp.hp + sp.atk + sp.dfn + sp.spd;
}

// Below this power ratio the foe is trivial FOR THIS MON → zero challenge
// (the firewall: stomping under-powered foes earns near-nothing, however
// many times you repeat it).
export const TRIVIAL_FLOOR = 0.7;
// Challenge saturates here — fighting above your weight is worth more, but
// capped so a single suicidal mismatch can't dump a stage's worth of bond.
export const CHALLENGE_CAP = 1.6;

// Challenge factor in [0, CHALLENGE_CAP]. 0 at/below the trivial floor,
// 1.0 at parity, scaling past 1 when the foe out-powers the mon.
export function challengeFactor(monPower: number, foePower: number): number {
  if (monPower <= 0) return 0;
  const ratio = foePower / monPower;
  if (ratio <= TRIVIAL_FLOOR) return 0;
  const c = (ratio - TRIVIAL_FLOOR) / (1 - TRIVIAL_FLOOR);
  return Math.min(CHALLENGE_CAP, c);
}

// ---- Bond XP per fight (challenge-weighted) -----------------------------

// A trainer fight is weighted above a wild (the core Pokémon loop must
// matter); a boss is the big bonus. (bond-growth-refinement.md.)
export type FightKind = 'wild' | 'trainer' | 'boss';

export const KIND_MULT: { readonly [K in FightKind]: number } = {
  wild: 1.0,
  trainer: 1.5,
  boss: 2.0,
};

// Base XP for a parity (challenge = 1) wild win. All other terms scale off
// this. Tuned so a favored mon fills the early stages over a handful of
// real fights and late stages take sustained engagement (see the
// diminishing-returns curve below + the sim report).
export const BOND_XP_BASE = 9;

// A boss clear is a landmark — a flat bonus on top of its challenge value.
export const BOSS_BONUS = 8;

// Surviving on fumes is a real moment → a little extra bond. A fainted mon
// (hpFrac ≤ 0) gets none (it didn't pull through).
export function clutchBonus(hpFracRemaining: number): number {
  if (hpFracRemaining <= 0) return 0;
  if (hpFracRemaining <= 0.15) return 4;
  if (hpFracRemaining <= 0.35) return 2;
  return 0;
}

export interface BondFightInput {
  // Power of the bonding mon and of the toughest foe it faced.
  readonly monPower: number;
  readonly foePower: number;
  readonly kind: FightKind;
  // The bonding mon's HP fraction at battle end (the clutch signal).
  readonly hpFracRemaining: number;
  // Calls the player landed this battle (the partnership deepening). 0 ok.
  readonly callsLanded?: number;
}

// Bond XP (effort units) earned from one fight. THE FIREWALL: a trivial
// foe (challenge 0) yields exactly 0 for a wild/trainer — no base, no
// clutch, no call credit — so grinding weaklings is worthless. A boss
// always grants at least its landmark bonus (bosses are never trivial by
// design).
export function bondXp(input: BondFightInput): number {
  const challenge = challengeFactor(input.monPower, input.foePower);
  if (challenge <= 0 && input.kind !== 'boss') return 0;
  let xp = BOND_XP_BASE * challenge * KIND_MULT[input.kind];
  if (input.kind === 'boss') xp += BOSS_BONUS;
  if (challenge > 0) {
    xp += clutchBonus(input.hpFracRemaining);
    xp += (input.callsLanded ?? 0) * 1.5;
  }
  return xp;
}

// ---- XP → value: the WIDENING-tier curve --------------------------------

// The persisted bond value stays 0–100 (catching.ts maps it to the 7 named
// stages). Bond XP accrues with DIMINISHING RETURNS: the same XP moves a
// low-bond mon far and a high-bond mon a little. That is the "easy early,
// earned late" curve — the named-stage thresholds WIDEN in real-fight terms
// even though the 0–100 ranges are fixed (bond-growth-refinement.md: the
// widening is a curve, not a hard split).
//
// Implemented as an effort→value map  V = BOND_MAX·(1 − e^(−E/K)).  Bond XP
// adds to the effort E, so applying XP is order-independent (associative)
// and strictly monotonic. K sets how fast early stages fill.
//
// PACING (tuned 2026-06-18 to track gym progression for a devoted core
// companion used since ~start vs real opposition; ~10.5 effort/real-fight on
// an alternating parity-trainer/near-power-wild stream). K was 55 (curve hit
// stage 6 in ~8 fights — far too fast); stretched ~10× to span a campaign:
//   ~stage 2 by ~10 real fights · ~stage 4 by ~30 (gym ~4) · ~stage 5 by ~50
//   (gym ~5-6) · ~stage 6 by ~80 (gym ~7-8) · ~stage 7 by ~140 (E4/postgame,
//   and/or the Practice Arena). Early climb stays PERCEPTIBLE (off stage 1 in
//   a few real fights); the widening shape is preserved, just stretched. True
//   max stays aspirational — you can't max a starter by gym 4. See the sim
//   report in bondGrowth.test.ts. Constants-only knob; engine math untouched.
export const BOND_EFFORT_K = 575;

export function valueToEffort(value: number): number {
  const v = Math.max(0, Math.min(BOND_MAX - 1e-9, value));
  return -BOND_EFFORT_K * Math.log(1 - v / BOND_MAX);
}

export function effortToValue(effort: number): number {
  return BOND_MAX * (1 - Math.exp(-Math.max(0, effort) / BOND_EFFORT_K));
}

// Apply bond XP to a current value, returning the new value (clamped). XP ≤
// 0 is a no-op (the firewall's near-zero gains simply don't move the bar).
export function applyBondXp(value: number, xp: number): number {
  const clamped = Math.max(BOND_MIN, Math.min(BOND_MAX, value));
  if (xp <= 0) return clamped;
  return Math.min(BOND_MAX, effortToValue(valueToEffort(clamped) + xp));
}

// Convenience: the whole pipeline for one fight (challenge → XP → value).
export function bondAfterFight(currentValue: number, input: BondFightInput): number {
  return applyBondXp(currentValue, bondXp(input));
}

// ---- The one combat effect's unlock (B5) --------------------------------

// The Tier-I "Familiar" jumpstart (first read-win each battle banks a free
// ★) unlocks once a mon crosses out of the freshly-met first stage into the
// second — i.e. it has actually bonded a little, not at the moment of
// catching. (Call-tier→display-stage placement is a tuning detail per
// bond-track-v2; stage 2 is the first FELT step. Mathias can retune.)
export const JUMPSTART_STAGE = 2;

export function hasJumpstart(bondValue: number): boolean {
  return bondStage(bondValue) >= JUMPSTART_STAGE;
}

// ---- The visible meter's "sense of progress" (B4) -----------------------

// Progress 0..1 WITHIN the current stage — surfaced as a few pips, never a
// number. Shows the relationship deepening toward the next named stage.
// Returns 1 at the top stage (Inseparable — nowhere further to climb).
// Stage bounds derive from catching's BOND_STAGES table (no duplication →
// no drift): stage s occupies (BOND_STAGES[s-2].max, BOND_STAGES[s-1].max].
export function stageProgress(bondValue: number): number {
  const stage = bondStage(bondValue);
  const lo = stage <= 1 ? BOND_MIN : BOND_STAGES[stage - 2]!.max;
  const hi = BOND_STAGES[stage - 1]!.max;
  if (hi <= lo) return 1;
  const v = Math.max(BOND_MIN, Math.min(BOND_MAX, bondValue));
  return Math.max(0, Math.min(1, (v - lo) / (hi - lo)));
}
