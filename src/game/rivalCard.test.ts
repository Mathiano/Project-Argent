import { describe, expect, test } from 'vitest';
import {
  KAMON_BOND_FACTOR,
  KAMON_ACE_LEVEL,
  KAMON_STEAL,
  buildKamonTeam,
  kamonAceScale,
  kamonStolenStarter,
  loadDex,
} from '../engine';
import type { DexEntryJson, TypeChart } from '../engine';
import ch1BatchData from '../../docs/ch1-batch.json';
import typechartData from '../../docs/typechart.json';

const CH1 = loadDex(ch1BatchData as DexEntryJson[], 13);
const CHART = typechartData as TypeChart;
const PICKS = ['KINDRAKE', 'GRUBLEAF', 'SILTSKIP'] as const;

describe('KAMON rival card v2 — the type-triangle steal', () => {
  test('steal map: KINDRAKE→SILTSKIP, GRUBLEAF→KINDRAKE, SILTSKIP→GRUBLEAF', () => {
    expect(KAMON_STEAL.KINDRAKE).toBe('SILTSKIP');
    expect(KAMON_STEAL.GRUBLEAF).toBe('KINDRAKE');
    expect(KAMON_STEAL.SILTSKIP).toBe('GRUBLEAF');
  });

  test('the stolen starter TYPE-BEATS the player pick (he takes the counter)', () => {
    for (const pick of PICKS) {
      const stolen = kamonStolenStarter(pick)!;
      const pickType = CH1[pick]!.types[0]!;
      const stolenType = CH1[stolen]!.types[0]!;
      // The stolen type is super-effective into the pick type (>1 in the chart).
      expect(CHART[stolenType]![pickType]!).toBeGreaterThan(1);
    }
  });

  test('kamonStolenStarter returns undefined for a non-CH1 lead (fixture fallback)', () => {
    expect(kamonStolenStarter('EMBERCUB')).toBeUndefined();
  });
});

describe('KAMON rival card v2 — bond-factor 0.85 on the stolen starter ONLY', () => {
  test('the 0.85 hesitation is in the ace scale (atk/dfn), separate from the level', () => {
    expect(KAMON_BOND_FACTOR).toBe(0.85);
    for (const pick of PICKS) {
      const stolen = kamonStolenStarter(pick)!;
      const lvl = KAMON_ACE_LEVEL[stolen]!;
      const scale = kamonAceScale(stolen);
      // atk/dfn carry level × 0.85; the 0.85 factor divides back out exactly.
      expect(scale.atk! / lvl).toBeCloseTo(0.85, 10);
      expect(scale.dfn! / lvl).toBeCloseTo(0.85, 10);
      expect(scale.hp).toBe(lvl); // hp is the level only (no hesitation on bulk)
    }
  });

  test('buildKamonTeam scales the ACE; an added chaff fights at NORMAL bond (unscaled)', () => {
    const stolen = CH1.SILTSKIP!; // player picked KINDRAKE
    const chaff = CH1.MARSHMASH!;
    const team = buildKamonTeam(stolen, chaff);
    const ace = team.members[0]!;
    const chaffSide = team.members[1]!;
    // Ace atk reflects level × 0.85 (SILTSKIP level 1.14 → 0.969×).
    const expectedAceAtk = Math.round(stolen.atk * KAMON_ACE_LEVEL.SILTSKIP! * 0.85);
    expect(ace.species.atk).toBe(expectedAceAtk);
    expect(ace.species.atk).not.toBe(stolen.atk); // the ace IS scaled
    // Chaff is fully unscaled — only the stolen starter carries the bond-factor.
    expect(chaffSide.species.atk).toBe(chaff.atk);
    expect(chaffSide.species.dfn).toBe(chaff.dfn);
    expect(chaffSide.species.hp).toBe(chaff.hp);
  });

  test('solo ace (first fight) = a 1-mon KAMON team', () => {
    const team = buildKamonTeam(CH1.GRUBLEAF!); // player picked SILTSKIP
    expect(team.members.length).toBe(1);
  });
});
