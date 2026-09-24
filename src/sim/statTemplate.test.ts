// Pins the PROPOSED stat template's arithmetic and its fit to shipped CH1. It
// does NOT pin the parity numbers — those are evidence for a ruling
// (docs/stat-template-proposal.md), not a band.

import { describe, expect, test } from 'vitest';
import ch1BatchData from '../../docs/ch1-batch.json';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseManifest } from '../engine';
import type { DexEntryJson } from '../engine';
import { SHAPES, STAMINA_BASE, budgetFor, templateStats } from './statTemplate';
import type { Archetype, Rarity } from './statTemplate';

const manifest = parseManifest(
  readFileSync(fileURLToPath(new URL('../../docs/mon-manifest.csv', import.meta.url)), 'utf8'),
);

describe('proposed stat template', () => {
  test('every shape is a real split of the budget', () => {
    for (const [a, s] of Object.entries(SHAPES)) {
      expect(s[0] + s[1] + s[2] + s[3], a).toBeCloseTo(1, 9);
      for (const v of s) expect(v, a).toBeGreaterThan(0);
    }
  });

  test('stats always sum EXACTLY to the budget (largest-remainder rounding)', () => {
    for (const a of Object.keys(SHAPES) as Archetype[]) {
      for (const rarity of ['common', 'uncommon', 'starter'] as Rarity[]) {
        for (const [stage, total] of [[1, 1], [1, 2], [2, 2], [1, 3], [2, 3], [3, 3]] as const) {
          const slot = { archetype: a, rarity, stage, stagesTotal: total };
          const t = templateStats(slot);
          expect(t.hp + t.atk + t.dfn + t.spd, `${a} ${rarity} ${stage}/${total}`).toBe(budgetFor(slot));
        }
      }
    }
  });

  test('stage-1 stamina is the stamina doc table verbatim', () => {
    expect(STAMINA_BASE).toEqual({
      Wall: 120, 'Counter-tank': 115, Drainer: 115, Pacer: 110,
      Brawler: 105, Dodger: 95, Trickster: 90, 'Glass nuke': 75,
    });
  });

  test('every shipped NON-starter CH1 mon sits inside the ±8% statFlavor band of the template', () => {
    // The commission kit derives stats as "template + stage band ± statFlavor
    // nudge (capped ±8%)". If the reconstructed template is the one the CH1 sheet
    // used, every non-starter lands within that cap. (Starters are excluded: their
    // stage-1 lines were bent by starter-trio-rebalance.md, deliberately.)
    for (const e of ch1BatchData as DexEntryJson[]) {
      if (e.rarity === 'starter') continue;
      const row = manifest.find((r) => r.name === e.name)!;
      const t = templateStats({
        archetype: e.archetype as Archetype, rarity: e.rarity as Rarity,
        stage: row.stage, stagesTotal: row.stages_total,
      });
      for (const k of ['hp', 'atk', 'dfn', 'spd'] as const) {
        const rel = Math.abs(t[k] - e.stats[k]) / e.stats[k];
        expect(rel, `${e.name}.${k}: template ${t[k]} vs shipped ${e.stats[k]}`).toBeLessThanOrEqual(0.08);
      }
    }
  });
});
