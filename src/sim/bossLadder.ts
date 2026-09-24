// Generic boss ladder: archetypes × starters vs one boss card (gym2-plan Step 5).
// The card, its policy and the fight's trait table come in as data, so a new
// gym is a card + a policy, not a copy of the Falkner runner. The foe side is
// the card's ace alone (the published Falkner bands are 1v1); the player side
// is each starter solo unless `playerTeam` builds a lineup around it.

import {
  createBattleState,
  createSide,
  createTeam,
  isTeamWiped,
  mulberry32,
  resolveRound,
} from '../engine';
import type {
  Action,
  BattleState,
  BossCard,
  BossPolicy,
  EnvironmentId,
  RNG,
  SideState,
  Species,
  Team,
  TraitTable,
  TypeChart,
} from '../engine';
import type { BotArchetype } from './archetypes';

export interface BossCellResult {
  readonly player: string;
  readonly archetype: string;
  readonly winPct: number;
  readonly wins: number;
  readonly meanRounds: number;
}

export interface BossLadderOpts {
  readonly card: BossCard;
  readonly policy: BossPolicy;
  readonly traits: TraitTable;
  readonly typeChart: TypeChart;
  readonly starters: readonly Species[];
  readonly archetypes: readonly BotArchetype[];
  // Combat Layer 3 — the ground the gym is fought on. Omitted → neutral, which
  // is the baseline every published Falkner band was measured against.
  readonly environment?: EnvironmentId;
  readonly n: number;
  readonly seed: number;
  // The player's lineup for a starter (lead first). Omitted → the starter solo.
  readonly playerTeam?: (starter: Species) => readonly Species[];
  readonly maxRounds?: number;
}

interface MatchOutcome {
  readonly winner: 'player' | 'foe' | 'draw';
  readonly rounds: number;
}

function runMatch(
  player: SideState | Team,
  opts: BossLadderOpts,
  archetype: BotArchetype,
  rng: RNG,
  maxRounds: number,
): MatchOutcome {
  const { card } = opts;
  let state: BattleState = createBattleState(
    player,
    createSide(
      card.species,
      card.statScale,
      card.openingMomentum !== undefined ? { openingMomentum: card.openingMomentum } : undefined,
    ),
    {
      bossCard: card,
      typeChart: opts.typeChart,
      traits: opts.traits,
      ...(opts.environment !== undefined ? { environment: opts.environment } : {}),
    },
  );
  for (let i = 0; i < maxRounds; i += 1) {
    const fAction: Action = opts.policy(state, 'foe', rng);
    const pAction = archetype.chooseAction(state, 'player', rng, fAction);
    let result;
    try {
      result = resolveRound(state, pAction, fAction, rng);
    } catch {
      return { winner: 'foe', rounds: i + 1 };
    }
    state = result.state;
    if (isTeamWiped(state.player)) return { winner: 'foe', rounds: i + 1 };
    if (isTeamWiped(state.foe)) return { winner: 'player', rounds: i + 1 };
  }
  return { winner: 'draw', rounds: maxRounds };
}

function playerSide(starter: Species, opts: BossLadderOpts): SideState | Team {
  if (!opts.playerTeam) return createSide(starter);
  return createTeam(opts.playerTeam(starter).map((s) => createSide(s)));
}

export function runBossLadder(opts: BossLadderOpts): BossCellResult[] {
  const maxRounds = opts.maxRounds ?? 50;
  const cells: BossCellResult[] = [];
  for (const archetype of opts.archetypes) {
    for (const starter of opts.starters) {
      let wins = 0;
      let totalRounds = 0;
      for (let i = 0; i < opts.n; i += 1) {
        const rng = mulberry32(opts.seed + i + starter.name.length * 7919);
        const r = runMatch(playerSide(starter, opts), opts, archetype, rng, maxRounds);
        if (r.winner === 'player') wins += 1;
        totalRounds += r.rounds;
      }
      cells.push({
        player: starter.name,
        archetype: archetype.name,
        winPct: (wins / opts.n) * 100,
        wins,
        meanRounds: totalRounds / opts.n,
      });
    }
  }
  return cells;
}
