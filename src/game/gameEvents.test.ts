// Audio SEAM tests (risks/gaps #1). The emitter works (subscribe / emit /
// unsubscribe / throw-isolation), and a real battle EMITS at the natural
// points so a future audio layer can attach without re-plumbing.

import { afterEach, describe, expect, test } from 'vitest';
import ch1BatchData from '../../docs/ch1-batch.json';
import movesData from '../../docs/moves.json';
import {
  createBattleState,
  createSide,
  createTeam,
  loadDex,
  loadMoves,
  mulberry32,
  registerMoves,
} from '../engine';
import type { DexEntryJson, MoveJson } from '../engine';
import { clearGameEventListeners, emitGameEvent, onGameEvent } from './gameEvents';
import type { GameEvent, GameEventKind } from './gameEvents';
import { createBattleScene } from './scenes/battle';

registerMoves(loadMoves(movesData as MoveJson[]));
const CH1 = loadDex(ch1BatchData as DexEntryJson[], 13);

afterEach(() => clearGameEventListeners());

describe('the emitter', () => {
  test('a subscriber receives emitted events; unsubscribe stops them', () => {
    const seen: GameEvent[] = [];
    const off = onGameEvent((e) => seen.push(e));
    emitGameEvent({ kind: 'battle-start' });
    emitGameEvent({ kind: 'ko', side: 'foe' });
    off();
    emitGameEvent({ kind: 'battle-end', winner: 'player' });
    expect(seen.map((e) => e.kind)).toEqual(['battle-start', 'ko']);
  });

  test('a throwing listener does not break the emit (or other listeners)', () => {
    let reached = false;
    onGameEvent(() => {
      throw new Error('boom');
    });
    onGameEvent(() => {
      reached = true;
    });
    expect(() => emitGameEvent({ kind: 'menu-move' })).not.toThrow();
    expect(reached).toBe(true);
  });

  test('no subscribers → emit is a harmless no-op', () => {
    clearGameEventListeners();
    expect(() => emitGameEvent({ kind: 'evolve', species: 'KILNDRAKE' })).not.toThrow();
  });
});

describe('a battle emits at the natural points', () => {
  function makeScene(onResolve: (w: 'player' | 'foe') => void) {
    const player = createTeam([createSide(CH1.GRUBLEAF!)]);
    // 1-HP foe so the player's strike KOs it → ko + battle-end this round.
    const foe = createTeam([{ ...createSide(CH1.FLITPECK!), hp: 1 }]);
    const state = createBattleState(player, foe, {});
    return createBattleScene({
      state,
      rng: mulberry32(1),
      chooseFoeAction: () => ({ kind: 'move', move: 'TACKLE', stance: 'G' }),
      intro: ['A wild FLITPECK', 'appeared!'],
      catchBreathUnlocked: false,
      canRun: true,
      onResolve: (w) => onResolve(w),
    });
  }

  test('battle-start fires on construction; menu-move / move-resolved / hit-landed / ko / battle-end fire through a round', () => {
    const kinds: GameEventKind[] = [];
    const off = onGameEvent((e) => kinds.push(e.kind));
    const scene = makeScene(() => {});

    expect(kinds).toContain('battle-start'); // emitted at construction

    // Clear the 2-line intro → the action menu.
    scene.input?.('a');
    scene.input?.('a');
    scene.input?.('down'); // action-menu cursor move
    scene.input?.('up');
    expect(kinds).toContain('menu-move');

    // FIGHT → commit the first move (default stance).
    scene.input?.('a'); // open move list
    scene.input?.('a'); // commit move → resolveRound

    // Drain the resolve event stream (A advances held beats).
    for (let i = 0; i < 120; i += 1) {
      scene.update?.(0.05);
      scene.input?.('a');
    }
    off();

    expect(kinds).toContain('move-resolved');
    expect(kinds).toContain('hit-landed');
    expect(kinds).toContain('ko');
    expect(kinds).toContain('battle-end');
  });
});
