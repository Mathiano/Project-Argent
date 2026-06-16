// Phase 6.5 — the Dex: the player's seen/caught PROGRESS register.
//
// NOT to be confused with src/engine/dexLoader.ts, which loads the
// species DATABASE (stats/movesets). This module tracks, per species
// name, whether the player has SEEN it (encountered in the wild) or
// CAUGHT it (added to party/box, or received as the starter). CAUGHT
// always implies SEEN.
//
// Pure + headless (no DOM): two Sets behind a tiny API, plus a save
// seam (toSavedDex/fromSavedDex) matching the save/load shape so the
// two consumers can't drift — same discipline as toSavedSide.

import type { SavedDex } from './save';

export type { SavedDex };

export type DexStatus = 'unseen' | 'seen' | 'caught';

export interface DexRecord {
  // Species names the player has encountered (superset of caught).
  readonly seen: Set<string>;
  // Species names the player owns / has owned.
  readonly caught: Set<string>;
}

export function createDex(): DexRecord {
  return { seen: new Set<string>(), caught: new Set<string>() };
}

// Mark a species encountered. Idempotent. Returns true if this was the
// FIRST sighting (useful for a "new!" flash later).
export function markSeen(dex: DexRecord, name: string): boolean {
  if (dex.seen.has(name)) return false;
  dex.seen.add(name);
  return true;
}

// Mark a species caught — implies seen. Idempotent. Returns true if this
// was the first catch.
export function markCaught(dex: DexRecord, name: string): boolean {
  dex.seen.add(name); // caught ⇒ seen, always
  if (dex.caught.has(name)) return false;
  dex.caught.add(name);
  return true;
}

export function dexStatus(dex: DexRecord, name: string): DexStatus {
  if (dex.caught.has(name)) return 'caught';
  if (dex.seen.has(name)) return 'seen';
  return 'unseen';
}

// Seen/caught tallies for the dex header (caught counts as seen).
export function dexCounts(dex: DexRecord): { readonly seen: number; readonly caught: number } {
  return { seen: dex.seen.size, caught: dex.caught.size };
}

// ---- save seam ----------------------------------------------------------

export function toSavedDex(dex: DexRecord): SavedDex {
  return { seen: [...dex.seen], caught: [...dex.caught] };
}

// Rebuild from a saved record. Defensive: a caught name missing from the
// saved seen list is still treated as seen (caught ⇒ seen invariant).
export function fromSavedDex(saved: SavedDex | undefined): DexRecord {
  const dex = createDex();
  if (!saved) return dex;
  for (const n of saved.seen) dex.seen.add(n);
  for (const n of saved.caught) markCaught(dex, n);
  return dex;
}
