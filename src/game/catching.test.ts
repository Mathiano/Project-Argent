// Phase 6a — catching math (pure). Pins the window/chance/willing-join
// formulas + the interim bond so the battle-scene + main.ts wiring lean
// on tested arithmetic.

import { describe, expect, test } from 'vitest';
import { mulberry32 } from '../engine';
import {
  BOND_MAX,
  bondBonus,
  bumpBond,
  catchChance,
  fleeTelegraphed,
  hpFactor,
  refusalHint,
  rollCatch,
  rollWillingJoin,
  WARINESS_FLEE_THRESHOLD,
  willingJoinChance,
  windowMultiplier,
} from './catching';

describe('Path 1 — windows + catch chance', () => {
  test('window multipliers: none 0, read 1.0, exhausted 1.5, broken 2.0', () => {
    expect(windowMultiplier('none')).toBe(0);
    expect(windowMultiplier('read')).toBe(1.0);
    expect(windowMultiplier('exhausted')).toBe(1.5);
    expect(windowMultiplier('broken')).toBe(2.0);
  });

  test('out-of-window throw has ZERO catch chance (auto-fail)', () => {
    expect(catchChance({ rarity: 0.8, window: 'none', ballMult: 1, hpFrac: 0.1 })).toBe(0);
  });

  test('catch chance scales with window quality (read < exhausted < broken)', () => {
    const base = { rarity: 0.3, ballMult: 1, hpFrac: 1 } as const;
    const read = catchChance({ ...base, window: 'read' });
    const exh = catchChance({ ...base, window: 'exhausted' });
    const brk = catchChance({ ...base, window: 'broken' });
    expect(read).toBeGreaterThan(0);
    expect(exh).toBeGreaterThan(read);
    expect(brk).toBeGreaterThan(exh);
  });

  test('catch chance is clamped to ≤ 0.95 (never a guaranteed catch)', () => {
    expect(catchChance({ rarity: 1, window: 'broken', ballMult: 2, hpFrac: 0 })).toBeLessThanOrEqual(0.95);
  });

  test('a hurt foe is mildly easier (hpFactor)', () => {
    expect(hpFactor(1)).toBe(1);
    expect(hpFactor(0)).toBeCloseTo(1.5, 5);
    expect(hpFactor(0.5)).toBeCloseTo(1.25, 5);
  });

  test('rollCatch is a strict threshold on the RNG draw', () => {
    // mulberry32(1) first draw is deterministic; a chance of 1 always
    // catches, a chance of 0 never does.
    expect(rollCatch(1, mulberry32(1))).toBe(true);
    expect(rollCatch(0, mulberry32(1))).toBe(false);
  });
});

describe('Path 1 — Wariness flee telegraph', () => {
  test('flee telegraphs at/above the threshold', () => {
    expect(fleeTelegraphed(WARINESS_FLEE_THRESHOLD - 1)).toBe(false);
    expect(fleeTelegraphed(WARINESS_FLEE_THRESHOLD)).toBe(true);
  });
});

describe('Path 2 — willing join', () => {
  test('more badges → higher acceptance (badges are the primary gate)', () => {
    const at0 = willingJoinChance({ badges: 0, monRarity: 0.3, bondBonus: 0 });
    const at1 = willingJoinChance({ badges: 1, monRarity: 0.3, bondBonus: 0 });
    const at4 = willingJoinChance({ badges: 4, monRarity: 0.3, bondBonus: 0 });
    expect(at1).toBeGreaterThan(at0);
    expect(at4).toBeGreaterThan(at1);
  });

  test('bond is a bonus modifier on top of badges', () => {
    const noBond = willingJoinChance({ badges: 2, monRarity: 0.3, bondBonus: 0 });
    const withBond = willingJoinChance({ badges: 2, monRarity: 0.3, bondBonus: 0.15 });
    expect(withBond).toBeGreaterThan(noBond);
    expect(withBond - noBond).toBeCloseTo(0.15, 5);
  });

  test('rarer mons are harder to win over', () => {
    const common = willingJoinChance({ badges: 2, monRarity: 0.2, bondBonus: 0 });
    const rare = willingJoinChance({ badges: 2, monRarity: 0.9, bondBonus: 0 });
    expect(rare).toBeLessThan(common);
  });

  test('always a real gamble — clamped to [0.05, 0.95]', () => {
    expect(willingJoinChance({ badges: 0, monRarity: 1, bondBonus: 0 })).toBeGreaterThanOrEqual(0.05);
    expect(willingJoinChance({ badges: 8, monRarity: 0, bondBonus: 0.15 })).toBeLessThanOrEqual(0.95);
  });

  test('refusal hint points at the weakest factor (a lesson, not just a loss)', () => {
    expect(refusalHint({ badges: 0, bondBonus: 0.1 })).toContain('badges');
    expect(refusalHint({ badges: 3, bondBonus: 0 })).toContain('bond');
  });

  test('rollWillingJoin thresholds on the RNG draw', () => {
    expect(rollWillingJoin(1, mulberry32(2))).toBe(true);
    expect(rollWillingJoin(0, mulberry32(2))).toBe(false);
  });
});

describe('Interim bond (S7)', () => {
  test('bumpBond clamps to [0, 100]', () => {
    expect(bumpBond(98, 5)).toBe(100);
    expect(bumpBond(2, -5)).toBe(0);
    expect(bumpBond(50, 3)).toBe(53);
  });

  test('bondBonus maps 0..100 → 0..0.15', () => {
    expect(bondBonus(0)).toBe(0);
    expect(bondBonus(BOND_MAX)).toBeCloseTo(0.15, 5);
    expect(bondBonus(50)).toBeCloseTo(0.075, 5);
  });
});
