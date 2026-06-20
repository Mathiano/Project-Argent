import { describe, expect, test } from 'vitest';
import { runTrainerProfiles } from './trainerProfiles';
import { TRAINER_PROFILES } from '../engine';
import type { TrainerProfile } from '../engine';

// ── Trainer-profile sim-gate (Combat Layer 4 — Stage 1) ──────────────────────
// Each profiled trainer (the foe) vs a competent READING player, SPROUTLE
// mirror, n=800 seed=7 (deterministic). The gate: each profile is a FAIR fight
// (competitive band, not unbeatable nor trivially exploitable) and the profiles
// are measurably DISTINCT (stance leans differ; only the Charger Focuses).

describe('trainer profiles — fair-but-distinct (Stage 1)', () => {
  // Pinned to the original three (the registry now also holds the CH1 floor
  // stamps, gated in their own block below).
  const stage1 = {
    youngster: TRAINER_PROFILES.youngster!,
    jay: TRAINER_PROFILES.jay!,
    lass: TRAINER_PROFILES.lass!,
  };
  const rows = runTrainerProfiles('reading', 'SPROUTLE', 800, 7, stage1);
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

// ── New-knob representative gate (KICKOFF-trainer-archetype-engine.md §4) ─────
// A representative profile per policy-affecting new knob, gated fair-but-distinct
// vs the same yardstick. (infoLevel is presentation-only → no policy effect, so
// it isn't a sim variable; it's covered by the battle-scene tell tests.) These
// are TEST FIXTURES, not shipped trainer data.
describe('new-knob profiles — fair-but-distinct (release variability + stamina-aware)', () => {
  const reps: { readonly [id: string]: TrainerProfile } = {
    // Variable Charger (the Gym-2+ pivot): signature HEAVY, mixes FEINT. Also a
    // heavy-charger that gets winded → exercises stamina-aware banking.
    charger_var: {
      name: 'CHARGER',
      stance: 'aggressor',
      twoStep: 'signature',
      release: { feintRate: 0.35, signature: 'heavy' },
      infoLevel: 'veiled',
    },
    // Control: same Charger but FIXED-Heavy — isolates the variability knob.
    charger_fixed: {
      name: 'CHARGER-FIX',
      stance: 'aggressor',
      twoStep: 'signature',
      release: 'fixed-Heavy',
      infoLevel: 'veiled',
    },
  };
  const rows = runTrainerProfiles('reading', 'SPROUTLE', 800, 7, reps);
  const varc = rows.find((r) => r.id === 'charger_var')!;
  const fixc = rows.find((r) => r.id === 'charger_fixed')!;

  test('reports (logged for the audit)', () => {
    for (const r of rows) {
      const u = r.usagePct;
      // eslint-disable-next-line no-console
      console.log(
        `  ${r.id.padEnd(13)} foeWin ${r.foeWinPct.toFixed(1)}% | A${u.A.toFixed(0)} G${u.G.toFixed(0)} F${u.F.toFixed(0)} | focus${u.focus.toFixed(0)} | relH${u.heavy.toFixed(0)} relFe${u.feint.toFixed(0)} | other${u.other.toFixed(0)}`,
      );
    }
    expect(rows.length).toBe(2);
  });

  test('both are FAIR fights vs a reading player', () => {
    expect(varc.foeWinPct).toBeGreaterThan(20);
    expect(varc.foeWinPct).toBeLessThan(80);
    expect(fixc.foeWinPct).toBeGreaterThan(20);
    expect(fixc.foeWinPct).toBeLessThan(80);
  });

  test('the variability knob WORKS: variable mixes FEINT, fixed never does', () => {
    expect(varc.usagePct.heavy).toBeGreaterThan(3); // still mostly HEAVY
    expect(varc.usagePct.feint).toBeGreaterThan(3); // but FEINT is mixed in
    expect(fixc.usagePct.feint).toBe(0); // fixed-Heavy never feints
  });

  test('mixing FEINT does not break balance (variable is not wildly easier/harder)', () => {
    expect(Math.abs(varc.foeWinPct - fixc.foeWinPct)).toBeLessThan(25);
  });
});

// ── CH1 generic floor roster (docs/trainer-sets-ch1.md) ──────────────────────
// The three floor stamps used across Route 31 / Violet / gym chaff, gated vs the
// same reader. Fair AND floor-appropriate (in line with the existing floor
// cells ~38–58% foeWin), and the profiles READ distinctly.
describe('CH1 floor roster — fair-but-distinct (GREENHORN / BRUISER / SKIRMISHER)', () => {
  const reps: { readonly [id: string]: TrainerProfile } = {
    greenhorn: TRAINER_PROFILES.youngster!, // GREENHORN reuses the youngster profile
    bruiser: TRAINER_PROFILES.bruiser!,
    skirmisher: TRAINER_PROFILES.skirmisher!,
  };
  const rows = runTrainerProfiles('reading', 'SPROUTLE', 800, 7, reps);
  const by = Object.fromEntries(rows.map((r) => [r.id, r]));
  const greenhorn = by.greenhorn!;
  const bruiser = by.bruiser!;
  const skirmisher = by.skirmisher!;

  test('reports (logged for the audit)', () => {
    for (const r of rows) {
      const u = r.usagePct;
      // eslint-disable-next-line no-console
      console.log(
        `  ${r.id.padEnd(11)} foeWin ${r.foeWinPct.toFixed(1)}% | A${u.A.toFixed(0)} G${u.G.toFixed(0)} F${u.F.toFixed(0)} | focus${u.focus.toFixed(0)} | other${u.other.toFixed(0)}`,
      );
    }
    expect(rows.length).toBe(3);
  });

  test('every floor stamp is a FAIR, floor-appropriate fight vs the reader', () => {
    // The floor SPREADS by readability vs a strict counter-reader (not a single
    // number): Bulwark walls the reader (~58), Balanced is mid (~39), the pure
    // Aggressor is the reader's prey (~18 — the triangle's "bait the commit with
    // Guard" lesson made literal, same principle as FluidSpam flooring ~20 in
    // the stance gate). All BEATABLE, none unbeatable; vs a human (imperfect
    // counter-reader) the Aggressor is a fair pressure fight.
    for (const r of rows) {
      expect(r.foeWinPct).toBeGreaterThan(12);
      expect(r.foeWinPct).toBeLessThan(75);
      expect(r.usagePct.focus).toBe(0); // Single-only floor — never two-steps
    }
  });

  test('the three read DISTINCTLY (Bruiser=Aggressive, Skirmisher=Fluid, Greenhorn=balanced)', () => {
    expect(bruiser.usagePct.A).toBeGreaterThan(skirmisher.usagePct.A + 5); // Aggressor
    expect(skirmisher.usagePct.F).toBeGreaterThan(bruiser.usagePct.F + 5); // Evader
    // Greenhorn: no stance dominates.
    const g = greenhorn.usagePct;
    expect(Math.max(g.A, g.G, g.F) - Math.min(g.A, g.G, g.F)).toBeLessThan(8);
  });
});
