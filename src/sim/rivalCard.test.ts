import { describe, expect, test } from 'vitest';
import { runRivalCard, runRivalCardPostFalkner } from './rivalCard';

// ── KAMON Rival Card v2 — POST-FALKNER fairness gate (docs/kamon-rival-card-v2)
// The fight is now the Violet→Route 32 gate, AFTER the ZEPHYR badge — which is
// also the badge that GATES the starter's evolution (evolution.ts: bond stage 3
// + ZEPHYR). So the EXPECTED developed team's lead is the STAGE-2 EVOLVED form.
// The GATE sims that: the evolved lead (the canonical `reader`) vs KAMON's solo
// stolen counter-starter at the 0.85 hesitation.
//
// RE-TUNED 2026-06-22 (kamon-first-fight integration). At the OLD early-route
// levels (~1.0) the post-Falkner fight was trivial — evolved win% 99.7 / 81.8 /
// 99.8 (two near auto-wins). KAMON_ACE_LEVEL was raised (engine/rivalCard.ts) so
// the evolved matchup is winnable-but-tense again: ~67%, tight.
describe('KAMON rival card — post-Falkner gate (the EVOLVED lead)', () => {
  const rows = runRivalCardPostFalkner(2000, 1);

  test('reports (logged for the audit)', () => {
    for (const r of rows) {
      // eslint-disable-next-line no-console
      console.log(`  evolved lead vs KAMON's ${r.stolen.padEnd(9)} (pick ${r.pick.padEnd(9)}) → ${r.playerWinPct.toFixed(1)}%`);
    }
    expect(rows.length).toBe(3);
  });

  test('every pick is WINNABLE-BUT-TENSE for the developed (evolved) team', () => {
    for (const r of rows) {
      expect(r.playerWinPct).toBeGreaterThan(55);
      expect(r.playerWinPct).toBeLessThan(80);
    }
  });

  test('the three picks are TIGHT (within ~8pp)', () => {
    const w = rows.map((r) => r.playerWinPct);
    expect(Math.max(...w) - Math.min(...w)).toBeLessThan(8);
  });
});

// Reference DIAGNOSTIC (not a gate) — the UNEVOLVED lead. ⚠️ Tuning the card for
// the expected (evolved) team makes an under-developed lead near-unwinnable for
// 2/3 picks (a solo stage-1 ace can't be fair for both leads — flagged in
// engine/rivalCard.ts). Logged so the consequence stays visible; the gate's
// BOTH-ADVANCE design (a loss still opens the exit, no soft-lock) is what keeps
// the under-developed player non-blocked. A fuller fix is a card-shape change.
describe('KAMON rival card — unevolved-lead reference (diagnostic, NOT a gate)', () => {
  test('reports (logged)', () => {
    for (const r of runRivalCard(2000, 1)) {
      // eslint-disable-next-line no-console
      console.log(`  unevolved lead vs KAMON's ${r.stolen.padEnd(9)} (pick ${r.pick.padEnd(9)}) → ${r.playerWinPct.toFixed(1)}%`);
    }
    expect(true).toBe(true);
  });
});
