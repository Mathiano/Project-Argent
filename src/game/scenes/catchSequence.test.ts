// The catch-visual pass: a throw plays out instead of resolving in a line of
// text. These assert the BEAT — how many times the ball wiggles, and that the
// result lands after the wiggles, not before — because the wiggle IS the
// tension the design doc asks for (visual-north-star §the CATCH SEQUENCE).
import { describe, expect, test } from 'vitest';
import {
  SPECIES,
  createBattleState,
  createSide,
  createTeam,
  mulberry32,
} from '../../engine';
import type { Action, BattleState, SideState } from '../../engine';
import { createBattleScene } from './battle';
import type { CatchWindow } from '../catching';
import { onGameEvent } from '../gameEvents';
import type { GameEvent } from '../gameEvents';

function sceneWith(caught: boolean, foe?: SideState) {
  const player = createSide(SPECIES.EMBERCUB!);
  const theFoe = foe ?? createSide(SPECIES.AQUAFIN!);
  const state: BattleState = createBattleState(createTeam([player]), createTeam([theFoe]));
  let caughtCount = 0;
  const scene = createBattleScene({
    state,
    rng: mulberry32(1),
    chooseFoeAction: (): Action => ({ kind: 'move', move: 'TACKLE', stance: 'A' }),
    intro: [],
    catchBreathUnlocked: false,
    canRun: true,
    canCatch: true,
    ballCount: () => 5,
    medicineCount: () => 2,
    onThrowBall: (_w: CatchWindow) => ({ caught }),
    onCaught: () => { caughtCount += 1; },
    onResolve: () => {},
  });
  return { scene, caughtCount: () => caughtCount };
}

// Record every game event the scene emits while the sequence runs.
function recordThrow(caught: boolean, foe?: SideState): GameEvent[] {
  const seen: GameEvent[] = [];
  const off = onGameEvent((e) => seen.push(e));
  try {
    const { scene } = sceneWith(caught, foe);
    scene.input?.('down'); // FIGHT → BALL
    scene.input?.('a'); // throw
    for (let i = 0; i < 200; i += 1) scene.update?.(1 / 60);
  } finally {
    off();
  }
  return seen;
}

const kinds = (evs: GameEvent[]) => evs.map((e) => e.kind);

describe('the catch sequence', () => {
  test('an exposed catch wiggles THREE times, then clicks', () => {
    const exhausted: SideState = { ...createSide(SPECIES.AQUAFIN!), st: 0, exhausted: true };
    const evs = recordThrow(true, exhausted);
    expect(kinds(evs).filter((k) => k === 'catch-wiggle')).toHaveLength(3);
    expect(kinds(evs)).toContain('catch-success');
    // Order is the whole point: the ball has to shake BEFORE it locks.
    expect(kinds(evs).lastIndexOf('catch-wiggle')).toBeLessThan(kinds(evs).indexOf('catch-success'));
    expect(kinds(evs)).not.toContain('catch-break');
  });

  test('an in-window escape wiggles TWICE, then bursts', () => {
    const exhausted: SideState = { ...createSide(SPECIES.AQUAFIN!), st: 0, exhausted: true };
    const evs = recordThrow(false, exhausted);
    expect(kinds(evs).filter((k) => k === 'catch-wiggle')).toHaveLength(2);
    expect(kinds(evs)).toContain('catch-break');
    expect(kinds(evs).lastIndexOf('catch-wiggle')).toBeLessThan(kinds(evs).indexOf('catch-break'));
    expect(kinds(evs)).not.toContain('catch-success');
  });

  test('an out-of-window throw never had the mon — no wiggle at all', () => {
    // A healthy, unexposed foe → window 'none'.
    const evs = recordThrow(false);
    expect(kinds(evs)).toContain('catch-attempt');
    expect(kinds(evs).filter((k) => k === 'catch-wiggle')).toHaveLength(0);
    expect(kinds(evs)).toContain('catch-break');
  });

  test('the throw is not instant — the result waits on the animation', () => {
    const exhausted: SideState = { ...createSide(SPECIES.AQUAFIN!), st: 0, exhausted: true };
    const { scene, caughtCount } = sceneWith(true, exhausted);
    scene.input?.('down');
    scene.input?.('a'); // throw
    scene.update?.(1 / 60);
    scene.input?.('a'); // a press during the sequence must be swallowed
    expect(caughtCount()).toBe(0); // nothing resolved yet
    for (let i = 0; i < 200; i += 1) scene.update?.(1 / 60);
    scene.input?.('a'); // now the "Gotcha!" line is up — advance it
    expect(caughtCount()).toBe(1);
  });
});
