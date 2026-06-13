import {
  COUNTER_MAP,
  SPECIES,
  affordableMoves,
  createBattleState,
  createSide,
  falknerBossAI,
  forcedAction,
  loadDex,
  loadMoves,
  mulberry32,
  registerMoves,
  TRAITS,
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
  Stance,
  TypeChart,
} from '../engine';
import ch1BatchData from '../../docs/ch1-batch.json';
import movesData from '../../docs/moves.json';
import typechartData from '../../docs/typechart.json';
import { rivalAI } from '../sim/archetypes';
import { mountCanvas } from './canvas';
import { createInputDispatcher } from './input';
import { SceneStack } from './scene';
import { createBattleScene } from './scenes/battle';
import { createEndScene } from './scenes/end';
import { createOverworldScene } from './scenes/overworld';
import { createPrepScene } from './scenes/prep';
import { createStarterPickScene } from './scenes/starterPick';
import { createTitleScene } from './scenes/title';

const host = document.getElementById('app');
if (!host) throw new Error('Argent: #app element missing in index.html');

const { ctx } = mountCanvas(host);
const dispatcher = createInputDispatcher((key) => scenes.input(key));

const sessionFlags = new Set<string>();
const flagStore = {
  has: (flag: string): boolean => sessionFlags.has(flag),
  set: (flag: string): void => {
    sessionFlags.add(flag);
  },
};

// Load CH1 dex + moves at startup.
registerMoves(loadMoves(movesData as MoveJson[]));
const CH1_LEVEL = 13;
const FALKNER_ACE_LEVEL = 15;
const CH1_DEX = loadDex(ch1BatchData as DexEntryJson[], CH1_LEVEL);
const FALKNER_ACE_DEX = loadDex(ch1BatchData as DexEntryJson[], FALKNER_ACE_LEVEL);
const TYPECHART_CH1 = typechartData as TypeChart;

const STARTERS: readonly Species[] = ['KINDRAKE', 'GRUBLEAF', 'SILTSKIP'].map(
  (n) => CH1_DEX[n]!,
);

const FALKNER_ARENA: ArenaSchedule = {
  rhythmEveryN: 3,
  heavyExtraCost: 8,
  heavyExtraInitWeight: 1.3,
  telegraphAheadBy: 1,
};

// Use the locked B1 levers: gust=1.4, hp=1.15.
(TRAITS as { GUSTBORNE: { dmgMult: number; initMult: number } }).GUSTBORNE = {
  dmgMult: 1.4,
  initMult: 1.25,
};

void SPECIES;
void COUNTER_MAP;
const RNG_SEED = 0xa9c0;

const scenes = new SceneStack();

interface RunState {
  playerSpecies: Species | null;
  catchBreathUnlocked: boolean;
  rng: RNG;
}

const run: RunState = {
  playerSpecies: null,
  catchBreathUnlocked: false,
  rng: mulberry32(RNG_SEED),
};

function showTitle(): void {
  scenes.replace(createTitleScene({ onStart: showStarterPick }));
}

function showStarterPick(): void {
  scenes.replace(
    createStarterPickScene({
      starters: STARTERS,
      onPick: (species) => {
        run.playerSpecies = species;
        run.catchBreathUnlocked = false;
        run.rng = mulberry32(RNG_SEED + species.name.length);
        sessionFlags.clear();
        showOverworld('LAB', 'default', false);
      },
    }),
  );
}

// Simple wild AI: uniform-random affordable move + 40A/30G/30F stance mix.
function wildFoeAI(state: BattleState, rng: RNG): Action {
  const me = state.foe;
  const forced = forcedAction(me);
  if (forced) return forced;
  const aff = affordableMoves(me);
  const move = aff[Math.floor(rng.next() * aff.length)]!;
  const r = rng.next();
  const stance: Stance = r < 0.4 ? 'A' : r < 0.7 ? 'G' : 'F';
  return { kind: 'move', move, stance };
}

function showWildBattle(): void {
  const player = run.playerSpecies!;
  const state = createBattleState(createSide(player), createSide(SPECIES.FUZZLET!));
  scenes.replace(
    createBattleScene({
      state,
      rng: run.rng,
      chooseFoeAction: (s, r) => wildFoeAI(s, r),
      intro: ['A wild FUZZLET', 'appeared!', 'TIP: SELECT cycles', 'your STANCE.'],
      catchBreathUnlocked: false,
      canRun: true,
      onResolve: (winner) => {
        if (winner === 'player') {
          run.catchBreathUnlocked = true;
          showPrep();
        } else {
          showWildBattle();
        }
      },
    }),
  );
}

function showPrep(): void {
  const player = run.playerSpecies!;
  const foe = SPECIES[COUNTER_MAP[player.name]!]!;
  scenes.replace(
    createPrepScene({
      playerSpecies: player,
      foeSpecies: foe,
      foeTrainerName: 'KAMON',
      onContinue: showRivalBattle,
    }),
  );
}

