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

// Mild HP factor — a hurt foe is a little easier (full HP ×1.0 → near-0
// HP ×1.5). Deliberately gentle: the window is the real lever, not HP.
export function hpFactor(hpFrac: number): number {
  const f = Math.max(0, Math.min(1, hpFrac));
  return 1 + (1 - f) * 0.5;
}

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

// The teaching hint on refusal — points at the weakest factor so refusal
// is a lesson, not just a loss.
export function refusalHint(input: { badges: number; bondBonus: number }): string {
  if (input.badges <= 1) {
    return 'It didn’t yet trust a trainer with so few badges.';
  }
  if (input.bondBonus < 0.05) {
    return 'It sensed your bond with your partner wasn’t deep enough yet.';
  }
  return 'It wasn’t ready to follow you — not this time.';
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
