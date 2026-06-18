import { COMBAT, TIERS } from './config';
import { LEGACY_TRAIT_TABLE, LEGACY_TYPE_CHART, MOVES } from './data';
import type {
  Action,
  BattleState,
  BossCard,
  Move,
  SideState,
  Species,
  Stance,
  StatScale,
  Team,
  TraitTable,
  TypeChart,
} from './types';
import { activeMon } from './types';

export interface SideOpts {
  // Arm the bond jumpstart (first read-win this battle banks an extra ★).
  // The game sets this for a sufficiently-bonded mon; omitted everywhere
  // else, so the returned SideState shape is unchanged (bit-identical).
  readonly jumpstartArmed?: boolean;
}

export function createSide(species: Species, scale?: StatScale, opts?: SideOpts): SideState {
  const sp: Species = scale
    ? {
        ...species,
        hp: Math.round(species.hp * (scale.hp ?? 1)),
        atk: Math.round(species.atk * (scale.atk ?? 1)),
        dfn: Math.round(species.dfn * (scale.dfn ?? 1)),
        spd: Math.round(species.spd * (scale.spd ?? 1)),
      }
    : species;
  // Global TTK knob: scale effective HP at battle creation (the HP:damage
  // ratio lever — broad, never per-mon). Species data stays static; per-mon
  // `scale.hp` already composed into sp.hp above, so this multiplies on top.
  const maxHp = Math.round(sp.hp * COMBAT.hpScale);
  return {
    species: sp,
    hp: maxHp,
    maxHp,
    st: 100,
    exhausted: false,
    staggered: false,
    momentum: 0,
    // Conditional spread: when not armed, the field is ABSENT (not `false`),
    // so the object is identical to the pre-jumpstart shape → bit-identical.
    ...(opts?.jumpstartArmed ? { jumpstartArmed: true } : {}),
  };
}

export interface BattleSetup {
  readonly typeChart?: TypeChart;
  readonly traits?: TraitTable;
  readonly bossCard?: BossCard;
}

// Wrap one or more SideStates into a Team. The first member is active.
// maxSize defaults to members.length; pass explicit maxSize when the team
// can grow (currently unused — boss cards declare teamSize at battle setup).
export function createTeam(members: readonly SideState[], maxSize?: number): Team {
  if (members.length === 0) throw new Error('createTeam: empty members');
  return {
    active: 0,
    members,
    maxSize: maxSize ?? members.length,
  };
}

function asTeam(side: SideState | Team): Team {
  if ('members' in side) return side;
  return createTeam([side]);
}

// createBattleState accepts either a SideState (1v1 convenience, wraps
// into a 1-member team) or a Team (multi-mon). The 1v1 path performs
// EXACTLY the same operations as the legacy single-side path — bit-
// identical on RNG draws and on the active mon's state shape.
export function createBattleState(
  player: SideState | Team,
  foe: SideState | Team,
  setup: BattleSetup = {},
): BattleState {
  return {
    player: asTeam(player),
    foe: asTeam(foe),
    round: 1,
    history: [],
    typeChart: setup.typeChart ?? LEGACY_TYPE_CHART,
    traits: setup.traits ?? LEGACY_TRAIT_TABLE,
    ...(setup.bossCard !== undefined ? { bossCard: setup.bossCard } : {}),
  };
}

// activeMon re-exported here for convenience (engine consumers can
// import it from './state' next to createSide/lookupMove).
export { activeMon };

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
  const move = MOVES[moveName] ?? REGISTERED_MOVES[moveName];
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
  if (action.kind === 'switch') {
    throw new Error('validateAction: switch needs team context — use validateActionTeam');
  }
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
  if (action.kind === 'throwBall') {
    // Always legal — the player may throw any turn (out-of-window throws
    // auto-fail game-side). No engine constraint.
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

// Team-aware validator: handles 'switch' with bench access, delegates
// other action kinds to validateAction on the active mon.
export function validateActionTeam(team: Team, action: Action): void {
  if (action.kind === 'switch') {
    if (action.toIndex < 0 || action.toIndex >= team.members.length) {
      throw new Error(`Switch target ${action.toIndex} out of range`);
    }
    if (action.toIndex === team.active) {
      throw new Error('Cannot switch to active mon');
    }
    const target = team.members[action.toIndex]!;
    if (target.hp <= 0) throw new Error('Cannot switch to fainted mon');
    return;
  }
  validateAction(activeMon(team), action);
}

export function setActiveMember(team: Team, side: SideState): Team {
  const newMembers = team.members.slice();
  newMembers[team.active] = side;
  return { ...team, members: newMembers };
}
