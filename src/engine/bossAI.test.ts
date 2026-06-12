import { describe, expect, test } from 'vitest';
import { falknerBossAI } from './bossAI';
import { registerMoves } from './state';
import { mulberry32 } from './rng';
import { createBattleState, createSide } from './state';
import { SPECIES } from './data';
import type { BattleState, BossCard, Species, ArenaSchedule } from './types';

const ARENA: ArenaSchedule = {
  rhythmEveryN: 3,
  heavyExtraCost: 8,
  heavyExtraInitWeight: 1.3,
  telegraphAheadBy: 1,
};

// Register Falkner's moves so the boss AI can pick them.
registerMoves({
  'GUST RAKE': { name: 'GUST RAKE', tier: 'light', type: 'GALE' },
  'WING CUT': { name: 'WING CUT', tier: 'mid', type: 'GALE' },
  'DIVE BOMB': { name: 'DIVE BOMB', tier: 'heavy', type: 'GALE' },
});

const GALEHAWK: Species = {
  name: 'GALEHAWK',
  types: ['GALE'],
  hp: 56,
  atk: 117,
  dfn: 59,
  spd: 122,
  moves: ['GUST RAKE', 'WING CUT', 'DIVE BOMB'],
  trait: 'GUSTBORNE',
};

const CARD: BossCard = {
  species: GALEHAWK,
  arenaSchedule: ARENA,
  breakBar: 2,
};

function makeState(): BattleState {
  return createBattleState(
    createSide(SPECIES.EMBERCUB!),
    createSide(GALEHAWK),
    { bossCard: CARD },
  );
}

function atRound(s: BattleState, round: number, phase = 1): BattleState {
  return { ...s, round, phase };
}

describe('Falkner boss AI (A6)', () => {
  test('phase 1: DIVE BOMB only on rhythm rounds', () => {
    const onRhythm = falknerBossAI(atRound(makeState(), 3, 1), 'foe', mulberry32(1));
    expect(onRhythm.kind).toBe('move');
    expect(onRhythm.kind === 'move' && onRhythm.move).toBe('DIVE BOMB');

    const offRhythm = falknerBossAI(atRound(makeState(), 2, 1), 'foe', mulberry32(1));
    expect(offRhythm.kind).toBe('move');
    expect(offRhythm.kind === 'move' && offRhythm.move).not.toBe('DIVE BOMB');
  });

  test('phase 1: gust round goes Aggressive (attack hard)', () => {
    const action = falknerBossAI(atRound(makeState(), 3, 1), 'foe', mulberry32(1));
    expect(action.kind === 'move' && action.stance).toBe('A');
  });

  test('phase 2: on rhythm baits with WING CUT 50% of the time', () => {
    let baits = 0;
    let bombs = 0;
    for (let seed = 0; seed < 200; seed += 1) {
      const action = falknerBossAI(atRound(makeState(), 3, 2), 'foe', mulberry32(seed));
      if (action.kind === 'move' && action.move === 'WING CUT') baits += 1;
      else if (action.kind === 'move' && action.move === 'DIVE BOMB') bombs += 1;
    }
    expect(baits).toBeGreaterThan(50);
    expect(bombs).toBeGreaterThan(50);
  });

  test('low ST + momentum + phase 1 triggers Catch Breath', () => {
    let s = makeState();
    s = atRound(s, 2, 1);
    s = { ...s, foe: { ...s.foe, momentum: 1, st: 20 } };
    const action = falknerBossAI(s, 'foe', mulberry32(1));
    expect(action.kind).toBe('catchBreath');
  });
});
