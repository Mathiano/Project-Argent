// Phase 2 GATE tests — save/load round-trip + the writeback contract
// (party hp/st/momentum persists across battles). The two consumers
// (save/load and post-battle writeback) share toSavedSide/fromSavedSide
// so we can pin them with the same shape assertions.

import { describe, expect, test } from 'vitest';
import ch1BatchData from '../../docs/ch1-batch.json';
import movesData from '../../docs/moves.json';
import typechartData from '../../docs/typechart.json';
import {
  activeMon,
  createBattleState,
  createSide,
  createTeam,
  loadDex,
  loadMoves,
  mulberry32,
  registerMoves,
  resolveRound,
  setActiveMember,
} from '../engine';
import type {
  DexEntryJson,
  MoveJson,
  Species,
  TypeChart,
} from '../engine';
import {
  SAVE_KEY,
  fromSavedSide,
  hasSave,
  loadFromStorage,
  saveToStorage,
  toSavedSide,
  wipeStorage,
} from './save';
import type { SaveState, StorageLike } from './save';
import { awardMoney } from './economy';

registerMoves(loadMoves(movesData as MoveJson[]));
const CH1 = loadDex(ch1BatchData as DexEntryJson[], 13);
const TYPECHART = typechartData as TypeChart;

function resolveSpecies(name: string): Species {
  const sp = CH1[name];
  if (!sp) throw new Error(`unknown species: ${name}`);
  return sp;
}

function memoryStorage(): StorageLike {
  const m = new Map<string, string>();
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => {
      m.set(k, v);
    },
    removeItem: (k) => {
      m.delete(k);
    },
  };
}

describe('save.ts — toSavedSide / fromSavedSide round-trip', () => {
  test('drops round-local fields (exhausted, staggered, maxHp) and preserves hp/st/momentum', () => {
    const grub = { ...createSide(CH1.GRUBLEAF!), hp: 30, st: 45, momentum: 1, exhausted: false, staggered: true };
    const saved = toSavedSide(grub);
    expect(saved).toEqual({
      speciesName: 'GRUBLEAF',
      hp: 30,
      st: 45,
      momentum: 1,
    });
    // Restore — maxHp recomputed from species, round-local fields reset.
    const restored = fromSavedSide(saved, resolveSpecies);
    expect(restored.species.name).toBe('GRUBLEAF');
    expect(restored.hp).toBe(30);
    expect(restored.st).toBe(45);
    expect(restored.momentum).toBe(1);
    expect(restored.maxHp).toBe(createSide(CH1.GRUBLEAF!).maxHp); // recomputed (incl. hpScale)
    expect(restored.exhausted).toBe(false); // round-local — reset
    expect(restored.staggered).toBe(false); // round-local — reset
  });

  test('clamps hp / st / momentum into valid ranges (defensive against corrupted saves)', () => {
    const restored = fromSavedSide(
      { speciesName: 'GRUBLEAF', hp: 9999, st: -50, momentum: 17 },
      resolveSpecies,
    );
    expect(restored.hp).toBeLessThanOrEqual(restored.maxHp);
    expect(restored.st).toBeGreaterThanOrEqual(0);
    expect(restored.st).toBeLessThanOrEqual(100);
    expect(restored.momentum).toBeLessThanOrEqual(2);
    expect(restored.momentum).toBeGreaterThanOrEqual(0);
  });
});

