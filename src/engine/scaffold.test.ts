import { describe, expect, test } from 'vitest';
import {
  COMBAT,
  SPECIES,
  createBattleState,
  createSide,
  fixedRng,
  mulberry32,
  resolveRound,
} from './index';

function setup() {
  return createBattleState(createSide(SPECIES.EMBERCUB!), createSide(SPECIES.AQUAFIN!));
}

describe('resolveRound smoke', () => {
  test('mirror Aggressive → clash event', () => {
    // 3 rng calls before the clash roll: 2 variance pulls aren't used (no strike yet).
    // Clash roll first, then strike's variance roll, then dodge skip check etc.
    const rng = fixedRng([0.01, 0.5, 0.5]);
    const result = resolveRound(
      setup(),
      { kind: 'move', move: 'TACKLE', stance: 'A' },
      { kind: 'move', move: 'TACKLE', stance: 'A' },
      rng,
    );
    expect(result.events.some((e) => e.kind === 'clash')).toBe(true);
  });

  test('Guard vs Aggressive → counter event when defender survives', () => {
    const state = setup();
    const rng = mulberry32(42);
    const result = resolveRound(
      state,
      { kind: 'move', move: 'TACKLE', stance: 'G' },
      { kind: 'move', move: 'TACKLE', stance: 'A' },
      rng,
    );
    expect(result.events.some((e) => e.kind === 'counter' && e.side === 'player')).toBe(true);
  });

  test('Fluid vs Guard → opening event, no counter', () => {
    const rng = mulberry32(7);
    const result = resolveRound(
      setup(),
      { kind: 'move', move: 'TACKLE', stance: 'F' },
      { kind: 'move', move: 'TACKLE', stance: 'G' },
      rng,
    );
    expect(result.events.some((e) => e.kind === 'opening' && e.side === 'player')).toBe(true);
    expect(result.events.some((e) => e.kind === 'counter')).toBe(false);
  });

  test('deterministic given a seed', () => {
    const a = resolveRound(
      setup(),
      { kind: 'move', move: 'TACKLE', stance: 'A' },
      { kind: 'move', move: 'TACKLE', stance: 'G' },
      mulberry32(123),
    );
    const b = resolveRound(
      setup(),
      { kind: 'move', move: 'TACKLE', stance: 'A' },
      { kind: 'move', move: 'TACKLE', stance: 'G' },
      mulberry32(123),
    );
    expect(a.state.foe.hp).toBe(b.state.foe.hp);
    expect(a.state.player.hp).toBe(b.state.player.hp);
  });

  test('momentum capped at 2', () => {
    let state = setup();
    // Force-set player momentum to 2 via successive opening landings would be involved;
    // instead, verify directly by constructing a state with momentum=2 and observing no further gain.
    state = {
      ...state,
      player: { ...state.player, momentum: COMBAT.momentumCap },
    };
    const result = resolveRound(
      state,
      { kind: 'move', move: 'TACKLE', stance: 'F' },
      { kind: 'move', move: 'TACKLE', stance: 'G' },
      mulberry32(1),
    );
    expect(result.state.player.momentum).toBe(COMBAT.momentumCap);
    expect(result.events.some((e) => e.kind === 'momentum' && e.side === 'player')).toBe(false);
  });
});
