// DEMO-COMPLETE GATE — the full spine, walked as ONE continuous run.
//
// This is the test the demo-readiness audit said was missing: the cold
// spine from the playable-overworld start all the way to the badge,
// composed (not segmented). It drives the REAL scenes — overworld,
// battle, Falkner prep, badge fanfare — wired the way main.ts wires
// them, through a slim harness that mirrors main.ts's show/push helpers
// (same altitude as coldstart.test.ts).
//
//   intro end-state (player_has_starter + starter seeded)
//     → Hearthwick → Route 31 → VIOLET CITY → GYM
//     → gym trainer fight (win, sets gym_trainer_beaten)
//     → Falkner prep → Falkner boss (win)
//     → ZEPHYR badge awarded + the fanfare beat
//
// The pre-starter intro internals (bedroom → lab → theft) stay owned by
// intro.test.ts; this composes from the overworld start, the same line
// coldstart.test.ts draws. Determinism: foe mons are built at 1 HP and
// spd 1 so the player always strikes first and KOs (spd 1 also zeroes
// the A-vs-F dodge), and the overworld's seeded `random` is pinned high
// (() => 0.999) so the Route 31 grass can't roll a wild encounter mid-walk.

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import ch1BatchData from '../../docs/ch1-batch.json';
import movesData from '../../docs/moves.json';
import typechartData from '../../docs/typechart.json';
import {
  activeMon,
  affordableMoves,
  createBattleState,
  createSide,
  createTeam,
  falknerBossAI,
  forcedAction,
  loadDex,
  loadMoves,
  mulberry32,
  registerMoves,
} from '../engine';
import type {
  Action,
  ArenaSchedule,
  BattleState,
  BossCard,
  DexEntryJson,
  MoveJson,
  RNG,
  SideState,
  Species,
  Stance,
  TraitTable,
  TypeChart,
} from '../engine';
import { SceneStack } from './scene';
import type { InputKey } from './scene';
import type { InputState } from './input';
import type { Facing, MapData, MapObject } from './overworld/types';
import { isWalkable } from './overworld/types';
import { getMap } from './overworld/maps';
import type { FlagStore } from './scenes/overworld';
import { createOverworldScene } from './scenes/overworld';
import type { OverworldScene } from './scenes/overworld';
import { createBattleScene } from './scenes/battle';
import { createFalknerPrepScene } from './scenes/falknerPrep';
import { createBadgeAwardScene } from './scenes/badgeAward';

registerMoves(loadMoves(movesData as MoveJson[]));
const CH1 = loadDex(ch1BatchData as DexEntryJson[], 13);
const TYPECHART = typechartData as TypeChart;
const ZEPHYR_BADGE = 'ZEPHYR';

const FALKNER_ARENA: ArenaSchedule = {
  rhythmEveryN: 3,
  heavyExtraCost: 8,
  heavyExtraInitWeight: 1.3,
  telegraphAheadBy: 1,
};
const FALKNER_TRAITS: TraitTable = { GUSTBORNE: { dmgMult: 1.4, initMult: 1.25 } };

interface MockInput extends InputState {
  press(key: InputKey): void;
  release(key: InputKey): void;
  releaseAll(): void;
}
function mockInput(): MockInput {
  const held = new Set<InputKey>();
  return {
    pressed: (k) => held.has(k),
    press: (k) => {
      held.add(k);
    },
    release: (k) => {
      held.delete(k);
    },
    releaseAll: () => held.clear(),
  };
}

function mockFlags(): FlagStore {
  const set = new Set<string>();
  return {
    has: (f) => set.has(f),
    set: (f) => {
      set.add(f);
    },
    unset: (f) => {
      set.delete(f);
    },
  };
}

// Test-weak foe: 1 HP so any landed strike KOs, and spd 1 so the player
// always wins initiative AND the A-vs-F dodge probability is 0
// (clamp((spdDef/spdAtk - 1)*2) with spdDef=1 → 0). Makes every fight
// resolve to a player win in ~one round per foe-mon, deterministically.
function weakFoe(sp: Species): SideState {
  const slow: Species = { ...sp, spd: 1 };
  return { ...createSide(slow), hp: 1 };
}

