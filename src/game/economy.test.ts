// Phase 5b economy — buy/sell/payout math + affordability gate. Pure
// functions, so these pin the arithmetic the Mart UI and the trainer
// payout both rely on. The "money survives a save round-trip" case
// lives in save.test.ts; here we prove the math and the can't-overspend
// invariant.

import { describe, expect, test } from 'vitest';
import {
  MONEY_CAP,
  STARTING_MONEY,
  awardMoney,
  buyItem,
  canAfford,
  formatMoney,
  maxAffordable,
  priceOf,
  sellItem,
  sellPriceOf,
} from './economy';
import type { BagEntry } from './items';

describe('prices', () => {
  test('priceOf reads the item registry; sellPriceOf is half (floored)', () => {
    expect(priceOf('POTION')).toBe(300);
    expect(sellPriceOf('POTION')).toBe(150);
    expect(priceOf('SUPER POTION')).toBe(700);
    expect(sellPriceOf('SUPER POTION')).toBe(350);
    expect(priceOf('FULL HEAL')).toBe(600);
    expect(sellPriceOf('FULL HEAL')).toBe(300);
  });

  test('formatMoney prefixes the ₽ glyph', () => {
    expect(formatMoney(3000)).toBe('₽3000');
    expect(formatMoney(0)).toBe('₽0');
  });
});

describe('affordability', () => {
  test('canAfford gates on total cost', () => {
    expect(canAfford(300, 'POTION', 1)).toBe(true);
    expect(canAfford(299, 'POTION', 1)).toBe(false);
    expect(canAfford(900, 'POTION', 3)).toBe(true);
    expect(canAfford(899, 'POTION', 3)).toBe(false);
    expect(canAfford(1000, 'POTION', 0)).toBe(false); // non-positive qty
  });

  test('maxAffordable is the integer count the wallet covers', () => {
    expect(maxAffordable(1000, 'POTION')).toBe(3); // 3×300 = 900 ≤ 1000
    expect(maxAffordable(299, 'POTION')).toBe(0);
    expect(maxAffordable(0, 'POTION')).toBe(0);
  });
});

describe('buyItem — decrements money, fills the bag, never overspends', () => {
  test('a covered buy adds to the bag and subtracts the cost', () => {
    const bag: BagEntry[] = [];
    const { money, bought } = buyItem(1000, bag, 'POTION', 2);
    expect(bought).toBe(true);
    expect(money).toBe(1000 - 600);
    expect(bag).toEqual([{ itemId: 'POTION', qty: 2 }]);
  });

  test('buying stacks onto an existing bag entry', () => {
    const bag: BagEntry[] = [{ itemId: 'POTION', qty: 1 }];
    const { money, bought } = buyItem(600, bag, 'POTION', 1);
    expect(bought).toBe(true);
    expect(money).toBe(300);
    expect(bag[0]!.qty).toBe(2);
  });

  test('an unaffordable buy is refused — money + bag untouched (the gate)', () => {
    const bag: BagEntry[] = [];
    const { money, bought } = buyItem(299, bag, 'POTION', 1);
    expect(bought).toBe(false);
    expect(money).toBe(299);
    expect(bag).toEqual([]);
  });

  test('a non-positive quantity is a no-op', () => {
    const bag: BagEntry[] = [];
    expect(buyItem(1000, bag, 'POTION', 0).bought).toBe(false);
    expect(bag).toEqual([]);
  });
});

describe('sellItem — half price, decrements the bag, refuses what you do not own', () => {
  test('selling credits half price and removes from the bag', () => {
    const bag: BagEntry[] = [{ itemId: 'POTION', qty: 2 }];
    const { money, sold, gain } = sellItem(100, bag, 'POTION', 1);
    expect(sold).toBe(true);
    expect(gain).toBe(150);
    expect(money).toBe(250);
    expect(bag[0]!.qty).toBe(1);
  });

  test('selling the last unit removes the entry', () => {
    const bag: BagEntry[] = [{ itemId: 'POTION', qty: 1 }];
    const { money, sold } = sellItem(0, bag, 'POTION', 1);
    expect(sold).toBe(true);
    expect(money).toBe(150);
    expect(bag).toEqual([]);
  });

  test('selling more than you own is refused — nothing changes', () => {
    const bag: BagEntry[] = [{ itemId: 'POTION', qty: 1 }];
    const { money, sold } = sellItem(500, bag, 'POTION', 2);
    expect(sold).toBe(false);
    expect(money).toBe(500);
    expect(bag[0]!.qty).toBe(1);
  });
});

describe('awardMoney — trainer payout', () => {
  test('adds the reward to the wallet', () => {
    expect(awardMoney(STARTING_MONEY, 500)).toBe(STARTING_MONEY + 500);
  });

  test('clamps a negative reward to no-op and caps the total', () => {
    expect(awardMoney(100, -50)).toBe(100);
    expect(awardMoney(MONEY_CAP, 1000)).toBe(MONEY_CAP);
  });
});
