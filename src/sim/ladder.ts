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
  readonly dodges: number;
  readonly counters: number;
  readonly openings: number;
  readonly clashes: number;
}

export function runMatch(spec: MatchSpec, rng: RNG): MatchResult {
  const maxRounds = spec.maxRounds ?? 200;
  let state: BattleState = createBattleState(
    createSide(SPECIES[spec.player.species]!, spec.player.scale),
    createSide(SPECIES[spec.foe.species]!, spec.foe.scale),
  );
  let pExh = false;
  let fExh = false;
  let dodges = 0;
  let counters = 0;
  let openings = 0;
  let clashes = 0;
  for (let i = 0; i < maxRounds; i += 1) {
    // Foe commits first; player sees the foe's action as a telegraph.
    const fAction = spec.foe.archetype.chooseAction(state, 'foe', rng);
    const pAction = spec.player.archetype.chooseAction(state, 'player', rng, fAction);
    const r = resolveRound(state, pAction, fAction, rng);
    for (const ev of r.events) {
      if (ev.kind === 'dodge') dodges += 1;
      else if (ev.kind === 'counter') counters += 1;
      else if (ev.kind === 'opening') openings += 1;
      else if (ev.kind === 'clash') clashes += 1;
    }
    state = r.state;
    if (state.player.exhausted) pExh = true;
    if (state.foe.exhausted) fExh = true;
    if (state.player.hp <= 0) {
      return {
        winner: 'foe',
        rounds: i + 1,
        playerExhaustedSeen: pExh,
        foeExhaustedSeen: fExh,
        dodges,
        counters,
        openings,
        clashes,
      };
    }
    if (state.foe.hp <= 0) {
      return {
        winner: 'player',
        rounds: i + 1,
        playerExhaustedSeen: pExh,
        foeExhaustedSeen: fExh,
        dodges,
        counters,
        openings,
        clashes,
      };
    }
  }
  return {
    winner: 'draw',
    rounds: maxRounds,
    playerExhaustedSeen: pExh,
    foeExhaustedSeen: fExh,
    dodges,
    counters,
    openings,
    clashes,
  };
}

export interface LadderStats {
  readonly n: number;
  readonly wins: number;
  readonly playerWinPct: number;
  readonly meanRounds: number;
  readonly playerExhaustionRate: number;
  readonly foeExhaustionRate: number;
  readonly draws: number;
  readonly dodgesPerMatch: number;
  readonly countersPerMatch: number;
  readonly openingsPerMatch: number;
  readonly clashesPerMatch: number;
}

export function runLadder(spec: MatchSpec, n: number, seed: number): LadderStats {
  let wins = 0;
  let draws = 0;
  let totalRounds = 0;
  let pE = 0;
  let fE = 0;
  let dodges = 0;
  let counters = 0;
  let openings = 0;
  let clashes = 0;
  for (let i = 0; i < n; i += 1) {
    const rng = mulberry32(seed + i);
    const r = runMatch(spec, rng);
    if (r.winner === 'player') wins += 1;
    else if (r.winner === 'draw') draws += 1;
    totalRounds += r.rounds;
    if (r.playerExhaustedSeen) pE += 1;
    if (r.foeExhaustedSeen) fE += 1;
    dodges += r.dodges;
    counters += r.counters;
    openings += r.openings;
    clashes += r.clashes;
  }
  return {
    n,
    wins,
    playerWinPct: (wins / n) * 100,
    meanRounds: totalRounds / n,
    playerExhaustionRate: pE / n,
    foeExhaustionRate: fE / n,
    draws,
    dodgesPerMatch: dodges / n,
    countersPerMatch: counters / n,
    openingsPerMatch: openings / n,
    clashesPerMatch: clashes / n,
  };
}