describe('save.ts — storage adapter round-trip', () => {
  test('save → load returns a structurally identical SaveState', () => {
    const storage = memoryStorage();
    const state: SaveState = {
      version: 1,
      party: [
        { speciesName: 'GRUBLEAF', hp: 30, st: 80, momentum: 0 },
        { speciesName: 'SILTSKIP', hp: 67, st: 100, momentum: 1 },
      ],
      position: { map: 'ROUTE31', x: 9, y: 7, facing: 'down' },
      flags: ['route31_warning', 'gym_trainer_beaten'],
      catchBreathUnlocked: true,
      rngSeed: 0xa9c0,
    };
    saveToStorage(state, storage);
    const loaded = loadFromStorage(storage);
    expect(loaded).toEqual(state);
  });

  test('Phase 6.5 — box/boxBond/dex round-trip through storage', () => {
    const storage = memoryStorage();
    const state: SaveState = {
      version: 1,
      party: [{ speciesName: 'KINDRAKE', hp: 40, st: 100, momentum: 0 }],
      position: { map: 'HEARTHWICK_CENTER', x: 7, y: 3, facing: 'up' },
      flags: [],
      catchBreathUnlocked: true,
      rngSeed: 0xa9c0,
      box: [
        { speciesName: 'GRUBLEAF', hp: 12, st: 60, momentum: 1 },
        { speciesName: 'GALEHAWK', hp: 50, st: 100, momentum: 0 },
      ],
      boxBond: [11, 5],
      dex: { seen: ['FLITPECK', 'CAVELURE', 'KINDRAKE'], caught: ['KINDRAKE'] },
    };
    saveToStorage(state, storage);
    expect(loadFromStorage(storage)).toEqual(state);
  });

  test('Phase 6.5 — a malformed dex (non-string caught entry) nukes the save', () => {
    const storage = memoryStorage();
    storage.setItem(
      SAVE_KEY,
      JSON.stringify({
        version: 1,
        party: [],
        position: { map: 'X', x: 0, y: 0, facing: 'down' },
        flags: [],
        catchBreathUnlocked: false,
        rngSeed: 0,
        dex: { seen: ['FLITPECK'], caught: [42] },
      }),
    );
    expect(loadFromStorage(storage)).toBeNull();
  });

  test('hasSave reports presence correctly across save / wipe cycles', () => {
    const storage = memoryStorage();
    expect(hasSave(storage)).toBe(false);
    saveToStorage(
      {
        version: 1,
        party: [{ speciesName: 'GRUBLEAF', hp: 54, st: 100, momentum: 0 }],
        position: { map: 'LAB', x: 6, y: 7, facing: 'down' },
        flags: [],
        catchBreathUnlocked: false,
        rngSeed: 1,
      },
      storage,
    );
    expect(hasSave(storage)).toBe(true);
    wipeStorage(storage);
    expect(hasSave(storage)).toBe(false);
  });

  test('loadFromStorage returns null on malformed JSON (no throw)', () => {
    const storage = memoryStorage();
    storage.setItem(SAVE_KEY, '{not json');
    expect(loadFromStorage(storage)).toBeNull();
  });

  test('loadFromStorage rejects unknown version (treats as no save)', () => {
    const storage = memoryStorage();
    storage.setItem(
      SAVE_KEY,
      JSON.stringify({ version: 99, party: [], position: {}, flags: [], catchBreathUnlocked: false, rngSeed: 0 }),
    );
    expect(loadFromStorage(storage)).toBeNull();
  });

  test('loadFromStorage rejects malformed shape (missing fields, wrong types)', () => {
    const storage = memoryStorage();
    // Missing position
    storage.setItem(
      SAVE_KEY,
      JSON.stringify({ version: 1, party: [], flags: [], catchBreathUnlocked: false, rngSeed: 0 }),
    );
    expect(loadFromStorage(storage)).toBeNull();
    // Wrong facing
    storage.setItem(
      SAVE_KEY,
      JSON.stringify({
        version: 1,
        party: [],
        position: { map: 'X', x: 0, y: 0, facing: 'sideways' },
        flags: [],
        catchBreathUnlocked: false,
        rngSeed: 0,
      }),
    );
    expect(loadFromStorage(storage)).toBeNull();
  });
});

