import { describe, expect, test } from 'vitest';
import { runFalknerLadder } from './falknerLadder';

const SEED = 0x1f;
const N = 2000;
const BAND = 2.0; // ±2pp tolerance per the kickoff.

// Locked at gust=1.4 hp=1.15 — the best-fit lever combination found by
// runFalknerLadder.ts sweep. 4/15 cells land in the card's stated bands;
// GRUBLEAF (the "classic hard first gym" matchup per the card) is the
// drag on the rest. Widening the bands is a design call, not a lever —
// reported to design, no resolution invented here.
const LOCKED: ReadonlyArray<{
  player: string;
  archetype: string;
  expected: number; // winPct
}> = [
  { player: 'KINDRAKE', archetype: 'button-masher', expected: 48.5 },
  { player: 'GRUBLEAF', archetype: 'button-masher', expected: 9.5 },
  { player: 'SILTSKIP', archetype: 'button-masher', expected: 46.7 },
  { player: 'KINDRAKE', archetype: 'brute', expected: 11.3 },
  { player: 'GRUBLEAF', archetype: 'brute', expected: 10.8 },
  { player: 'SILTSKIP', archetype: 'brute', expected: 17.8 },
  { player: 'KINDRAKE', archetype: 'naive-triangle', expected: 74.8 },
  { player: 'GRUBLEAF', archetype: 'naive-triangle', expected: 36.6 },
  { player: 'SILTSKIP', archetype: 'naive-triangle', expected: 68.5 },
  { player: 'KINDRAKE', archetype: 'stamina-reader', expected: 100.0 },
  { player: 'GRUBLEAF', archetype: 'stamina-reader', expected: 12.2 },
  { player: 'SILTSKIP', archetype: 'stamina-reader', expected: 100.0 },
  { player: 'KINDRAKE', archetype: 'human-ish', expected: 88.1 },
  { player: 'GRUBLEAF', archetype: 'human-ish', expected: 14.7 },
  { player: 'SILTSKIP', archetype: 'human-ish', expected: 86.6 },
];

describe('Falkner ladder regression (n=2000, seed=0x1f, gust=1.4 hp=1.15)', () => {
  const cells = runFalknerLadder({
    gustBorneDmgMult: 1.4,
    aceHpMult: 1.15,
    n: N,
    seed: SEED,
  });

  for (const lock of LOCKED) {
    test(`${lock.player} vs Falkner — ${lock.archetype} ≈ ${lock.expected.toFixed(1)}%`, () => {
      const cell = cells.find(
        (c) => c.player === lock.player && c.archetype === lock.archetype,
      );
      expect(cell).toBeDefined();
      expect(Math.abs(cell!.winPct - lock.expected)).toBeLessThanOrEqual(BAND);
    });
  }
});
