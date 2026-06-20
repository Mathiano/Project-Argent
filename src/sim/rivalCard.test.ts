import { describe, expect, test } from 'vitest';
import { runRivalCard } from './rivalCard';

// ── KAMON Rival Card v2 — per-pick fairness gate (docs/kamon-rival-card-v2.md) ─
// The reader (player, the bonded pick) vs KAMON (the stolen counter-type at
// bond-factor 0.85, Aggressor/Single-only) over all three picks.
//
// ✅ FAIRNESS GATE LIVE again (2026-06-21, starter-trio-rebalance.md RESOLUTION).
// The trio is now budget-balanced (mirror-sim ~50% RPS each: KINDRAKE 52.1 /
// GRUBLEAF 49.7 / SILTSKIP 47.4, spread 4.7pp), so KAMON's per-pick levels
// re-converged to a TIGHT band around ~1.0 (0.90–1.03; engine/rivalCard.ts) and
// the picks land winnable-but-tense: KINDRAKE 72.0 / GRUBLEAF 70.3 / SILTSKIP
// 65.7% (n=2000 seed=1, spread 6.3pp). The asymmetry the old skip flagged is
// gone — the gates below are restored.
describe('KAMON rival card — fair-but-tense across all three picks', () => {
  const rows = runRivalCard(2000, 1);

  test('reports (logged for the audit)', () => {
    for (const r of rows) {
      // eslint-disable-next-line no-console
      console.log(`  ${r.pick.padEnd(9)} vs KAMON's ${r.stolen.padEnd(9)} → player ${r.playerWinPct.toFixed(1)}%`);
    }
    expect(rows.length).toBe(3);
  });

  test('every pick is WINNABLE-BUT-CLOSE', () => {
    for (const r of rows) {
      expect(r.playerWinPct).toBeGreaterThan(55);
      expect(r.playerWinPct).toBeLessThan(88);
    }
  });

  test('the three picks are TIGHT (within ~12pp)', () => {
    const w = rows.map((r) => r.playerWinPct);
    expect(Math.max(...w) - Math.min(...w)).toBeLessThan(12);
  });
});
