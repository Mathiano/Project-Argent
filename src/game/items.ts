// Phase 5a items — game-layer only. The engine doesn't know items
// exist; effects mutate a SideState into a new SideState and the
// caller writes it back to run.party (same shape the post-battle
// writeback uses, so the persisted state stays one source of truth).
//
// Pockets are declared for all five categories now even though
// berries/balls/keyitems are empty — the bag UI reads the pocket list
// directly so adding the first item in any pocket is a one-line
// registry change later (no UI rework).

import type { SideState } from '../engine';

export type ItemCategory = 'medicine' | 'items' | 'berries' | 'keyitems' | 'balls';

export type ItemEffect =
  // Restores `amount` HP (clamped to maxHp).
  | { readonly kind: 'heal-hp'; readonly amount: number }
  // Restores HP to full + clears status flags (exhausted, staggered).
  | { readonly kind: 'heal-hp-full' }
  // Cures status without restoring HP — exhausted/staggered cleared.
  | { readonly kind: 'cure-status' };

export interface Item {
  readonly id: string;
  readonly name: string;
  readonly category: ItemCategory;
  readonly description: string;
  readonly effect: ItemEffect;
  // True when the player must select a target party mon to use it.
  // medicine items target a mon; berries (future) too; key items
  // typically don't. Drives the bag's target-picker mode.
  readonly targetsParty: boolean;
}

// Pockets in DISPLAY order — the bag's tab order is this array.
export const POCKETS: readonly ItemCategory[] = [
  'medicine',
  'items',
  'berries',
  'keyitems',
  'balls',
];

// Phase 5a ships only the medicine pocket populated. Other pockets
// are empty by design — the bag UI shows '— empty —' so the player
// can see them as future surface area.
export const ITEMS: { readonly [id: string]: Item } = {
  POTION: {
    id: 'POTION',
    name: 'POTION',
    category: 'medicine',
    description: 'Restores 20 HP to one party member.',
    effect: { kind: 'heal-hp', amount: 20 },
    targetsParty: true,
  },
  'SUPER POTION': {
    id: 'SUPER POTION',
    name: 'SUPER POTION',
    category: 'medicine',
    description: 'Restores 50 HP to one party member.',
    effect: { kind: 'heal-hp', amount: 50 },
    targetsParty: true,
  },
  'FULL HEAL': {
    id: 'FULL HEAL',
    name: 'FULL HEAL',
    category: 'medicine',
    description: 'Restores all HP and clears status.',
    effect: { kind: 'heal-hp-full' },
    targetsParty: true,
  },
};

export function lookupItem(id: string): Item {
  const it = ITEMS[id];
  if (!it) throw new Error(`Argent items: unknown item "${id}"`);
  return it;
}

// Apply an item's effect to a SideState. Pure — returns a new
// SideState. Caller writes it back into run.party at the right index.
//
// Fainted (hp ≤ 0) mons cannot be revived by these Phase 5a items —
// a Revive belongs to Phase 5b or 6. Returns the side UNCHANGED if
// the item is a no-op (heal at full hp, etc.) so the UI can react.
export function applyItemEffect(side: SideState, item: Item): {
  readonly result: SideState;
  readonly delta: { readonly hp: number; readonly statusCleared: boolean };
  readonly noop: boolean;
} {
  const e = item.effect;
  if (e.kind === 'heal-hp') {
    if (side.hp <= 0) {
      // Can't revive with a potion. Future: Revive item.
      return { result: side, delta: { hp: 0, statusCleared: false }, noop: true };
    }
    if (side.hp >= side.maxHp) {
      return { result: side, delta: { hp: 0, statusCleared: false }, noop: true };
    }
    const newHp = Math.min(side.maxHp, side.hp + e.amount);
    return {
      result: { ...side, hp: newHp },
      delta: { hp: newHp - side.hp, statusCleared: false },
      noop: false,
    };
  }
  if (e.kind === 'heal-hp-full') {
    if (side.hp >= side.maxHp && !side.exhausted && !side.staggered) {
      return { result: side, delta: { hp: 0, statusCleared: false }, noop: true };
    }
    return {
      result: { ...side, hp: side.maxHp, exhausted: false, staggered: false },
      delta: { hp: side.maxHp - side.hp, statusCleared: side.exhausted || side.staggered },
      noop: false,
    };
  }
  if (e.kind === 'cure-status') {
    if (!side.exhausted && !side.staggered) {
      return { result: side, delta: { hp: 0, statusCleared: false }, noop: true };
    }
    return {
      result: { ...side, exhausted: false, staggered: false },
      delta: { hp: 0, statusCleared: true },
      noop: false,
    };
  }
  // Unreachable — exhaustive ItemEffect union.
  return { result: side, delta: { hp: 0, statusCleared: false }, noop: true };
}

// Bag entries (stored on run.bag + persisted via save). Mutable qty —
// using items decrements, removes when 0.
export interface BagEntry {
  readonly itemId: string;
  qty: number;
}

// Add `count` of an item to the bag (stacks with existing entries of
// the same id). Mutates the bag in place.
export function bagAdd(bag: BagEntry[], itemId: string, count: number): void {
  if (count <= 0) return;
  const existing = bag.find((e) => e.itemId === itemId);
  if (existing) {
    existing.qty += count;
    return;
  }
  bag.push({ itemId, qty: count });
}

// Remove ONE of an item from the bag (decrement qty; remove entry at
// zero). Returns false if the item wasn't in the bag.
export function bagConsume(bag: BagEntry[], itemId: string): boolean {
  const idx = bag.findIndex((e) => e.itemId === itemId);
  if (idx < 0) return false;
  const entry = bag[idx]!;
  entry.qty -= 1;
  if (entry.qty <= 0) bag.splice(idx, 1);
  return true;
}

// Group bag entries by pocket — used by the bag UI for tab rendering.
export function bagByPocket(bag: readonly BagEntry[]): { readonly [K in ItemCategory]: readonly BagEntry[] } {
  const out: { [K in ItemCategory]: BagEntry[] } = {
    medicine: [],
    items: [],
    berries: [],
    keyitems: [],
    balls: [],
  };
  for (const entry of bag) {
    const item = ITEMS[entry.itemId];
    if (!item) continue;
    out[item.category].push(entry);
  }
  return out;
}
