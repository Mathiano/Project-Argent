import { describe, expect, test } from 'vitest';
import { runStarterMirror, STARTERS } from './starterMirror';

// Starter-trio balance gate (docs/starter-trio-rebalance.md, criterion #1).
// The three CH1 starters share one budget (330) and must be balanced by SHAPE,
// not total — so the mirror-sim (reader v reader, real CH1 chart) lands each
// aggregate win% near 50% RPS. Pre-rebalance this split was 21/50/79; the
// budget-balanced trio collapses it to ~50 each. Locks the rebalance against
// regression. Deterministic given the seed.
describe('starter-trio mirror-sim — budget-balanced ⇒ ~50% RPS each', () => {
  const res = runStarterMirror(2000, 1);

  test('reports (logged for the audit)', () => {
    for (const s of STARTERS) {
      // eslint-disable-next-line no-console
      console.log(`  ${s.padEnd(9)} aggregate ${res.aggregate[s].toFixed(1)}%`);
    }
    expect(STARTERS.length).toBe(3);
  });

  // Spine-1 re-baseline (2026-06-30, phased-unlock): the ★-ramp opens battles
  // light-only, mildly favouring the bulky Wall (KINDRAKE 56.0 vs 46.5/46.5) —
  // bulk gets more value while offense is throttled early. Spread 9.5pp still
  // honours the TIGHT (<10pp) contract below; band widened 44–56 → 43–57.
  test('every starter lands near 50% aggregate (43–57%)', () => {
    for (const s of STARTERS) {
      expect(res.aggregate[s]).toBeGreaterThanOrEqual(43);
      expect(res.aggregate[s]).toBeLessThanOrEqual(57);
    }
  });

  test('the trio is TIGHT (aggregate spread < 10pp)', () => {
    const vals = STARTERS.map((s) => res.aggregate[s]);
    expect(Math.max(...vals) - Math.min(...vals)).toBeLessThan(10);
  });
});
