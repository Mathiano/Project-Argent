import { describe, expect, test } from 'vitest';
import { runRivalCardGate, runRivalCardSolo } from './rivalCard';

// ── KAMON Rival Card v2 — the TWO-MON STAGE-1 fairness GATE (docs/kamon-rival-
// card-v2). The fight is the Violet→Route 32 gate, AFTER ZEPHYR. The starter's
// first evolution now gates on HIVE/badge 2 (evolution.ts), so the developed
// player's lead is STILL STAGE 1 — "developed" = a fuller stage-1 bench, not
// bigger stats (bond is horizontal, there is no leveling). KAMON answers with a
// 2-mon card: a leading crudely-caught CHAFF + the stolen counter-starter ACE at
// the 0.85 hesitation.
//
// RE-BASELINED 2026-06-22 (kamon-2mon-stage1). Supersedes the prior evolved-lead
// re-tune: the card-shape fix (a 2nd KAMON mon + the badge-2 evo gate) is the
// proper fairness fix the earlier commit flagged as Mathias's call. KAMON_ACE_
// LEVEL returned toward its original early-route band (~0.9–1.0) once the chaff
// carries part of the threat. The fairness knobs are KAMON_ACE_LEVEL + KAMON_
// CHAFF_LEVEL (engine/rivalCard.ts); the 0.85 bond-factor + the kamon AI/profile
// are untouched.
describe('KAMON rival card — the two-mon stage-1 gate', () => {
  const rows = runRivalCardGate(2000, 1);

  test('reports (logged for the audit)', () => {
    for (const r of rows) {
      // eslint-disable-next-line no-console
      console.log(`  stage-1 team (pick ${r.pick.padEnd(9)}) vs KAMON chaff+${r.stolen.padEnd(9)} → ${r.playerWinPct.toFixed(1)}%`);
    }
    expect(rows.length).toBe(3);
  });

  test('every pick is WINNABLE-BUT-TENSE (~65–70%) for the stage-1 team', () => {
    for (const r of rows) {
      expect(r.playerWinPct).toBeGreaterThan(62);
      expect(r.playerWinPct).toBeLessThan(73);
    }
  });

  test('the three picks are TIGHT (within ~8pp)', () => {
    const w = rows.map((r) => r.playerWinPct);
    expect(Math.max(...w) - Math.min(...w)).toBeLessThan(8);
  });
});

// Reference DIAGNOSTIC (not a gate) — the SOLO 1v1 (stage-1 starter vs the ace
// alone, no chaff, no bench). Logged as a contrast to the bare duel: the gate
// adds KAMON's chaff AND the player's common, so the win% shifts per pick.
describe('KAMON rival card — solo 1v1 reference (diagnostic, NOT a gate)', () => {
  test('reports (logged)', () => {
    for (const r of runRivalCardSolo(2000, 1)) {
      // eslint-disable-next-line no-console
      console.log(`  solo starter (pick ${r.pick.padEnd(9)}) vs KAMON ${r.stolen.padEnd(9)} → ${r.playerWinPct.toFixed(1)}%`);
    }
    expect(true).toBe(true);
  });
});
