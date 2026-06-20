import { describe, expect, test } from 'vitest';
import { SPECIES } from '../engine';
import { bondStage, bondStageName } from './catching';
import { bondAfterFight, powerIndex } from './bond';
import type { FightKind } from './bond';

// ── BOND PACING + sim-gate proofs (re-verified after the 2026-06-18 tune) ──
// The growth mechanic (challenge → xp → value) is tuned to LOOSELY track gym
// progression for a devoted core companion. These sim it directly and print
// the curve so the pacing is on record. (Game-layer pure functions, so this
// lives under src/game — the ≤3% ladder gate that needs the engine/bots
// lives in src/sim/bondLadder.test.ts.)

const PAR = powerIndex(SPECIES.SPROUTLE!); // a representative even mon

interface Fight {
  readonly monPower: number;
  readonly foePower: number;
  readonly kind: FightKind;
  readonly hpFracRemaining: number;
}

// One "real fight" on a devoted-starter stream: alternate a parity trainer
// (the weighted core-loop fight) and a near-power wild. Both are challenge-
// positive — the unit the pacing is measured in. (Trivia gives 0 and is
// excluded by definition; the firewall test below proves that.)
function realFight(i: number): Fight {
  const trainer = i % 2 === 0;
  return {
    monPower: PAR,
    foePower: PAR * (trainer ? 1.0 : 0.95),
    kind: trainer ? 'trainer' : 'wild',
    hpFracRemaining: 0.5, // no clutch — a clean tuning anchor
  };
}

function fmt(v: number): string {
  return `bond ${v.toFixed(1).padStart(5)}  stage ${bondStage(v)} (${bondStageName(v)})`;
}

describe('devoted-starter pacing — bond loosely tracks gym progression', () => {
  test('stage at 10 / 30 / 50 / 80 / 100 cumulative real fights tracks the target', () => {
    const MILESTONES = [10, 30, 50, 80, 100];
    const gymHint: { [n: number]: string } = {
      10: 'gym ~1-2 → stage 1-2',
      30: 'gym ~3-4 → stage 3-4',
      50: 'gym ~5-6 → stage 5',
      80: 'gym ~7-8 → stage 6-7',
      100: 'E4/postgame → stage 7-8 (true max via Arena, aspirational)',
    };
    const rows: string[] = [];
    const stageAt: { [n: number]: number } = {};
    let value = 10; // a devoted starter begins a little warm
    let next = 0;
    for (let n = 1; n <= 100; n += 1) {
      value = bondAfterFight(value, realFight(n - 1));
      if (MILESTONES.includes(n)) {
        stageAt[n] = bondStage(value);
        rows.push(`  ${String(n).padStart(3)} fights: ${fmt(value)}   ${gymHint[n]}`);
      }
      void next;
    }
    console.log('\n── DEVOTED-STARTER PACING (start bond 10, real fights only) ──\n' + rows.join('\n') + '\n');

    // Loosely track the milestones (ranges — bond is earned, not gym-locked).
    expect(stageAt[10]!).toBeGreaterThanOrEqual(1);
    expect(stageAt[10]!).toBeLessThanOrEqual(2);
    expect(stageAt[30]!).toBeGreaterThanOrEqual(3);
    expect(stageAt[30]!).toBeLessThanOrEqual(4);
    expect(stageAt[50]!).toBeGreaterThanOrEqual(4);
    expect(stageAt[50]!).toBeLessThanOrEqual(5);
    expect(stageAt[80]!).toBeGreaterThanOrEqual(5);
    expect(stageAt[80]!).toBeLessThanOrEqual(6);
    expect(stageAt[100]!).toBeGreaterThanOrEqual(6);
    // …and NOT maxed early: a starter is near-max, not Inseparable, by ~100.
    expect(stageAt[80]!).toBeLessThan(7);
  });
});

describe('early-perceptibility — a new mon FEELS early progress', () => {
  test('value visibly moves within 1 fight; a devoted starter leaves Wary within a few', () => {
    // Perceptible immediately — even a freshly-caught mon's value moves on
    // its first real win (the meter pips shift before the stage name does).
    const after1 = bondAfterFight(5, realFight(0)); // freshly caught at 5
    expect(after1).toBeGreaterThan(5 + 1);

    // The brief's subject — a devoted starter (begins a little warm at 10) —
    // crosses out of Wary within a few real fights, so early progress FEELS
    // earned, not a slog.
    let value = 10;
    let fightsToWarming = 0;
    for (let n = 0; n < 20 && bondStage(value) < 2; n += 1) {
      value = bondAfterFight(value, realFight(n));
      fightsToWarming = n + 1;
    }
    expect(bondStage(value)).toBe(2);
    expect(fightsToWarming).toBeLessThanOrEqual(4);
  });
});