describe('Phase 2 GATE — writeback: damage from one battle persists into the next', () => {
  test('a battle that ends with the lead at reduced HP carries that HP forward via toSavedSide / fromSavedSide', () => {
    // Simulate the writeback in pure functions (this is what main.ts's
    // writebackParty does). Build a battle, run a round that damages
    // the player's active, extract via toSavedSide, restore via
    // fromSavedSide — assert hp < maxHp.
    const playerTeam = createTeam([createSide(CH1.GRUBLEAF!), createSide(CH1.SILTSKIP!)]);
    const foeTeam = createTeam([createSide(CH1.FLITPECK!)]);
    let state = createBattleState(playerTeam, foeTeam, { typeChart: TYPECHART });

    // Player Aggressive vs foe Guard → counter → player takes counter
    // damage (G vs A rule). After the round, GRUBLEAF should be hurt.
    const r = resolveRound(
      state,
      { kind: 'move', move: 'TACKLE', stance: 'A' },
      { kind: 'move', move: 'TACKLE', stance: 'G' },
      mulberry32(42),
    );
    state = r.state;
    const grubAfter = activeMon(state.player);
    expect(grubAfter.hp).toBeLessThan(grubAfter.maxHp);

    // Writeback (same shape main.ts uses): toSavedSide → fromSavedSide.
    const writtenBack = state.player.members.map((m) =>
      fromSavedSide(toSavedSide(m), resolveSpecies),
    );

    // The lead's damaged HP carries through; round-local fields reset.
    expect(writtenBack[0]!.hp).toBe(grubAfter.hp);
    expect(writtenBack[0]!.hp).toBeLessThan(writtenBack[0]!.maxHp);
    expect(writtenBack[0]!.exhausted).toBe(false);
    expect(writtenBack[0]!.staggered).toBe(false);
    // Bench mon untouched.
    expect(writtenBack[1]!.hp).toBe(writtenBack[1]!.maxHp);
    expect(writtenBack[1]!.species.name).toBe('SILTSKIP');
  });

  test('partial ST + momentum survives the writeback', () => {
    const grub = createSide(CH1.GRUBLEAF!);
    const team = setActiveMember(
      createTeam([grub]),
      { ...grub, hp: 20, st: 40, momentum: 2 },
    );
    const writtenBack = team.members.map((m) =>
      fromSavedSide(toSavedSide(m), resolveSpecies),
    );
    expect(writtenBack[0]!.hp).toBe(20);
    expect(writtenBack[0]!.st).toBe(40);
    expect(writtenBack[0]!.momentum).toBe(2);
  });
});

describe('Phase 5a — bag round-trip + back-compat with pre-Phase-5a saves', () => {
  test('save → load preserves the bag entries (itemId + qty)', () => {
    const storage = memoryStorage();
    const state: SaveState = {
      version: 1,
      party: [{ speciesName: 'GRUBLEAF', hp: 30, st: 80, momentum: 0 }],
      position: { map: 'HEARTHWICK', x: 8, y: 8, facing: 'down' },
      flags: [],
      catchBreathUnlocked: false,
      rngSeed: 1,
      bag: [
        { itemId: 'POTION', qty: 3 },
        { itemId: 'SUPER POTION', qty: 1 },
      ],
    };
    saveToStorage(state, storage);
    const loaded = loadFromStorage(storage)!;
    expect(loaded.bag).toEqual([
      { itemId: 'POTION', qty: 3 },
      { itemId: 'SUPER POTION', qty: 1 },
    ]);
  });

  test('pre-Phase-5a saves (no bag field) load successfully with bag undefined', () => {
    const storage = memoryStorage();
    // The exact JSON shape a Phase 4 client wrote (no bag field).
    storage.setItem(
      SAVE_KEY,
      JSON.stringify({
        version: 1,
        party: [{ speciesName: 'GRUBLEAF', hp: 54, st: 100, momentum: 0 }],
        position: { map: 'LAB', x: 6, y: 7, facing: 'down' },
        flags: [],
        catchBreathUnlocked: false,
        rngSeed: 1,
      }),
    );
    const loaded = loadFromStorage(storage);
    expect(loaded).not.toBeNull();
    expect(loaded!.bag).toBeUndefined();
  });

  test('loadFromStorage rejects a malformed bag entry (loud-fail)', () => {
    const storage = memoryStorage();
    storage.setItem(
      SAVE_KEY,
      JSON.stringify({
        version: 1,
        party: [{ speciesName: 'GRUBLEAF', hp: 54, st: 100, momentum: 0 }],
        position: { map: 'LAB', x: 6, y: 7, facing: 'down' },
        flags: [],
        catchBreathUnlocked: false,
        rngSeed: 1,
        bag: [{ itemId: 'POTION' /* missing qty */ }],
      }),
    );
    expect(loadFromStorage(storage)).toBeNull();
  });
});

