// KAMON Rival Card v2 — per-pick fairness sim (docs/kamon-rival-card-v2.md).
// For each player starter pick, the player (the canonical `reader`) fights KAMON
// — who stole the COUNTER-type starter and fights it at bond-factor 0.85 — over
// the REAL engine with the CH1 type chart. The thesis: winnable-but-tense, the
// bond (0.85 + reading) offsetting the type disadvantage. Not a free win, not a
// wall. Deterministic given the seed.

import ch1BatchData from '../../docs/ch1-batch.json';
import movesData from '../../docs/moves.json';
import typechartData from '../../docs/typechart.json';
import {
  buildKamonTeam,
  createBattleState,
  createSide,
  createTeam,
  isTeamWiped,
  kamonStolenStarter,
  loadDex,
  loadMoves,
  mulberry32,
  registerMoves,
  resolveRound,
  trainerPolicy,
  TRAINER_PROFILES,
} from '../engine';
import type { DexEntryJson, MoveJson, TypeChart } from '../engine';
import { reader } from './archetypes';

registerMoves(loadMoves(movesData as MoveJson[]));
const CH1_LEVEL = 13; // matches the game's CH1 dex load (no per-mon level system yet)
const CH1 = loadDex(ch1BatchData as DexEntryJson[], CH1_LEVEL);
const CHART = typechartData as TypeChart;

export const CH1_STARTERS = ['KINDRAKE', 'GRUBLEAF', 'SILTSKIP'] as const;
export type StarterPick = (typeof CH1_STARTERS)[number];

export interface RivalCardResult {
  readonly pick: StarterPick;
  readonly stolen: string; // KAMON's counter-type starter
  readonly playerWinPct: number; // the reader, with the bonded pick, vs KAMON
}

// One pick: the reader (player, the bonded pick at full stats) vs KAMON (the
// counter-starter SOLO at 0.85, Aggressor/Single-only profile). Foe commits
// first; the player reads the telegraph (ladder convention).
export function runRivalCardPick(pick: StarterPick, n = 2000, seed = 1): RivalCardResult {
  const stolenName = kamonStolenStarter(pick)!;
  let wins = 0;
  for (let i = 0; i < n; i += 1) {
    const rng = mulberry32(seed + i);
    let state = createBattleState(
      createTeam([createSide(CH1[pick]!)]),
      buildKamonTeam(CH1[stolenName]!),
      { typeChart: CHART },
    );
    for (let r = 0; r < 200; r += 1) {
      const fA = trainerPolicy(TRAINER_PROFILES.kamon!)(state, 'foe', rng);
      const pA = reader.chooseAction(state, 'player', rng, fA);
      state = resolveRound(state, pA, fA, rng).state;
      if (isTeamWiped(state.foe)) { wins += 1; break; }
      if (isTeamWiped(state.player)) break;
    }
  }
  return { pick, stolen: stolenName, playerWinPct: (wins / n) * 100 };
}

export function runRivalCard(n = 2000, seed = 1): RivalCardResult[] {
  return CH1_STARTERS.map((p) => runRivalCardPick(p, n, seed));
}

// ── POST-FALKNER placement (the KAMON first-fight gate moved to Violet→Route
// 32, AFTER the ZEPHYR badge). A developed player's lead has EVOLVED (stage 1 →
// stage 2; gate = bond stage 3 + the ZEPHYR badge — evolution.ts). Evolution is
// the ONLY combat-power change a developed team brings here (bond is horizontal,
// there is no leveling). KAMON's card is unchanged — his stolen STARTER stays
// stage 1 (he's the rival's first fight, he never grew it). This measures
// whether the authored card is still fair once its placement is post-Falkner.
const EVOLVED_LEAD: { readonly [pick in StarterPick]: string } = {
  KINDRAKE: 'KILNDRAKE',
  GRUBLEAF: 'VINESNAP',
  SILTSKIP: 'BRACKSLAP',
};

export function runRivalCardPostFalknerPick(pick: StarterPick, n = 2000, seed = 1): RivalCardResult {
  const stolenName = kamonStolenStarter(pick)!;
  const lead = CH1[EVOLVED_LEAD[pick]]!;
  let wins = 0;
  for (let i = 0; i < n; i += 1) {
    const rng = mulberry32(seed + i);
    let state = createBattleState(
      createTeam([createSide(lead)]),
      buildKamonTeam(CH1[stolenName]!),
      { typeChart: CHART },
    );
    for (let r = 0; r < 200; r += 1) {
      const fA = trainerPolicy(TRAINER_PROFILES.kamon!)(state, 'foe', rng);
      const pA = reader.chooseAction(state, 'player', rng, fA);
      state = resolveRound(state, pA, fA, rng).state;
      if (isTeamWiped(state.foe)) { wins += 1; break; }
      if (isTeamWiped(state.player)) break;
    }
  }
  return { pick, stolen: stolenName, playerWinPct: (wins / n) * 100 };
}

export function runRivalCardPostFalkner(n = 2000, seed = 1): RivalCardResult[] {
  return CH1_STARTERS.map((p) => runRivalCardPostFalknerPick(p, n, seed));
}
