// Phase 6b GATE — evolution (bond-gated, boss-capped). Pins the two-gate
// rule (all four combinations), the CH1 data, the 8-badge uncap, the
// readiness line, the ask response, and the bond-stage mapping.

import { describe, expect, test } from 'vitest';
import { bondStage, bondStageName } from './catching';
import {
  CH1_EVOLUTIONS,
  askResponse,
  evolutionFor,
  evolutionReadiness,
  evolutionReady,
  gatesSatisfied,
} from './evolution';

// FLITPECK → GALEHAWK gates on bond stage 3 (Companions, 31–45) + the
// ZEPHYR badge (Gym 1) — the demo's catchable, evolvable exemplar.
const BOND_STAGE3 = 35; // → bond stage 3 (met)
const BOND_LOW = 10; // → bond stage 1 (not met)

describe('S1 — the two-gate rule (all four combinations)', () => {
  test('both gates met → evolves', () => {
    expect(evolutionReady({ speciesName: 'FLITPECK', bondValue: BOND_STAGE3, badges: ['ZEPHYR'] }))
      .toMatchObject({ evolvesTo: 'GALEHAWK' });
  });
  test('bond met but badge missing → does NOT evolve', () => {
    expect(evolutionReady({ speciesName: 'FLITPECK', bondValue: BOND_STAGE3, badges: [] })).toBeNull();
  });
  test('badge met but bond low → does NOT evolve', () => {
    expect(evolutionReady({ speciesName: 'FLITPECK', bondValue: BOND_LOW, badges: ['ZEPHYR'] })).toBeNull();
  });
  test('neither gate met → does NOT evolve', () => {
    expect(evolutionReady({ speciesName: 'FLITPECK', bondValue: BOND_LOW, badges: [] })).toBeNull();
  });
});

describe('S2 — CH1 evolution data (bond+badge, not levels)', () => {
  test('the CH1 lines are wired: starters, the route bird, the cave line', () => {
    expect(evolutionFor('FLITPECK')).toMatchObject({ evolvesTo: 'GALEHAWK', bondStage: 3, progressGate: 'ZEPHYR' });
    expect(evolutionFor('GRITHOAX')).toMatchObject({ evolvesTo: 'CAVELURE' });
    expect(evolutionFor('CAVELURE')).toMatchObject({ evolvesTo: 'CHASMTRAP' });
    expect(evolutionFor('KINDRAKE')).toMatchObject({ evolvesTo: 'KILNDRAKE' });
    expect(evolutionFor('GRUBLEAF')).toMatchObject({ evolvesTo: 'VINESNAP' });
    expect(evolutionFor('SILTSKIP')).toMatchObject({ evolvesTo: 'BRACKSLAP' });
  });
  test('STARTER first-evos gate on HIVE (badge 2), NOT ZEPHYR (badge 1)', () => {
    // The KAMON first-fight (Violet→Route 32) sits after ZEPHYR but before HIVE,
    // and is sim-gated on a still-stage-1 starter lead — so the starter must not
    // evolve until badge 2. Bond gate stays stage 3.
    for (const from of ['KINDRAKE', 'GRUBLEAF', 'SILTSKIP']) {
      expect(evolutionFor(from)).toMatchObject({ bondStage: 3, progressGate: 'HIVE' });
    }
    // Bond stage 3 + ZEPHYR alone (badge 1) is NOT enough now — needs HIVE.
    expect(evolutionReady({ speciesName: 'KINDRAKE', bondValue: BOND_STAGE3, badges: ['ZEPHYR'] })).toBeNull();
    // Bond stage 3 + HIVE evolves.
    expect(evolutionReady({ speciesName: 'KINDRAKE', bondValue: BOND_STAGE3, badges: ['ZEPHYR', 'HIVE'] }))
      .toMatchObject({ evolvesTo: 'KILNDRAKE' });
  });
  test('NON-starter CH1 lines keep their ZEPHYR (badge 1) gate', () => {
    // Only the starter brief moved; the route bird + cave line are untouched.
    expect(evolutionFor('FLITPECK')).toMatchObject({ progressGate: 'ZEPHYR' });
    expect(evolutionFor('GRITHOAX')).toMatchObject({ progressGate: 'ZEPHYR' });
  });
  test('single-stage / final forms have no evolution', () => {
    expect(evolutionFor('MARSHMASH')).toBeNull();
    expect(evolutionFor('GALEHAWK')).toBeNull();
    expect(evolutionFor('FORTDRAKE')).toBeNull();
  });
  test('every entry carries evolvesTo + bondStage + progressGate', () => {
    for (const e of CH1_EVOLUTIONS) {
      expect(typeof e.evolvesTo).toBe('string');
      expect(e.bondStage).toBeGreaterThanOrEqual(1);
      expect(e.bondStage).toBeLessThanOrEqual(7);
      // progressGate is a badge id or null (the uncap) — never undefined.
      expect(e.progressGate === null || typeof e.progressGate === 'string').toBe(true);
    }
  });
});

