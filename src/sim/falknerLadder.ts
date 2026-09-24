// Falkner B1 ladder: 5 archetypes x 3 new starters at band (n=2000/cell).
// Levers come from the boss-card tuning list. Run via `npm run sim:falkner`
// or imported into the regression test once the bands stabilise. A thin wrapper
// over the generic runBossLadder (bossLadder.ts): the card is the engine's
// FALKNER_CARD, the same source the game's Falkner fight builds from.

import ch1BatchData from '../../docs/ch1-batch.json';
import movesData from '../../docs/moves.json';
import typeChartData from '../../docs/typechart.json';
import {
  FALKNER_CARD,
  falknerBossAI,
  LEGACY_TRAIT_TABLE,
  loadBossCard,
  loadDex,
  loadMoves,
  registerMoves,
} from '../engine';
import type {
  BossCard,
  DexEntryJson,
  MoveJson,
  Species,
  TraitTable,
  TypeChart,
  EnvironmentId,
} from '../engine';
import type { BotArchetype } from './archetypes';
import { FALKNER_LADDER_ARCHETYPES } from './archetypes';
import { runBossLadder } from './bossLadder';
import type { BossCellResult } from './bossLadder';

const STARTER_LEVEL = 13;

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

// The shipped card (engine FALKNER_CARD — the one source main.ts also builds
// from), with the two sweep levers laid over it: the ace HP scale and the
// GUSTBORNE damage mult (initMult stays the card's). Omitting the gust lever
// falls back to the engine-default LEGACY_TRAIT_TABLE.
export function buildFalknerAce(opts: { aceHpMult: number; gustBorneDmgMult?: number }): {
  galehawk: Species;
  card: BossCard;
  traits: TraitTable;
} {
  ensureRegistered();
  const loaded = loadBossCard(FALKNER_CARD, ch1BatchData as DexEntryJson[]);
  const card: BossCard = { ...loaded.card, statScale: { hp: opts.aceHpMult } };
  const gust = FALKNER_CARD.traits.GUSTBORNE!;
  const traits: TraitTable =
    opts.gustBorneDmgMult === undefined
      ? LEGACY_TRAIT_TABLE
      : { GUSTBORNE: { dmgMult: opts.gustBorneDmgMult, initMult: gust.initMult } };
  return { galehawk: card.species, card, traits };
}

export type FalknerCellResult = BossCellResult;

export function runFalknerLadder(opts: {
  aceHpMult: number;
  gustBorneDmgMult?: number;
  n: number;
  seed: number;
  environment?: EnvironmentId;
  // Defaults to the card's five; the runner appends `reader` as an unasserted column.
  archetypes?: readonly BotArchetype[];
}): FalknerCellResult[] {
  ensureRegistered();
  const { card, traits } = buildFalknerAce(opts);
  const starters: Species[] = ['KINDRAKE', 'GRUBLEAF', 'SILTSKIP'].map((name) => {
    const entry = dexEntry(name);
    return loadDex([entry], STARTER_LEVEL)[name]!;
  });
  return runBossLadder({
    card,
    policy: falknerBossAI,
    traits,
    typeChart: TYPECHART,
    starters,
    archetypes: opts.archetypes ?? FALKNER_LADDER_ARCHETYPES,
    ...(opts.environment !== undefined ? { environment: opts.environment } : {}),
    n: opts.n,
    seed: opts.seed,
  });
}
