// CH1 CENSUS — what a chapter-one run actually contains, measured.
//
// The project's own risk register says the bottleneck is playtest hours, and the
// open question it names is whether "no grinding" leaves too little to do
// (`docs/design-risks-and-gaps.md` Risk 4: core fun is unproven at length). That is
// a question about NUMBERS — how many fights, how long each one runs, how much of
// the toolkit gets used — and nobody should have to sit through a two-hour run to
// get a first answer.
//
// So: enumerate every fight and every encounter zone by WALKING THE REAL MAPS (not
// a hand-kept list, which would drift the way the roadmap's CH1 checklist did), then
// run each fight through the real engine against the canonical `reader` yardstick.
//
// GAME LAYER on purpose: it reads map data, which is game-layer, and calls into the
// engine + sim. `src/sim/` may not import this (sim consumes the engine only).
//
// It measures; it gates nothing. No ladder band depends on these numbers.

import ch1BatchData from '../../docs/ch1-batch.json';
import typeChartData from '../../docs/typechart.json';
import {
  createBattleState,
  createSide,
  createTeam,
  foeProfileForFlag,
  isTeamWiped,
  loadDex,
  mulberry32,
  trainerPolicy,
} from '../engine';
import type {
  Action,
  BattleState,
  DexEntryJson,
  EnvironmentId,
  RNG,
  Species,
  TypeChart,
} from '../engine';
import { reader } from '../sim/archetypes';
import './overworld/maps';
import { getMap } from './overworld/maps';
import type { MapData, MapObject, ScriptCommand } from './overworld/types';

// The maps a CH1 run passes through, in route order.
export const CH1_MAPS: readonly string[] = [
  'BEDROOM',
  'HOUSE',
  'HEARTHWICK',
  'LAB',
  'HEARTHWICK_CENTER',
  'HEARTHWICK_MART',
  'ROUTE31',
  'VIOLET',
  'VIOLET_CENTER',
  'VIOLET_MART',
  'VIOLET_ACADEMY',
  'GYM',
  'ROUTE32',
];

const CH1_LEVEL = 13;
const TYPECHART = typeChartData as TypeChart;
const CH1_DEX = loadDex(ch1BatchData as DexEntryJson[], CH1_LEVEL);

export interface Ch1Fight {
  readonly flag: string;
  readonly map: string;
  readonly foeSpecies: readonly string[];
  readonly reward: number;
  // The Layer-4 profile id, or null → the generic wildFoeAI (unprofiled).
  readonly profileName: string | null;
  // The ground the fight is fought on (Layer 3), inherited from its map.
  readonly environment: EnvironmentId | undefined;
  // Does the trainer drag you in on sight, or can you walk past?
  readonly avoidable: boolean;
}

export interface Ch1Zone {
  readonly map: string;
  readonly species: readonly string[];
  readonly rate: number;
  readonly tiles: number;
}

function objectsOf(map: MapData): readonly MapObject[] {
  return map.objects;
}

function battleCommands(cmds: readonly ScriptCommand[]): readonly Extract<ScriptCommand, { kind: 'start-trainer-battle' }>[] {
  return cmds.filter(
    (c): c is Extract<ScriptCommand, { kind: 'start-trainer-battle' }> =>
      c.kind === 'start-trainer-battle',
  );
}

/** Every trainer fight reachable in CH1, read off the shipped maps. */
export function ch1Fights(): readonly Ch1Fight[] {
  const out: Ch1Fight[] = [];
  for (const name of CH1_MAPS) {
    let map: MapData;
    try {
      map = getMap(name);
    } catch {
      continue; // a map that isn't registered yet is simply absent from the census
    }
    for (const obj of objectsOf(map)) {
      const cmds =
        obj.type === 'npc' ? obj.interact : obj.type === 'script' ? obj.commands : [];
      for (const b of battleCommands(cmds)) {
        const species = typeof b.foeSpecies === 'string' ? [b.foeSpecies] : b.foeSpecies;
        out.push({
          flag: b.winFlag,
          map: map.name,
          foeSpecies: species,
          reward: b.reward ?? 0,
          profileName: foeProfileForFlag(b.winFlag)?.name ?? null,
          environment: map.environment,
          // An NPC with a sightRange pulls you in when you cross its line.
          avoidable: obj.type !== 'npc' || obj.sightRange === undefined,
        });
      }
    }
  }
  return out;
}

/** Every wild encounter zone in CH1, with its area and roll rate. */
export function ch1Zones(): readonly Ch1Zone[] {
  const out: Ch1Zone[] = [];
  for (const name of CH1_MAPS) {
    let map: MapData;
    try {
      map = getMap(name);
    } catch {
      continue;
    }
    for (const obj of objectsOf(map)) {
      if (obj.type !== 'encounter_zone') continue;
      out.push({
        map: map.name,
        species: obj.species,
        rate: obj.rate,
        tiles: obj.width * obj.height,
      });
    }
  }
  return out;
}

// ── Measuring one fight ───────────────────────────────────────────────────────

export interface FightMetrics {
  readonly flag: string;
  readonly winPct: number;
  readonly meanRounds: number;
  // Player ★ EARNED across the fight (read-wins), not the meter at the end —
  // the question is whether the momentum economy is exercised at all.
  readonly meanStarsEarned: number;
  // Mean player HP left on a WIN, as a fraction of max. A chapter of fights that
  // all end at 95% is a chapter with no tension.
  readonly meanHpLeftPct: number;
  readonly draws: number;
}

