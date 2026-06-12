import { COMBAT, TIERS } from './config';
import { LEGACY_TYPE_CHART, MOVES } from './data';
import type {
  Action,
  BattleState,
  BossCard,
  Move,
  SideState,
  Species,
  Stance,
  StatScale,
  TypeChart,
} from './types';

export function createSide(species: Species, scale?: StatScale): SideState {
  const sp: Species = scale
    ? {
        ...species,
        hp: Math.round(species.hp * (scale.hp ?? 1)),
        atk: Math.round(species.atk * (scale.atk ?? 1)),
        dfn: Math.round(species.dfn * (scale.dfn ?? 1)),
        spd: Math.round(species.spd * (scale.spd ?? 1)),
      }
    : species;
  return {
    species: sp,
    hp: sp.hp,
    maxHp: sp.hp,
    st: 100,
    exhausted: false,
    staggered: false,
    momentum: 0,
  };
}

export interface BattleSetup {
  readonly typeChart?: TypeChart;
  readonly bossCard?: BossCard;
}

export function createBattleState(
  player: SideState,
  foe: SideState,
  setup: BattleSetup = {},
): BattleState {
  return {
    player,
    foe,
    round: 1,
    history: [],
    typeChart: setup.typeChart ?? LEGACY_TYPE_CHART,
    ...(setup.bossCard !== undefined ? { bossCard: setup.bossCard } : {}),
  };
}

const REGISTERED_MOVES: { [name: string]: Move } = {};

export function registerMoves(extras: { readonly [name: string]: Move }): void {
  Object.assign(REGISTERED_MOVES, extras);
}

export function lookupMove(name: string): Move {
  const m = MOVES[name] ?? REGISTERED_MOVES[name];
  if (!m) throw new Error(`Unknown move: ${name}`);
  return m;
}

export function canAfford(side: SideState, move: Move): boolean {
  return side.st >= TIERS[move.tier].cost;
}

export function isWinded(side: SideState): boolean {
  return side.st <= COMBAT.winded;
}

export function moveLegal(side: SideState, moveName: string): boolean {
  if (!side.species.moves.includes(moveName)) return false;
  const move = MOVES[moveName];
  if (!move) return false;
  if (isWinded(side) && (move.tier === 'heavy' || move.tier === 'nuke')) return false;
  return canAfford(side, move);
}

export function affordableMoves(side: SideState): string[] {
  return side.species.moves.filter((m) => moveLegal(side, m));
}

// Returns a forced action if the side cannot freely choose, else null.
export function forcedAction(side: SideState): Action | null {
  if (side.exhausted) return { kind: 'rest' };
  if (affordableMoves(side).length === 0) return { kind: 'rest' };
  return null;
}

export function validateAction(side: SideState, action: Action): void {
  if (action.kind === 'rest') {
    if (!side.exhausted && affordableMoves(side).length > 0) {
      throw new Error('Rest illegal: side has affordable moves and is not exhausted');
    }
    return;
  }
  if (action.kind === 'catchBreath') {
    if (side.momentum < 1) throw new Error('Catch Breath needs ≥1 momentum');
    if (side.exhausted) throw new Error('Cannot Catch Breath while exhausted');
    return;
  }
  if (side.exhausted) throw new Error('Cannot move while exhausted');
  if (!side.species.moves.includes(action.move)) {
    throw new Error(`Side cannot use ${action.move}`);
  }
  const move = lookupMove(action.move);
  if (isWinded(side) && (move.tier === 'heavy' || move.tier === 'nuke')) {
    throw new Error(`${move.tier} locked while winded`);
  }
  if (!canAfford(side, move)) {
    throw new Error(`Cannot afford ${action.move}`);
  }
  void (action.stance satisfies Stance);
}
