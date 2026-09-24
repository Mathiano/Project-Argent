// Batch validator (gym2-plan Step 3) — the commission kit's validation pass run
// against the shipped CH1 batch, plus one negative case per rule on synthetic
// data (nothing synthetic is committed to docs/).
import { describe, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import ch1BatchData from '../../docs/ch1-batch.json';
import typechartData from '../../docs/typechart.json';
import { registerMoves, SPECIES } from '../engine';
import type { DexEntryJson, TypeChart } from '../engine';
import {
  CH1_KNOWN_FLAGS,
  issueKey,
  parseManifest,
  partitionKnown,
  sentenceCount,
  SIGNATURE_RESERVED,
  validateBatch,
} from './batchValidate';
import type { BatchIssue, BatchRule, ManifestRow } from './batchValidate';

const MANIFEST = parseManifest(
  readFileSync(fileURLToPath(new URL('../../docs/mon-manifest.csv', import.meta.url)), 'utf8'),
);
const CHART = typechartData as TypeChart;
const CH1 = ch1BatchData as DexEntryJson[];

function ch1At(level: number): BatchIssue[] {
  return validateBatch(CH1, {
    manifest: MANIFEST,
    bucket: 'CH1',
    typeChart: CHART,
    level,
    priorNames: Object.keys(SPECIES), // the legacy fixtures own their names
  });
}

describe('parseManifest', () => {
  test('reads every row, quoted notes with commas included', () => {
    expect(MANIFEST.length).toBe(345);
    expect(MANIFEST.filter((r) => r.bucket === 'CH1').length).toBe(29);
    const kin = MANIFEST.find((r) => r.name === 'KINDRAKE')!;
    expect(kin).toMatchObject({ line_id: 'L001', stage: 1, stages_total: 3, type1: 'FLAME', type2: '' });
    expect(kin).toMatchObject({ archetype: 'Wall', rarity: 'starter', evolve_at: 16 });
    const fort = MANIFEST.find((r) => r.name === 'FORTDRAKE')!;
    expect(fort).toMatchObject({ type2: 'DRAKE', evolve_at: null });
  });
});

describe('the CH1 batch against the doc-settled rules', () => {
  test('at the shipped band (13) only the unauthored-slot flags fire', () => {
    const issues = ch1At(13);
    const { unexpected, known } = partitionKnown(issues, CH1_KNOWN_FLAGS);
    expect(unexpected).toEqual([]);
    expect(known.every((i) => i.rule === 'slot-unauthored')).toBe(true);
    expect(known.length).toBe(14);
  });

  test('above the band the attack overflow is known, nothing else is new', () => {
    for (const level of [16, 19, 24]) {
      expect(partitionKnown(ch1At(level), CH1_KNOWN_FLAGS).unexpected, `@${level}`).toEqual([]);
    }
  });

  test('every allowlist entry still fires (no stale known flags)', () => {
    const fired = new Set(ch1At(24).map(issueKey));
    for (const key of Object.keys(CH1_KNOWN_FLAGS)) expect(fired.has(key), key).toBe(true);
  });

  test('all 15 authored CH1 entries carry stamina (no warnings)', () => {
    expect(ch1At(13).filter((i) => i.severity === 'warning')).toEqual([]);
  });
});

// ── Synthetic negatives: a clean two-stage line, then one defect at a time ──

const ROWS: ManifestRow[] = [
  {
    line_id: 'LT01', stage: 1, name: 'TESTLING', stages_total: 2, bucket: 'TEST',
    type1: 'FLAME', type2: '', archetype: 'Wall', rarity: 'common', evolve_at: 16,
  },
  {
    line_id: 'LT01', stage: 2, name: 'TESTMAW', stages_total: 2, bucket: 'TEST',
    type1: 'FLAME', type2: '', archetype: 'Wall', rarity: 'common', evolve_at: null,
  },
  {
    line_id: 'LT02', stage: 1, name: 'OTHERKIT', stages_total: 1, bucket: 'ELSEWHERE',
    type1: 'AQUA', type2: '', archetype: 'Brawler', rarity: 'common', evolve_at: null,
  },
];

const DEX = 'It stands its ground against every blow. Foes tire long before it does.';
const LEARNSET = [
  { move: 'TACKLE', level: 1 },
  { move: 'CINDER FLICK', level: 1 },
  { move: 'EMBER SNAP', level: 7 },
  { move: 'SEAR', level: 1 },
  { move: 'KINDLE', level: 1 },
];

function entry(over: Partial<DexEntryJson> & Pick<DexEntryJson, 'name' | 'stage'>): DexEntryJson {
  return {
    id: 900 + over.stage,
    line_id: 'LT01',
    types: ['FLAME'],
    stats: { hp: 60, atk: 90, dfn: 110, spd: 60, stamina: 108 },
    archetype: 'Wall',
    rarity: 'common',
    statFlavor: 'sturdy',
    learnset: LEARNSET,
    evoLine: over.stage === 1 ? { evolvesTo: 'TESTMAW', at: 16 } : null,
    dexEntry: DEX,
    ...over,
  };
}

const CLEAN: DexEntryJson[] = [
  entry({ name: 'TESTLING', stage: 1 }),
  entry({ name: 'TESTMAW', stage: 2 }),
];

function check(entries: readonly DexEntryJson[], extra: { level?: number; priorNames?: string[] } = {}) {
  return validateBatch(entries, {
    manifest: ROWS,
    bucket: 'TEST',
    typeChart: CHART,
    level: extra.level ?? 13,
    ...(extra.priorNames ? { priorNames: extra.priorNames } : {}),
  });
}
const rules = (issues: readonly BatchIssue[]): BatchRule[] => issues.map((i) => i.rule);
const withStage1 = (over: Partial<DexEntryJson>): DexEntryJson[] => [
  entry({ name: 'TESTLING', stage: 1, ...over }),
  CLEAN[1]!,
];

describe('synthetic negatives — each rule trips on its own defect', () => {
  test('the clean synthetic line passes with no issues at all', () => {
    expect(check(CLEAN)).toEqual([]);
  });

  test('slot coverage: a missing bucket slot, an extra, a duplicate', () => {
    expect(check([CLEAN[0]!]).map(issueKey)).toEqual(['slot-unauthored:LT01s2']);
    const extra = check([...CLEAN, entry({ name: 'STRAYKIT', stage: 1, line_id: 'LT99', evoLine: null })]);
    expect(extra.map(issueKey)).toContain('slot-extra:STRAYKIT');
    const dup = check([...CLEAN, entry({ name: 'TWINLING', stage: 1 })]);
    expect(dup.map(issueKey)).toContain('slot-duplicate:TWINLING');
  });

  test('types / archetype / rarity must match the manifest row', () => {
    for (const over of [{ types: ['AQUA'] }, { archetype: 'Dodger' }, { rarity: 'rare' }]) {
      const got = check(withStage1(over));
      expect(rules(got), JSON.stringify(over)).toEqual(['manifest-mismatch']);
    }
  });

  test('a manifest-named slot answered under another name warns (name drift)', () => {
    const got = check([entry({ name: 'TESTKIT', stage: 1 }), CLEAN[1]!]);
    expect(got.map((i) => [i.rule, i.severity])).toEqual([['name-drift', 'warning']]);
  });

  test('type vocabulary: legacy Mixed-case and unknown UPPERCASE are rejected', () => {
    expect(rules(check(withStage1({ types: ['Flame'] })))).toContain('type-vocab');
    expect(rules(check(withStage1({ types: ['WOOD'] })))).toContain('type-vocab');
  });

  test('naming law: 4–9 chars, ALL CAPS', () => {
    for (const name of ['TES', 'TESTLINGSX', 'Testling', 'TEST KIT']) {
      const got = check([entry({ name, stage: 1 }), CLEAN[1]!]);
      expect(rules(got), name).toContain('naming-law');
    }
    for (const name of ['TEST', 'TESTLINGS']) {
      const got = check([entry({ name, stage: 1 }), CLEAN[1]!]);
      expect(rules(got), name).not.toContain('naming-law');
    }
  });

  test('collisions: in-batch duplicate, a prior name, another slot’s manifest name', () => {
    expect(check(CLEAN, { priorNames: ['TESTMAW'] }).map(issueKey)).toEqual(['name-collision:TESTMAW']);
    const stolen = check([entry({ name: 'OTHERKIT', stage: 1 }), CLEAN[1]!]);
    expect(stolen.map(issueKey)).toContain('name-collision:OTHERKIT');
    const twice = check([CLEAN[0]!, entry({ name: 'TESTLING', stage: 2 })]);
    expect(twice.map(issueKey)).toContain('name-collision:TESTLING');
  });

  test('dexEntry must be exactly 2 terminated sentences', () => {
    for (const dexEntry of [
      'It stands its ground.',
      'It stands. It waits. It wins.',
      'It stands its ground. Foes tire before it does',
      '',
    ]) {
      expect(rules(check(withStage1({ dexEntry }))), dexEntry).toEqual(['dex-entry']);
    }
    expect(sentenceCount(DEX)).toBe(2);
    expect(sentenceCount('Is it there?! It is.')).toBe(2);
  });

  test('every learnset move must be registered (the signature slot is exempt)', () => {
    const bad = withStage1({ learnset: [...LEARNSET, { move: 'FAKE MOVE', level: 1 }] });
    expect(check(bad).map(issueKey)).toEqual(['move-unregistered:TESTLING']);
    const sig = withStage1({ learnset: [...LEARNSET, { move: SIGNATURE_RESERVED, level: 34 }] });
    expect(check(sig)).toEqual([]);
  });

  test('no nuke-tier learnset move outside the signature slot', () => {
    registerMoves({ 'FX NUKE': { name: 'FX NUKE', tier: 'nuke', type: 'FLAME' } });
    const got = check(withStage1({ learnset: [...LEARNSET, { move: 'FX NUKE', level: 30 }] }));
    expect(got.map(issueKey)).toEqual(['nuke:TESTLING']);
  });

  test('move-pool integrity is checked at the CALLER’S level', () => {
    const heavy = [
      ...LEARNSET,
      { move: 'HEADBUTT', level: 13 },
      { move: 'FLAME RUSH', level: 19 },
    ];
    expect(check(withStage1({ learnset: heavy }), { level: 13 })).toEqual([]);
    const at19 = check(withStage1({ learnset: heavy }), { level: 19 });
    expect(at19.map(issueKey)).toEqual(['move-pool:TESTLING']);
    expect(at19[0]!.message).toContain('5 attacks (max 4)');
  });

  test('the evolution chain must match the manifest', () => {
    const wrongTo = check(withStage1({ evoLine: { evolvesTo: 'SOMEMON', at: 16 } }));
    expect(wrongTo.map(issueKey)).toEqual(['evo-chain:TESTLING']);
    const wrongAt = check(withStage1({ evoLine: { evolvesTo: 'TESTMAW', at: 20 } }));
    expect(wrongAt.map(issueKey)).toEqual(['evo-chain:TESTLING']);
    const finalEvolves = check([CLEAN[0]!, entry({ name: 'TESTMAW', stage: 2, evoLine: { evolvesTo: 'X', at: 30 } })]);
    expect(finalEvolves.map(issueKey)).toEqual(['evo-chain:TESTMAW']);
  });

  test('missing stamina is a warning, not an error', () => {
    const got = check(withStage1({ stats: { hp: 60, atk: 90, dfn: 110, spd: 60 } }));
    expect(got.map((i) => [i.rule, i.severity])).toEqual([['stamina-missing', 'warning']]);
  });
});