// Wild/trainer AI (mirrors main.ts wildFoeAI).
function wildFoeAI(state: BattleState, rng: RNG): Action {
  const me = activeMon(state.foe);
  const forced = forcedAction(me);
  if (forced) return forced;
  const aff = affordableMoves(me);
  const move = aff[Math.floor(rng.next() * aff.length)]!;
  const r = rng.next();
  const stance: Stance = r < 0.4 ? 'A' : r < 0.7 ? 'G' : 'F';
  return { kind: 'move', move, stance };
}

type TopKind = 'overworld' | 'battle' | 'prep' | 'badge' | 'end';

interface Harness {
  readonly scenes: SceneStack;
  readonly flags: FlagStore;
  readonly input: MockInput;
  readonly run: { party: SideState[]; badges: string[] };
  top(): TopKind;
  overworld(): OverworldScene;
  badgeShown(): boolean;
  pushWild(species: string): void;
  press(key: InputKey): void;
  tick(n?: number, dt?: number): void;
  rivalBondAwarded(): boolean;
}

// Slim harness mirroring main.ts's relevant show/push helpers + the
// BUG-2 loss handling (black-out, boss retry). The WIN path builds
// weakFoe() teams (deterministic player win); the LOSE path builds
// 'normal' foes vs a 1-HP player (deterministic player loss).
function createHarness(
  start: { map: string; spawnAt: { x: number; y: number; facing: Facing } },
  opts: { foeMode?: 'weak' | 'normal' } = {},
): Harness {
  const foeMode = opts.foeMode ?? 'weak';
  const makeFoe = (sp: Species): SideState => (foeMode === 'weak' ? weakFoe(sp) : createSide(sp));
  const scenes = new SceneStack();
  const flags = mockFlags();
  const input = mockInput();
  const rng: RNG = mulberry32(0xa9c0);
  const run: { party: SideState[]; badges: string[] } = { party: [], badges: [] };
  // BUG 2 black-out respawn (mirrors main.ts lastCenterTarget — the
  // Center 'wake' spot in front of the counter, not the door tile).
  const lastCenterTarget = 'HEARTHWICK_CENTER:wake';

  let topKind: TopKind = 'overworld';
  let currentOverworld: OverworldScene | null = null;
  let badgeWasShown = false;
  let rivalBondAwarded = false; // mirrors main.ts awardBondForFight on a KAMON win

  function healPartyInPlace(): void {
    run.party = run.party.map((s) => ({ ...s, hp: s.maxHp, st: 100, momentum: 0, exhausted: false, staggered: false }));
  }
  function blackout(): void {
    healPartyInPlace();
    scenes.pop(); // drop the battle
    const [map, spawn] = lastCenterTarget.split(':');
    showOverworld(map!, spawn!);
  }

  function buildPlayerTeam() {
    return createTeam(run.party.map((s) => ({ ...s, exhausted: false, staggered: false })));
  }
  function writeback(finalState: BattleState): void {
    run.party = finalState.player.members.map((m) => ({ ...m, exhausted: false, staggered: false }));
  }

  function awardBadge(id: string): boolean {
    if (run.badges.includes(id)) return false;
    run.badges.push(id);
    return true;
  }
  function pushBadgeAward(onContinue: () => void): void {
    badgeWasShown = true;
    topKind = 'badge';
    scenes.push(
      createBadgeAwardScene({
        badgeName: ZEPHYR_BADGE,
        leaderName: 'FALKNER',
        lines: ['Proof of the rooftop wind.'],
        onContinue,
      }),
    );
  }

  function pushTrainerFight(spec: string | readonly string[], winFlag: string): void {
    const names = typeof spec === 'string' ? [spec] : spec;
    const foeTeam = createTeam(names.map((n) => makeFoe(CH1[n]!)));
    const state = createBattleState(buildPlayerTeam(), foeTeam, { typeChart: TYPECHART });
    topKind = 'battle';
    scenes.push(
      createBattleScene({
        state,
        rng,
        chooseFoeAction: (s, r) => wildFoeAI(s, r),
        intro: ['Gym trainer!'],
        catchBreathUnlocked: false,
        canRun: false,
        onResolve: (winner, finalState) => {
          writeback(finalState);
          if (winner !== 'player') {
            blackout(); // BUG 2 — loss does NOT advance; heal + Center
            return;
          }
          flags.set(winFlag);
          scenes.pop();
          topKind = 'overworld';
          currentOverworld?.armPostBattleGrace();
        },
      }),
    );
  }

  // The KAMON gate fight, mirroring main.ts pushRivalGateFight's RESOLVE wiring
  // (the part that lived only in main.ts, inspection-verified). BOTH branches
  // advance — set kamon_beaten + return to the overworld, NO soft-lock and NO
  // black-out: a WIN awards bond, a LOSS heals the party first (so it isn't left
  // fainted in the gate). The KAMON card/AI/bond-factor are untouched + sim-gated
  // elsewhere; this proves only the loss/win resolve paths end-to-end. Foe shape
  // is a 2-mon team (chaff + ace) per the card; weakFoe/normal drives the outcome.
  function pushRivalGate(): void {
    const foeTeam = createTeam([makeFoe(CH1.FLITPECK!), makeFoe(CH1.GRITHOAX!)]);
    const state = createBattleState(buildPlayerTeam(), foeTeam, { typeChart: TYPECHART });
    topKind = 'battle';
    scenes.push(
      createBattleScene({
        state,
        rng,
        chooseFoeAction: (s, r) => wildFoeAI(s, r),
        intro: ['KAMON blocks the road south.'],
        catchBreathUnlocked: false,
        canRun: false,
        onResolve: (winner, finalState) => {
          writeback(finalState);
          flags.set('kamon_beaten'); // BOTH branches advance — KAMON leaves, the exit opens
          if (winner === 'player') {
            rivalBondAwarded = true; // mirror awardBondForFight (win only)
          } else {
            healPartyInPlace(); // a loss HEALS — not stranded fainted, not a black-out
          }
          scenes.pop();
          topKind = 'overworld';
        },
      }),
    );
  }

  // Wild encounter mirroring main.ts: win pops, loss blacks out, and
  // RUN (onFlee) returns to the SAME tile with no heal/warp.
  function pushWildEncounter(species: string): void {
    const state = createBattleState(buildPlayerTeam(), createSide(CH1[species]!), { typeChart: TYPECHART });
    topKind = 'battle';
    scenes.push(
      createBattleScene({
        state,
        rng,
        chooseFoeAction: (s, r) => wildFoeAI(s, r),
        intro: ['A wild one!'],
        catchBreathUnlocked: false,
        canRun: true,
        onFlee: (finalState) => {
          writeback(finalState);
          scenes.pop();
          topKind = 'overworld';
          currentOverworld?.armPostBattleGrace();
        },
        onResolve: (winner, finalState) => {
          writeback(finalState);
          if (winner !== 'player') {
            blackout();
            return;
          }
          scenes.pop();
          topKind = 'overworld';
          currentOverworld?.armPostBattleGrace();
        },
      }),
    );
  }

  function pushFalknerPrep(): void {
    topKind = 'prep';
    scenes.push(
      createFalknerPrepScene({
        playerSpecies: run.party[0]!.species,
        foeSpecies: CH1.GALEHAWK!,
        onContinue: () => {
          scenes.pop();
          pushFalknerBattle();
        },
      }),
    );
  }
  function pushFalknerBattle(): void {
    const galehawk: Species = { ...CH1.GALEHAWK!, trait: 'GUSTBORNE' };
    const card: BossCard = {
      species: galehawk,
      statScale: { hp: 1.15 },
      arenaSchedule: FALKNER_ARENA,
      breakBar: 2,
      teamSize: 2,
    };
    const foeTeam = createTeam([makeFoe(CH1.FLITPECK!), makeFoe(galehawk)]);
    const state = createBattleState(buildPlayerTeam(), foeTeam, {
      typeChart: TYPECHART,
      traits: FALKNER_TRAITS,
      bossCard: card,
    });
    topKind = 'battle';
    scenes.push(
      createBattleScene({
        state,
        rng,
        chooseFoeAction: (s, r) => falknerBossAI(s, 'foe', r),
        intro: ['FALKNER!'],
        catchBreathUnlocked: true,
        canRun: false,
        onResolve: (winner, finalState) => {
          writeback(finalState);
          scenes.pop();
          if (winner === 'player') {
            flags.set('falkner_beaten');
            awardBadge(ZEPHYR_BADGE);
            pushBadgeAward(() => {
              scenes.pop();
              topKind = 'overworld';
            });
          } else {
            // BUG 2 — boss loss heals + instant retry (re-prep), not a
            // softlock and not a fainted rooftop party.
            healPartyInPlace();
            pushFalknerPrep();
          }
        },
      }),
    );
  }

  function showOverworld(map: string, spawn: string, spawnAt?: { x: number; y: number; facing: Facing }): void {
    const scene = createOverworldScene({ random: () => 0.999, // pinned high → grass can't roll an encounter mid-walk
      map,
      spawn,
      inputState: input,
      flags,
      ...(spawnAt ? { spawnAt } : {}),
      onWarp(target) {
        const colon = target.indexOf(':');
        const nextMap = colon >= 0 ? target.slice(0, colon) : target;
        const nextSpawn = colon >= 0 ? target.slice(colon + 1) : 'default';
        showOverworld(nextMap, nextSpawn);
      },
      onEncounter(species) {
        pushWildEncounter(species);
      },
      onTrainerBattle(foeSpecies, winFlag) {
        pushTrainerFight(foeSpecies, winFlag);
      },
      onBossBattle(bossId) {
        if (bossId === 'falkner') pushFalknerPrep();
      },
      onRivalBattle() {
        pushRivalGate();
      },
    });
    currentOverworld = scene;
    topKind = 'overworld';
    scenes.replace(scene);
  }

  showOverworld(start.map, 'default', start.spawnAt);

  return {
    scenes,
    flags,
    input,
    run,
    top: () => topKind,
    overworld: () => currentOverworld!,
    badgeShown: () => badgeWasShown,
    pushWild: (species) => pushWildEncounter(species),
    press: (k) => scenes.input(k),
    tick: (n = 1, dt = 0.02) => {
      for (let i = 0; i < n; i += 1) scenes.update(dt);
    },
    rivalBondAwarded: () => rivalBondAwarded,
  };
}

