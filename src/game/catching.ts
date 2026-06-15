// Phase 6a — Catching 2.0 math (game-side, pure). The engine only knows
// the `throwBall` turn; everything here — window quality, catch chance,
// the willing-join roll, the interim bond value — is game-layer and
// unit-tested. Build from docs/catching-2-0.md.

import type { RNG } from '../engine';

// ---- Path 1: the read window --------------------------------------------

// Window quality at the moment of a throw. `none` = out of window
// (auto-fail + Wariness). A read-win opens a 1-round window; an exhausted
// foe is a standing stronger window; a Broken foe is the best.
export type CatchWindow = 'none' | 'read' | 'exhausted' | 'broken';

export function windowMultiplier(window: CatchWindow): number {
  switch (window) {
    case 'read':
      return 1.0;
    case 'exhausted':
      return 1.5;
    case 'broken':
      return 2.0;
    case 'none':
    default:
      return 0; // out of window → no chance (auto-fail)
  }
}

// S2 — QUANTIZED HP catch bonus at 100/75/50/25 remaining HP, each step
// a progressively better bonus. Window quality stays the MAIN lever (a
// read is what catches — this protects the anti-"beat it senseless"
// design); HP is a meaningful SECONDARY ("soften it below half" is a
// real sub-goal). Exact bonuses:
//   >75% HP → ×1.0 (none) · ≤75% → ×1.1 · ≤50% → ×1.2 · ≤25% → ×1.3
// The max HP bonus (1.3) is deliberately BELOW the smallest window-step
// ratio (broken/exhausted = 1.33), so a better window ALWAYS beats more
// attrition — HP can never substitute for the read.
export const HP_BONUS = { full: 1.0, below75: 1.1, below50: 1.2, below25: 1.3 } as const;

export function hpFactor(hpFrac: number): number {
  const f = Math.max(0, Math.min(1, hpFrac));
  if (f <= 0.25) return HP_BONUS.below25;
  if (f <= 0.5) return HP_BONUS.below50;
  if (f <= 0.75) return HP_BONUS.below75;
  return HP_BONUS.full;
}

// S1 — per-species catch rarity (base rate, 0..1). The curve has TEETH
// at the rare end: a common is easy with a good window, but a rare
// resists even with the best window (its low base rate caps the product
// far below first-try). main.ts maps each species to a tier.
export const CATCH_RARITY = { common: 0.55, uncommon: 0.3, rare: 0.12 } as const;

export interface CatchChanceInput {
  // Species base catch rate, 0..1 (common ≈ 0.55, rare ≈ 0.2).
  readonly rarity: number;
  readonly window: CatchWindow;
  // Ball multiplier (basic ball = 1.0; better balls later).
  readonly ballMult: number;
  // Foe HP fraction 0..1.
  readonly hpFrac: number;
}

// Catch chance, clamped to [0, 0.95] (never a guaranteed catch; out of
// window → 0). Path 1's headline math.
export function catchChance(input: CatchChanceInput): number {
  const wm = windowMultiplier(input.window);
  if (wm <= 0) return 0;
  const raw = input.rarity * wm * input.ballMult * hpFactor(input.hpFrac);
  return Math.max(0, Math.min(0.95, raw));
}

export function rollCatch(chance: number, rng: RNG): boolean {
  return rng.next() < chance;
}

// ---- Path 1: Wariness + flee --------------------------------------------

// Failed out-of-window throws raise Wariness; at/above this it telegraphs
// a flee, then leaves (never instant-poof).
export const WARINESS_FLEE_THRESHOLD = 3;

export function fleeTelegraphed(wariness: number): boolean {
  return wariness >= WARINESS_FLEE_THRESHOLD;
}

// ---- Path 2: the willing join (mercy) -----------------------------------

export interface WillingJoinInput {
  // Earned gym badges — the PRIMARY gate (accomplished trainers inspire
  // loyalty, and it scales with progress so the path works early).
  readonly badges: number;
  // The mon's rarity as difficulty, 0..1 (rarer = harder to win over).
  readonly monRarity: number;
  // Active mon's bond as a BONUS, 0..~0.15 (see bondBonus()). Interim
  // bond per S7; 0 when bond isn't trackable yet.
  readonly bondBonus: number;
}

