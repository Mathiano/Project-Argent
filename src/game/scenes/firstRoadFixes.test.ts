// firstroad-fixes GATE — the Hearthwick→Violet playtest fixes.
//   S1 ST resets to full at battle start (HP carries over)
//   S2 RUN renders on-screen (not clipped)
//   S3 Violet entered from the NORTH, walking south
//   S4 PIP (the lost mon) has a visible overworld sprite
//   S5 the seed event still completes (richer writing, same flag chain)

import { describe, expect, test } from 'vitest';
import ch1BatchData from '../../../docs/ch1-batch.json';
import movesData from '../../../docs/moves.json';
import {
  createBattleState,
  createSide,
  createTeam,
  loadDex,
  loadMoves,
  mulberry32,
  registerMoves,
} from '../../engine';
import type { DexEntryJson, MoveJson } from '../../engine';
import { freshBattleSide } from '../battlePrep';
import { createBattleScene } from './battle';
import { getMap } from '../overworld/maps';
import type { MapObject } from '../overworld/types';

registerMoves(loadMoves(movesData as MoveJson[]));
const CH1 = loadDex(ch1BatchData as DexEntryJson[], 13);

describe('S1 — stamina resets to full at battle start (HP carries over)', () => {
  test('freshBattleSide resets ST + ★ (per-battle), keeps HP, clears round flags', () => {
    const tired = { ...createSide(CH1.KINDRAKE!), hp: 17, st: 4, momentum: 2, exhausted: true, staggered: true };
    const fresh = freshBattleSide(tired);
    // ST resets to the mon's OWN full stamina (maxSt — per-mon now, stat-foundation).
    // KINDRAKE is a starter → equalised to 108 (Decision A), not the old flat 100.
    expect(fresh.st).toBe(tired.maxSt); // = 108 (KINDRAKE stamina)
    expect(fresh.momentum).toBe(0); // ★ reset — per-battle, never carried over (Bug 1)
    expect(fresh.hp).toBe(17); // HP carries over — the persistent resource
    expect(fresh.exhausted).toBe(false);
    expect(fresh.staggered).toBe(false);
  });
});

describe('S2 — RUN renders on-screen (not clipped off the bottom)', () => {
  // Position-capturing ctx: record every fillText with its y.
  function posCtx() {
    const calls: Array<{ text: string; y: number }> = [];
    return new Proxy(
      { calls },
      {
        get(t, p) {
          if (p === 'calls') return (t as { calls: typeof calls }).calls;
          if (p === 'fillText') return (text: string, _x: number, y: number) => calls.push({ text: String(text), y });
          if (p === 'measureText') return () => ({ width: 10 });
          if (p === 'canvas') return { width: 320, height: 180 };
          return () => {};
        },
        set: () => true,
      },
    ) as unknown as CanvasRenderingContext2D & { calls: Array<{ text: string; y: number }> };
  }

  test('the RUN row sits within the 360px battle screen', () => {
    const state = createBattleState(createTeam([createSide(CH1.GRUBLEAF!)]), createTeam([createSide(CH1.FLITPECK!)]));
    const scene = createBattleScene({
      state,
      rng: mulberry32(1),
      chooseFoeAction: () => ({ kind: 'move', move: 'TACKLE', stance: 'G' }),
      intro: ['A wild FLITPECK', 'appeared!'],
      catchBreathUnlocked: false,
      canRun: true, // wild → the row reads 'RUN'
      onResolve: () => {},
    });
    // Clear the 2-line intro → the root action menu.
    scene.input?.('a');
    scene.input?.('a');
    const ctx = posCtx();
    scene.draw(ctx);
    const run = ctx.calls.find((c) => c.text.includes('RUN'));
    expect(run, 'RUN label is drawn').toBeTruthy();
    // Battle-UI rebuild Part 2a: the battle scene runs at 640×360, so the bottom
    // command menu (RUN is its last row) is bounded by the 360px battle screen.
    expect(run!.y + 8).toBeLessThanOrEqual(360);
  });
});

describe('S3 — Violet is entered from the NORTH, walking south', () => {
  const v = getMap('VIOLET');
  test('fromRoute spawn is at the top, facing down into the city', () => {
    const s = v.spawns.fromRoute!;
    expect(s.y).toBeLessThanOrEqual(2); // near the top edge
    expect(s.facing).toBe('down'); // walking south into Violet
  });
  test('the Route-31 exit warp is on the NORTH edge (above the entrance)', () => {
    const routeWarp = v.objects.find(
      (o): o is Extract<MapObject, { type: 'warp' }> => o.type === 'warp' && o.target.startsWith('ROUTE31:'),
    );
    expect(routeWarp).toBeTruthy();
    expect(routeWarp!.y).toBe(0); // top edge
    expect(routeWarp!.y).toBeLessThan(v.spawns.fromRoute!.y + 1); // north of the spawn
  });
});

describe('S4 — PIP (the lost mon) has a visible overworld sprite', () => {
  test('the lost-mon NPC renders as a FLITPECK sprite', () => {
    const r = getMap('ROUTE31');
    const pip = r.objects.find(
      (o): o is Extract<MapObject, { type: 'npc' }> =>
        o.type === 'npc' && o.interact.some((c) => c.kind === 'set-flag' && c.flag === 'route31_lost_mon_found'),
    );
    expect(pip, 'the lost-mon NPC exists').toBeTruthy();
    expect(pip!.sprite).toBe('FLITPECK'); // visible creature, not a blank square
    expect(pip!.spriteType).toBe('GALE');
  });
});

describe('S5 — the seed event still completes (flag chain intact after the rewrite)', () => {
  test('lost mon → found flag → gated kid → one-time reunion reward', () => {
    const r = getMap('ROUTE31');
    const setsFound = r.objects.some(
      (o) => o.type === 'npc' && o.interact.some((c) => c.kind === 'set-flag' && c.flag === 'route31_lost_mon_found'),
    );
    const gatedKid = r.objects.some(
      (o) => o.type === 'npc' && o.blockedUntilFlag === 'route31_lost_mon_found' && o.interactAfterFlag !== undefined,
    );
    const reward = r.objects.some(
      (o) => o.type === 'script' && o.requiresFlag === 'route31_lost_mon_found' && o.once === true &&
        o.commands.some((c) => c.kind === 'give-item'),
    );
    expect(setsFound && gatedKid && reward).toBe(true);
  });
});
