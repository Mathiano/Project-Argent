// Phase 6a GATE — the battle-scene catch flow. Drives the real scene
// with injected catch callbacks (the math is proven in catching.test.ts)
// to pin: the BALL row, window detection (read + exhausted + out), the
// Wariness flee, caught → onCaught, and Path 2 (spare a fainted foe).

import { describe, expect, test } from 'vitest';
import {
  SPECIES,
  createBattleState,
  createSide,
  createTeam,
  mulberry32,
} from '../../engine';
import type { Action, BattleState, RNG, SideState } from '../../engine';
import { createBattleScene } from './battle';
import type { CatchWindow } from '../catching';

function noopCtx(): CanvasRenderingContext2D {
  const noop = () => {};
  const path = { fill: noop, stroke: noop, ellipse: noop };
  return new Proxy(
    {},
    {
      get(_t, prop) {
        if (prop === 'beginPath') return () => path;
        if (prop === 'measureText') return () => ({ width: 10 });
        if (prop === 'canvas') return { width: 320, height: 180 };
        return noop;
      },
      set: () => true,
    },
  ) as unknown as CanvasRenderingContext2D;
}

interface Recorder {
  windows: CatchWindow[];
  caught: number;
  joined: number;
  willingCalls: number;
  foeGone: number;
  resolved: ('player' | 'foe')[];
}

function makeScene(opts: {
  foe?: SideState;
  foeAction?: Action;
  balls?: number;
  medicine?: number;
  catchResult?: (w: CatchWindow) => boolean;
  joinResult?: boolean;
  rng?: RNG;
}): { scene: ReturnType<typeof createBattleScene>; rec: Recorder } {
  const player = createSide(SPECIES.EMBERCUB!);
  const foe = opts.foe ?? createSide(SPECIES.AQUAFIN!);
  const state: BattleState = createBattleState(createTeam([player]), createTeam([foe]));
  const rec: Recorder = { windows: [], caught: 0, joined: 0, willingCalls: 0, foeGone: 0, resolved: [] };
  let balls = opts.balls ?? 5;
  let medicine = opts.medicine ?? 2;
  const scene = createBattleScene({
    state,
    rng: opts.rng ?? mulberry32(1),
    chooseFoeAction: () => opts.foeAction ?? { kind: 'move', move: 'TACKLE', stance: 'A' },
    intro: [],
    catchBreathUnlocked: false,
    canRun: true,
    canCatch: true,
    ballCount: () => balls,
    medicineCount: () => medicine,
    onThrowBall: (window) => {
      rec.windows.push(window);
      balls -= 1;
      return { caught: opts.catchResult ? opts.catchResult(window) : false };
    },
    onWillingJoin: () => {
      rec.willingCalls += 1;
      medicine -= 1;
      const joined = opts.joinResult ?? false;
      if (joined) rec.joined += 1;
      return { joined, hint: 'It wasn’t ready.' };
    },
    onCaught: () => {
      rec.caught += 1;
    },
    onFoeGone: () => {
      rec.foeGone += 1;
    },
    onResolve: (w) => {
      rec.resolved.push(w);
    },
  });
  return { scene, rec };
}

// Flush a resolve to the next menu: ONE A (skipResolve) + ticks. Use
// right after a commit — do NOT call at a menu (A there enters FIGHT).
function flush(scene: ReturnType<typeof createBattleScene>): void {
  scene.input?.('a');
  for (let i = 0; i < 6; i += 1) scene.update?.(0.2);
}

// From the FIGHT menu, move down to the BALL row and throw.
function throwBall(scene: ReturnType<typeof createBattleScene>): void {
  scene.input?.('down'); // FIGHT → (skip greyed PKMN) → BALL
  scene.input?.('a'); // confirm BALL → throw
}

// One full out-of-window throw cycle from a menu, landing at the next
// beginTurn: down,a (throw → 1-line msg), a (msg → commit throwBall),
// a (skipResolve → next turn).
function outThrowCycle(scene: ReturnType<typeof createBattleScene>): void {
  throwBall(scene); // down, a
  scene.input?.('a'); // clear the 1-line miss message → commit throwBall
  scene.input?.('a'); // skipResolve → finishResolve → beginTurn
}

