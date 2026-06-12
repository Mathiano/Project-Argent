import {
  COUNTER_MAP,
  SPECIES,
  affordableMoves,
  createBattleState,
  createSide,
  forcedAction,
  mulberry32,
} from '../engine';
import type { Action, BattleState, RNG, Species, Stance } from '../engine';
import { rivalAI } from '../sim/archetypes';
import { mountCanvas } from './canvas';
import { createInputDispatcher } from './input';
import { SceneStack } from './scene';
import { createBattleScene } from './scenes/battle';
import { createEndScene } from './scenes/end';
import { createPrepScene } from './scenes/prep';
import { createStarterPickScene } from './scenes/starterPick';
import { createTitleScene } from './scenes/title';

const host = document.getElementById('app');
if (!host) throw new Error('Argent: #app element missing in index.html');

const { ctx } = mountCanvas(host);

const STARTERS = ['EMBERCUB', 'SPROUTLE', 'AQUAFIN'] as const;
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
        showWildBattle();
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
else showTitle();

let lastTime = performance.now();
function frame(now: number): void {
  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;
  scenes.update(dt);
  scenes.draw(ctx);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

createInputDispatcher((key) => scenes.input(key));