// Walk one tile toward facing `dir`: hold until the tile coordinate
// changes (or a bound is hit), release, drain MOVE_DURATION.
function step(h: Harness, dir: Facing): void {
  const start = h.overworld().currentPosition();
  h.input.press(dir);
  for (let i = 0; i < 40; i += 1) {
    h.tick(1);
    const p = h.overworld().currentPosition();
    if (p.x !== start.x || p.y !== start.y) break;
  }
  h.input.release(dir);
  h.tick(14);
}

// Tiles the player cannot enter for pathing: blocking NPCs (respecting
// blockedUntilFlag, exactly like npcBlocksAt) + every warp tile except
// the destination (so a route never accidentally warps mid-walk).
function pathBlocked(map: MapData, flags: { has(f: string): boolean }, tx: number, ty: number): Set<string> {
  const blocked = new Set<string>();
  for (const o of map.objects as readonly MapObject[]) {
    if (o.type === 'npc') {
      const blocks = !o.blockedUntilFlag || !flags.has(o.blockedUntilFlag);
      if (blocks) blocked.add(`${o.x},${o.y}`);
    } else if (o.type === 'warp' && !(o.x === tx && o.y === ty)) {
      blocked.add(`${o.x},${o.y}`);
    }
  }
  return blocked;
}

