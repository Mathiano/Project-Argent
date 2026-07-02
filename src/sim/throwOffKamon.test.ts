import { describe, expect, test } from 'vitest';
import {
  SPECIES,
  activeMon,
  createBattleState,
  createSide,
  isTeamWiped,
  mulberry32,
  resolveRound,
} from '../engine';
import type { Action, BattleState, RNG, Side } from '../engine';
import { kamonRivalBot, reader } from './archetypes';

// ── THROW THEM OFF vs KAMON's modal-read (docs/calls-expansion-design.md) ────
// KAMON reads the player's recent modal stance and counters it (10% of rounds).
// THROW THEM OFF poisons that history — the surface KAMON consults. SIM GATE:
// run the poison against the history-reader and REPORT the win% shift; the band
// must hold (the mechanic is a nudge, not a KAMON-breaker) — else HOLD, don't
// re-baseline silently. The rival-card REGRESSION gate (rivalCard.test.ts) uses
// the starter bots (no throwOff) → stays bit-identical (verified separately).

// A reader that PLANTS a false stance ONCE (THROW THEM OFF) to poison KAMON's
// modal-read, then plays normally. Planting forgoes a strike + a ★, so a single
// well-placed plant isolates the poison's net effect from the (large, self-
// inflicted) cost of spamming it. Round 3 = KAMON has a 2-round history to
// misread. FINDING (measured): spamming plants every 3rd round craters the
// reader (~−44pp) — the strike/★ cost makes over-planting SELF-DEFEATING, a
// healthy anti-degeneracy property (the tool has a real opportunity cost).
function throwOffReader(state: BattleState, side: Side, rng: RNG): Action {
  const me = activeMon(state[side]);
  const base = reader.chooseAction(state, side, rng);
  if (base.kind === 'move' && me.momentum >= 1 && state.round === 3) {
    return { kind: 'call', call: 'throwOff', plantStance: 'A' }; // the lie, once
  }
  return base;
}

function winPct(
  playerPol: (s: BattleState, side: Side, rng: RNG) => Action,
  n: number,
  seed: number,
  maxRounds = 80,
): number {
  let plWins = 0;
  for (let i = 0; i < n; i += 1) {
    const rng = mulberry32(seed + i);
    let state = createBattleState(createSide(SPECIES.SPROUTLE!), createSide(SPECIES.SPROUTLE!));
    let decided = false;
    for (let k = 0; k < maxRounds; k += 1) {
      const pA = playerPol(state, 'player', rng);
      const fA = kamonRivalBot.chooseAction(state, 'foe', rng);
      state = resolveRound(state, pA, fA, rng).state;
      const pd = isTeamWiped(state.player);
      const fd = isTeamWiped(state.foe);
      if (pd || fd) {
        decided = true;
        if (fd && !pd) plWins += 1;
        else if (pd && fd) plWins += 0.5;
        break;
      }
    }
    if (!decided) {
      const pl = activeMon(state.player).hp;
      const fo = activeMon(state.foe).hp;
      plWins += pl > fo ? 1 : pl === fo ? 0.5 : 0;
    }
  }
  return (plWins / n) * 100;
}

describe('THROW THEM OFF vs KAMON — history poison (SPROUTLE mirror, n=2000)', () => {
  const N = 2000;
  const SEED = 1;
  const basePct = winPct((s, side, rng) => reader.chooseAction(s, side, rng), N, SEED);
  const poisonPct = winPct(throwOffReader, N, SEED);
  const shift = poisonPct - basePct;

  test('reports the shift (logged for the audit)', () => {
    // eslint-disable-next-line no-console
    console.log(
      `  player win% vs KAMON — reader ${basePct.toFixed(1)}% → +throwOff ${poisonPct.toFixed(1)}% (shift ${shift >= 0 ? '+' : ''}${shift.toFixed(1)}pp)`,
    );
    expect(Number.isFinite(shift)).toBe(true);
  });

  test('the poison is a bounded nudge — KAMON neither collapses nor stomps', () => {
    // FINDING (measured ~−8pp): one plant forgoes a strike + ★, and KAMON's
    // modal-read fires only ~10% of rounds — so the plant COSTS the reader more
    // than the poison gains. THROW THEM OFF is thus NOT a free win vs KAMON; it
    // BLOOMS vs the heavy history-readers of part-B Reactive (per the design). It
    // must not swing the fight wildly in EITHER direction (niche tool, not a
    // KAMON-breaker / not an exploit).
    expect(Math.abs(shift)).toBeLessThan(12);
    // Stays a real, non-degenerate fight (no 0% collapse / 100% stomp).
    expect(poisonPct).toBeGreaterThan(60);
    expect(poisonPct).toBeLessThan(90);
  });
});
