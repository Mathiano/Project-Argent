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

  // Spine-1 re-baseline (2026-06-30, phased-unlock): the ★-ramp shifted the
  // stage-1 picks up a touch (70.5 / 70.8 / 76.3) — the player's read-driven ★
  // snowball vs the weak fixed-aggressor rival. Still winnable-but-tense and
  // TIGHT (spread 5.8pp < 8, below); upper band 73 → 78 for the shift.
  // ── INTENTIONAL RE-BASELINE (2026-07-03, tuning pass #5 + per-mon stamina) —
  // PROVISIONAL, pending KAMON's full multi-mon card ─────────────────────────
  // Un-quarantined at pass #5. Two shifts settled the rival fight: (1) tuning-pass
  // #5's self-escalation DR neutralised the TIDE-MEND heal-turtle that KAMON's AQUA
  // mons had been abusing through the trainer AI (the original quarantine root),
  // and (2) per-mon stamina equalised the three STARTER lines to 108 while KAMON's
  // stolen counter-starters kept their own values. Net: the three picks now land
  // KINDRAKE 71.6 / GRUBLEAF 82.0 / SILTSKIP 88.1 — every pick a comfortable win
  // (no starter is a TRAP; the >62 floor holds), but the CEILING is high (2 picks
  // > 78) and the SPREAD is ~16.5pp. Per the ruling (Decision 2): starters needn't
  // win identically vs the rival, and KAMON's card is a STUB (he gains mons in
  // later chapters), so we do NOT over-engineer a tightening tune now. The bands
  // are LOOSENED to accept the current shape (floor held; ceiling + spread widened),
  // flagged PROVISIONAL — they re-tighten when KAMON's real multi-mon card lands.
  test('every pick is WINNABLE (>62 floor; loosened ceiling — provisional, KAMON is a stub)', () => {
    for (const r of rows) {
      expect(r.playerWinPct).toBeGreaterThan(62); // no starter is a trap (the fairness floor)
      expect(r.playerWinPct).toBeLessThan(92); // provisional ceiling — re-tightens with KAMON's full card
    }
  });

  test('the three picks are within a provisional spread (~16pp — re-tightens with KAMON’s full card)', () => {
    const w = rows.map((r) => r.playerWinPct);
    expect(Math.max(...w) - Math.min(...w)).toBeLessThan(20);
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
