// The ONE manifest CSV parser (shared by the game's placeholders and the sim's
// batch validator): quoted fields — the long `note` column carries commas and
// "" escapes — must not shift the columns either consumer reads.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import { parseCsv, parseManifest } from './manifest';

const monManifestCsv = readFileSync(
  fileURLToPath(new URL('../../docs/mon-manifest.csv', import.meta.url)),
  'utf8',
);

describe('parseCsv', () => {
  test('quoted commas, "" escapes, quoted newlines and CRLF', () => {
    expect(parseCsv('a,"b,c","say ""hi"""\r\n"x\ny",,z\n')).toEqual([
      ['a', 'b,c', 'say "hi"'],
      ['x\ny', '', 'z'],
    ]);
  });

  test('a final row without a trailing newline is kept', () => {
    expect(parseCsv('a,b\nc,d')).toEqual([['a', 'b'], ['c', 'd']]);
  });
});

describe('parseManifest', () => {
  test('columns are read by header name, not position', () => {
    const csv =
      'rarity,name,archetype,stage,evolve_at,line_id,stages_total,bucket,type1,type2\n' +
      'rare,FOO,Wall,2,,L999,3,CH9,FLAME,"DRAKE"\n';
    expect(parseManifest(csv)).toEqual([
      {
        line_id: 'L999', stage: 2, name: 'FOO', stages_total: 3, bucket: 'CH9',
        type1: 'FLAME', type2: 'DRAKE', archetype: 'Wall', rarity: 'rare', evolve_at: null,
      },
    ]);
  });

  test('a missing column fails loudly', () => {
    expect(() => parseManifest('line_id,stage,name\nL1,1,FOO\n')).toThrow(/stages_total/);
  });

  test('a quoted field spanning a line stays ONE row (the case the old line-splitter got wrong)', () => {
    const csv =
      'line_id,stage,name,stages_total,bucket,type1,type2,archetype,rarity,evolve_at,note\n' +
      'L998,1,BAR,1,CH9,AQUA,,Dodger,common,,"two\nlines"\n' +
      'L999,1,BAZ,1,CH9,AQUA,,Dodger,common,,x\n';
    expect(parseManifest(csv).map((r) => r.name)).toEqual(['BAR', 'BAZ']);
  });

  test('the shipped manifest parses: every row has a line id, a 1-3 stage and an archetype', () => {
    const rows = parseManifest(monManifestCsv);
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      expect(r.line_id, JSON.stringify(r)).toMatch(/^L\d{3}$/);
      expect([1, 2, 3], r.line_id).toContain(r.stage);
      expect(r.archetype, r.line_id).not.toBe('');
    }
    // Both former parsers agreed on this count; pin it so a parser change that
    // drops or splits a row is caught here, not in two consumers.
    expect(rows.length).toBe(345);
    const named = rows.filter((r) => r.name).map((r) => r.name);
    expect(new Set(named).size).toBe(named.length); // names key the lookup → no collisions
  });
});