// BFS the next step toward (tx,ty) over walkable, non-blocked tiles.
function bfsNext(
  map: MapData,
  flags: { has(f: string): boolean },
  sx: number, sy: number, tx: number, ty: number,
): Facing | null {
  if (sx === tx && sy === ty) return null;
  const blocked = pathBlocked(map, flags, tx, ty);
  const start = `${sx},${sy}`;
  const prev = new Map<string, string | null>([[start, null]]);
  const q: Array<[number, number]> = [[sx, sy]];
  while (q.length) {
    const [x, y] = q.shift()!;
    if (x === tx && y === ty) break;
    for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]] as const) {
      const nx = x + dx, ny = y + dy, k = `${nx},${ny}`;
      if (prev.has(k)) continue;
      if (!isWalkable(map, nx, ny)) continue;
      if (blocked.has(k) && !(nx === tx && ny === ty)) continue;
      prev.set(k, `${x},${y}`);
      q.push([nx, ny]);
    }
  }
  if (!prev.has(`${tx},${ty}`)) return null; // unreachable
  let cur = `${tx},${ty}`;
  while (prev.get(cur) !== start) {
    const p = prev.get(cur);
    if (p == null) return null;
    cur = p;
  }
  const [cx, cy] = cur.split(',').map(Number) as [number, number];
  if (cy > sy) return 'down';
  if (cy < sy) return 'up';
  if (cx > sx) return 'right';
  return 'left';
}

