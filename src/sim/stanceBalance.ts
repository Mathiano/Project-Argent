// Stance-balance Monte Carlo (Combat Layer 1 sim-gate). The engine analogue
// of docs/argent_combat_montecarlo_run1-4.py: pit stance-choice POLICIES
// (PureAGG/PureFLUID/PureGUARD/Balanced…) round-robin through the REAL engine
// and measure win-rates. The pre-Layer-1 triangle made FLUID dominant; this
// confirms the fix — PureFLUID collapses from dominant to a losing spam.
//
// Mirror matchups (same species both sides) isolate the STANCE triangle from
// type/stat asymmetry. Engine-headless; deterministic given the seed.

import {
  SPECIES,
  activeMon,
  affordableMoves,
  createBattleState,
  createSide,
  forcedAction,
  isTeamWiped,
  mulberry32,
  resolveRound,
} from '../engine';
import type { Action, BattleState, RNG, Side, Stance } from '../engine';

export type StancePolicy = (rng: RNG) => Stance;

const STANCES: readonly Stance[] = ['A', 'F', 'G'];

export const POLICIES: { readonly [name: string]: StancePolicy } = {
  PureAGG: () => 'A',
  PureFLUID: () => 'F',
  PureGUARD: () => 'G',
  // Balanced = uniform random over the three (the "varying" baseline).
  Balanced: (rng) => STANCES[Math.floor(rng.next() * 3)]!,
  // AntiFluid = mostly Aggressive (the predator), some Guard — the kind of
  // adaptive play that SHOULD beat a Fluid-spammer after the fix.
  AntiFluid: (rng) => (rng.next() < 0.6 ? 'A' : rng.next() < 0.5 ? 'G' : 'F'),
};

// Turn the chosen stance into a legal action: forced rest if exhausted/
// softlocked, else a cheap sustainable move (TACKLE) in that stance.
function actionFor(state: BattleState, side: Side, stance: Stance): Action {
  const me = activeMon(state[side]);
  const forced = forcedAction(me);
  if (forced) return forced;
  const moves = affordableMoves(me);
  if (moves.length === 0) return { kind: 'rest' };
  const move = moves.includes('TACKLE') ? 'TACKLE' : moves[0]!;
  return { kind: 'move', move, stance };
}

// One mirror battle: policy A (player) vs policy B (foe). Returns A's score
// (1 win / 0.5 draw / 0 loss).
export function battle(
  polA: StancePolicy,
  polB: StancePolicy,
  speciesName: string,
  rng: RNG,
  maxRounds = 80,
): number {
  let state = createBattleState(
    createSide(SPECIES[speciesName]!),
    createSide(SPECIES[speciesName]!),
  );
  for (let i = 0; i < maxRounds; i += 1) {
    const r = resolveRound(state, actionFor(state, 'player', polA(rng)), actionFor(state, 'foe', polB(rng)), rng);
    state = r.state;
    const plDead = isTeamWiped(state.player);
    const foeDead = isTeamWiped(state.foe);
    if (plDead && foeDead) return 0.5;
    if (foeDead) return 1;
    if (plDead) return 0;
  }
  const pl = activeMon(state.player).hp;
  const fo = activeMon(state.foe).hp;
  return pl > fo ? 1 : fo > pl ? 0 : 0.5;
}

export interface BalanceResult {
  readonly winPct: { readonly [name: string]: number };
  readonly spreadPp: number; // max - min win% (dominance metric; lower = healthier)
  readonly top: string;
}

// Round-robin every ordered policy pairing, n battles each.
export function runStanceBalance(speciesName = 'SPROUTLE', nPerPair = 600, seed = 1): BalanceResult {
  const names = Object.keys(POLICIES);
  const wins: { [k: string]: number } = {};
  const games: { [k: string]: number } = {};
  for (const n of names) {
    wins[n] = 0;
    games[n] = 0;
  }
  let s = seed;
  for (const na of names) {
    for (const nb of names) {
      if (na === nb) continue;
      for (let i = 0; i < nPerPair; i += 1) {
        const score = battle(POLICIES[na]!, POLICIES[nb]!, speciesName, mulberry32(s));
        s += 1;
        wins[na]! += score;
        games[na]! += 1;
      }
    }
  }
  const winPct: { [k: string]: number } = {};
  for (const n of names) winPct[n] = (wins[n]! / games[n]!) * 100;
  const vals = Object.values(winPct);
  const spreadPp = Math.max(...vals) - Math.min(...vals);
  const top = names.reduce((a, b) => (winPct[b]! > winPct[a]! ? b : a), names[0]!);
  return { winPct, spreadPp, top };
}
