import { describe, expect, test } from 'vitest';
import typeChartData from '../../docs/typechart.json';
import { falknerBossAI } from '../engine';
import type { TypeChart } from '../engine';
import { FALKNER_LADDER_ARCHETYPES, reader } from './archetypes';
import { runBossLadder } from './bossLadder';
import { buildFalknerAce, runFalknerLadder } from './falknerLadder';

// gym2-plan Step 5 — the generic harness. The bit-identical guarantee for the
// published Falkner bands lives in falknerLadder.test.ts (n=2000, seed 0x1f);
// these are fast shape checks at small n.
const N = 40;
const SEED = 0x1f;

describe('runBossLadder (generic boss-ladder harness)', () => {
  const { card, traits } = buildFalknerAce({ aceHpMult: 1.15, gustBorneDmgMult: 1.4 });
  const starters = [card.species];

  test('the Falkner wrapper is the generic harness fed the Falkner card', () => {
    const viaWrapper = runFalknerLadder({ aceHpMult: 1.15, gustBorneDmgMult: 1.4, n: N, seed: SEED });
    expect(viaWrapper).toHaveLength(FALKNER_LADDER_ARCHETYPES.length * 3);
    expect(viaWrapper.map((c) => c.archetype)).toEqual(
      FALKNER_LADDER_ARCHETYPES.flatMap((a) => [a.name, a.name, a.name]),
    );
    // Deterministic given the seed.
    expect(runFalknerLadder({ aceHpMult: 1.15, gustBorneDmgMult: 1.4, n: N, seed: SEED })).toEqual(
      viaWrapper,
    );
  });

  test('a reader column is an extra archetype — the card five are unmoved by it', () => {
    const five = runFalknerLadder({ aceHpMult: 1.15, gustBorneDmgMult: 1.4, n: N, seed: SEED });
    const six = runFalknerLadder({
      aceHpMult: 1.15,
      gustBorneDmgMult: 1.4,
      n: N,
      seed: SEED,
      archetypes: [...FALKNER_LADDER_ARCHETYPES, reader],
    });
    expect(six.slice(0, five.length)).toEqual(five);
    expect(six.slice(five.length).every((c) => c.archetype === 'reader')).toBe(true);
  });

  test('playerTeam builds a lineup around each starter; cells keep the starter name', () => {
    const cells = runBossLadder({
      card,
      policy: falknerBossAI,
      traits,
      typeChart: typeChartData as TypeChart,
      starters,
      archetypes: [reader],
      n: N,
      seed: SEED,
      playerTeam: (s) => [s, s],
    });
    expect(cells).toHaveLength(1);
    expect(cells[0]!.player).toBe(card.species.name);
    expect(cells[0]!.wins).toBeGreaterThanOrEqual(0);
    expect(cells[0]!.wins).toBeLessThanOrEqual(N);
  });
});
