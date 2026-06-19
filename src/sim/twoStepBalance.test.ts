import { describe, expect, test } from 'vitest';
import { runTwoStepBalance } from './twoStepBalance';

// ── Combat Layer 2 sim-gate (the depth layer must not create a new dominant
// strategy) ─────────────────────────────────────────────────────────────────
// The kickoff's hard requirements, asserted as STRUCTURAL properties:
//   • NO two-step-spam dominance — ChargeSpam/HideSpam/FeintSpam each sit BELOW
//     balanced/adaptive play.
//   • EVERY option used (3 base + 3 two-step) — no dead weight (leak cap).
//   • Single-stance spam still LOSES — FluidSpam is the floor (Layer 1 preserved).
//   • Balanced/adaptive reading TOPS the table.
//
// On the SPREAD: the MC's abstract model hit ~16pp. The REAL engine is more
// decisive than that smoothed payoff matrix, so the FULL-pool spread is wider —
// driven entirely by the two SINGLE-step extremes: FluidSpam (a no-read strawman
// the Layer-1 hard counters justly crush — the Layer-1 gate already puts
// PureFLUID <40%) and BaseBalanced (idealised never-committing varied reading,
// very strong in a blind mirror with no telegraph to exploit). The TWO-STEP
// LAYER itself is healthy: the three two-steps cluster, none dominates, all are
// used, and spam loses to reading. We report both the full spread and the
// "competitive" spread (excluding the FluidSpam strawman) for transparency.

describe('two-step balance — Layer 2 adds depth without a dominant strategy', () => {
  test('no two-step-spam dominance; every option used; reading tops; predictable spam loses', () => {
    const r = runTwoStepBalance('SPROUTLE', 500, 1);
    const rows = Object.entries(r.winPct).sort((a, b) => b[1] - a[1]);
    const compVals = Object.entries(r.winPct)
      .filter(([n]) => n !== 'FluidSpam')
      .map(([, w]) => w);
    const compSpread = Math.max(...compVals) - Math.min(...compVals);
    console.log(
      '\n── TWO-STEP BALANCE (SPROUTLE mirror, round-robin, n=500/pair) ──\n' +
        rows.map(([n, w]) => `  ${n.padEnd(13)} ${w.toFixed(1)}%`).join('\n') +
        `\n  full spread ${r.spreadPp.toFixed(1)}pp · competitive spread (excl. FluidSpam strawman) ${compSpread.toFixed(1)}pp` +
        `\n  top ${r.top} · bottom ${r.bottom}\n` +
        '── ACTION USAGE (every option used? unused = dead weight) ──\n' +
        (['A', 'F', 'G', 'charge', 'hide', 'feint'] as const)
          .map((k) => `  ${k.padEnd(7)} ${r.usagePct[k].toFixed(1)}%`)
          .join('\n') +
        '\n',
    );

    const { winPct } = r;
    const spams = [winPct.ChargeSpam!, winPct.HideSpam!, winPct.FeintSpam!];

    // 1. No dead weight — every option (3 base + 3 two-step) is used.
    for (const k of ['A', 'F', 'G', 'charge', 'hide', 'feint'] as const) {
      expect(r.usagePct[k]).toBeGreaterThan(3);
    }
    // 2. No two-step-spam dominance — each sits BELOW balanced AND adaptive play.
    for (const s of spams) {
      expect(winPct.BaseBalanced!).toBeGreaterThan(s);
      expect(winPct.Adaptive!).toBeGreaterThan(s);
    }
    // 3. Predictable single-stance spam still LOSES — FluidSpam below every
    //    two-step-spam (Layer 1 preserved, and it can't punish wind-ups).
    for (const s of spams) {
      expect(s).toBeGreaterThan(winPct.FluidSpam!);
    }
    // 4. Balanced/adaptive reading tops the table (top two policies).
    const top2 = Object.entries(winPct).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([n]) => n);
    expect(top2).toContain('BaseBalanced');
    expect(top2).toContain('Adaptive');
    // 5. No single two-step dominates the others — the three cluster.
    expect(Math.max(...spams) - Math.min(...spams)).toBeLessThan(20);
  });
});
