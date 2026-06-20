import { describe, expect, test } from 'vitest';
import { runRivalCard } from './rivalCard';

// ── KAMON Rival Card v2 — per-pick fairness gate (docs/kamon-rival-card-v2.md) ─
// The reader (player, the bonded pick) vs KAMON (the stolen counter-type at
// bond-factor 0.85, Aggressor/Single-only) over all three picks. Fair-but-
// tense: winnable-but-close — the bond (0.85 + reading + the per-pick level
// tuning) offsetting the type edge — not a free win, not a wall.
describe('KAMON rival card — fair-but-tense across all three picks', () => {
  const rows = runRivalCard(2000, 1);

  test('reports (logged for the audit)', () => {
    for (const r of rows) {
      // eslint-disable-next-line no-console
      console.log(`  ${r.pick.padEnd(9)} vs KAMON's ${r.stolen.padEnd(9)} → player ${r.playerWinPct.toFixed(1)}%`);
    }
    expect(rows.length).toBe(3);
  });

  test('every pick is WINNABLE-BUT-CLOSE — not a free win, not a wall', () => {
    for (const r of rows) {
      expect(r.playerWinPct).toBeGreaterThan(55); // clearly winnable (the thesis demo)
      expect(r.playerWinPct).toBeLessThan(88); // but not a free win — KAMON's edge bites
    }
  });

  test('the three picks are TIGHT (no lopsided matchup) — within ~12pp of each other', () => {
    const w = rows.map((r) => r.playerWinPct);
    expect(Math.max(...w) - Math.min(...w)).toBeLessThan(12);
  });
});
