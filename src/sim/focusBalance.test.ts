import { describe, expect, test } from 'vitest';
import { runFocusBalance } from './focusBalance';

// ── Combat FOCUS sim-gate ────────────────────────────────────────────────────
// The rebuild must hold: Adaptive (reading + occasional focus) TOPS; focus-spam
// (FocusLover/HeavySpam/FeintSpam/HideSpam) sits BELOW balanced play; the three
// releases are used ~equally (no dominant release); single-step spam (FluidSpam)
// still loses (base triangle preserved). FOCUS_COST is the master lever.

describe('FOCUS balance — the rebuild has no dominant strategy', () => {
  test('reading tops; focus-spam below balanced; releases used ~equally; spam loses', () => {
    const r = runFocusBalance('SPROUTLE', 400, 1);
    const rows = Object.entries(r.winPct).sort((a, b) => b[1] - a[1]);
    const compVals = Object.entries(r.winPct).filter(([n]) => n !== 'FluidSpam').map(([, w]) => w);
    const compSpread = Math.max(...compVals) - Math.min(...compVals);
    console.log(
      '\n── FOCUS BALANCE (SPROUTLE mirror, round-robin, n=400/pair) ──\n' +
        rows.map(([n, w]) => `  ${n.padEnd(13)} ${w.toFixed(1)}%`).join('\n') +
        `\n  full spread ${r.spreadPp.toFixed(1)}pp · competitive (excl. FluidSpam) ${compSpread.toFixed(1)}pp` +
        `\n  top ${r.top} · bottom ${r.bottom}\n` +
        '── ACTION USAGE ──\n' +
        (['A', 'F', 'G', 'heavy', 'feint', 'hide'] as const)
          .map((k) => `  ${k.padEnd(6)} ${r.usagePct[k].toFixed(1)}%`)
          .join('\n') +
        '\n',
    );

    const { winPct } = r;
    const focusSpam = [winPct.FocusLover!, winPct.HeavySpam!, winPct.FeintSpam!, winPct.HideSpam!];

    // Every release is used, and the three are roughly equal (no dominant release).
    for (const k of ['heavy', 'feint', 'hide'] as const) expect(r.usagePct[k]).toBeGreaterThan(3);
    const rel = [r.usagePct.heavy, r.usagePct.feint, r.usagePct.hide];
    expect(Math.max(...rel) - Math.min(...rel)).toBeLessThan(6); // ~equal
    // Focus-spam sits BELOW balanced/adaptive play.
    for (const s of focusSpam) {
      expect(winPct.BaseBalanced!).toBeGreaterThan(s);
      expect(winPct.Adaptive!).toBeGreaterThan(s);
    }
    // Predictable single-stance spam still loses hardest.
    expect(winPct.FluidSpam!).toBeLessThan(winPct.BaseBalanced!);
    for (const s of focusSpam) expect(s).toBeGreaterThan(winPct.FluidSpam!);
    // Balanced/adaptive reading tops the table.
    const top2 = Object.entries(winPct).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([n]) => n);
    expect(top2).toContain('BaseBalanced');
    expect(top2).toContain('Adaptive');
  });
});
