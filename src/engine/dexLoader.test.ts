import { describe, expect, test } from 'vitest';
import { loadDex, loadMoves, loadSpeciesAt } from './dexLoader';
import type { DexEntryJson, MoveJson } from './dexLoader';

const KINDRAKE: DexEntryJson = {
  id: 1,
  line_id: 'L001',
  stage: 1,
  name: 'KINDRAKE',
  types: ['FLAME'],
  stats: { hp: 64, atk: 86, dfn: 119, spd: 57 },
  archetype: 'Wall',
  rarity: 'starter',
  statFlavor: 'sturdy',
  learnset: [
    { move: 'TACKLE', level: 1 },
    { move: 'CINDER FLICK', level: 1 },
    { move: 'EMBER SNAP', level: 7 },
    { move: 'HEADBUTT', level: 13 },
  ],
};

const FORTDRAKE: DexEntryJson = {
  ...KINDRAKE,
  id: 3,
  stage: 3,
  name: 'FORTDRAKE',
  types: ['FLAME', 'DRAKE'],
};

describe('dex loader', () => {
  test('learnset filters by encounter level (≤ inclusive)', () => {
    const at1 = loadSpeciesAt(KINDRAKE, 1);
    expect(at1.moves).toEqual(['TACKLE', 'CINDER FLICK']);

    const at7 = loadSpeciesAt(KINDRAKE, 7);
    expect(at7.moves).toEqual(['TACKLE', 'CINDER FLICK', 'EMBER SNAP']);

    const at40 = loadSpeciesAt(KINDRAKE, 40);
    expect(at40.moves).toEqual(['TACKLE', 'CINDER FLICK', 'EMBER SNAP', 'HEADBUTT']);
  });

  test('stats are species-static — no level scaling', () => {
    const at1 = loadSpeciesAt(KINDRAKE, 1);
    const at40 = loadSpeciesAt(KINDRAKE, 40);
    expect(at1.hp).toBe(at40.hp);
    expect(at1.atk).toBe(at40.atk);
    expect(at1.dfn).toBe(at40.dfn);
    expect(at1.spd).toBe(at40.spd);
  });

  test('dual-type species carry both types in the array', () => {
    const dual = loadSpeciesAt(FORTDRAKE, 1);
    expect(dual.types).toEqual(['FLAME', 'DRAKE']);
  });

  test('loadDex returns a name-keyed dictionary', () => {
    const dex = loadDex([KINDRAKE, FORTDRAKE], 7);
    expect(Object.keys(dex).sort()).toEqual(['FORTDRAKE', 'KINDRAKE']);
    expect(dex.KINDRAKE!.moves).toEqual(['TACKLE', 'CINDER FLICK', 'EMBER SNAP']);
  });

  test('loadMoves returns a name-keyed Move dictionary', () => {
    const json: MoveJson[] = [
      { name: 'GUST RAKE', type: 'GALE', tier: 'light' },
      { name: 'WING CUT', type: 'GALE', tier: 'mid' },
      { name: 'DIVE BOMB', type: 'GALE', tier: 'heavy' },
    ];
    const moves = loadMoves(json);
    expect(moves['GUST RAKE']).toEqual({ name: 'GUST RAKE', type: 'GALE', tier: 'light' });
    expect(moves['DIVE BOMB']!.tier).toBe('heavy');
  });
});
