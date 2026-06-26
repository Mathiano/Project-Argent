// Call effects (Lane B) — game-layer UI tests. The bond-tier unlock schedule +
// the ?calls=all dev override, the Full Power two-step (arm → attack menu →
// buffed strike), and confirmation that Shake It Off is NOT wired (the Hang In
// There slot stays a locked placeholder pending the status system). Engine
// effects are covered in src/engine/callEffects.test.ts.

import { describe, expect, test } from 'vitest';
import {
  activeMon,
  createBattleState,
  createSide,
  createTeam,
  loadDex,
  loadMoves,
  mulberry32,
  registerMoves,
  setActiveMember,
} from '../engine';
import type { DexEntryJson, MoveJson, SideState } from '../engine';
import ch1BatchData from '../../docs/ch1-batch.json';
import movesData from '../../docs/moves.json';
import { CALL_SET, createBattleScene } from './scenes/battle';

interface RecordingCtx extends CanvasRenderingContext2D {
  readonly texts: string[];
  reset(): void;
}
function stubCtx(): RecordingCtx {
  const noop = () => {};
  const texts: string[] = [];
  return new Proxy(
    { texts, reset: () => texts.splice(0) },
    {
      get(target, prop) {
        if (prop === 'texts') return (target as { texts: string[] }).texts;
        if (prop === 'reset') return (target as { reset: () => void }).reset;
        if (prop === 'fillText') return (t: string) => texts.push(String(t));
        if (prop === 'beginPath') return () => ({ fill: noop, stroke: noop, ellipse: noop });
        if (prop === 'measureText') return () => ({ width: 10 });
        if (prop === 'canvas') return { width: 320, height: 180 };
        return noop;
      },
      set: () => true,
    },
  ) as unknown as RecordingCtx;
}

registerMoves(loadMoves(movesData as MoveJson[]));
const CH1 = loadDex(ch1BatchData as DexEntryJson[], 13);

interface BuildOpts {
  readonly callBondValue?: number;
  readonly devUnlockAllCalls?: boolean;
  readonly momentum?: number;
  readonly hp?: number;
}
function buildScene(opts: BuildOpts = {}): ReturnType<typeof createBattleScene> {
  let state = createBattleState(
    createTeam([createSide(CH1.GRUBLEAF!)]),
    createTeam([createSide(CH1.FLITPECK!)]),
  );
  const patched: SideState = {
    ...activeMon(state.player),
    momentum: opts.momentum ?? 2,
    ...(opts.hp !== undefined ? { hp: opts.hp } : {}),
  };
  state = { ...state, player: setActiveMember(state.player, patched) };
  return createBattleScene({
    state,
    rng: mulberry32(1),
    chooseFoeAction: () => ({ kind: 'move', move: 'TACKLE', stance: 'G' }),
    intro: [],
    catchBreathUnlocked: true, // the CALL menu row is open
    canRun: true,
    callBondValue: opts.callBondValue ?? 0,
    devUnlockAllCalls: opts.devUnlockAllCalls ?? false,
    onResolve: () => {},
  });
}

// Open the CALL submenu and return the rendered screen text.
function callMenuScreen(scene: ReturnType<typeof createBattleScene>): string {
  scene.update?.(0.01); // → menu
  scene.input?.('down'); // FIGHT → CALL (disabled rows skipped)
  scene.input?.('a'); // open submenu
  const ctx = stubCtx();
  scene.draw(ctx);
  return ctx.texts.join('|');
}

// A Call name renders with ' ·LOCKED' appended when it's gated/unbuilt.
const locked = (screen: string, name: string) => screen.includes(`${name} ·LOCKED`);

describe('Call unlock — the bond-tier schedule (the real, shipping rule)', () => {
  test('at low bond, the new Calls are LOCKED', () => {
    const screen = callMenuScreen(buildScene({ callBondValue: 0 }));
    expect(locked(screen, 'Recover')).toBe(true);
    expect(locked(screen, 'Dodge')).toBe(true);
    expect(locked(screen, 'Full Power')).toBe(true);
  });

  test('Recover unlocks at Companions (stage 3); Dodge/Full Power still locked', () => {
    const screen = callMenuScreen(buildScene({ callBondValue: 45 })); // Companions (top of 3)
    expect(locked(screen, 'Recover')).toBe(false);
    expect(locked(screen, 'Dodge')).toBe(true);
    expect(locked(screen, 'Full Power')).toBe(true);
  });

  test('deep bond unlocks all three; Full Power gates highest', () => {
    const screen = callMenuScreen(buildScene({ callBondValue: 80 })); // Kindred (stage 6)
    expect(locked(screen, 'Recover')).toBe(false);
    expect(locked(screen, 'Dodge')).toBe(false);
    expect(locked(screen, 'Full Power')).toBe(false);
  });

  test('?calls=all dev override unlocks every built Call at any bond', () => {
    const screen = callMenuScreen(buildScene({ callBondValue: 0, devUnlockAllCalls: true }));
    expect(locked(screen, 'Recover')).toBe(false);
    expect(locked(screen, 'Dodge')).toBe(false);
    expect(locked(screen, 'Full Power')).toBe(false);
  });
});

