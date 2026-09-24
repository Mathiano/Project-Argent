import { describe, expect, test } from 'vitest';
import { FALKNER_OPENING_MOMENTUM } from './bossAI';
import { FALKNER_CARD, loadBossCard } from './bossCards';
import type { BossCardData } from './bossCards';
import type { DexEntryJson } from './dexLoader';

function entry(name: string, learnset: DexEntryJson['learnset']): DexEntryJson {
  return {
    id: 1,
    line_id: 'L000',
    stage: 1,
    name,
    types: ['GALE'],
    stats: { hp: 50, atk: 60, dfn: 40, spd: 90, stamina: 80 },
    archetype: 'Glass nuke',
    rarity: 'uncommon',
    statFlavor: 'fixture',
    learnset,
  };
}

const ROWS: readonly DexEntryJson[] = [
  entry('FLITPECK', [
    { move: 'TACKLE', level: 1 },
    { move: 'WING CUT', level: 13 },
    { move: 'DIVE BOMB', level: 15 },
  ]),
  entry('GALEHAWK', [
    { move: 'TACKLE', level: 1 },
    { move: 'DIVE BOMB', level: 15 },
    { move: 'SKY RAKE', level: 24 },
  ]),
];

describe('boss cards as data (gym2-plan Step 5)', () => {
  test('FALKNER_CARD carries the live sim-gated values', () => {
    expect(FALKNER_CARD.roster).toEqual([
      { species: 'FLITPECK', level: 13 },
      { species: 'GALEHAWK', level: 15, trait: 'GUSTBORNE' },
    ]);
    expect(FALKNER_CARD.statScale).toEqual({ hp: 1.15 });
    expect(FALKNER_CARD.arenaSchedule).toEqual({
      rhythmEveryN: 3,
      heavyExtraCost: 8,
      heavyExtraInitWeight: 1.3,
      telegraphAheadBy: 1,
    });
    expect(FALKNER_CARD.breakBar).toBe(4);
    expect(FALKNER_CARD.openingMomentum).toBe(FALKNER_OPENING_MOMENTUM);
    expect(FALKNER_CARD.traits).toEqual({ GUSTBORNE: { dmgMult: 1.4, initMult: 1.25 } });
  });

  test('loadBossCard: roster at each slot level, ace last carries the trait', () => {
    const { card, roster } = loadBossCard(FALKNER_CARD, ROWS);
    expect(roster.map((s) => s.name)).toEqual(['FLITPECK', 'GALEHAWK']);
    expect(roster[0]!.moves).toEqual(['TACKLE', 'WING CUT']); // level 13 filter
    expect(roster[0]!.trait).toBeUndefined();
    expect(roster[1]!.moves).toEqual(['TACKLE', 'DIVE BOMB']); // level 15 filter
    expect(card.species).toBe(roster[1]);
    expect(card.species.trait).toBe('GUSTBORNE');
    expect(card.teamSize).toBe(2);
    expect(card.breakBar).toBe(4);
    expect(card.statScale).toEqual({ hp: 1.15 });
    expect(card.arenaSchedule).toBe(FALKNER_CARD.arenaSchedule);
    expect(card.openingMomentum).toBe(FALKNER_OPENING_MOMENTUM);
  });

  test('unset optional levers stay ABSENT on the card (not undefined keys)', () => {
    const bare: BossCardData = {
      id: 'BARE',
      roster: [{ species: 'GALEHAWK', level: 15 }],
      traits: {},
    };
    const { card } = loadBossCard(bare, ROWS);
    expect(Object.keys(card).sort()).toEqual(['species', 'teamSize']);
    expect(card.teamSize).toBe(1);
  });

  test('a roster species missing from the rows throws; so does an empty roster', () => {
    const missing: BossCardData = { id: 'X', roster: [{ species: 'NOPE', level: 5 }], traits: {} };
    expect(() => loadBossCard(missing, ROWS)).toThrow(/NOPE/);
    expect(() => loadBossCard({ id: 'E', roster: [], traits: {} }, ROWS)).toThrow(/empty roster/);
  });
});
