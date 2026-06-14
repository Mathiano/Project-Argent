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

// Stub CanvasRenderingContext2D — records every fillText so tests can
// assert what's on screen. Everything else is a no-op; we don't render
// pixels in Node.
interface RecordingCtx extends CanvasRenderingContext2D {
  readonly texts: string[];
  reset(): void;
}

function stubCtx(): RecordingCtx {
  const noop = () => {};
  const path = { fill: noop, stroke: noop, ellipse: noop };
  const texts: string[] = [];
  return new Proxy(
    { texts, reset: () => texts.splice(0) },
    {
      get(target, prop) {
        if (prop === 'texts') return (target as { texts: string[] }).texts;
        if (prop === 'reset') return (target as { reset: () => void }).reset;
        if (prop === 'fillText') return (text: string) => texts.push(String(text));
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
  ) as unknown as RecordingCtx;
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

describe('battle menu — FIGHT must open the move list, NOT the Calls-locked dialog', () => {
  function makeWildScene(): ReturnType<typeof createBattleScene> {
    const player = CH1.GRUBLEAF!;
    const foe = CH1.FLITPECK!;
    const state = createBattleState(
      createTeam([createSide(player)]),
      createTeam([createSide(foe)]),
    );
    return createBattleScene({
      state,
      rng: mulberry32(1),
      chooseFoeAction: () => ({ kind: 'move', move: 'TACKLE', stance: 'G' }),
      // 2-line intro matches main.ts pushWildEncounter (`A wild X`, `appeared!`).
      intro: ['A wild FLITPECK', 'appeared!'],
      catchBreathUnlocked: false, // first wild battle — Calls locked
      canRun: true,
      onResolve: () => {},
    });
  }

  test('cold-start: A through 2-line intro lands at FIGHT; A opens move list (no Calls dialog)', () => {
    const scene = makeWildScene();
    const ctx = stubCtx();

    // Two A presses to clear the 2-line intro → beginTurn → phase=menu, cursor=0.
    scene.input?.('a');
    scene.input?.('a');
    // One A press should select FIGHT (cursor 0 default).
    scene.input?.('a');

    ctx.reset();
    scene.draw(ctx);
    // The move menu shows the player's moves down the left edge. If
    // FIGHT opened correctly we should see TACKLE listed. If the Calls-
    // locked dialog fired instead, we'd see "Calls unlock after" / "your
    // first win.".
    expect(ctx.texts.join('|')).toContain('TACKLE');
    expect(ctx.texts.join('|')).not.toContain('Calls unlock');
  });

  test('cursor skips the locked CALL row: DOWN from FIGHT lands on RUN, not CALL', () => {
    const scene = makeWildScene();
    const ctx = stubCtx();

    scene.input?.('a');
    scene.input?.('a');
    // DOWN from FIGHT must skip the greyed CALL row (Calls locked here)
    // and land on RUN. A then confirms RUN → "Got away safely!" dialog.
    scene.input?.('down');
    scene.input?.('a');

    ctx.reset();
    scene.draw(ctx);
    const screen = ctx.texts.join('|');
    expect(screen).toContain('Got away safely');
    expect(screen).not.toContain('Calls unlock');
  });

  test('START key acts as a second confirm — does NOT shortcut to CALL', () => {
    // Regression: an old START handler forced menuCursor=1 and dispatched
    // A, surfacing the Calls-locked dialog when the user thought they
    // were confirming FIGHT. START should now just confirm the focused
    // row (FIGHT by default → move list).
    const scene = makeWildScene();
    const ctx = stubCtx();

    // Use START to advance the intro and confirm FIGHT.
    scene.input?.('start');
    scene.input?.('start');
    scene.input?.('start');

    ctx.reset();
    scene.draw(ctx);
    const screen = ctx.texts.join('|');
    expect(screen).toContain('TACKLE');
    expect(screen).not.toContain('Calls unlock');
  });
});

describe('battle move menu — A commits the highlighted move; SELECT cycles stance', () => {
  function driveToMoveList(onResolve: (w: 'player' | 'foe') => void = () => {}): {
    scene: ReturnType<typeof createBattleScene>;
    foeMove: { kind: 'move'; move: string; stance: 'A' | 'G' | 'F' };
  } {
    const player = CH1.GRUBLEAF!;
    const foe = CH1.FLITPECK!;
    const state = createBattleState(
      createTeam([createSide(player)]),
      createTeam([createSide(foe)]),
    );
    const foeMove = { kind: 'move' as const, move: 'TACKLE', stance: 'G' as const };
    const scene = createBattleScene({
      state,
      rng: mulberry32(1),
      chooseFoeAction: () => foeMove,
      intro: ['A wild FLITPECK', 'appeared!'],
      catchBreathUnlocked: false,
      canRun: true,
      onResolve,
    });
    // 2 A's intro, 1 A confirms FIGHT → phase=move.
    scene.input?.('a');
    scene.input?.('a');
    scene.input?.('a');
    return { scene, foeMove };
  }

  test('pressing A on the move list commits the highlighted move (phase leaves move; resolve runs)', () => {
    const { scene } = driveToMoveList();
    const ctx = stubCtx();

    // Sanity: we're in the move list.
    ctx.reset();
    scene.draw(ctx);
    expect(ctx.texts.join('|')).toContain('TACKLE');

    // Press A to commit TACKLE.
    scene.input?.('a');

    // The commit transitions phase → resolve and seeds pendingEvents
    // from resolveRound. The resolve tickResolve drains events on
    // update; after a few seconds of ticks, finishResolve fires and
    // calls beginTurn (or onResolve on team-wipe). Either way, the
    // bottom row is no longer the move list once events drain.
    for (let i = 0; i < 60; i += 1) scene.update?.(0.5);

    ctx.reset();
    scene.draw(ctx);
    const screen = ctx.texts.join('|');
    // After commit + resolve + next-turn beginTurn, the menu (or end
    // text) is back on screen — TACKLE should NOT still be drawn as
    // the cursor-prefixed move-list row. If A had been silently
    // dropped, we'd still be staring at "> TACKLE" with no progress.
    expect(screen).not.toContain('> TACKLE');
    // We expect either the FIGHT menu again, or end text.
    expect(screen.includes('FIGHT') || screen.includes('Press A')).toBe(true);
  });

  test('pressing A in the move list with a CH1 (registered-only) move still commits — no silent drop', () => {
    // GRUBLEAF has THORN FLICK (only in REGISTERED_MOVES, not LEGACY MOVES).
    // The earlier lookupMove fix means this should not throw; here we
    // verify A on THORN FLICK doesn't silently drop either.
    const { scene } = driveToMoveList();
    // Move cursor down once to land on THORN FLICK (GRUBLEAF moves order:
    // TACKLE, THORN FLICK, LEAF LASH, HEADBUTT).
    scene.input?.('down');
    scene.input?.('a');
    // Drain resolve.
    for (let i = 0; i < 60; i += 1) scene.update?.(0.5);

    const ctx = stubCtx();
    scene.draw(ctx);
    const screen = ctx.texts.join('|');
    expect(screen).not.toContain('> THORN FLICK');
  });

  test('SELECT in the move list cycles stance A → G → F → A (visible in the stance badge label)', () => {
    const { scene } = driveToMoveList();
    const ctx = stubCtx();

    ctx.reset();
    scene.draw(ctx);
    // Default stance is A (AGGR). The UI helper draws STANCE_NAME[stance]
    // — for 'A' that's "AGGR".
    expect(ctx.texts).toContain('AGGR');

    scene.input?.('select');
    ctx.reset();
    scene.draw(ctx);
    expect(ctx.texts).toContain('GUARD');

    scene.input?.('select');
    ctx.reset();
    scene.draw(ctx);
    expect(ctx.texts).toContain('FLUID');

    scene.input?.('select');
    ctx.reset();
    scene.draw(ctx);
    expect(ctx.texts).toContain('AGGR');
  });
});
