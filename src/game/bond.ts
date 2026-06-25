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

// FIGHT-AWARE strain: how hard the fight actually was ON THIS MON, read off
// the HP fraction it ended with (HP only falls in battle — no in-battle heal
// is built — so the survivor's final HP is its lowest point). This MODULATES
// the power-ratio challenge so bond tracks FELT difficulty, not just nominal
// stats: a type-advantaged SWEEP that left the mon near-full earns less; a
// grind that nearly killed it earns more (this subsumes the old clutch
// bonus). A fainted mon (in a won battle) gets the neutral 1.0 — it fought
// and fell, but sacrificing isn't rewarded above a hard-won survival.
// Centred so a typical mid-HP win (≈0.5) is exactly 1.0 → the pacing anchor
// (and BOND_EFFORT_K) is unchanged by this factor.
export function strainMultiplier(hpFracRemaining: number): number {
  if (hpFracRemaining <= 0) return 1.0; // fainted — fought and fell
  if (hpFracRemaining < 0.2) return 1.35; // clutch: survived on fumes
  if (hpFracRemaining < 0.5) return 1.15; // a real grind
  if (hpFracRemaining < 0.85) return 1.0; // a normal fight
  return 0.6; // barely scratched — a sweep, not a struggle
}

export interface BondFightInput {
  // Power of the bonding mon and of the toughest foe it faced.
  readonly monPower: number;
  readonly foePower: number;
  readonly kind: FightKind;
  // THIS mon's HP fraction at battle end — the fight-strain signal.
  readonly hpFracRemaining: number;
  // Calls the player landed this battle (the partnership deepening). 0 ok.
  readonly callsLanded?: number;
}

// Bond XP (effort units) earned from one fight, FOR ONE MON. THE FIREWALL: a
// trivial foe (challenge 0) yields exactly 0 for a wild/trainer — no base, no
// strain, no call credit — so grinding weaklings is worthless however hurt
// you let yourself get. A boss always grants at least its landmark bonus
// (bosses are never trivial). Strain MODULATES the challenge (felt difficulty)
// but can never resurrect a zero — the firewall holds.
export function bondXp(input: BondFightInput): number {
  const challenge = challengeFactor(input.monPower, input.foePower);
  if (challenge <= 0 && input.kind !== 'boss') return 0;
  const strain = strainMultiplier(input.hpFracRemaining);
  let xp = BOND_XP_BASE * challenge * strain * KIND_MULT[input.kind];
  if (input.kind === 'boss') xp += BOSS_BONUS;
  if (challenge > 0) xp += (input.callsLanded ?? 0) * 1.5;
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

// Did applying bond XP cross into a new named stage? Returns the from/to
// stage numbers when it did, else null — the trigger for the post-battle
// stage-crossing beat (Issue 1). Pure: the caller maps stage → name + shows
// the message; this just detects the milestone.
export interface BondStageCross {
  readonly fromStage: number;
  readonly toStage: number;
}
export function bondStageCrossing(before: number, after: number): BondStageCross | null {
  const fromStage = bondStage(before);
  const toStage = bondStage(after);
  return toStage > fromStage ? { fromStage, toStage } : null;
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

// The top of the named stage `value` currently sits in — the value at which
// the bar would read 100% before crossing into the next stage. Used by the
// in-combat bond bar's post-win advance: the bar fills to its stage ceiling
// (caps at 100%) and a genuine tier-cross is handed to the post-fight beat
// (bond-legibility-design.md surface ①/②), never snapping the bar mid-fill.
export function stageCeiling(bondValue: number): number {
  return BOND_STAGES[bondStage(bondValue) - 1]!.max;
}
