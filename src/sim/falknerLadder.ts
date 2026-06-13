// Falkner B1 ladder: 5 archetypes x 3 new starters at band (n=2000/cell).
// Levers come from the boss-card tuning list. Run via `npm run sim:falkner`
// or imported into the regression test once the bands stabilise.

import ch1BatchData from '../../docs/ch1-batch.json';
import movesData from '../../docs/moves.json';
import typeChartData from '../../docs/typechart.json';
import {
  createBattleState,
  createSide,
  falknerBossAI,
  LEGACY_TRAIT_TABLE,
  loadDex,
  loadMoves,
  mulberry32,
  registerMoves,
  resolveRound,
} from '../engine';
import type {
  Action,
  ArenaSchedule,
  BattleState,
  BossCard,
  DexEntryJson,
  MoveJson,
  RNG,
  Species,
  TraitTable,
  TypeChart,
} from '../engine';
import type { BotArchetype } from './archetypes';
import { FALKNER_LADDER_ARCHETYPES } from './archetypes';

const STARTER_LEVEL = 13;
const FALKNER_ACE_LEVEL = 15;

const ARENA: ArenaSchedule = {
  rhythmEveryN: 3,
  heavyExtraCost: 8,
  heavyExtraInitWeight: 1.3,
  telegraphAheadBy: 1,
};

const TYPECHART = typeChartData as TypeChart;

// Register CH1 moves into the engine's lookup once.
let registered = false;
function ensureRegistered(): void {
  if (registered) return;
  const ch1Moves = loadMoves(movesData as MoveJson[]);
  registerMoves(ch1Moves);
  registered = true;
}

function dexEntry(name: string): DexEntryJson {
  const found = (ch1BatchData as DexEntryJson[]).find((e) => e.name === name);
  if (!found) throw new Error(`Falkner ladder: missing dex entry ${name}`);
  return found;
}

export function buildFalknerAce(opts: { aceHpMult: number; gustBorneDmgMult?: number }): {
  galehawk: Species;
  card: BossCard;
  traits: TraitTable;
} {
  ensureRegistered();
  const galehawkBase = loadDex([dexEntry('GALEHAWK')], FALKNER_ACE_LEVEL).GALEHAWK!;
  const speciesWithTrait: Species = { ...galehawkBase, trait: 'GUSTBORNE' };
  const card: BossCard = {
    species: speciesWithTrait,
    statScale: { hp: opts.aceHpMult },
    arenaSchedule: ARENA,
    breakBar: 2,
  };
  const traits: TraitTable =
    opts.gustBorneDmgMult === undefined
      ? LEGACY_TRAIT_TABLE
      : { GUSTBORNE: { dmgMult: opts.gustBorneDmgMult, initMult: 1.25 } };
  return { galehawk: speciesWithTrait, card, traits };
}

export interface FalknerCellResult {
  readonly player: string;
  readonly archetype: string;
  readonly winPct: number;
  readonly wins: number;
  readonly meanRounds: number;
}

interface MatchOutcome {
  readonly winner: 'player' | 'foe' | 'draw';
  readonly rounds: number;
}

function runMatch(
  playerSpecies: Species,
  card: BossCard,
  traits: TraitTable,
  archetype: BotArchetype,
  rng: RNG,
  maxRounds = 50,
): MatchOutcome {
  let state: BattleState = createBattleState(
    createSide(playerSpecies),
    createSide(card.species, card.statScale),
    { bossCard: card, typeChart: TYPECHART, traits },
  );
  for (let i = 0; i < maxRounds; i += 1) {
    const fAction: Action = falknerBossAI(state, 'foe', rng);
    const pAction = archetype.chooseAction(state, 'player', rng, fAction);
    let result;
    try {
      result = resolveRound(state, pAction, fAction, rng);
    } catch {
      return { winner: 'foe', rounds: i + 1 };
    }
    state = result.state;
    if (state.player.hp <= 0) return { winner: 'foe', rounds: i + 1 };
    if (state.foe.hp <= 0) return { winner: 'player', rounds: i + 1 };
  }
  return { winner: 'draw', rounds: maxRounds };
}

export function runFalknerLadder(opts: {
  aceHpMult: number;
  gustBorneDmgMult?: number;
  n: number;
  seed: number;
}): FalknerCellResult[] {
  ensureRegistered();
  const { card, traits } = buildFalknerAce(opts);
  const starters: Species[] = ['KINDRAKE', 'GRUBLEAF', 'SILTSKIP'].map((name) => {
    const entry = dexEntry(name);
    return loadDex([entry], STARTER_LEVEL)[name]!;
  });

  const cells: FalknerCellResult[] = [];
  for (const archetype of FALKNER_LADDER_ARCHETYPES) {
    for (const player of starters) {
      let wins = 0;
      let totalRounds = 0;
      for (let i = 0; i < opts.n; i += 1) {
        const rng = mulberry32(opts.seed + i + player.name.length * 7919);
        const r = runMatch(player, card, traits, archetype, rng);
        if (r.winner === 'player') wins += 1;
        totalRounds += r.rounds;
      }
      cells.push({
        player: player.name,
        archetype: archetype.name,
        winPct: (wins / opts.n) * 100,
        wins,
        meanRounds: totalRounds / opts.n,
      });
    }
  }
  return cells;
}