describe('Phase 5b — money round-trip + back-compat with pre-5b saves', () => {
  test('save → load preserves the wallet', () => {
    const storage = memoryStorage();
    const state: SaveState = {
      version: 1,
      party: [{ speciesName: 'GRUBLEAF', hp: 54, st: 100, momentum: 0 }],
      position: { map: 'HEARTHWICK', x: 14, y: 12, facing: 'down' },
      flags: [],
      catchBreathUnlocked: false,
      rngSeed: 1,
      money: 4200,
    };
    saveToStorage(state, storage);
    expect(loadFromStorage(storage)!.money).toBe(4200);
  });

  test('a trainer payout persists across a save round-trip', () => {
    // Mirrors the main.ts payout: awardMoney bumps the wallet on a win,
    // autosave writes it, a later load restores it.
    const storage = memoryStorage();
    const earned = awardMoney(3000, 500); // starting + a 500 reward
    saveToStorage(
      {
        version: 1,
        party: [{ speciesName: 'GRUBLEAF', hp: 54, st: 100, momentum: 0 }],
        position: { map: 'ROUTE31', x: 8, y: 6, facing: 'up' },
        flags: ['route31_trainer_beaten'],
        catchBreathUnlocked: true,
        rngSeed: 1,
        money: earned,
      },
      storage,
    );
    expect(loadFromStorage(storage)!.money).toBe(3500);
  });

  test('pre-5b saves (no money field) load with money undefined (caller defaults it)', () => {
    const storage = memoryStorage();
    storage.setItem(
      SAVE_KEY,
      JSON.stringify({
        version: 1,
        party: [{ speciesName: 'GRUBLEAF', hp: 54, st: 100, momentum: 0 }],
        position: { map: 'LAB', x: 6, y: 7, facing: 'down' },
        flags: [],
        catchBreathUnlocked: false,
        rngSeed: 1,
      }),
    );
    const loaded = loadFromStorage(storage);
    expect(loaded).not.toBeNull();
    expect(loaded!.money).toBeUndefined();
  });

  test('a non-number money field nukes the save (loud-fail)', () => {
    const storage = memoryStorage();
    storage.setItem(
      SAVE_KEY,
      JSON.stringify({
        version: 1,
        party: [{ speciesName: 'GRUBLEAF', hp: 54, st: 100, momentum: 0 }],
        position: { map: 'LAB', x: 6, y: 7, facing: 'down' },
        flags: [],
        catchBreathUnlocked: false,
        rngSeed: 1,
        money: 'lots',
      }),
    );
    expect(loadFromStorage(storage)).toBeNull();
  });
});

describe('Demo-complete — badges round-trip + back-compat', () => {
  test('save → load preserves earned badges', () => {
    const storage = memoryStorage();
    const state: SaveState = {
      version: 1,
      party: [{ speciesName: 'GRUBLEAF', hp: 54, st: 100, momentum: 0 }],
      position: { map: 'GYM', x: 7, y: 14, facing: 'up' },
      flags: ['falkner_beaten'],
      catchBreathUnlocked: true,
      rngSeed: 1,
      badges: ['ZEPHYR'],
    };
    saveToStorage(state, storage);
    expect(loadFromStorage(storage)!.badges).toEqual(['ZEPHYR']);
  });

  test('pre-badge saves (no badges field) load with badges undefined', () => {
    const storage = memoryStorage();
    storage.setItem(
      SAVE_KEY,
      JSON.stringify({
        version: 1,
        party: [{ speciesName: 'GRUBLEAF', hp: 54, st: 100, momentum: 0 }],
        position: { map: 'LAB', x: 6, y: 7, facing: 'down' },
        flags: [],
        catchBreathUnlocked: false,
        rngSeed: 1,
      }),
    );
    expect(loadFromStorage(storage)!.badges).toBeUndefined();
  });

  test('a non-string badge entry nukes the save (loud-fail)', () => {
    const storage = memoryStorage();
    storage.setItem(
      SAVE_KEY,
      JSON.stringify({
        version: 1,
        party: [{ speciesName: 'GRUBLEAF', hp: 54, st: 100, momentum: 0 }],
        position: { map: 'LAB', x: 6, y: 7, facing: 'down' },
        flags: [],
        catchBreathUnlocked: false,
        rngSeed: 1,
        badges: ['ZEPHYR', 7],
      }),
    );
    expect(loadFromStorage(storage)).toBeNull();
  });
});

