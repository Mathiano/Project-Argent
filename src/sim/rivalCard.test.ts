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

  // ── RE-PINNED 2026-07-03 (content era — the gate SHIPPED as npc_kamon_gate,
  // main.ts's showKamonGate, the map-placeable Route 32 gate). The card's combat
  // numbers + KAMON's AI are UNCHANGED — this is a BAND tightening now that the
  // fight is real content, not the earlier PROVISIONAL loosening. Observed (n=2000,
  // seed 1): KINDRAKE 71.6 / GRUBLEAF 82.0 / SILTSKIP 88.1 — spread 16.5pp. Every
  // pick a comfortable-but-real win (the >62 fairness FLOOR HOLDS — no starter is a
  // trap), the ceiling + spread now pinned TIGHT to observed ± a sane margin:
  //   floor  >62   (HELD — the fairness floor / Decision 2: no trap pick)
  //   ceiling <90  (was <92 provisional → observed max 88.1 + ~2pp margin)
  //   spread  <18  (was <20 provisional → observed 16.5 + ~1.5pp margin)
  // Still PROVISIONAL only in that KAMON's card gains mons in later chapters (a
  // future re-baseline); for the CH1 shipped gate these bands are the pin.
  test('every pick is WINNABLE (>62 floor HELD; ceiling re-pinned tight <90)', () => {
    for (const r of rows) {
      expect(r.playerWinPct).toBeGreaterThan(62); // no starter is a trap (the fairness floor)
      expect(r.playerWinPct).toBeLessThan(90); // re-pinned tight (observed max 88.1 + margin)
    }
  });

  test('the three picks are within a TIGHT spread (<18pp — observed 16.5 + margin)', () => {
    const w = rows.map((r) => r.playerWinPct);
    expect(Math.max(...w) - Math.min(...w)).toBeLessThan(18);
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
