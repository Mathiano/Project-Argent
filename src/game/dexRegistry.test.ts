// Chapter-dex registry — the one species resolver + the one type-chart rule.
// The hazard it closes: a species from a SECOND chapter batch used to fall outside
// the per-call-site `CH1_DEX[name]` checks and silently fight on the legacy chart.
// A synthetic UPPERCASE batch (built here, never committed to docs/) stands in for
// that second chapter; no real CH2 dex or level is chosen by these tests.

import { describe, expect, test } from 'vitest';
import ch1BatchData from '../../docs/ch1-batch.json';
import typechartData from '../../docs/typechart.json';
import { LEGACY_TYPE_CHART, SPECIES, createBattleState, createSide, loadDex } from '../engine';
import type { DexEntryJson } from '../engine';
import {
  CH1_LEVEL,
  CHAPTER_DEXES,
  DEX_REGISTRY,
  TYPECHART_CANON,
  createDexRegistry,
  type ChapterDexSpec,
} from './dexRegistry';

const CH1 = ch1BatchData as DexEntryJson[];

// Test-only synthetic entry (UPPERCASE types from docs/typechart.json).
const SYNTH: DexEntryJson = {
  id: 900,
  line_id: 'LTEST',
  stage: 1,
  name: 'SYNTHMITE',
  types: ['INSECT', 'VENOM'],
  stats: { hp: 60, atk: 70, dfn: 60, spd: 80 },
  archetype: 'Test',
  rarity: 'common',
  statFlavor: 'test',
  learnset: [
    { move: 'TACKLE', level: 1 },
    { move: 'SYNTH A', level: 10 },
    { move: 'SYNTH B', level: 20 },
  ],
};
const SYNTH_CHAPTER: ChapterDexSpec = { id: 'TEST2', entries: [SYNTH], level: 20 };

describe('dex registry — the shipped registration', () => {
  test('CH1 is the only registered chapter, at CH1_LEVEL 13', () => {
    expect(CHAPTER_DEXES.map((c) => c.id)).toEqual(['CH1']);
    expect(CH1_LEVEL).toBe(13);
    expect(CHAPTER_DEXES[0]!.level).toBe(CH1_LEVEL);
  });

  test('the CH1 dex equals a direct loadDex of the batch at level 13', () => {
    expect(DEX_REGISTRY.dex('CH1')).toEqual(loadDex(CH1, 13));
    expect(DEX_REGISTRY.names).toEqual(CH1.map((e) => e.name));
  });

  test('the canon chart IS docs/typechart.json', () => {
    expect(TYPECHART_CANON).toBe(typechartData);
  });

  test('every CH1 species resolves to its CH1 dex object and gets the canon chart', () => {
    const dex = DEX_REGISTRY.dex('CH1');
    for (const e of CH1) {
      expect(DEX_REGISTRY.resolveSpecies(e.name)).toBe(dex[e.name]);
      expect(DEX_REGISTRY.chapterSpecies(e.name)).toBe(dex[e.name]);
      expect(DEX_REGISTRY.usesCanonChart(e.name)).toBe(true);
      expect(DEX_REGISTRY.chartOptsFor(e.name)).toEqual({ typeChart: TYPECHART_CANON });
      expect(DEX_REGISTRY.chapterEntry(e.name)).toEqual({ entry: e, level: 13 });
    }
  });

  test('legacy fixtures resolve via SPECIES and keep the legacy (default) chart', () => {
    for (const n of ['EMBERCUB', 'SPROUTLE', 'AQUAFIN']) {
      expect(DEX_REGISTRY.resolveSpecies(n)).toBe(SPECIES[n]);
      expect(DEX_REGISTRY.chapterSpecies(n)).toBeUndefined();
      expect(DEX_REGISTRY.chapterEntry(n)).toBeUndefined();
      expect(DEX_REGISTRY.usesCanonChart(n)).toBe(false);
      expect(DEX_REGISTRY.chartOptsFor(n)).toEqual({});
      const state = createBattleState(createSide(SPECIES[n]!), createSide(SPECIES[n]!), DEX_REGISTRY.chartOptsFor(n));
      expect(state.typeChart).toBe(LEGACY_TYPE_CHART);
    }
  });

  test('an unknown name resolves to nothing; an unknown chapter id throws', () => {
    expect(DEX_REGISTRY.resolveSpecies('NOSUCHMON')).toBeUndefined();
    expect(DEX_REGISTRY.usesCanonChart('NOSUCHMON')).toBe(false);
    expect(() => DEX_REGISTRY.dex('NOSUCH')).toThrow(/unknown chapter dex/);
  });
});

describe('dex registry — a second (synthetic) chapter batch', () => {
  const reg = createDexRegistry([...CHAPTER_DEXES, SYNTH_CHAPTER]);

  test('an UPPERCASE mon from a later batch resolves and gets the canon chart', () => {
    const sp = reg.resolveSpecies('SYNTHMITE');
    expect(sp?.types).toEqual(['INSECT', 'VENOM']);
    expect(reg.usesCanonChart('SYNTHMITE')).toBe(true);
    const state = createBattleState(createSide(sp!), createSide(sp!), reg.chartOptsFor('SYNTHMITE'));
    expect(state.typeChart).toBe(TYPECHART_CANON);
  });

  test('the learnset level is taken per batch', () => {
    // CH1 stays at 13; the synthetic batch loads at its own 20.
    expect(reg.dex('CH1')).toEqual(loadDex(CH1, 13));
    expect(reg.resolveSpecies('SYNTHMITE')!.moves).toEqual(['TACKLE', 'SYNTH A', 'SYNTH B']);
    expect(reg.chapterEntry('SYNTHMITE')).toEqual({ entry: SYNTH, level: 20 });
    const low = createDexRegistry([{ ...SYNTH_CHAPTER, level: 10 }]);
    expect(low.resolveSpecies('SYNTHMITE')!.moves).toEqual(['TACKLE', 'SYNTH A']);
  });

  test('names span every registered batch, in registry order', () => {
    expect(reg.names).toEqual([...CH1.map((e) => e.name), 'SYNTHMITE']);
  });

  test('legacy fixtures are unaffected by the extra batch', () => {
    expect(reg.resolveSpecies('EMBERCUB')).toBe(SPECIES.EMBERCUB);
    expect(reg.chartOptsFor('EMBERCUB')).toEqual({});
  });
});