describe('Phase 6a — bond + box round-trip + back-compat', () => {
  test('save → load preserves the interim per-mon bond and the box', () => {
    const storage = memoryStorage();
    const state: SaveState = {
      version: 1,
      party: [{ speciesName: 'GRUBLEAF', hp: 54, st: 100, momentum: 0 }],
      position: { map: 'ROUTE31', x: 9, y: 7, facing: 'down' },
      flags: [],
      catchBreathUnlocked: false,
      rngSeed: 1,
      partyBond: [37],
      box: [{ speciesName: 'FLITPECK', hp: 40, st: 100, momentum: 0 }],
    };
    saveToStorage(state, storage);
    const loaded = loadFromStorage(storage)!;
    expect(loaded.partyBond).toEqual([37]);
    expect(loaded.box).toEqual([{ speciesName: 'FLITPECK', hp: 40, st: 100, momentum: 0 }]);
  });

  test('pre-6a saves (no partyBond/box) load with both undefined', () => {
    const storage = memoryStorage();
    storage.setItem(
      SAVE_KEY,
      JSON.stringify({
        version: 1,
        party: [{ speciesName: 'GRUBLEAF', hp: 54, st: 100, momentum: 0 }],
        position: { map: 'LAB', x: 6, y: 7, facing: 'down' },
        flags: [],
        catchBreathUnlocked: false,
        rngSeed: 1,
      }),
    );
    const loaded = loadFromStorage(storage)!;
    expect(loaded.partyBond).toBeUndefined();
    expect(loaded.box).toBeUndefined();
  });

  test('a non-number bond entry / malformed box nukes the save (loud-fail)', () => {
    const storage = memoryStorage();
    const base = {
      version: 1,
      party: [{ speciesName: 'GRUBLEAF', hp: 54, st: 100, momentum: 0 }],
      position: { map: 'LAB', x: 6, y: 7, facing: 'down' },
      flags: [],
      catchBreathUnlocked: false,
      rngSeed: 1,
    };
    storage.setItem(SAVE_KEY, JSON.stringify({ ...base, partyBond: [10, 'x'] }));
    expect(loadFromStorage(storage)).toBeNull();
    storage.setItem(SAVE_KEY, JSON.stringify({ ...base, box: [{ speciesName: 'X' }] }));
    expect(loadFromStorage(storage)).toBeNull();
  });
});

describe('Phase 2 — New Game wipes the save; Continue restores it', () => {
  test('wipe clears the slot; subsequent load returns null', () => {
    const storage = memoryStorage();
    saveToStorage(
      {
        version: 1,
        party: [{ speciesName: 'GRUBLEAF', hp: 54, st: 100, momentum: 0 }],
        position: { map: 'LAB', x: 6, y: 7, facing: 'down' },
        flags: ['route31_warning'],
        catchBreathUnlocked: false,
        rngSeed: 1,
      },
      storage,
    );
    expect(hasSave(storage)).toBe(true);
    wipeStorage(storage);
    expect(loadFromStorage(storage)).toBeNull();
  });

  test('round-trip preserves flags as a stable array', () => {
    const storage = memoryStorage();
    const flags = ['route31_warning', 'gym_trainer_beaten', 'falkner_beaten'];
    saveToStorage(
      {
        version: 1,
        party: [{ speciesName: 'GRUBLEAF', hp: 54, st: 100, momentum: 0 }],
        position: { map: 'GYM', x: 7, y: 14, facing: 'up' },
        flags,
        catchBreathUnlocked: true,
        rngSeed: 0xa9c0,
      },
      storage,
    );
    const loaded = loadFromStorage(storage)!;
    expect(loaded.flags).toEqual(flags);
    expect(loaded.catchBreathUnlocked).toBe(true);
  });
});
