import { describe, expect, test } from 'vitest';
import { SPECIES } from '../engine';
import { bondStage, bondStageName } from './catching';
import { bondAfterFight, powerIndex } from './bond';
import type { FightKind } from './bond';

// ── ANTI-GRIND + RENEWABLE proofs (bond-core sim-gate) ───────────────────
// These sim the GROWTH MECHANIC directly (challenge → xp → value). They are
// the firewall + renewable evidence the kickoff asks for, and print the
// curve so the numbers are on record. (Game-layer pure functions, so this
// lives under src/game — the ≤3% ladder gate that needs the engine/bots
// lives in src/sim/bondLadder.test.ts.)

const PAR = powerIndex(SPECIES.SPROUTLE!); // a representative even mon

interface Fight {
  readonly monPower: number;
  readonly foePower: number;
  readonly kind: FightKind;
  readonly hpFracRemaining: number;
}

// Run a sequence of fights from a starting bond, sampling the curve.
function runCurve(start: number, fights: readonly Fight[]): { value: number; trace: string[] } {
  let value = start;
  const trace: string[] = [`  fight  0: ${fmt(value)}`];
  fights.forEach((f, i) => {
    value = bondAfterFight(value, f);
    trace.push(`  fight ${String(i + 1).padStart(2)}: ${fmt(value)}`);
  });
  return { value, trace };
}
function fmt(v: number): string {
  return `bond ${v.toFixed(1).padStart(5)}  stage ${bondStage(v)} (${bondStageName(v)})`;
}

describe('anti-grind firewall — farming weak foes vs quality play', () => {
  test('farming weak/under-leveled wilds yields NEAR-ZERO; quality play progresses', () => {
    // A trivial wild, repeated 30×: foe is 40% of the mon's power.
    const farming: Fight[] = Array.from({ length: 30 }, () => ({
      monPower: PAR,
      foePower: PAR * 0.4,
      kind: 'wild' as const,
      hpFracRemaining: 1,
    }));
    // Quality play: near-level trainers + near-level wilds, alternating.
    const quality: Fight[] = Array.from({ length: 12 }, (_, i) => ({
      monPower: PAR,
      foePower: PAR * (i % 2 === 0 ? 1.0 : 0.95),
      kind: (i % 2 === 0 ? 'trainer' : 'wild') as FightKind,
      hpFracRemaining: 0.55,
    }));

    const farm = runCurve(10, farming);
    const qual = runCurve(10, quality);

    console.log(
      '\n── ANTI-GRIND: farming 30 weak wilds (foe = 0.4× mon power) ──\n' +
        `  start: ${fmt(10)}\n  end:   ${fmt(farm.value)}   ← flat: the firewall holds\n` +
        '\n── QUALITY: 12 near-level fights (trainers + wilds) ──\n' +
        qual.trace.filter((_, i) => i % 2 === 0).join('\n') +
        '\n',
    );

    // Firewall: 30 farmed stomps do not move bond at all.
    expect(farm.value).toBe(10);
    // Quality play climbs several stages over a campaign-ish stretch.
    expect(bondStage(qual.value)).toBeGreaterThanOrEqual(4);
  });
});

describe('renewable fuel — a fresh under-powered mon can still bond', () => {
  test('a weak/late mon earns meaningful bond from parity opposition', () => {
    const weakMon = Math.round(PAR * 0.5); // an early-stage / under-powered mon
    // It fights opposition near ITS OWN power — real challenges for IT.
    const fights: Fight[] = Array.from({ length: 8 }, () => ({
      monPower: weakMon,
      foePower: weakMon,
      kind: 'trainer' as const,
      hpFracRemaining: 0.5,
    }));
    const { value, trace } = runCurve(5, fights); // freshly caught at 5

    console.log(
      '\n── RENEWABLE: a fresh under-powered mon (0.5× power) vs parity foes ──\n' +
        trace.join('\n') +
        '\n  → bond fuel is renewable: appropriate opposition is always available.\n',
    );

    expect(value).toBeGreaterThan(5 + 15); // it genuinely climbs from fresh
    expect(bondStage(value)).toBeGreaterThanOrEqual(3);
    // And it would NOT have climbed by farming trivia: same mon, weak foes.
    const farmed = runCurve(5, fights.map((f) => ({ ...f, foePower: weakMon * 0.4 })));
    expect(farmed.value).toBe(5);
  });
});
