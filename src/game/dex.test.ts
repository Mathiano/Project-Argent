// Phase 6.5 GATE tests — the seen/caught registry: transitions, the
// caught⇒seen invariant, status states, and the save round-trip.

import { describe, expect, test } from 'vitest';
import {
  createDex,
  dexCounts,
  dexStatus,
  fromSavedDex,
  markCaught,
  markSeen,
  markSeenAll,
  toSavedDex,
} from './dex';

describe('dex registry', () => {
  test('unseen by default', () => {
    const dex = createDex();
    expect(dexStatus(dex, 'FLITPECK')).toBe('unseen');
    expect(dexCounts(dex)).toEqual({ seen: 0, caught: 0 });
  });

  test('seen-on-encounter marks SEEN, not CAUGHT', () => {
    const dex = createDex();
    expect(markSeen(dex, 'FLITPECK')).toBe(true); // first sighting
    expect(markSeen(dex, 'FLITPECK')).toBe(false); // idempotent
    expect(dexStatus(dex, 'FLITPECK')).toBe('seen');
    expect(dexCounts(dex)).toEqual({ seen: 1, caught: 0 });
  });

  test('caught-on-catch marks CAUGHT and implies SEEN', () => {
    const dex = createDex();
    expect(markCaught(dex, 'GALEHAWK')).toBe(true);
    expect(dexStatus(dex, 'GALEHAWK')).toBe('caught');
    // caught ⇒ seen, even though markSeen was never called
    expect(dex.seen.has('GALEHAWK')).toBe(true);
    expect(dexCounts(dex)).toEqual({ seen: 1, caught: 1 });
  });

  test('seen → caught upgrades status without double-counting seen', () => {
    const dex = createDex();
    markSeen(dex, 'GRUBLEAF');
    expect(dexStatus(dex, 'GRUBLEAF')).toBe('seen');
    markCaught(dex, 'GRUBLEAF');
    expect(dexStatus(dex, 'GRUBLEAF')).toBe('caught');
    expect(dexCounts(dex)).toEqual({ seen: 1, caught: 1 });
  });

  test('save round-trip preserves seen + caught', () => {
    const dex = createDex();
    markSeen(dex, 'FLITPECK');
    markSeen(dex, 'CAVELURE');
    markCaught(dex, 'KINDRAKE');
    const restored = fromSavedDex(toSavedDex(dex));
    expect(dexStatus(restored, 'FLITPECK')).toBe('seen');
    expect(dexStatus(restored, 'CAVELURE')).toBe('seen');
    expect(dexStatus(restored, 'KINDRAKE')).toBe('caught');
    expect(dexCounts(restored)).toEqual({ seen: 3, caught: 1 });
  });

  test('fromSavedDex enforces caught⇒seen even on a malformed save', () => {
    // A hand-edited save where a caught name is missing from seen.
    const restored = fromSavedDex({ seen: [], caught: ['WYRMFERN'] });
    expect(dexStatus(restored, 'WYRMFERN')).toBe('caught');
    expect(restored.seen.has('WYRMFERN')).toBe(true);
  });

  test('undefined save (pre-6.5) loads an empty dex', () => {
    const dex = fromSavedDex(undefined);
    expect(dexCounts(dex)).toEqual({ seen: 0, caught: 0 });
  });

  test('a trainer/boss roster marks every foe mon SEEN (not wild-only)', () => {
    const dex = createDex();
    // Falkner's two-mon team — the wiring (buildTrainerTeam /
    // buildFalknerTeam) calls markSeenAll with the foe species names.
    markSeenAll(dex, ['FLITPECK', 'GALEHAWK']);
    expect(dexStatus(dex, 'FLITPECK')).toBe('seen');
    expect(dexStatus(dex, 'GALEHAWK')).toBe('seen');
    expect(dexCounts(dex)).toEqual({ seen: 2, caught: 0 });
    // Idempotent + doesn't clobber an already-caught foe's status.
    markCaught(dex, 'FLITPECK');
    markSeenAll(dex, ['FLITPECK', 'GALEHAWK']);
    expect(dexStatus(dex, 'FLITPECK')).toBe('caught');
  });
});
