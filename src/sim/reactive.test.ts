import { describe, expect, test } from 'vitest';
import {
  SPECIES,
  activeMon,
  createBattleState,
  createSide,
  isTeamWiped,
  mulberry32,
  resolveRound,
  trainerPolicy,
} from '../engine';
import type { Action, BattleState, RNG, Side, TrainerProfile } from '../engine';
import { reader, staticGuard } from './archetypes';
import { runTrainerProfiles } from './trainerProfiles';

// ── STAGE 3 — Reactive adaptivity sim gate (catalog part B) ──────────────────
// A Reactive profile reads the player's stance history + counter-weights its pick.
// Gates: fair-but-distinct vs the reader (no wall); a Reactive profile punishes a
// stance-REPEATER measurably harder than a static one (the design intent); and the
// espionage loop — THROW THEM OFF poisons the very history a full Reactive leans on.

// CLEAN reactive fixtures (no bond/Calls) so the sim ISOLATES adaptivity: a
// balanced base + lite / full reactive, vs the same balanced STATIC control.
const staticBase: TrainerProfile = { name: 'STATIC', stance: 'balanced', twoStep: 'single-only', infoLevel: 'veiled' };
const reactiveLite: TrainerProfile = { name: 'R-LITE', stance: 'balanced', twoStep: 'single-only', infoLevel: 'veiled', adaptive: 'lite' };
const reactiveFull: TrainerProfile = { name: 'R-FULL', stance: 'balanced', twoStep: 'single-only', infoLevel: 'veiled', adaptive: 'full' };

// Foe (profile) win-% vs a player BOT, SPROUTLE mirror, through the real engine.
function foeWinVs(
  profile: TrainerProfile,
  playerPol: (s: BattleState, side: Side, rng: RNG) => Action,
  n: number,
  seed: number,
  maxRounds = 80,
): number {
  const foePol = trainerPolicy(profile);
  let foeWins = 0;
  for (let i = 0; i < n; i += 1) {
    const rng = mulberry32(seed + i);
    let state = createBattleState(createSide(SPECIES.SPROUTLE!), createSide(SPECIES.SPROUTLE!));
    let decided = false;
    for (let k = 0; k < maxRounds; k += 1) {
      const pA = playerPol(state, 'player', rng);
      const fA = foePol(state, 'foe', rng);
      state = resolveRound(state, pA, fA, rng).state;
      const pd = isTeamWiped(state.player);
      const fd = isTeamWiped(state.foe);
      if (pd || fd) { decided = true; foeWins += pd && fd ? 0.5 : pd ? 1 : 0; break; }
    }
    if (!decided) {
      const pl = activeMon(state.player).hp;
      const fo = activeMon(state.foe).hp;
      foeWins += fo > pl ? 1 : pl > fo ? 0 : 0.5;
    }
  }
  return (foeWins / n) * 100;
}

describe('Reactive profiles — fair-but-distinct vs the reader', () => {
  const rows = runTrainerProfiles('reading', 'SPROUTLE', 800, 7, {
    static: staticBase, lite: reactiveLite, full: reactiveFull,
  });
  const by = Object.fromEntries(rows.map((r) => [r.id, r]));

  test('reports (logged for the audit)', () => {
    for (const r of rows) {
      // eslint-disable-next-line no-console
      console.log(`  ${r.id.padEnd(8)} foeWin ${r.foeWinPct.toFixed(1)}% | A${r.usagePct.A.toFixed(0)} G${r.usagePct.G.toFixed(0)} F${r.usagePct.F.toFixed(0)}`);
    }
    expect(rows.length).toBe(3);
  });

  test('both reactive levels are a FAIR fight (20–78 band; no wall)', () => {
    for (const id of ['lite', 'full'] as const) {
      expect(by[id]!.foeWinPct).toBeGreaterThan(20);
      expect(by[id]!.foeWinPct).toBeLessThan(78);
    }
  });

  test('adaptivity is a monotone edge: static ≤ lite ≤ full vs the reader', () => {
    // Reading the player back and countering can only help the trainer.
    expect(by.lite!.foeWinPct).toBeGreaterThanOrEqual(by.static!.foeWinPct - 1);
    expect(by.full!.foeWinPct).toBeGreaterThanOrEqual(by.lite!.foeWinPct - 1);
  });
});

