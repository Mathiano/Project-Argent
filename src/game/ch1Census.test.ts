// The census is a MEASUREMENT instrument, so these tests guard the instrument,
// not the numbers: that it still sees every fight the maps ship, that its
// team-size control is actually applied, and that it never silently publishes a
// figure it could not measure.
//
// It deliberately does NOT pin win rates. No ladder band reads these numbers, and
// pinning them would turn a content edit into a false regression.

import { describe, expect, it } from 'vitest';
import ch1BatchData from '../../docs/ch1-batch.json';
import { loadDex } from '../engine';
import type { DexEntryJson } from '../engine';
import { ch1Census, ch1Fights, ch1Zones, simulateFight } from './ch1Census';

const DEX = loadDex(ch1BatchData as DexEntryJson[], 13);
const FIGHTS = ch1Fights();

describe('the census sees the shipped content', () => {
  it('finds every trainer fight CH1 ships', () => {
    expect(new Set(FIGHTS.map((f) => f.flag))).toEqual(
      new Set([
        'route31_youngster_beaten',
        'route31_camper_beaten',
        'route31_birdkeeper_beaten',
        'route31_youngster2_beaten',
        'route31_lass_beaten',
        'route31_trainer_beaten',
        'violet_schoolkid_beaten',
        'gym_trainer_beaten',
        'gym_trainer_2_beaten',
        'gym_trainer_3_beaten',
        'gym_trainer_4_beaten',
      ]),
    );
  });

  it('every CH1 fight is PROFILED, so every one can be measured', () => {
    // An unprofiled trainer runs main.ts's wildFoeAI, which is game-layer and not
    // engine-public — the census marks such a fight unmeasured rather than
    // substituting a different bot. If this ever fails, the census silently got
    // less complete.
    const unprofiled = FIGHTS.filter((f) => f.profileName === null).map((f) => f.flag);
    expect(unprofiled).toEqual([]);
  });

  it('carries the ground each fight is fought on', () => {
    for (const f of FIGHTS.filter((x) => x.map === 'ROUTE 31')) {
      expect(f.environment, f.flag).toBe('forest');
    }
    for (const f of FIGHTS.filter((x) => x.map === 'GYM')) {
      expect(f.environment, f.flag).toBeUndefined(); // the gym stays neutral
    }
  });

  it('reads avoidability off the sight-lines, not a hand-kept list', () => {
    const byFlag = new Map(FIGHTS.map((f) => [f.flag, f]));
    // The scout-report economy hangs its deepest tell on the one gym trainer who
    // can be walked past; the other three drag you in.
    expect(byFlag.get('gym_trainer_beaten')!.avoidable).toBe(true);
    expect(byFlag.get('gym_trainer_2_beaten')!.avoidable).toBe(false);
    expect(byFlag.get('gym_trainer_4_beaten')!.avoidable).toBe(false);
  });

  it('finds the wild encounter zones with their rates', () => {
    const zones = ch1Zones();
    expect(zones.length).toBeGreaterThan(0);
    for (const z of zones) {
      expect(z.rate, `${z.map} rate`).toBeGreaterThan(0);
      expect(z.rate, `${z.map} rate`).toBeLessThanOrEqual(1);
      expect(z.species.length, `${z.map} species`).toBeGreaterThan(0);
      expect(z.tiles, `${z.map} area`).toBeGreaterThan(0);
    }
  });
});

describe('the instrument itself', () => {
  it('mirrors the trainer team size — without it a 2-mon trainer reads as a spike', () => {
    // Measured: Route 31's PAX (2 mons) came out at 9% against a solo player and
    // 99% once the sides were matched, while his 1-mon neighbours sat at 69-100%.
    // The 9% was the harness, not the fight.
    const pax = FIGHTS.find((f) => f.flag === 'route31_youngster2_beaten')!;
    expect(pax.foeSpecies.length).toBe(2);
    const m = simulateFight(pax, DEX.GRUBLEAF!, 40, 1)!;
    expect(m).not.toBeNull();
    expect(m.winPct).toBeGreaterThan(50); // nowhere near the un-controlled 9%
  });

  it('produces sane, deterministic metrics', () => {
    const solo = FIGHTS.find((f) => f.foeSpecies.length === 1)!;
    const a = simulateFight(solo, DEX.GRUBLEAF!, 40, 7)!;
    const b = simulateFight(solo, DEX.GRUBLEAF!, 40, 7)!;
    expect(a).toEqual(b); // seeded → reproducible
    expect(a.winPct).toBeGreaterThanOrEqual(0);
    expect(a.winPct).toBeLessThanOrEqual(100);
    expect(a.meanRounds).toBeGreaterThan(0);
    expect(a.meanStarsEarned).toBeGreaterThanOrEqual(0);
  });

  it('rolls up totals that match the rows', () => {
    const c = ch1Census({ n: 10, seed: 3, starter: 'GRUBLEAF' });
    expect(c.totals.fights).toBe(c.fights.length);
    expect(c.totals.profiledFights).toBe(c.metrics.length);
    expect(c.unmeasured).toEqual([]);
    expect(c.totals.money).toBe(c.fights.reduce((a, f) => a + f.reward, 0));
    expect(c.totals.avoidableFights).toBe(c.fights.filter((f) => f.avoidable).length);
  });

  it('rejects an unknown starter rather than measuring nothing', () => {
    expect(() => ch1Census({ n: 2, seed: 1, starter: 'NOT_A_MON' })).toThrow(/unknown starter/);
  });
});
