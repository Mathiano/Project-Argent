// B2 batch sim: each CH1 species (15 entries) × 5 archetypes, run at a
// uniform Falkner-band level vs a reference foe. Flag species whose
// per-archetype win% deviates from the batch average by >3%, and any
// kit with exhaustion-rate >40% (softlock canary per move-pool.md).

import ch1BatchData from '../../docs/ch1-batch.json';
import movesData from '../../docs/moves.json';
import typeChartData from '../../docs/typechart.json';
import {
  activeMon,
  createBattleState,
  createSide,
  forcedAction,
  isTeamWiped,
  loadDex,
  loadMoves,
  mulberry32,
  registerMoves,
  resolveRound,
} from '../engine';
import type {
  Action,
  BattleState,
  DexEntryJson,
  MoveJson,
  RNG,
  Species,
  Stance,
  TypeChart,
} from '../engine';
import { affordableMoves } from '../engine';
import {
  buttonMasher,
  brute,
  humanIsh,
  naiveTriangle,
  staminaReader,
} from './archetypes';
import type { BotArchetype } from './archetypes';

const LEVEL = 13;
const TYPECHART = typeChartData as TypeChart;

let registered = false;
function ensureRegistered(): void {
  if (registered) return;
  registerMoves(loadMoves(movesData as MoveJson[]));
  registered = true;
}

const ARCHETYPES: readonly BotArchetype[] = [
  buttonMasher,
  brute,
  naiveTriangle,
  staminaReader,
  humanIsh,
];

// Wild-style random-stance reference foe. Same shape as the in-game wild AI.
function refFoeAI(state: BattleState, rng: RNG): Action {
  const me = activeMon(state.foe);
  const forced = forcedAction(me);
  if (forced) return forced;
  const aff = affordableMoves(me);
  const move = aff[Math.floor(rng.next() * aff.length)]!;
  const r = rng.next();
  const stance: Stance = r < 0.4 ? 'A' : r < 0.7 ? 'G' : 'F';
  return { kind: 'move', move, stance };
}

function loadAllSpecies(): Species[] {
  ensureRegistered();
  return (ch1BatchData as DexEntryJson[]).map((e) => loadDex([e], LEVEL)[e.name]!);
}

export interface BatchCell {
  readonly player: string;
  readonly archetype: string;
  readonly winPct: number;
  readonly exhaustionPct: number;
}

interface MatchOutcome {
  readonly winner: 'player' | 'foe' | 'draw';
  readonly exhausted: boolean;
  readonly rounds: number;
}

function runMatch(
  playerSpecies: Species,
  foeSpecies: Species,
  archetype: BotArchetype,
  rng: RNG,
  maxRounds = 30,
): MatchOutcome {
  let state: BattleState = createBattleState(
    createSide(playerSpecies),
    createSide(foeSpecies),
    { typeChart: TYPECHART },
  );
  let playerExhaustedSeen = false;
  for (let i = 0; i < maxRounds; i += 1) {
    const fAction = refFoeAI(state, rng);
    let pAction: Action;
    try {
      pAction = archetype.chooseAction(state, 'player', rng, fAction);
    } catch {
      return { winner: 'foe', exhausted: playerExhaustedSeen, rounds: i + 1 };
    }
    let result;
    try {
      result = resolveRound(state, pAction, fAction, rng);
    } catch {
      return { winner: 'foe', exhausted: playerExhaustedSeen, rounds: i + 1 };
    }
    state = result.state;
    if (activeMon(state.player).exhausted) playerExhaustedSeen = true;
    if (isTeamWiped(state.player)) {
      return { winner: 'foe', exhausted: playerExhaustedSeen, rounds: i + 1 };
    }
    if (isTeamWiped(state.foe)) {
      return { winner: 'player', exhausted: playerExhaustedSeen, rounds: i + 1 };
    }
  }
  return { winner: 'draw', exhausted: playerExhaustedSeen, rounds: maxRounds };
}

export function runCh1Batch(opts: { n: number; seed: number; foeName: string }): BatchCell[] {
  const species = loadAllSpecies();
  const foe = species.find((s) => s.name === opts.foeName);
  if (!foe) throw new Error(`Reference foe ${opts.foeName} not in CH1 batch`);

  const cells: BatchCell[] = [];
  for (const archetype of ARCHETYPES) {
    for (const player of species) {
      let wins = 0;
      let exhCount = 0;
      for (let i = 0; i < opts.n; i += 1) {
        const rng = mulberry32(opts.seed + i + player.name.length * 7919);
        const r = runMatch(player, foe, archetype, rng);
        if (r.winner === 'player') wins += 1;
        if (r.exhausted) exhCount += 1;
      }
      cells.push({
        player: player.name,
        archetype: archetype.name,
        winPct: (wins / opts.n) * 100,
        exhaustionPct: (exhCount / opts.n) * 100,
      });
    }
  }
  return cells;
}

export interface BatchFlag {
  readonly kind: 'drift' | 'softlock';
  readonly archetype: string;
  readonly player: string;
  readonly value: number;
  readonly note: string;
}

export function auditBatch(cells: readonly BatchCell[]): BatchFlag[] {
  const flags: BatchFlag[] = [];
  // Drift: per-archetype, flag any species >±3pp from the archetype mean.
  const archetypes = [...new Set(cells.map((c) => c.archetype))];
  for (const archetype of archetypes) {
    const rows = cells.filter((c) => c.archetype === archetype);
    if (rows.length === 0) continue;
    const mean = rows.reduce((s, c) => s + c.winPct, 0) / rows.length;
    for (const c of rows) {
      const delta = c.winPct - mean;
      if (Math.abs(delta) > 3) {
        flags.push({
          kind: 'drift',
          archetype,
          player: c.player,
          value: delta,
          note: `Δ${delta.toFixed(1)}pp vs archetype mean ${mean.toFixed(1)}%`,
        });
      }
    }
  }
  // Softlock: any cell with exhaustion% above 40 (move-pool.md canary).
  for (const c of cells) {
    if (c.exhaustionPct > 40) {
      flags.push({
        kind: 'softlock',
        archetype: c.archetype,
        player: c.player,
        value: c.exhaustionPct,
        note: `exhaustion-rate ${c.exhaustionPct.toFixed(1)}%`,
      });
    }
  }
  return flags;
}