describe('Reactive punishes a stance-REPEATER harder than a static profile', () => {
  // staticGuard ALWAYS plays Guard → a fixed modal a Reactive trainer exploits
  // (F beats G). A static balanced trainer can't lean in. The design intent, as
  // an assertion: reactive foeWin(vs repeater) > static foeWin(vs repeater).
  const N = 1500;
  const SEED = 3;
  const staticVs = foeWinVs(staticBase, (s, side, rng) => staticGuard.chooseAction(s, side, rng), N, SEED);
  const liteVs = foeWinVs(reactiveLite, (s, side, rng) => staticGuard.chooseAction(s, side, rng), N, SEED);
  const fullVs = foeWinVs(reactiveFull, (s, side, rng) => staticGuard.chooseAction(s, side, rng), N, SEED);

  test('reports (logged)', () => {
    // eslint-disable-next-line no-console
    console.log(`  vs a GUARD-repeater — static ${staticVs.toFixed(1)}% · lite ${liteVs.toFixed(1)}% · full ${fullVs.toFixed(1)}%`);
    expect(true).toBe(true);
  });

  test('full Reactive beats the repeater MEASURABLY harder than static (design intent)', () => {
    expect(fullVs).toBeGreaterThan(staticVs + 5); // a real, measurable adaptivity edge
    expect(liteVs).toBeGreaterThan(staticVs - 1); // lite trends the same way (mild)
  });
});

// ── The espionage loop closes: THROW THEM OFF vs a full Reactive ─────────────
// A reader that plants a false stance to poison the history a full Reactive reads
// EVERY round. The loop is now measurable end-to-end: THROW THEM OFF → history →
// the Reactive reads the lie → it mis-counters. FINDING (measured, reported below):
// as a RAW win-shift in a bot mirror the poison is cost-NEGATIVE vs the Reactive
// too (single ≈ −10pp, like KAMON's −7.9), NOT more valuable as the design hoped —
// the plant's opportunity cost (a forgone strike + ★) is real (the KAMON principle),
// and the planting BOT doesn't coordinate a follow-up to cash the misdirection it
// created (a human would; the tool's value is situational, which a fixed-schedule
// bot can't capture). FLAGGED for Mathias — the mechanic is sound + wired; the
// "more valuable vs a heavy reader" hypothesis did not survive the bot mirror.
function plantingReader(everyRound: boolean) {
  return (state: BattleState, side: Side, rng: RNG): Action => {
    const me = activeMon(state[side]);
    const base = reader.chooseAction(state, side, rng);
    const plantRound = everyRound ? state.round >= 3 && (state.round - 3) % 3 === 0 : state.round === 3;
    if (base.kind === 'move' && me.momentum >= 1 && plantRound) {
      return { kind: 'call', call: 'throwOff', plantStance: 'A' };
    }
    return base;
  };
}

describe('THROW THEM OFF vs a full Reactive — the espionage matchup, measured', () => {
  const N = 2000;
  const SEED = 1;
  const basePct = 100 - foeWinVs(reactiveFull, (s, side, rng) => reader.chooseAction(s, side, rng), N, SEED); // player win%
  const singlePct = 100 - foeWinVs(reactiveFull, plantingReader(false), N, SEED);
  const sustainedPct = 100 - foeWinVs(reactiveFull, plantingReader(true), N, SEED);
  const singleShift = singlePct - basePct;
  const sustainedShift = sustainedPct - basePct;

  test('reports the shifts (logged — the pair’s designed matchup)', () => {
    // eslint-disable-next-line no-console
    console.log(
      `  player win% vs full-Reactive — reader ${basePct.toFixed(1)}%` +
        ` → +throwOff(1×) ${singlePct.toFixed(1)}% (${singleShift >= 0 ? '+' : ''}${singleShift.toFixed(1)}pp)` +
        ` · +throwOff(sustained) ${sustainedPct.toFixed(1)}% (${sustainedShift >= 0 ? '+' : ''}${sustainedShift.toFixed(1)}pp)`,
    );
    expect(Number.isFinite(singleShift + sustainedShift)).toBe(true);
  });

  test('the espionage loop is CLOSED + wired: the poison measurably moves the Reactive matchup', () => {
    // The mechanically-true, honest gate (NOT the hoped-for "more valuable" claim,
    // which the numbers above refute): the plant has a REAL, measurable effect on a
    // Reactive — proof the Reactive reads the poisoned history and reacts. The value
    // sign stays negative in the bot mirror (self-cost > uncoordinated benefit).
    expect(Math.abs(singleShift)).toBeGreaterThan(2); // the plant genuinely lands (loop closed)
    // Without poison the Reactive is a FAIR fight (no wall / no stomp).
    expect(basePct).toBeGreaterThan(30);
    expect(basePct).toBeLessThan(70);
    // Poison never collapses the fight to a degenerate floor/ceiling.
    expect(singlePct).toBeGreaterThan(15);
    expect(sustainedPct).toBeGreaterThan(10);
  });
});