function teamOf(names: readonly string[]): ReturnType<typeof createTeam> {
  const sides = names.flatMap((n) => {
    const sp = CH1_DEX[n];
    return sp ? [createSide(sp)] : [];
  });
  if (sides.length === 0) throw new Error(`ch1Census: no known species in [${names.join(', ')}]`);
  return createTeam(sides);
}

function hpFraction(state: BattleState): number {
  const members = state.player.members;
  const hp = members.reduce((a, m) => a + Math.max(0, m.hp), 0);
  const max = members.reduce((a, m) => a + m.maxHp, 0);
  return max > 0 ? hp / max : 0;
}

/**
 * Run `fight` n times against the canonical `reader` yardstick playing the PLAYER
 * side — so the numbers describe a competent player, not a masher or an oracle.
 *
 * TEAM-SIZE CONTROL: the player fields as many mons as the trainer does, all of
 * `playerSpecies`. Without it a 2-mon trainer reads as a brutal difficulty spike
 * (Route 31's PAX measured 9% before this control, against 69-100% for his
 * neighbours) purely because the player was outnumbered — an artifact of the
 * harness, not of the fight. Repeating one species is the same mirror control
 * `src/sim/trainerProfiles.ts` uses to isolate policy from stat luck.
 */
export function simulateFight(
  fight: Ch1Fight,
  playerSpecies: Species,
  n: number,
  seed: number,
  maxRounds = 60,
): FightMetrics | null {
  const profile = foeProfileForFlag(fight.flag);
  // An UNPROFILED trainer fights with main.ts's wildFoeAI, which is game-layer and
  // not part of the engine's public API — so it cannot be measured from here. Rather
  // than substitute a different bot and quietly publish the wrong number, the census
  // reports the fight and marks it unmeasured. (Every shipped CH1 trainer is
  // profiled today; `ch1Census.test.ts` fails if that stops being true.)
  if (!profile) return null;
  const foePolicy = trainerPolicy(profile);
  let wins = 0;
  let draws = 0;
  let rounds = 0;
  let stars = 0;
  let hpSum = 0;

  for (let i = 0; i < n; i += 1) {
    const rng: RNG = mulberry32(seed + i * 7919);
    const foeTeam = teamOf(fight.foeSpecies);
    let state: BattleState = createBattleState(
      createTeam(foeTeam.members.map(() => createSide(playerSpecies))),
      foeTeam,
      {
        typeChart: TYPECHART,
        ...(fight.environment !== undefined ? { environment: fight.environment } : {}),
      },
    );
    let earned = 0;
    let r = 0;
    for (; r < maxRounds; r += 1) {
      const pAction: Action = reader.chooseAction(state, 'player', rng);
      const fAction: Action = foePolicy(state, 'foe', rng);
      let result;
      try {
        result = resolveRoundSafe(state, pAction, fAction, rng);
      } catch {
        break;
      }
      if (result === null) break;
      earned += result.events.filter(
        (e) => 'side' in e && e.side === 'player' && READ_WIN_KINDS.has(e.kind),
      ).length;
      state = result.state;
      if (isTeamWiped(state.foe)) {
        wins += 1;
        hpSum += hpFraction(state);
        break;
      }
      if (isTeamWiped(state.player)) break;
    }
    if (r >= maxRounds) draws += 1;
    rounds += r + 1;
    stars += earned;
  }

  return {
    flag: fight.flag,
    winPct: (wins / n) * 100,
    meanRounds: rounds / n,
    meanStarsEarned: stars / n,
    meanHpLeftPct: wins > 0 ? (hpSum / wins) * 100 : 0,
    draws,
  };
}

const READ_WIN_KINDS = new Set(['counter', 'opening', 'punish', 'clash']);

// resolveRound is imported lazily through this indirection so the module's import
// list stays engine-public-API only.
import { resolveRound } from '../engine';
function resolveRoundSafe(
  state: BattleState,
  p: Action,
  f: Action,
  rng: RNG,
): ReturnType<typeof resolveRound> | null {
  return resolveRound(state, p, f, rng);
}

export interface Ch1Census {
  readonly fights: readonly Ch1Fight[];
  readonly zones: readonly Ch1Zone[];
  readonly metrics: readonly FightMetrics[];
  // Fights the census could not measure (unprofiled → game-layer wildFoeAI).
  readonly unmeasured: readonly string[];
  readonly totals: {
    readonly fights: number;
    readonly avoidableFights: number;
    readonly profiledFights: number;
    readonly money: number;
    readonly expectedRounds: number;
    readonly zones: number;
    readonly wildSpecies: number;
  };
}

export function ch1Census(opts: { n: number; seed: number; starter: string }): Ch1Census {
  const fights = ch1Fights();
  const zones = ch1Zones();
  const player = CH1_DEX[opts.starter];
  if (!player) throw new Error(`ch1Census: unknown starter ${opts.starter}`);
  const measured = fights.map((f) => ({ f, m: simulateFight(f, player, opts.n, opts.seed) }));
  const metrics = measured.flatMap(({ m }) => (m ? [m] : []));
  const unmeasured = measured.flatMap(({ f, m }) => (m ? [] : [f.flag]));
  const wildSpecies = new Set(zones.flatMap((z) => z.species));
  return {
    fights,
    zones,
    metrics,
    unmeasured,
    totals: {
      fights: fights.length,
      avoidableFights: fights.filter((f) => f.avoidable).length,
      profiledFights: fights.filter((f) => f.profileName !== null).length,
      money: fights.reduce((a, f) => a + f.reward, 0),
      expectedRounds: metrics.reduce((a, m) => a + m.meanRounds, 0),
      zones: zones.length,
      wildSpecies: wildSpecies.size,
    },
  };
}
