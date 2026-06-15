// Phase 6a — the sanctioned `throwBall` Action. Pins the turn mechanics
// (thrower forgoes its strike, foe acts, no stamina change) and that it
// validates. The CATCH MATH is game-side (catching.ts) — the engine only
// governs the turn. Sim bots never throw, so the ladders are unaffected
// (see the bit-identical assertion in the ladder regressions).

import { describe, expect, test } from 'vitest';
import {
  SPECIES,
  activeMon,
  createBattleState,
  createSide,
  createTeam,
  fixedRng,
  resolveRound,
  validateActionTeam,
} from './index';

describe('throwBall action', () => {
  test('validates as always-legal', () => {
    const team = createTeam([createSide(SPECIES.EMBERCUB!)]);
    expect(() => validateActionTeam(team, { kind: 'throwBall' })).not.toThrow();
  });

  test('the thrower does NOT strike; the foe acts normally', () => {
    const state = createBattleState(
      createSide(SPECIES.EMBERCUB!),
      createSide(SPECIES.AQUAFIN!),
    );
    const r = resolveRound(
      state,
      { kind: 'throwBall' },
      { kind: 'move', move: 'TACKLE', stance: 'A' },
      fixedRng([0.5, 0.5, 0.5]),
    );
    // Foe struck; player did not.
    const foeStrike = r.events.find((e) => e.kind === 'strike' && e.side === 'foe');
    const playerStrike = r.events.find((e) => e.kind === 'strike' && e.side === 'player');
    expect(foeStrike).toBeDefined();
    expect(playerStrike).toBeUndefined();
    // The player took the foe's hit (HP dropped); the foe is untouched.
    expect(activeMon(r.state.player).hp).toBeLessThan(activeMon(state.player).hp);
    expect(activeMon(r.state.foe).hp).toBe(activeMon(state.foe).hp);
  });

  test('throwing costs the thrower no stamina (no strike, no regen swing)', () => {
    const state = createBattleState(
      createSide(SPECIES.EMBERCUB!),
      createSide(SPECIES.AQUAFIN!),
    );
    const before = activeMon(state.player).st;
    const r = resolveRound(
      state,
      { kind: 'throwBall' },
      { kind: 'move', move: 'TACKLE', stance: 'G' },
      fixedRng([0.5, 0.5]),
    );
    expect(activeMon(r.state.player).st).toBe(before);
  });

  test('the commit event describes the throw (renderer can label it)', () => {
    const state = createBattleState(
      createSide(SPECIES.EMBERCUB!),
      createSide(SPECIES.AQUAFIN!),
    );
    const r = resolveRound(
      state,
      { kind: 'throwBall' },
      { kind: 'move', move: 'TACKLE', stance: 'G' },
      fixedRng([0.5, 0.5]),
    );
    const commit = r.events.find((e) => e.kind === 'commit' && e.side === 'player');
    expect(commit).toBeDefined();
    expect(commit && commit.kind === 'commit' && commit.action.kind).toBe('throwBall');
  });
});