describe('S3 — the 8-badge uncap (null progressGate = bond-only)', () => {
  test('no CH1 evolution is gated beyond Gym 8 (only ZEPHYR/Gym1 or HIVE/Gym2)', () => {
    const validGates = new Set([null, 'ZEPHYR', 'HIVE']);
    for (const e of CH1_EVOLUTIONS) expect(validGates.has(e.progressGate)).toBe(true);
  });
  test('a null-progressGate entry evolves on bond ALONE (uncapped)', () => {
    const uncapped = { from: 'X', evolvesTo: 'Y', bondStage: 3, progressGate: null } as const;
    expect(gatesSatisfied(uncapped, BOND_STAGE3, [])).toBe(true); // no badge needed
    expect(gatesSatisfied(uncapped, BOND_LOW, [])).toBe(false); // bond still gates
  });
});

describe('S4 — legibility (readiness + ask)', () => {
  test('readiness: ready / waiting-on-badge / nothing', () => {
    expect(evolutionReadiness({ speciesName: 'FLITPECK', bondValue: BOND_STAGE3, badges: ['ZEPHYR'] })).toBe('Ready to evolve!');
    expect(evolutionReadiness({ speciesName: 'FLITPECK', bondValue: BOND_STAGE3, badges: [] })).toBe('Ready once you earn the next badge.');
    expect(evolutionReadiness({ speciesName: 'FLITPECK', bondValue: BOND_LOW, badges: ['ZEPHYR'] })).toBeNull();
    expect(evolutionReadiness({ speciesName: 'MARSHMASH', bondValue: 90, badges: ['ZEPHYR'] })).toBeNull(); // no evo
  });
  test('ask: bond-ready-but-badge-gated says it is waiting to see you prove yourself', () => {
    const r = askResponse({ speciesName: 'FLITPECK', bondValue: BOND_STAGE3, badges: [] });
    expect(r.toLowerCase()).toContain('prove yourself');
  });
  test('ask: high bond reads as full trust; low bond as still taking your measure', () => {
    expect(askResponse({ speciesName: 'MARSHMASH', bondValue: 90, badges: [] }).toLowerCase()).toContain('trusts you completely');
    expect(askResponse({ speciesName: 'MARSHMASH', bondValue: 5, badges: [] }).toLowerCase()).toContain('measure');
  });
});

describe('bond-stage display mapping (bond-track-v2)', () => {
  test('the hidden value maps to the 7 named stages', () => {
    expect(bondStage(5)).toBe(1);
    expect(bondStage(15)).toBe(1);
    expect(bondStage(16)).toBe(2);
    expect(bondStage(35)).toBe(3);
    expect(bondStage(100)).toBe(7);
    expect(bondStageName(5)).toBe('Wary');
    expect(bondStageName(35)).toBe('Companions');
    expect(bondStageName(100)).toBe('Inseparable');
  });
});
