// auditBatch is a diagnostic tool — these tests guard the flag-generation
// logic itself from silently breaking when archetypes evolve.

import { describe, expect, test } from 'vitest';
import { auditBatch } from './ch1Batch';
import type { BatchCell } from './ch1Batch';

const baseCell = (over: Partial<BatchCell>): BatchCell => ({
  player: 'A',
  archetype: 'static-guard',
  winPct: 80,
  exhaustionPct: 0,
  ...over,
});

describe('auditBatch', () => {
  test('flags a species drifting more than 3pp from its archetype mean', () => {
    const cells: BatchCell[] = [
      baseCell({ player: 'A', winPct: 80 }),
      baseCell({ player: 'B', winPct: 80 }),
      baseCell({ player: 'C', winPct: 70 }), // mean ≈ 76.7 → 'C' is -6.7pp
    ];
    const flags = auditBatch(cells);
    const drift = flags.find((f) => f.kind === 'drift' && f.player === 'C');
    expect(drift).toBeDefined();
  });

  test('does not flag drift inside the ±3pp band', () => {
    const cells: BatchCell[] = [
      baseCell({ player: 'A', winPct: 80 }),
      baseCell({ player: 'B', winPct: 81 }),
      baseCell({ player: 'C', winPct: 79 }), // mean = 80, all within ±3pp
    ];
    const flags = auditBatch(cells).filter((f) => f.kind === 'drift');
    expect(flags).toHaveLength(0);
  });

  test('flags a cell with exhaustion-rate above 40% as softlock-prone', () => {
    const cells: BatchCell[] = [
      baseCell({ exhaustionPct: 50 }),
      baseCell({ exhaustionPct: 0 }),
    ];
    const flags = auditBatch(cells).filter((f) => f.kind === 'softlock');
    expect(flags).toHaveLength(1);
    expect(flags[0]!.value).toBe(50);
  });

  test('does not flag softlock at 40% exactly (strict >)', () => {
    const cells: BatchCell[] = [baseCell({ exhaustionPct: 40 })];
    const flags = auditBatch(cells).filter((f) => f.kind === 'softlock');
    expect(flags).toHaveLength(0);
  });
});
