// Phase 6.5 — the Box: pure deposit/withdraw logic for PC storage.
//
// Headless + unit-tested; the boxMenu scene is a thin shell over these.
// Mons live as SideStates (party + box) with an index-aligned bond array
// each (partyBond / boxBond) — the SAME shape main.ts already persists.
// Deposit/withdraw move the mon AND its bond together so bond travels
// with the mon, mirroring the party-menu reorder swap.

import type { SideState } from '../engine';
import type { CatchOrigin } from './catching';

// A full party is six mons (matches addCaughtMon's `< 6` rule in main.ts).
export const MAX_PARTY = 6;

export interface MonStore {
  readonly party: SideState[];
  readonly partyBond: number[];
  // living-world.md Feature 3 — provenance, index-aligned with `party`.
  // Travels with the mon on deposit/withdraw, same as bond.
  readonly partyOrigin: CatchOrigin[];
  readonly box: SideState[];
  readonly boxBond: number[];
  readonly boxOrigin: CatchOrigin[];
}

export type BoxOpResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: string };

// S2 — the party can never empty: depositing the last mon is blocked.
export function canDeposit(store: MonStore): boolean {
  return store.party.length > 1;
}

export function canWithdraw(store: MonStore): boolean {
  return store.box.length > 0 && store.party.length < MAX_PARTY;
}

// Move party[index] → box (with its bond). Blocks the last-mon case with
// a clear reason. Mutates the arrays in place (same convention as the
// party-menu reorder); caller persists via autosave.
export function deposit(store: MonStore, index: number): BoxOpResult {
  if (index < 0 || index >= store.party.length) {
    return { ok: false, reason: 'No mon selected.' };
  }
  if (!canDeposit(store)) {
    return { ok: false, reason: 'Can’t deposit your last mon — keep at least one.' };
  }
  const [mon] = store.party.splice(index, 1);
  const [bond] = store.partyBond.splice(index, 1);
  const [origin] = store.partyOrigin.splice(index, 1);
  store.box.push(mon!);
  store.boxBond.push(bond ?? 0);
  store.boxOrigin.push(origin ?? 'gift');
  return { ok: true };
}

// Move box[index] → party (with its bond). Blocks when the party is full.
export function withdraw(store: MonStore, index: number): BoxOpResult {
  if (index < 0 || index >= store.box.length) {
    return { ok: false, reason: 'No mon selected.' };
  }
  if (store.party.length >= MAX_PARTY) {
    return { ok: false, reason: 'Your party is full — deposit one first.' };
  }
  const [mon] = store.box.splice(index, 1);
  const [bond] = store.boxBond.splice(index, 1);
  const [origin] = store.boxOrigin.splice(index, 1);
  store.party.push(mon!);
  store.partyBond.push(bond ?? 0);
  store.partyOrigin.push(origin ?? 'gift');
  return { ok: true };
}