// Walk toward a target tile via BFS, recomputing each step so a gust
// push-back (Falkner's rooftop) is just re-attempted. Robust to map
// geometry (winding paths, water, forest). Bails if unreachable.
function walkTo(h: Harness, tx: number, ty: number, budget = 400): void {
  for (let i = 0; i < budget; i += 1) {
    const p = h.overworld().currentPosition();
    if (p.x === tx && p.y === ty) return;
    const dir = bfsNext(getMap(p.map), h.flags, p.x, p.y, tx, ty);
    if (dir === null) return;
    step(h, dir);
  }
}

// Face `dir` without moving (tap: the turn-hold timer is cancelled on
// release before it commits to a walk).
function face(h: Harness, dir: Facing): void {
  h.input.press(dir);
  h.tick(1);
  h.input.release(dir);
  h.tick(1);
}

// Pump A + ticks until the battle on top resolves (its onResolve pops
// it). Detects resolution by the harness leaving the 'battle' top.
function driveBattleToWin(h: Harness): void {
  for (let i = 0; i < 300 && h.top() === 'battle'; i += 1) {
    h.press('a');
    h.tick(6, 0.2);
  }
}

// Walk to (tx,ty) RESOLVING any line-of-sight trainer battles that
// interrupt the climb — the gym is now a gauntlet (F2). When a sight-
// trainer freezes movement (the player can't step), let the walk-up
// cutscene + dialog play, dismiss it to fire the forced battle, and win.
function climbResolvingTrainers(h: Harness, tx: number, ty: number): void {
  for (let i = 0; i < 80; i += 1) {
    if (h.top() === 'battle') {
      driveBattleToWin(h);
      continue;
    }
    const p = h.overworld().currentPosition();
    if (p.x === tx && p.y === ty) return;
    const dir = bfsNext(getMap(p.map), h.flags, p.x, p.y, tx, ty);
    if (dir === null) return;
    step(h, dir);
    const after = h.overworld().currentPosition();
    if (after.x === p.x && after.y === p.y && h.top() !== 'battle') {
      // Didn't move and not yet in battle → a sight-trainer froze us mid-
      // approach. Let the cutscene + dialog finish, dismiss → forced battle.
      h.tick(80, 0.03);
      h.press('a');
      h.tick(8);
      if (h.top() === 'battle') driveBattleToWin(h);
    }
  }
}