// Acceptance odds for the willing join. Badges dominate; rarity is the
// difficulty it's measured against; bond is a bonus. Clamped to a real
// gamble [0.05, 0.95] — never a guaranteed KO-and-heal. (Tuning is
// settled at the catching kickoff per docs/catching-2-0.md.)
export function willingJoinChance(input: WillingJoinInput): number {
  const raw = 0.2 + input.badges * 0.2 + input.bondBonus - input.monRarity * 0.15;
  return Math.max(0.05, Math.min(0.95, raw));
}

export function rollWillingJoin(chance: number, rng: RNG): boolean {
  return rng.next() < chance;
}

// S3 — the refusal is a LESSON, not just a loss: it points (evocatively,
// from the mon's POV) at the weakest factor — without stating the
// mechanic flatly. `refusalReason` is the testable category; the lines
// are flavor (a few variants per reason).
export type RefusalReason = 'badges' | 'bond' | 'rarity';

export function refusalReason(input: {
  badges: number;
  bondBonus: number;
}): RefusalReason {
  if (input.badges <= 1) return 'badges'; // too green a trainer
  if (input.bondBonus < 0.05) return 'bond'; // your own bond is too shallow
  return 'rarity'; // a proud mon that must be won, not given
}

export const REFUSAL_LINES: { readonly [K in RefusalReason]: readonly string[] } = {
  badges: [
    'It holds your gaze a long moment — then turns for the tall grass. You haven’t walked far enough yet to be worth the following.',
    'It weighs you, the way wild things weigh a stranger, and finds the road behind you still too short. Make a name out there first.',
  ],
  bond: [
    'It glances at the partner already at your side — and something in it isn’t sure you’d ever hold it that close.',
    'It watches how your mon stands with you, and steps back. Come find me again, it seems to say, when that trust runs deeper.',
  ],
  rarity: [
    'It dips its head — almost respect — and is gone in a breath. This one won’t be given. It has to be won.',
    'Proud to the last, it slips away unhurried. A mon like this follows only strength it has truly seen.',
  ],
};

export function refusalHint(
  input: { badges: number; bondBonus: number },
  rng?: RNG,
): string {
  const lines = REFUSAL_LINES[refusalReason(input)];
  const i = rng ? Math.floor(rng.next() * lines.length) : 0;
  return lines[i] ?? lines[0]!;
}

// ---- Interim bond (S7) ---------------------------------------------------

// Minimal per-mon bond value, 0..100. Quality-earned only (read-wins,
// boss clears) — never farming. The full Phase-8 system layers on later;
// for now it just exists + persists so Path 2 + (6b) evolution can read it.
export const BOND_MIN = 0;
export const BOND_MAX = 100;
export const BOND_START_CAUGHT = 5; // a freshly-caught/joined mon
export const BOND_START_STARTER = 10; // your starter begins a little warmer

// Quality bumps. A normal win nudges the active mon; a boss win is worth
// more. No participation/time XP — only meaningful outcomes.
export const BOND_BUMP_WIN = 3;
export const BOND_BUMP_BOSS = 10;

export function bumpBond(bond: number, amount: number): number {
  return Math.max(BOND_MIN, Math.min(BOND_MAX, bond + amount));
}

// Map the interim bond value to the willing-join bonus (0..0.15).
export function bondBonus(bond: number): number {
  return (Math.max(BOND_MIN, Math.min(BOND_MAX, bond)) / BOND_MAX) * 0.15;
}

// The bond DISPLAY model (bond-track-v2): the hidden 0–100 value is
// surfaced only as ~7 named STAGES (never the number). Used by the
// summary's BOND line + the evolution bond-gate.
export const BOND_STAGES: ReadonlyArray<{ readonly stage: number; readonly max: number; readonly name: string }> = [
  { stage: 1, max: 15, name: 'Wary' },
  { stage: 2, max: 30, name: 'Warming' },
  { stage: 3, max: 45, name: 'Companions' },
  { stage: 4, max: 62, name: 'In Sync' },
  { stage: 5, max: 78, name: 'Partners in Kind' },
  { stage: 6, max: 92, name: 'Kindred' },
  { stage: 7, max: 100, name: 'Inseparable' },
];

export function bondStage(value: number): number {
  const v = Math.max(BOND_MIN, Math.min(BOND_MAX, value));
  for (const s of BOND_STAGES) if (v <= s.max) return s.stage;
  return 7;
}

export function bondStageName(value: number): string {
  return BOND_STAGES[bondStage(value) - 1]!.name;
}
