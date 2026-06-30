import { COMBAT, MOMENTUM_REQ_BY_TIER, TIERS } from './config';
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
  // Banked opening ★ (Spine-1 — a boss "comes prepared"). Omitted ⇒ 0, so every
  // non-boss side keeps the momentum:0 default → bit-identical.
  readonly openingMomentum?: number;
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
    momentum: opts?.openingMomentum ?? 0,
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
  // NEVER-MIX guard (load-time, throws). `lookupMove` resolves the legacy
  // `MOVES` table FIRST, so a registered move sharing a name with a legacy
  // fixture move would be silently shadowed — which previously no-op'd CH1 type
  // effectiveness (the legacy Mixed-case type has no key in the CH1 chart). Fail
  // LOUD instead: a name may only be shared if it's mechanically identical
  // (e.g., TACKLE/SCRATCH — null-typed both sides). Fixture moves are namespaced
  // (`FX …`) precisely so this never trips in normal content.
  for (const [name, mv] of Object.entries(extras)) {
    const legacy = MOVES[name];
    if (legacy && (legacy.type !== mv.type || legacy.tier !== mv.tier)) {
      throw new Error(
        `registerMoves: "${name}" collides with a legacy fixture move ` +
          `(legacy ${String(legacy.type)}/${legacy.tier} vs ${String(mv.type)}/${mv.tier}) — ` +
          `lookupMove resolves the legacy table first, so this would silently shadow. ` +
          `Namespace the fixture key or rename the new move; never share a name across vocabularies.`,
      );
    }
  }
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

// Phased-unlock (Spine-1): an ATTACK (a move with no `effect`) is ★-locked until
// its user holds the tier's required momentum. Returns false for an under-★
// attack; TECHNIQUES (move.effect set) are exempt — they keep their current
// availability (the effect-move layer is untouched). 0★ ⇒ only light attacks,
// but light needs 0★ so a mon can always act its Basic. Gates the SOFT filter
// (affordableMoves) below + the hard validateAction gate.
export function tierMomentumLocked(side: SideState, move: Move): boolean {
  if (move.effect !== undefined) return false; // techniques are exempt (Spine-1)
  return side.momentum < MOMENTUM_REQ_BY_TIER[move.tier];
}

export function moveLegal(side: SideState, moveName: string): boolean {
  if (!side.species.moves.includes(moveName)) return false;
  const move = MOVES[moveName] ?? REGISTERED_MOVES[moveName];
  if (!move) return false;
  if (isWinded(side) && (move.tier === 'heavy' || move.tier === 'nuke')) return false;
  if (tierMomentumLocked(side, move)) return false; // phased-unlock ★-gate
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
  if (action.kind === 'call') {
    // A ★-Call override (GET AWAY / HANG IN THERE). Costs 1 ★.
    if (side.momentum < 1) throw new Error('Call needs ≥1 momentum');
    if (side.exhausted) throw new Error('Cannot Call while exhausted');
    return;
  }
  if (action.kind === 'release') {
    // FOCUS R2 — only legal for a focusing mon (resolveRound skips validation
    // for a mon whose `focus` is set; this guards a stray release otherwise).
    if (side.focus === undefined) throw new Error('Release needs an active focus');
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
  if (tierMomentumLocked(side, move)) {
    throw new Error(`${move.tier} locked — needs ≥${MOMENTUM_REQ_BY_TIER[move.tier]} momentum`);
  }
  if (!canAfford(side, move)) {
    throw new Error(`Cannot afford ${action.move}`);
  }
  // FULL POWER (Lane B) — the +50% attack buff spends ★. Validate the cost so
  // a buffed move can't fire without the momentum (the game gates this too).
  if (action.fullPower === true && side.momentum < COMBAT.fullPowerCost) {
    throw new Error(`Full Power needs ≥${COMBAT.fullPowerCost} momentum`);
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
