// Phase 5b economy — money, prices, and the buy/sell/payout math.
// Game-layer only; the engine never sees money. Pure functions so the
// Mart UI and the trainer-payout hook both lean on the same tested
// arithmetic (no drift between "what the shop charges" and "what the
// save records").
//
// Money is a plain number on RunState (and an additive `money?` field
// on the save). These helpers take the current value and return the
// next value; bag mutations happen in place (matching bagAdd/bagConsume
// from items.ts) so the caller writes one source of truth back.

import { bagAdd, bagConsume, lookupItem } from './items';
import type { BagEntry } from './items';

// Classic Gen-2 starting wallet. Seeded by New Game; also the fallback
// a pre-5b save (no `money` field) loads with.
export const STARTING_MONEY = 3000;

// Hard ceiling — keeps the displayed figure inside the panel and guards
// against an absurd accumulated balance. Classic games cap at 999,999.
export const MONEY_CAP = 999_999;

// The ₽ glyph the canvas monospace font renders (same unicode comfort
// level as the ★ / ▼ / É already used across the UI + map signs).
export const MONEY_SYMBOL = '₽';

// Format a balance for display, e.g. 3000 → "₽3000".
export function formatMoney(money: number): string {
  return `${MONEY_SYMBOL}${Math.max(0, Math.floor(money))}`;
}

export function priceOf(itemId: string): number {
  return lookupItem(itemId).price;
}

// Sell price is half the buy price (classic), floored. Lives here so
// the haircut is defined once.
export function sellPriceOf(itemId: string): number {
  return Math.floor(lookupItem(itemId).price / 2);
}

export function canAfford(money: number, itemId: string, qty = 1): boolean {
  if (qty <= 0) return false;
  return money >= priceOf(itemId) * qty;
}

// Largest quantity of `itemId` the wallet can afford (0 when it can't
// afford one). Drives the buy quantity selector's upper clamp.
export function maxAffordable(money: number, itemId: string): number {
  const unit = priceOf(itemId);
  if (unit <= 0) return 0;
  return Math.floor(money / unit);
}

// Buy `qty` of an item. On success: adds to the bag (in place) and
// returns the decremented balance. On failure (can't afford, bad qty):
// returns the money unchanged and bought:false — the affordability gate
// that makes overspending impossible.
export function buyItem(
  money: number,
  bag: BagEntry[],
  itemId: string,
  qty = 1,
): { readonly money: number; readonly bought: boolean } {
  if (qty <= 0) return { money, bought: false };
  const cost = priceOf(itemId) * qty;
  if (money < cost) return { money, bought: false };
  bagAdd(bag, itemId, qty);
  return { money: Math.min(MONEY_CAP, money - cost), bought: true };
}

// Sell `qty` of an item at half price. Fails (sold:false, money
// unchanged) when the bag doesn't hold that many. On success: removes
// the items (in place) and returns the credited balance.
export function sellItem(
  money: number,
  bag: BagEntry[],
  itemId: string,
  qty = 1,
): { readonly money: number; readonly sold: boolean; readonly gain: number } {
  if (qty <= 0) return { money, sold: false, gain: 0 };
  const entry = bag.find((e) => e.itemId === itemId);
  if (!entry || entry.qty < qty) return { money, sold: false, gain: 0 };
  for (let i = 0; i < qty; i += 1) bagConsume(bag, itemId);
  const gain = sellPriceOf(itemId) * qty;
  return { money: Math.min(MONEY_CAP, money + gain), sold: true, gain };
}

// Trainer payout on a win. Clamps the reward to ≥0 and the total to the
// money cap. Wild wins never call this (trainers-only, anti-grind).
export function awardMoney(money: number, amount: number): number {
  return Math.min(MONEY_CAP, money + Math.max(0, Math.floor(amount)));
}
