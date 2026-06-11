import { SPECIES, createBattleState, createSide, mulberry32, resolveRound } from '../engine';
import type { BattleState, RNG, StatScale } from '../engine';
import type { BotArchetype } from './archetypes';

export interface SideSpec {
  readonly archetype: BotArchetype;
  readonly species: string;
  readonly scale?: StatScale;
}

export interface MatchSpec {
  readonly player: SideSpec;
  readonly foe: SideSpec;
  readonly maxRounds?: number;
}

export interface MatchResult {
  readonly winner: 'player' | 'foe' | 'draw';
  readonly rounds: number;
  readonly playerExhaustedSeen: boolean;
  readonly foeExhaustedSeen: boolean;
}

export function runMatch(spec: MatchSpec, rng: RNG): MatchResult {
  const maxRounds = spec.maxRounds ?? 200;
  let state: BattleState = createBattleState(
    createSide(SPECIES[spec.player.species]!, spec.player.scale),
    createSide(SPECIES[spec.foe.species]!, spec.foe.scale),
  );
  let pExh = false;
  let fExh = false;
  for (let i = 0; i < maxRounds; i += 1) {
    const pAction = spec.player.archetype.chooseAction(state, 'player', rng);
    const fAction = spec.foe.archetype.chooseAction(state, 'foe', rng);
    const r = resolveRound(state, pAction, fAction, rng);
    state = r.state;
    if (state.player.exhausted) pExh = true;
    if (state.foe.exhausted) fExh = true;
    if (state.player.hp <= 0) {
      return { winner: 'foe', rounds: i + 1, playerExhaustedSeen: pExh, foeExhaustedSeen: fExh };
    }
    if (state.foe.hp <= 0) {
      return { winner: 'player', rounds: i + 1, playerExhaustedSeen: pExh, foeExhaustedSeen: fExh };
    }
  }
  return { winner: 'draw', rounds: maxRounds, playerExhaustedSeen: pExh, foeExhaustedSeen: fExh };
}

export interface LadderStats {
  readonly n: number;
  readonly wins: number;
  readonly playerWinPct: number;
  readonly meanRounds: number;
  readonly playerExhaustionRate: number;
  readonly foeExhaustionRate: number;
  readonly draws: number;
}

export function runLadder(spec: MatchSpec, n: number, seed: number): LadderStats {
  let wins = 0;
  let draws = 0;
  let totalRounds = 0;
  let pE = 0;
  let fE = 0;
  for (let i = 0; i < n; i += 1) {
    const rng = mulberry32(seed + i);
    const r = runMatch(spec, rng);
    if (r.winner === 'player') wins += 1;
    else if (r.winner === 'draw') draws += 1;
    totalRounds += r.rounds;
    if (r.playerExhaustedSeen) pE += 1;
    if (r.foeExhaustedSeen) fE += 1;
  }
  return {
    n,
    wins,
    playerWinPct: (wins / n) * 100,
    meanRounds: totalRounds / n,
    playerExhaustionRate: pE / n,
    foeExhaustionRate: fE / n,
    draws,
  };
}
