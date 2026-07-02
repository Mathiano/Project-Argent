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
  TRAINER_PROFILES,
} from '../engine';
import type { TrainerProfile } from '../engine';
import { reader } from './archetypes';

// ── STAGE 2 trainer-Call sim gate (docs/calls-expansion-design.md) ───────────
// Each Call POLICY (clutch / liberal / defensive), as the foe, vs the competent
// READING player, SPROUTLE mirror. The gate: fair-but-distinct — clutch is
// baitable, liberal is not dominant, defensive does not STALL (battles still
// terminate; Recover-looping is bounded by the ★-economy, NOT self-escalation
// DR — a Call spends ★, and ★ only comes from read-wins). Plus: the Calls fire
// FOE-side (symmetry), and a NO-BOND profile casts ZERO Calls (bit-identical).

interface CallSimResult {
  readonly foeWinPct: number;
  readonly meanRounds: number;
  readonly terminatedPct: number;
  readonly foeCalls: Readonly<Record<string, number>>;
}

function runCallSim(profile: TrainerProfile, n = 800, seed = 7, maxRounds = 80): CallSimResult {
  const foePol = trainerPolicy(profile);
  let foeWins = 0;
  let roundsSum = 0;
  let terminated = 0;
  const foeCalls: Record<string, number> = {};
  for (let i = 0; i < n; i += 1) {
    const rng = mulberry32(seed + i);
    let state = createBattleState(createSide(SPECIES.SPROUTLE!), createSide(SPECIES.SPROUTLE!));
    let rounds = 0;
    let done = false;
    for (let k = 0; k < maxRounds; k += 1) {
      const pA = reader.chooseAction(state, 'player', rng);
      const fA = foePol(state, 'foe', rng);
      if (fA.kind === 'call') foeCalls[fA.call] = (foeCalls[fA.call] ?? 0) + 1;
      else if (fA.kind === 'catchBreath') foeCalls.catchBreath = (foeCalls.catchBreath ?? 0) + 1;
      else if (fA.kind === 'move' && fA.fullPower === true) foeCalls.fullPower = (foeCalls.fullPower ?? 0) + 1;
      const r = resolveRound(state, pA, fA, rng);
      state = r.state;
      rounds += 1;
      const pd = isTeamWiped(state.player);
      const fd = isTeamWiped(state.foe);
      if (pd || fd) {
        done = true;
        foeWins += pd && fd ? 0.5 : pd ? 1 : 0;
        break;
      }
    }
    if (done) terminated += 1;
    else {
      const pl = activeMon(state.player).hp;
      const fo = activeMon(state.foe).hp;
      foeWins += fo > pl ? 1 : pl > fo ? 0 : 0.5;
    }
    roundsSum += rounds;
  }
  return {
    foeWinPct: (foeWins / n) * 100,
    meanRounds: roundsSum / n,
    terminatedPct: (terminated / n) * 100,
    foeCalls,
  };
}

// A high-bond LIBERAL fixture (no dormant profile is high/liberal — the catalog's
// only liberal, TRICKSTER, is mid) so the sim EXERCISES the full-kit liberal path
// (Dodge on a feared release + the Full Power dump). A test fixture, not shipped.
const liberalHigh: TrainerProfile = {
  name: 'LIBERAL-HIGH',
  stance: 'aggressor',
  twoStep: 'occasional',
  release: { feintRate: 0.3, signature: 'heavy' },
  infoLevel: 'veiled',
  bond: 'high',
  callUse: 'liberal',
};

describe('trainer Call policies — fair-but-distinct vs a reading player', () => {
  const clutch = runCallSim(TRAINER_PROFILES.charger!); // mid/clutch
  const liberalMid = runCallSim(TRAINER_PROFILES.trickster!); // mid/liberal
  const defensive = runCallSim(TRAINER_PROFILES.stonewall!); // high/defensive
  const clutchHigh = runCallSim(TRAINER_PROFILES.duelist!); // high/clutch (Recover)
  const libHigh = runCallSim(liberalHigh); // high/liberal (Dodge + Full Power)
  const noBond = runCallSim(TRAINER_PROFILES.kamon!); // no-bond → zero Calls

  test('reports (logged for the audit)', () => {
    const rows: [string, CallSimResult][] = [
      ['charger(mid/clutch)', clutch],
      ['trickster(mid/liberal)', liberalMid],
      ['stonewall(high/def)', defensive],
      ['duelist(high/clutch)', clutchHigh],
      ['liberalHigh', libHigh],
      ['kamon(no-bond)', noBond],
    ];
    for (const [id, r] of rows) {
      // eslint-disable-next-line no-console
      console.log(
        `  ${id.padEnd(24)} foeWin ${r.foeWinPct.toFixed(1)}% | rounds ${r.meanRounds.toFixed(1)} | term ${r.terminatedPct.toFixed(0)}% | calls ${JSON.stringify(r.foeCalls)}`,
      );
    }
    expect(rows.length).toBe(6);
  });

  test('every Call policy is a FAIR fight (not sub-10%, not a 80%+ stomp)', () => {
    for (const r of [clutch, liberalMid, defensive, clutchHigh, libHigh]) {
      expect(r.foeWinPct).toBeGreaterThan(10);
      expect(r.foeWinPct).toBeLessThan(80);
    }
  });

  test('liberal is NOT dominant vs the reader (spends freely → beatable)', () => {
    expect(libHigh.foeWinPct).toBeLessThan(78);
    expect(liberalMid.foeWinPct).toBeLessThan(78);
  });

  test('clutch is baitable (the reader wins a real share; clutch DOES spend Calls)', () => {
    expect(clutch.foeWinPct).toBeLessThan(75); // reader beats it often enough
    const spent = Object.values(clutch.foeCalls).reduce((a, b) => a + b, 0);
    expect(spent).toBeGreaterThan(0);
  });

  test('defensive does NOT stall — battles terminate; survives via Calls', () => {
    expect(defensive.terminatedPct).toBeGreaterThan(85); // almost never times out
    expect(defensive.meanRounds).toBeLessThan(40); // well under the 80-round cap
    // It survives via Calls (Catch Breath foe-side; Get Away needs the reader to
    // focus, which the yardstick never does — see the policy unit test).
    expect(defensive.foeCalls.catchBreath ?? 0).toBeGreaterThan(0);
    expect(defensive.foeCalls.fullPower ?? 0).toBe(0); // never Full Power (survival-only)
  });

  // NOTE: the reader NEVER initiates a Focus, so the trainer's Get Away / Dodge
  // (gated on a feared foe release) can't fire in this sim — that path is proven
  // by the engine foe-side symmetry tests + the deterministic policy unit test in
  // trainerAI.test.ts. Here we gate the Call that DOES fire vs the reader.
  test('symmetry: Full Power fires FOE-side (liberal dumps ★ on a buffed strike)', () => {
    expect(libHigh.foeCalls.fullPower ?? 0).toBeGreaterThan(0);
  });

  test('a NO-BOND trainer casts ZERO Calls (toolkit none → bit-identical)', () => {
    expect(Object.keys(noBond.foeCalls).length).toBe(0);
  });
});