describe('DEMO-COMPLETE GATE — cold spine intro → Violet → gym → Falkner → badge (one continuous run)', () => {
  beforeEach(() => {
    // Belt-and-suspenders: the overworld's encounter roll is the injected
    // seeded `random` (pinned to 0.999 in showOverworld). This spy covers any
    // residual Math.random consumer so nothing can interrupt the spine walk.
    vi.spyOn(Math, 'random').mockReturnValue(0.999);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('walks the whole spine and ends with the ZEPHYR badge', () => {
    // Intro end-state: a starter in the party + player_has_starter set,
    // exactly what New Game + the lab ceremony establish. KINDRAKE is a
    // fair-path starter per the boss card.
    const h = createHarness({
      map: 'HEARTHWICK',
      // Authored Tiled town: drop just north of the elder@(18,34) (the gatekeeper
      // steps aside once player_has_starter is set) — the south exit is (18,35).
      spawnAt: { x: 18, y: 33, facing: 'down' },
    });
    h.run.party = [createSide(CH1.KINDRAKE!)];
    h.flags.set('player_has_starter');
    // Pre-mark Route 31's step-on flavor (the warning + the two hidden
    // ground items) + the JAY robber as already handled, so they don't
    // interrupt the spine walk. This gate tests TRAVERSAL; route content
    // (events, items, the lost-mon vignette, JAY's forced theft encounter)
    // is covered by firstRoad.test.ts / the JAY unmissability test.
    for (const f of ['route31_warning', 'route31_item_forest', 'route31_item_pond', 'route31_trainer_beaten'])
      h.flags.set(f);

    // Intro flags present (the audit's "intro flags" precondition).
    expect(h.flags.has('player_has_starter')).toBe(true);
    expect(h.run.party[0]!.species.name).toBe('KINDRAKE');
    expect(h.top()).toBe('overworld');
    expect(h.overworld().currentPosition().map).toBe('HEARTHWICK');

    // Hearthwick → Route 31 (south exit at (18,35)).
    walkTo(h, 18, 35);
    h.tick(30); // fade + warp + new-scene fade-in
    expect(h.overworld().currentPosition().map).toBe('ROUTE31');

    // Route 31 → Violet City: the BFS walker winds the whole multi-screen
    // route (grass, forest, around the pond) to the south-edge exit gap
    // (the Tiled map's warp_south at (11,73)).
    walkTo(h, 11, 73);
    h.tick(30);
    expect(h.overworld().currentPosition().map).toBe('VIOLET');

    // Violet City → gym: enter from the north (S3) and walk south down
    // the city lane to the gym door at the south end.
    walkTo(h, 9, 12);
    h.tick(30);
    expect(h.overworld().currentPosition().map).toBe('GYM');

    // Gym trainer: stand at (7,13) facing up, the trainer is at (7,12).
    walkTo(h, 7, 13);
    face(h, 'up');
    h.press('a'); // interact → opens the trainer dialog
    h.tick(2);
    h.press('a'); // advance the 1-page dialog → fires start-trainer-battle
    h.tick(2);
    expect(h.top()).toBe('battle');
    driveBattleToWin(h);
    expect(h.flags.has('gym_trainer_beaten')).toBe(true);
    expect(h.top()).toBe('overworld');

    // Climb to Falkner: stand at (6,3), the leader is on the throne at
    // (6,2). The rooftop is now a GAUNTLET — three line-of-sight trainers
    // (F2) watch the rows the player must cross; climbResolvingTrainers
    // fights each forced battle on the way up.
    climbResolvingTrainers(h, 6, 3);
    expect(h.flags.has('gym_trainer_2_beaten')).toBe(true);
    expect(h.flags.has('gym_trainer_3_beaten')).toBe(true);
    expect(h.flags.has('gym_trainer_4_beaten')).toBe(true);
    expect(h.overworld().currentPosition()).toMatchObject({ x: 6, y: 3 });
    face(h, 'up');
    h.press('a'); // interact → Falkner dialog
    h.tick(2);
    h.press('a'); // advance dialog → start-boss-battle → prep scene
    h.tick(2);
    expect(h.top()).toBe('prep');

    h.press('a'); // prep → Falkner boss battle
    h.tick(2);
    expect(h.top()).toBe('battle');
    driveBattleToWin(h);

    // Win → badge fanfare beat (the S1 payoff).
    expect(h.top()).toBe('badge');
    expect(h.badgeShown()).toBe(true);
    expect(h.run.badges).toContain('ZEPHYR');
    expect(h.flags.has('falkner_beaten')).toBe(true);

    // Dismiss the fanfare → back to the gym, badge in hand.
    h.press('a');
    h.tick(2);
    expect(h.top()).toBe('overworld');
    expect(h.run.badges).toEqual(['ZEPHYR']);
  });
});

describe('DEMO-COMPLETE GATE — the LOSE path (BUG 2: losing must not advance you)', () => {
  beforeEach(() => {
    vi.spyOn(Math, 'random').mockReturnValue(0.999);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('losing the gym trainer blacks out (heal + Center) and does NOT reach Falkner', () => {
    // Player at 1 HP vs a normal-strength trainer → guaranteed loss.
    const h = createHarness(
      { map: 'GYM', spawnAt: { x: 7, y: 13, facing: 'up' } },
      { foeMode: 'normal' },
    );
    h.run.party = [{ ...createSide(CH1.KINDRAKE!), hp: 1 }];

    // Trainer is at (7,12), directly north. Settle a frame + face it.
    h.tick(2);
    face(h, 'up');
    h.press('a'); // interact → trainer dialog
    h.tick(2);
    h.press('a'); // advance → start-trainer-battle
    h.tick(2);
    expect(h.top()).toBe('battle');

    driveBattleToWin(h); // (drives to resolve — here, a loss)

    // Blacked out: back in the OVERWORLD at the Center, party HEALED,
    // win flag NOT set — progress did not advance, and we are nowhere
    // near Falkner.
    expect(h.top()).toBe('overworld');
    expect(h.overworld().currentPosition().map).toBe('HEARTHWICK_CENTER');
    expect(h.flags.has('gym_trainer_beaten')).toBe(false);
    expect(h.run.party.every((m) => m.hp === m.maxHp)).toBe(true);
  });

  test('losing Falkner heals + offers an instant retry (re-prep), not a softlock', () => {
    const h = createHarness(
      // Stand directly below the leader's throne (6,2).
      { map: 'GYM', spawnAt: { x: 6, y: 3, facing: 'up' } },
      { foeMode: 'normal' },
    );
    h.run.party = [{ ...createSide(CH1.KINDRAKE!), hp: 1 }];
    h.flags.set('gym_trainer_beaten');

    h.tick(2);
    face(h, 'up');
    h.press('a'); // interact → Falkner dialog
    h.tick(2);
    h.press('a'); // advance → start-boss-battle → prep
    h.tick(2);
    expect(h.top()).toBe('prep');
    h.press('a'); // prep → boss battle
    h.tick(2);
    expect(h.top()).toBe('battle');

    driveBattleToWin(h); // (a loss)

    // Instant retry: the prep re-opens with a HEALED party; the badge
    // flag is NOT set and we are not stuck.
    expect(h.top()).toBe('prep');
    expect(h.flags.has('falkner_beaten')).toBe(false);
    expect(h.run.badges).not.toContain('ZEPHYR');
    expect(h.run.party.every((m) => m.hp === m.maxHp)).toBe(true);
  });
});

describe('KAMON gate fight — BOTH resolve paths advance (no soft-lock)', () => {
  // The Violet→Route 32 gate fight's resolve (pushRivalGateFight) lived only in
  // main.ts, inspection-verified. These drive the gate fight end-to-end through
  // the spine harness and assert both branches. KAMON sits at (6,28); the player
  // approaches from (6,27); the exit warp is (6,29)→ROUTE32.
  beforeEach(() => {
    vi.spyOn(Math, 'random').mockReturnValue(0.999);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Approach KAMON + drain his pre-fight dialog → the rival fight starts.
  function startGateFight(h: Harness): void {
    h.tick(2);
    face(h, 'down'); // face KAMON at (6,28)
    for (let i = 0; i < 12 && h.top() !== 'battle'; i += 1) {
      h.press('a'); // open / advance the pre-fight dialog → start-rival-battle
      h.tick(2);
    }
    expect(h.top()).toBe('battle');
  }

  test('LOSE: still advances — kamon_beaten set, party HEALED, exit opens, NOT blacked out', () => {
    const h = createHarness(
      { map: 'VIOLET', spawnAt: { x: 6, y: 27, facing: 'down' } },
      { foeMode: 'normal' },
    );
    h.run.party = [{ ...createSide(CH1.KINDRAKE!), hp: 1 }]; // guaranteed loss
    h.flags.set('zephyr_earned'); // KAMON present (obstacle gone)

    startGateFight(h);
    driveBattleToWin(h); // drives to resolve — here a LOSS

    // No soft-lock, no black-out: still on VIOLET (not warped to the Center).
    expect(h.top()).toBe('overworld');
    expect(h.overworld().currentPosition().map).toBe('VIOLET');
    expect(h.flags.has('kamon_beaten')).toBe(true); // the gate opens on a loss too
    expect(h.run.party.every((m) => m.hp === m.maxHp)).toBe(true); // healed, not stranded fainted
    expect(h.rivalBondAwarded()).toBe(false); // no bond on a loss

    // KAMON despawned (kamon_beaten) → the way south is clear: walk to the exit.
    step(h, 'down'); // (6,27) → (6,28), the now-clear gate tile
    step(h, 'down'); // (6,28) → (6,29), the exit warp
    h.tick(30);
    expect(h.overworld().currentPosition().map).toBe('ROUTE32'); // exit opened
  });

  test('WIN: kamon_beaten set, bond awarded, exit opens', () => {
    const h = createHarness(
      { map: 'VIOLET', spawnAt: { x: 6, y: 27, facing: 'down' } },
      { foeMode: 'weak' },
    );
    h.run.party = [createSide(CH1.KINDRAKE!)]; // full HP vs weak foes → win
    h.flags.set('zephyr_earned');

    startGateFight(h);
    driveBattleToWin(h); // a WIN

    expect(h.top()).toBe('overworld');
    expect(h.overworld().currentPosition().map).toBe('VIOLET');
    expect(h.flags.has('kamon_beaten')).toBe(true);
    expect(h.rivalBondAwarded()).toBe(true); // bond awarded on a win
    expect(h.run.party[0]!.hp).toBeGreaterThan(0); // survived

    step(h, 'down');
    step(h, 'down');
    h.tick(30);
    expect(h.overworld().currentPosition().map).toBe('ROUTE32'); // exit opened
  });
});

describe('RUN bug — fleeing a wild fight returns to the same tile, no heal, no warp', () => {
  beforeEach(() => {
    vi.spyOn(Math, 'random').mockReturnValue(0.999);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('RUN from a wild battle returns to the SAME overworld position with the party unchanged (not the Center, not healed)', () => {
    const h = createHarness({ map: 'ROUTE31', spawnAt: { x: 9, y: 7, facing: 'down' } });
    // Damaged party so a black-out (the bug) would visibly HEAL it —
    // a clean flee must preserve the 10 HP.
    h.run.party = [{ ...createSide(CH1.KINDRAKE!), hp: 10 }];
    h.tick(2);
    const before = h.overworld().currentPosition();

    h.pushWild('FLITPECK'); // step into a wild encounter
    expect(h.top()).toBe('battle');

    // Flee: clear the 1-line intro → menu, cursor FIGHT → (skips the
    // disabled PKMN/CALL rows) → RUN, confirm, advance "Got away safely!".
    h.press('a'); // intro → menu
    h.press('down'); // FIGHT → RUN
    h.press('a'); // confirm RUN → "Got away safely!"
    h.press('a'); // advance → onFlee
    h.tick(2);

    // Back on the SAME tile (Route 31), party untouched — NOT blacked
    // out to the Center, NOT healed.
    expect(h.top()).toBe('overworld');
    expect(h.overworld().currentPosition().map).toBe('ROUTE31');
    expect(h.overworld().currentPosition()).toEqual(before);
    expect(h.run.party[0]!.hp).toBe(10);
  });
});