describe('Full Power — the two-step flow (arm → attack menu → buffed strike)', () => {
  test('selecting Full Power returns to the attack menu armed (+50% indicator)', () => {
    const scene = buildScene({ callBondValue: 80, momentum: 2 });
    scene.update?.(0.01);
    scene.input?.('down'); // FIGHT → CALL (disabled rows skipped)
    scene.input?.('a'); // submenu (cursor on Catch Breath)
    for (let i = 0; i < 5; i += 1) scene.input?.('down'); // → Full Power (idx 5)
    scene.input?.('a'); // arm → shout dialog
    scene.input?.('a'); // advance shout → back to the attack menu, armed
    const ctx = stubCtx();
    scene.draw(ctx);
    const screen = ctx.texts.join('|');
    expect(screen).toContain('FULL+50%'); // the armed indicator on the move menu
  });

  test('committing the attack while armed produces the FULL POWER beat', () => {
    const scene = buildScene({ callBondValue: 80, momentum: 2 });
    scene.update?.(0.01);
    scene.input?.('down'); // CALL
    scene.input?.('a'); // submenu
    for (let i = 0; i < 5; i += 1) scene.input?.('down'); // Full Power
    scene.input?.('a'); // arm → shout
    scene.input?.('a'); // → attack menu armed
    scene.input?.('a'); // confirm the first move → commit fullPower → resolve
    let saw = false;
    for (let i = 0; i < 200 && !saw; i += 1) {
      scene.update?.(0.05);
      const ctx = stubCtx();
      scene.draw(ctx);
      if (ctx.texts.join('|').includes('FULL POWER')) saw = true;
      scene.input?.('a');
    }
    expect(saw).toBe(true);
  });
});

describe('Recover message (Fix 2) — no raw decimal', () => {
  test('the Recover beat reads "[mon] recovers!" with no number', () => {
    // Fractional HP so the heal CLAMPS — the old code rendered a long float
    // (e.g. "+23.4999…99 HP"). The new message states no number at all.
    const scene = buildScene({ devUnlockAllCalls: true, momentum: 1, hp: 35.0001 });
    scene.update?.(0.01);
    scene.input?.('down'); // CALL
    scene.input?.('a'); // submenu (cursor on Catch Breath)
    for (let i = 0; i < 3; i += 1) scene.input?.('down'); // → Recover (idx 3)
    scene.input?.('a'); // Recover → shout
    scene.input?.('a'); // advance shout → commit recover → resolve
    const recoverLines: string[] = [];
    for (let i = 0; i < 200; i += 1) {
      scene.update?.(0.05);
      const ctx = stubCtx();
      scene.draw(ctx);
      for (const t of ctx.texts) if (t.includes('recovers')) recoverLines.push(t);
      scene.input?.('a');
    }
    expect(recoverLines.length).toBeGreaterThan(0); // the beat fired
    // No digit anywhere in the recover line → no raw float, no integer either.
    expect(recoverLines.every((t) => !/\d/.test(t))).toBe(true);
  });
});

describe('Shake It Off — repurpose deferred (flag only, not built)', () => {
  test('no Shake It Off Call is wired; the Hang In There slot is the placeholder', () => {
    expect(CALL_SET.some((c) => /shake/i.test(c.name))).toBe(false);
    expect(CALL_SET.some((c) => c.id === 'hang-in')).toBe(true);
  });

  test('Recover / Dodge / Full Power are now BUILT', () => {
    const built = (id: string) => CALL_SET.find((c) => c.id === id)?.built === true;
    expect(built('recover')).toBe(true);
    expect(built('dodge')).toBe(true);
    expect(built('full-power')).toBe(true);
  });
});