describe('Phase 6a — the BALL row + window detection', () => {
  test('the BALL row throws (renders without throw), reaching onThrowBall', () => {
    const { scene, rec } = makeScene({ balls: 4 });
    scene.draw(noopCtx()); // the menu (with the BALL row) renders cleanly
    throwBall(scene);
    expect(rec.windows.length).toBe(1); // the throw reached the catch flow
  });

  test('throwing while the foe is EXHAUSTED detects an exhausted window', () => {
    const exhaustedFoe: SideState = { ...createSide(SPECIES.AQUAFIN!), st: 0, exhausted: true };
    const { scene, rec } = makeScene({ foe: exhaustedFoe });
    throwBall(scene);
    expect(rec.windows).toEqual(['exhausted']);
  });

  test('throwing with no read + a fresh foe is OUT of window (none)', () => {
    const { scene, rec } = makeScene({});
    throwBall(scene);
    expect(rec.windows).toEqual(['none']);
  });

  test('a player COUNTER opens a 1-round read window (throw next turn = read)', () => {
    // Player Guards vs an Aggressive foe → counter → read window.
    const { scene, rec } = makeScene({ foeAction: { kind: 'move', move: 'TACKLE', stance: 'A' } });
    scene.input?.('a'); // FIGHT → move
    scene.input?.('select'); // stance A → G
    scene.input?.('a'); // commit (Guard) → resolve (player counters → read window)
    flush(scene); // → next turn menu, read window pending
    throwBall(scene); // down, a → onThrowBall('read')
    expect(rec.windows[rec.windows.length - 1]).toBe('read');
  });
});

describe('Phase 6a — caught + Wariness flee', () => {
  test('a successful throw fires onCaught', () => {
    const exhaustedFoe: SideState = { ...createSide(SPECIES.AQUAFIN!), st: 0, exhausted: true };
    const { scene, rec } = makeScene({ foe: exhaustedFoe, catchResult: () => true });
    throwBall(scene); // down, a → caught → 1-line "Gotcha" text
    scene.input?.('a'); // advance the 1-line beat → onCaught
    expect(rec.caught).toBe(1);
  });

  test('repeated out-of-window throws raise Wariness → the foe flees (onFoeGone)', () => {
    const { scene, rec } = makeScene({ catchResult: () => false });
    outThrowCycle(scene); // wariness 1 → menu
    outThrowCycle(scene); // wariness 2 → menu
    outThrowCycle(scene); // wariness 3 → beginTurn shows the flee telegraph (text)
    scene.input?.('a'); // clear the telegraph → menu
    outThrowCycle(scene); // wariness 4 → beginTurn → "fled!" text (fleeWarned)
    scene.input?.('a'); // clear "fled!" → onFoeGone
    expect(rec.windows.every((w) => w === 'none')).toBe(true);
    expect(rec.foeGone).toBe(1);
  });
});

describe('Phase 6a — Path 2 (spare a fainted wild mon)', () => {
  // A 1-HP GUARDING foe — the player's Aggressive move KOs it cleanly
  // (no A-vs-A clash), surfacing the spare offer.
  const guardFoe = { kind: 'move', move: 'TACKLE', stance: 'G' } as const;

  test('YES + a willing join adds the mon (onCaught)', () => {
    const foe: SideState = { ...createSide(SPECIES.AQUAFIN!), hp: 1 };
    const { scene, rec } = makeScene({ foe, foeAction: guardFoe, joinResult: true });
    scene.input?.('a'); // FIGHT → move
    scene.input?.('a'); // commit → KO the 1-HP foe → resolve
    flush(scene); // skipResolve → finishResolve → the spare offer
    scene.input?.('a'); // YES (cursor default 0) → willing-join roll
    expect(rec.willingCalls).toBe(1);
    scene.input?.('a'); // advance the 1-line "joined!" beat → onCaught
    expect(rec.joined).toBe(1);
    expect(rec.caught).toBe(1);
  });

  test('YES + a refusal ends as a normal win (no mon)', () => {
    const foe: SideState = { ...createSide(SPECIES.AQUAFIN!), hp: 1 };
    const { scene, rec } = makeScene({ foe, foeAction: guardFoe, joinResult: false });
    scene.input?.('a'); // FIGHT → move
    scene.input?.('a'); // commit → KO
    flush(scene); // → spare offer
    scene.input?.('a'); // YES → refused (1-line hint)
    scene.input?.('a'); // clear hint → endWithWin text (2 lines)
    scene.input?.('a'); // clear win line 1
    scene.input?.('a'); // clear win line 2 → onResolve('player')
    expect(rec.willingCalls).toBe(1);
    expect(rec.caught).toBe(0);
    expect(rec.resolved).toContain('player');
  });
});
