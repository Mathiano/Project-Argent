// The manifest CSV parser: quoted fields (the long `note` column carries
// commas and "" escapes) must not shift the columns placeholders read.

import { describe, expect, test } from 'vitest';
import { parseCsv, parseManifest } from './monManifest';
import monManifestCsv from '../../docs/mon-manifest.csv?raw';

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
    const csv = 'name,archetype,stage,line_id,bucket,type1,type2\nFOO,Wall,2,L999,CH9,FLAME,"DRAKE"\n';
    expect(parseManifest(csv)).toEqual([
      { lineId: 'L999', stage: 2, name: 'FOO', bucket: 'CH9', type1: 'FLAME', type2: 'DRAKE', archetype: 'Wall' },
    ]);
  });

  test('a missing column fails loudly', () => {
    expect(() => parseManifest('line_id,stage,name\nL1,1,FOO\n')).toThrow(/bucket/);
  });

  test('the shipped manifest parses: every row has a line id, a 1-3 stage and an archetype', () => {
    const rows = parseManifest(monManifestCsv);
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      expect(r.lineId, JSON.stringify(r)).toMatch(/^L\d{3}$/);
      expect([1, 2, 3], r.lineId).toContain(r.stage);
      expect(r.archetype, r.lineId).not.toBe('');
    }
    const named = rows.filter((r) => r.name).map((r) => r.name);
    expect(new Set(named).size).toBe(named.length); // names key the lookup → no collisions
  });
});
