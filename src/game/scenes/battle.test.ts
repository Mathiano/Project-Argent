// Regression: the battle scene used to crash on first render when a side
// referenced a CH1 move (THORN FLICK, GUST RAKE, HEADBUTT, ...) because
// the renderer reached into the LEGACY MOVES fixture instead of going
// through lookupMove (which also checks REGISTERED_MOVES). A real cold-
// start with a CH1 starter would freeze the canvas on the first menu
// frame — the user perceived it as "boots back to title".

import { describe, expect, test } from 'vitest';
import {
  createBattleState,
  createSide,
  createTeam,
  loadDex,
  loadMoves,
  mulberry32,
  registerMoves,
} from '../../engine';
import type { Action, BattleState, DexEntryJson, MoveJson, RNG } from '../../engine';
import ch1BatchData from '../../../docs/ch1-batch.json';
import movesData from '../../../docs/moves.json';
import { createBattleScene } from './battle';

// Stub CanvasRenderingContext2D — record nothing, no-op everything draw
// the battle scene actually calls. The point is to prove no throw, not
// to validate pixel output.
function stubCtx(): CanvasRenderingContext2D {
  const noop = () => {};
  const path = { fill: noop, stroke: noop, ellipse: noop };
  return new Proxy(
    {},
    {
      get(_, prop) {
        if (prop === 'beginPath') return () => path;
        if (prop === 'measureText') return () => ({ width: 10 });
        if (prop === 'canvas') return { width: 320, height: 180 };
        if (prop === 'textBaseline' || prop === 'textAlign' || prop === 'lineWidth') return '';
        if (prop === 'fillStyle' || prop === 'strokeStyle' || prop === 'font') return '';
        return noop;
      },
      set() {
        return true;
      },
    },
  ) as unknown as CanvasRenderingContext2D;
}

// One-time CH1 move registration so lookupMove finds THORN FLICK etc.
registerMoves(loadMoves(movesData as MoveJson[]));
const CH1 = loadDex(ch1BatchData as DexEntryJson[], 13);

function ch1FoeAI(): (state: BattleState, rng: RNG) => Action {
  return (state, rng): Action => {
    void state;
    // Force a CH1 move (THORN FLICK is only in REGISTERED_MOVES) to
    // exercise the path that used to crash the renderer.
    void rng;
    return { kind: 'move', move: 'THORN FLICK', stance: 'A' };
  };
}

describe('battle scene — cold-start crash regression', () => {
  test('renders without throw when foe action references a CH1 (non-fixture) move', () => {
    const player = CH1.GRUBLEAF!;
    const foe = CH1.GRUBLEAF!;
    const state = createBattleState(
      createTeam([createSide(player)]),
      createTeam([createSide(foe)]),
    );

    const scene = createBattleScene({
      state,
      rng: mulberry32(1),
      chooseFoeAction: ch1FoeAI(),
      intro: [],
      catchBreathUnlocked: false,
      canRun: true,
      onResolve: () => {},
    });

    // Advance past intro+beginTurn so phase=menu and foeAction is set
    // to the CH1 move.
    scene.update?.(0.01);
    const ctx = stubCtx();
    expect(() => scene.draw(ctx)).not.toThrow();

    // Walking into the move menu also used to throw on the move list
    // (`MOVES[m]!` for THORN FLICK = undefined → .tier crash).
    scene.input?.('a'); // FIGHT
    expect(() => scene.draw(ctx)).not.toThrow();
  });

  test('CH1 starter (GRUBLEAF) species moves include non-fixture moves that need lookupMove', () => {
    // Sanity: the scenario this test guards actually exists in the data.
    const grubleaf = CH1.GRUBLEAF!;
    expect(grubleaf.moves).toContain('THORN FLICK');
    expect(grubleaf.moves).toContain('HEADBUTT');
  });
});
