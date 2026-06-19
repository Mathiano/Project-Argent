import { describe, expect, test } from 'vitest';
import { runStanceBalance } from './stanceBalance';

// ── Combat Layer 1 sim-gate (the dominance fix) ──────────────────────────
// The engine analogue of the Monte Carlo design probe. Pre-Layer-1 the
// triangle made FLUID dominant (PureFLUID ~99.7% in the MC). After the fix
// (Aggressive beats Fluid + thrice-daze + Fluid's safety gone), PureFLUID
// must be a LOSING spam and no single stance may dominate.

describe('stance balance — Layer 1 broke Fluid dominance', () => {
  test('PureFLUID collapses to a losing spam; Balanced tops; spread collapsed; every stance used', () => {
    const r = runStanceBalance('SPROUTLE', 600, 1);
    const rows = Object.entries(r.winPct).sort((a, b) => b[1] - a[1]);
    console.log(
      '\n── STANCE BALANCE (SPROUTLE mirror, round-robin, n=600/pair) ──\n' +
        rows.map(([n, w]) => `  ${n.padEnd(10)} ${w.toFixed(1)}%`).join('\n') +
        `\n  spread ${r.spreadPp.toFixed(1)}pp · top ${r.top}` +
        `\n  (pre-Layer-1 reference: PureFLUID ~99.7% dominant, spread ~97pp)\n`,
    );

    const fluid = r.winPct.PureFLUID!;
    // PureFLUID is no longer dominant — it's a LOSING spam now.
    expect(fluid).toBeLessThan(40);
    expect(r.top).not.toBe('PureFLUID');
    // Balanced/adaptive play sits ABOVE every pure-stance spam (a healthy
    // read-war: vary + read beats spamming one thing).
    expect(r.winPct.Balanced!).toBeGreaterThan(r.winPct.PureFLUID!);
    expect(r.winPct.Balanced!).toBeGreaterThan(r.winPct.PureAGG!);
    expect(r.winPct.Balanced!).toBeGreaterThan(r.winPct.PureGUARD!);
    // Dominant-strategy collapse: spread well under the old 97pp.
    expect(r.spreadPp).toBeLessThan(70);
    // No DEAD stance — every pure spam still wins a meaningful share.
    for (const name of ['PureAGG', 'PureFLUID', 'PureGUARD']) {
      expect(r.winPct[name]!).toBeGreaterThan(10);
    }
  });
});