describe('anti-grind firewall — STILL holds at the new pace', () => {
  test('farming weak/under-leveled wilds (≤0.7× power) stays exactly flat', () => {
    let bond = 10;
    for (let i = 0; i < 50; i += 1) {
      bond = bondAfterFight(bond, {
        monPower: PAR,
        foePower: PAR * 0.4, // trivial for this mon
        kind: 'wild',
        hpFracRemaining: 1,
      });
    }
    console.log(`\n── ANTI-GRIND: 50 farmed weak wilds → ${fmt(bond)} (flat: firewall holds)\n`);
    expect(bond).toBe(10);
  });
});

describe('renewable fuel — STILL holds (at the new, slower rate)', () => {
  test('a fresh under-powered mon climbs from parity opposition', () => {
    const weakMon = Math.round(PAR * 0.5); // an early-stage / under-powered mon
    const fights: Fight[] = Array.from({ length: 20 }, () => ({
      monPower: weakMon,
      foePower: weakMon, // appropriate opposition (parity for the weak mon)
      kind: 'trainer' as const,
      hpFracRemaining: 0.5,
    }));
    let value = 5; // freshly caught
    const trace: string[] = [`  fight  0: ${fmt(value)}`];
    fights.forEach((f, i) => {
      value = bondAfterFight(value, f);
      if ((i + 1) % 5 === 0) trace.push(`  fight ${String(i + 1).padStart(2)}: ${fmt(value)}`);
    });
    console.log(
      '\n── RENEWABLE: a fresh under-powered mon (0.5× power) vs parity foes ──\n' +
        trace.join('\n') +
        '\n  → still climbs, just at the stretched campaign rate.\n',
    );
    expect(bondStage(value)).toBeGreaterThanOrEqual(3); // it genuinely climbs over time
    // …and it would NOT have climbed by farming trivia (same mon, weak foes).
    let farmed = 5;
    for (const f of fights) farmed = bondAfterFight(farmed, { ...f, foePower: weakMon * 0.4 });
    expect(farmed).toBe(5);
  });
});

describe('goal check — the gym gauntlet brings a devoted starter into Warming', () => {
  // Real CH1 powers (stat-sums, verified from docs/ch1-batch.json):
  //   KINDRAKE starter 330 · FLITPECK 286 · GALEHAWK 354.
  //   (KINDRAKE 326→330 in the starter-trio rebalance — shared budget 330.)
  // The Violet gym is now a gauntlet: the existing talk-trainer + three
  // line-of-sight trainers + Falkner. We sim a devoted starter (bond 10)
  // fighting all five, PESSIMISTICALLY (every fight a near-untouched sweep,
  // strain 0.6 — the lowest bond payoff) to prove the floor: even then it
  // crosses into stage 2 (Warming), which arms the Tier-I jumpstart. Real
  // play (pressured multi-mon fights + route trainers/wilds) lands higher.
  const KINDRAKE = 330;
  const FLITPECK = 286;
  const GALEHAWK = 354;
  // Each gym fight: foePower = toughest mon faced. hpFrac 0.95 → strain 0.6.
  const gauntlet: Fight[] = [
    { monPower: KINDRAKE, foePower: FLITPECK, kind: 'trainer', hpFracRemaining: 0.95 }, // existing [FLITPECK,FLITPECK]
    { monPower: KINDRAKE, foePower: GALEHAWK, kind: 'trainer', hpFracRemaining: 0.95 }, // T2 [FLITPECK,GALEHAWK]
    { monPower: KINDRAKE, foePower: GALEHAWK, kind: 'trainer', hpFracRemaining: 0.95 }, // T3 [GALEHAWK]
    { monPower: KINDRAKE, foePower: GALEHAWK, kind: 'trainer', hpFracRemaining: 0.95 }, // T4 [GALEHAWK,FLITPECK]
    { monPower: KINDRAKE, foePower: GALEHAWK, kind: 'boss', hpFracRemaining: 0.95 }, // Falkner
  ];

  test('a devoted starter reaches stage 2 (Warming) on the gym gauntlet alone (worst-case strain)', () => {
    let bond = 10; // a devoted starter's opening bond
    const trace: string[] = [`  start:    ${fmt(bond)}`];
    const labels = ['gym trainer', 'BIRDKEEPER', 'FLEDGLING', 'ACE', 'FALKNER'];
    gauntlet.forEach((f, i) => {
      bond = bondAfterFight(bond, f);
      trace.push(`  +${labels[i]!.padEnd(11)} ${fmt(bond)}`);
    });
    console.log('\n── GOAL CHECK: gym gauntlet → devoted starter bond (worst-case sweeps) ──\n' + trace.join('\n') + '\n');
    expect(bondStage(bond)).toBeGreaterThanOrEqual(2); // crosses into Warming → jumpstart arms
    // Every gym fight is challenge-positive (no trivial zero in the chain).
    for (const f of gauntlet) {
      expect(bondAfterFight(10, f)).toBeGreaterThan(10);
    }
  });
});