function showRivalBattle(): void {
  const player = run.playerSpecies!;
  const foe = SPECIES[COUNTER_MAP[player.name]!]!;
  const state = createBattleState(
    createSide(player),
    createSide(foe, { atk: 0.85, dfn: 0.85 }),
  );
  scenes.replace(
    createBattleScene({
      state,
      rng: run.rng,
      chooseFoeAction: (s, r) => rivalAI.chooseAction(s, 'foe', r),
      intro: [
        'KAMON sent out',
        `the stolen ${foe.name}!`,
        'It has the type edge',
        '— but it hesitates.',
        'Out-read them.',
      ],
      catchBreathUnlocked: run.catchBreathUnlocked,
      canRun: false,
      onResolve: (winner) => showEnd(winner === 'player'),
    }),
  );
}

function showFalknerFight(): void {
  const player = run.playerSpecies ?? STARTERS[0]!;
  const galehawkBase = FALKNER_ACE_DEX.GALEHAWK!;
  const galehawk: Species = {
    ...galehawkBase,
    hp: Math.round(galehawkBase.hp * 1.15),
    trait: 'GUSTBORNE',
  };
  const card: BossCard = {
    species: galehawk,
    arenaSchedule: FALKNER_ARENA,
    breakBar: 2,
  };
  const state = createBattleState(createSide(player), createSide(galehawk), {
    typeChart: TYPECHART_CH1,
    bossCard: card,
  });
  scenes.replace(
    createBattleScene({
      state,
      rng: run.rng,
      chooseFoeAction: (s, r) => falknerBossAI(s, 'foe', r),
      intro: [
        'FALKNER: Welcome to my',
        'rooftop. Read the wind!',
        '— sent out GALEHAWK!',
      ],
      catchBreathUnlocked: true,
      canRun: false,
      onResolve: (winner) => {
        if (winner === 'player') showBadgeAwarded();
        else showFalknerFight();
      },
    }),
  );
}

function showBadgeAwarded(): void {
  scenes.replace(
    createEndScene({
      won: true,
      onRestart: showTitle,
    }),
  );
}

function showEnd(won: boolean): void {
  scenes.replace(createEndScene({ won, onRestart: showTitle }));
}

// Dev: skip ahead with ?skip=<scene>
const skip = new URLSearchParams(window.location.search).get('skip');
if (skip === 'starter') showStarterPick();
else if (skip === 'wild') {
  run.playerSpecies = SPECIES.EMBERCUB!;
  showWildBattle();
} else if (skip === 'prep') {
  run.playerSpecies = SPECIES.EMBERCUB!;
  run.catchBreathUnlocked = true;
  showPrep();
} else if (skip === 'rival') {
  run.playerSpecies = SPECIES.EMBERCUB!;
  run.catchBreathUnlocked = true;
  showRivalBattle();
} else if (skip === 'end') showEnd(true);
else if (skip === 'overworld') showOverworld('ROUTE31', 'default', false);
else if (skip === 'lab') showOverworld('LAB', 'default', false);
else if (skip === 'house') showOverworld('HOUSE', 'fromRoute', false);
else if (skip === 'falkner') {
  run.playerSpecies = STARTERS[0]!;
  showFalknerFight();
} else showTitle();

function showOverworld(map: string, spawn: string, faded: boolean): void {
  const opts = {
    map,
    spawn,
    inputState: dispatcher.state,
    flags: flagStore,
    onWarp(target: string) {
      const colon = target.indexOf(':');
      const nextMap = colon >= 0 ? target.slice(0, colon) : target;
      const nextSpawn = colon >= 0 ? target.slice(colon + 1) : 'default';
      showOverworld(nextMap, nextSpawn, true);
    },
    onEncounter(foeSpecies: string) {
      pushWildEncounter(foeSpecies);
    },
  };
  const sceneOpts = faded ? { ...opts, startFaded: true as const } : opts;
  scenes.replace(createOverworldScene(sceneOpts));
}

function pushWildEncounter(foeSpeciesName: string): void {
  const player = run.playerSpecies ?? STARTERS[0]!;
  const foe = CH1_DEX[foeSpeciesName] ?? SPECIES[foeSpeciesName];
  if (!foe) {
    console.warn(`Argent: encounter species not found: ${foeSpeciesName}`);
    return;
  }
  const state = createBattleState(createSide(player), createSide(foe));
  scenes.push(
    createBattleScene({
      state,
      rng: run.rng,
      chooseFoeAction: (s, r) => wildFoeAI(s, r),
      intro: [`A wild ${foe.name}`, 'appeared!'],
      catchBreathUnlocked: run.catchBreathUnlocked,
      canRun: true,
      onResolve: () => {
        scenes.pop();
      },
    }),
  );
}

let lastTime = performance.now();
function frame(now: number): void {
  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;
  scenes.update(dt);
  scenes.draw(ctx);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
