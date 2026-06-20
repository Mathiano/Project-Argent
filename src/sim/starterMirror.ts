// Starter-trio mirror-sim (docs/starter-trio-rebalance.md). Round-robins the
// three CH1 starters against each other through the REAL engine + CH1 type
// chart, BOTH sides driven by the canonical `reader` (the fair-fight yardstick)
// so the result isolates STAT SHAPE × the type triangle — no AI asymmetry.
//
// Reports each starter's aggregate win% across all its games (as the player
// side; includes the mirror, which trends ~50). A budget-balanced trio ⇒ each
// ~50% RPS: every starter's structural ceiling is (win-by-type 100 + lose-by-
// type 0 + mirror 50)/3 ≈ 50, so ~50 each IS the target.

import ch1BatchData from '../../docs/ch1-batch.json';
import movesData from '../../docs/moves.json';
import typechartData from '../../docs/typechart.json';
import {
  activeMon,
  createBattleState,
  createSide,
  createTeam,
  isTeamWiped,
  loadDex,
  loadMoves,
  mulberry32,
  registerMoves,
  resolveRound,
} from '../engine';
import type { DexEntryJson, MoveJson, RNG, TypeChart } from '../engine';
import { reader } from './archetypes';

registerMoves(loadMoves(movesData as MoveJson[]));
const CH1_LEVEL = 13;
const CH1 = loadDex(ch1BatchData as DexEntryJson[], CH1_LEVEL);
const CHART = typechartData as TypeChart;

export const STARTERS = ['KINDRAKE', 'GRUBLEAF', 'SILTSKIP'] as const;
export type Starter = (typeof STARTERS)[number];

// One battle: `a` (player) vs `b` (foe), both `reader`. Returns a's score
// (1 win / 0.5 draw / 0 loss). Every ordered pair is run, so each starter
// plays both seats — symmetric over the pairing.
function battle(a: Starter, b: Starter, rng: RNG): number {
  let state = createBattleState(
    createTeam([createSide(CH1[a]!)]),
    createTeam([createSide(CH1[b]!)]),
    { typeChart: CHART },
  );
  for (let r = 0; r < 200; r += 1) {
    const fA = reader.chooseAction(state, 'foe', rng);
    const pA = reader.chooseAction(state, 'player', rng, fA);
    state = resolveRound(state, pA, fA, rng).state;
    const pDead = isTeamWiped(state.player);
    const fDead = isTeamWiped(state.foe);
    if (pDead && fDead) return 0.5;
    if (fDead) return 1;
    if (pDead) return 0;
  }
  const pl = activeMon(state.player).hp;
  const fo = activeMon(state.foe).hp;
  return pl > fo ? 1 : fo > pl ? 0 : 0.5;
}

export interface MirrorResult {
  readonly aggregate: { readonly [s in Starter]: number }; // overall win% as player
  readonly matrix: { readonly [a in Starter]: { readonly [b in Starter]: number } }; // a-vs-b win%
}

export function runStarterMirror(nPerPair = 2000, seed = 1): MirrorResult {
  const wins: { [s: string]: number } = {};
  const games: { [s: string]: number } = {};
  const matrix: { [a: string]: { [b: string]: number } } = {};
  for (const s of STARTERS) {
    wins[s] = 0;
    games[s] = 0;
    matrix[s] = {};
  }
  let s = seed;
  for (const a of STARTERS) {
    for (const b of STARTERS) {
      let cell = 0;
      for (let i = 0; i < nPerPair; i += 1) {
        const score = battle(a, b, mulberry32(s));
        s += 1;
        cell += score;
        wins[a]! += score;
        games[a]! += 1;
      }
      matrix[a]![b] = (cell / nPerPair) * 100;
    }
  }
  const aggregate: { [s: string]: number } = {};
  for (const st of STARTERS) aggregate[st] = (wins[st]! / games[st]!) * 100;
  return {
    aggregate: aggregate as MirrorResult['aggregate'],
    matrix: matrix as MirrorResult['matrix'],
  };
}
