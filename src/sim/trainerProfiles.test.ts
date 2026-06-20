import { describe, expect, test } from 'vitest';
import { runTrainerProfiles } from './trainerProfiles';

// ── Trainer-profile sim-gate (Combat Layer 4 — Stage 1) ──────────────────────
// Each profiled trainer (the foe) vs a competent READING player, SPROUTLE
// mirror, n=800 seed=7 (deterministic). The gate: each profile is a FAIR fight
// (competitive band, not unbeatable nor trivially exploitable) and the profiles
// are measurably DISTINCT (stance leans differ; only the Charger Focuses).

describe('trainer profiles — fair-but-distinct (Stage 1)', () => {
  const rows = runTrainerProfiles('reading', 'SPROUTLE', 800, 7);
  const by = Object.fromEntries(rows.map((r) => [r.id, r]));
  const youngster = by.youngster!;
  const jay = by.jay!;
  const lass = by.lass!;

  test('reports (logged for the audit)', () => {
    for (const r of rows) {
      const u = r.usagePct;
      // eslint-disable-next-line no-console
      console.log(
        `  ${r.id.padEnd(10)} foeWin ${r.foeWinPct.toFixed(1)}% | A${u.A.toFixed(0)} G${u.G.toFixed(0)} F${u.F.toFixed(0)} | focus${u.focus.toFixed(0)} | relH${u.heavy.toFixed(0)} | other${u.other.toFixed(0)}`,
      );
    }
    expect(rows.length).toBe(3);
  });

  test('every profile is a FAIR fight vs a reading player (not 90%+, not sub-20%)', () => {
    for (const r of rows) {
      expect(r.foeWinPct).toBeGreaterThan(20);
      expect(r.foeWinPct).toBeLessThan(75);
    }
  });

  test('YOUNGSTER is the balanced teaching baseline — even stances, never Focuses', () => {
    const u = youngster.usagePct;
    expect(u.focus).toBe(0); // single-only
    expect(u.heavy + u.feint + u.hide).toBe(0); // never releases
    // Even mix: no stance dominates (all three within ~6pp of each other).
    const max = Math.max(u.A, u.G, u.F);
    const min = Math.min(u.A, u.G, u.F);
    expect(max - min).toBeLessThan(8);
  });

  test('JAY is the Aggressor Charger — leans Aggressive, FOCUSES into HEAVY (sensibly)', () => {
    const u = jay.usagePct;
    expect(u.A).toBeGreaterThan(u.G); // aggressor: Aggressive dominates
    expect(u.A).toBeGreaterThan(u.F);
    expect(u.focus).toBeGreaterThan(8); // actually two-steps
    expect(u.focus).toBeLessThan(32); // Occasional — not a focus-spammer
    expect(u.heavy).toBeGreaterThan(5); // his focus releases HEAVY
    expect(u.feint + u.hide).toBe(0); // signature HEAVY only
  });

  test('LASS is the Bulwark — Guard-heavy wall, never Focuses', () => {
    const u = lass.usagePct;
    expect(u.G).toBeGreaterThan(u.A); // bulwark: Guard dominates
    expect(u.G).toBeGreaterThan(u.F);
    expect(u.G).toBeGreaterThan(40);
    expect(u.focus).toBe(0); // single-only
  });

  test('the three profiles are measurably DISTINCT from each other', () => {
    // Aggressor plays more Aggressive than the Bulwark; Bulwark guards more
    // than the Balanced baseline; only the Charger Focuses.
    expect(jay.usagePct.A).toBeGreaterThan(lass.usagePct.A + 5);
    expect(lass.usagePct.G).toBeGreaterThan(youngster.usagePct.G + 5);
    expect(jay.usagePct.focus).toBeGreaterThan(youngster.usagePct.focus);
    expect(jay.usagePct.focus).toBeGreaterThan(lass.usagePct.focus);
  });
});
