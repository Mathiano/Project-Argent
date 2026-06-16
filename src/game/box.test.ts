// Phase 6.5 GATE tests — box deposit/withdraw: the round-trip, the
// last-mon block, the full-party block, and bond travelling with the mon.

import { describe, expect, test } from 'vitest';
import ch1BatchData from '../../docs/ch1-batch.json';
import movesData from '../../docs/moves.json';
import { createSide, loadDex, loadMoves, registerMoves } from '../engine';
import type { DexEntryJson, MoveJson, Species } from '../engine';
import { MAX_PARTY, canDeposit, canWithdraw, deposit, withdraw } from './box';
import type { MonStore } from './box';

registerMoves(loadMoves(movesData as MoveJson[]));
const CH1 = loadDex(ch1BatchData as DexEntryJson[], 13);
const sp = (n: string): Species => CH1[n]!;

function store(partyNames: string[], boxNames: string[]): MonStore {
  return {
    party: partyNames.map((n) => createSide(sp(n))),
    partyBond: partyNames.map((_, i) => 10 + i), // distinct bonds to trace
    partyOrigin: partyNames.map((_, i) => (i === 0 ? 'starter' : 'read')),
    box: boxNames.map((n) => createSide(sp(n))),
    boxBond: boxNames.map((_, i) => 50 + i),
    boxOrigin: boxNames.map(() => 'mercy'),
  };
}

describe('box deposit/withdraw', () => {
  test('deposit then withdraw round-trips the mon + its bond', () => {
    const s = store(['KINDRAKE', 'GRUBLEAF'], []);
    const dep = deposit(s, 1); // deposit GRUBLEAF (bond 11)
    expect(dep.ok).toBe(true);
    expect(s.party.map((m) => m.species.name)).toEqual(['KINDRAKE']);
    expect(s.box.map((m) => m.species.name)).toEqual(['GRUBLEAF']);
    expect(s.boxBond).toEqual([11]); // bond travelled

    expect(s.boxOrigin).toEqual(['read']); // origin travelled too (idx 1 = 'read')

    const wd = withdraw(s, 0); // bring GRUBLEAF back
    expect(wd.ok).toBe(true);
    expect(s.party.map((m) => m.species.name)).toEqual(['KINDRAKE', 'GRUBLEAF']);
    expect(s.box).toEqual([]);
    expect(s.partyBond).toEqual([10, 11]); // bond came back with it
    expect(s.partyOrigin).toEqual(['starter', 'read']); // origin came back too
  });

  test('cannot deposit the last party mon', () => {
    const s = store(['KINDRAKE'], []);
    expect(canDeposit(s)).toBe(false);
    const res = deposit(s, 0);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toMatch(/last mon/i);
    // unchanged
    expect(s.party.map((m) => m.species.name)).toEqual(['KINDRAKE']);
    expect(s.box).toEqual([]);
  });

  test('withdraw blocked when the party is full', () => {
    const full = ['KINDRAKE', 'GRUBLEAF', 'SILTSKIP', 'FLITPECK', 'CAVELURE', 'WYRMFERN'];
    const s = store(full, ['GALEHAWK']);
    expect(s.party.length).toBe(MAX_PARTY);
    expect(canWithdraw(s)).toBe(false);
    const res = withdraw(s, 0);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toMatch(/full/i);
    expect(s.box.map((m) => m.species.name)).toEqual(['GALEHAWK']);
  });

  test('deposit preserves a damaged mon’s HP/state', () => {
    const s = store(['KINDRAKE', 'GRUBLEAF'], []);
    s.party[1] = { ...s.party[1]!, hp: 3, st: 42 }; // a chipped, tired mon
    deposit(s, 1);
    expect(s.box[0]!.hp).toBe(3);
    expect(s.box[0]!.st).toBe(42);
  });

  test('out-of-range index is a clean no-op failure', () => {
    const s = store(['KINDRAKE', 'GRUBLEAF'], []);
    expect(deposit(s, 5).ok).toBe(false);
    expect(withdraw(s, 0).ok).toBe(false); // empty box
    expect(s.party.length).toBe(2);
  });
});
