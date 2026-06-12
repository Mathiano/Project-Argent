import {
  SPECIES,
  affordableMoves,
  createBattleState,
  createSide,
  forcedAction,
  mulberry32,
} from '../engine';
import type { Action, BattleState, RNG, Stance } from '../engine';
import { mountCanvas } from './canvas';
import { createInputDispatcher } from './input';
import { SceneStack } from './scene';
import { createBattleScene } from './scenes/battle';

const host = document.getElementById('app');
if (!host) throw new Error('Argent: #app element missing in index.html');

const { ctx, getScale } = mountCanvas(host);
void getScale;

function randomFoeAI(state: BattleState, rng: RNG): Action {
  const me = state.foe;
  const forced = forcedAction(me);
  if (forced) return forced;
  const aff = affordableMoves(me);
  const move = aff[Math.floor(rng.next() * aff.length)]!;
  const r = rng.next();
  const stance: Stance = r < 0.55 ? 'A' : r < 0.9 ? 'G' : 'F';
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
    onResolve: (winner) => console.log('battle resolved:', winner),
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

createInputDispatcher((key) => scenes.input(key));
