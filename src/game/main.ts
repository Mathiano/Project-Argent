import {
  MOVES,
  SPECIES,
  affordableMoves,
  createBattleState,
  createSide,
  forcedAction,
  mulberry32,
} from '../engine';
import type { Action, BattleState, RNG, Stance } from '../engine';
import { mountCanvas } from './canvas';
import { SceneStack } from './scene';
import type { InputKey } from './scene';
import { createBattleScene } from './scenes/battle';

const host = document.getElementById('app');
if (!host) throw new Error('Argent: #app element missing in index.html');

const { ctx, getScale } = mountCanvas(host);
void getScale;

// Temporary task-4 driver: launch a battle straight into the scene with a
// deterministic RNG and a simple random-stance foe AI. Real flow lands in task 7.
function randomFoeAI(state: BattleState, rng: RNG): Action {
  const me = state.foe;
  const forced = forcedAction(me);
  if (forced) return forced;
  const aff = affordableMoves(me);
  const move = aff[Math.floor(rng.next() * aff.length)]!;
  const r = rng.next();
  const stance: Stance = r < 0.55 ? 'A' : r < 0.9 ? 'G' : 'F';
  void MOVES; // silence the import lint; we use MOVES elsewhere in the scene
  return { kind: 'move', move, stance };
}

const initial = createBattleState(createSide(SPECIES.EMBERCUB!), createSide(SPECIES.AQUAFIN!));
const rng = mulberry32(42);

const scenes = new SceneStack();
scenes.push(
  createBattleScene({
    state: initial,
    rng,
    chooseFoeAction: (state, rng) => randomFoeAI(state, rng),
    intro: ['Foe AQUAFIN appeared!', 'TIP: SELECT cycles', 'your STANCE.'],
    catchBreathUnlocked: true,
    canRun: false,
    onResolve: (winner) => {
      console.log('battle resolved:', winner);
    },
  }),
);

let lastTime = performance.now();
function frame(now: number): void {
  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;
  scenes.update(dt);
  scenes.draw(ctx);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

const KEYS: Record<string, InputKey> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  z: 'a', Z: 'a',
  x: 'b', X: 'b',
  c: 'select', C: 'select',
  Enter: 'start',
};

window.addEventListener('keydown', (e) => {
  const key = KEYS[e.key];
  if (!key) return;
  e.preventDefault();
  scenes.input(key);
});
