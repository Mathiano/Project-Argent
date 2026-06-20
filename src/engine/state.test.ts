// validateAction's throw paths — short, fast, close a real coverage gap
// before the 6v6 sprint touches the action surface.

import { describe, expect, test } from 'vitest';
import { SPECIES, createSide, registerMoves, validateAction } from './index';
import type { SideState } from './index';

function patched(over: Partial<SideState>): SideState {
  return { ...createSide(SPECIES.EMBERCUB!), ...over };
}

// Make sure FALKNER moves are registered (used by the heavy-affordance test
// to keep the species in the legal moveset but unaffordable at low ST).
registerMoves({});

describe('validateAction throw paths', () => {
  test('throws when rest is requested but the side has affordable moves and is not exhausted', () => {
    const side = patched({});
    expect(() => validateAction(side, { kind: 'rest' })).toThrow(/Rest illegal/);
  });

  test('throws when catchBreath is requested without momentum', () => {
    const side = patched({ momentum: 0 });
    expect(() => validateAction(side, { kind: 'catchBreath' })).toThrow(/Catch Breath needs/);
  });

  test('throws when a move is requested but the side is exhausted', () => {
    const side = patched({ exhausted: true, st: 0 });
    expect(() =>
      validateAction(side, { kind: 'move', move: 'TACKLE', stance: 'A' }),
    ).toThrow(/exhausted/);
  });

  test('throws on an unknown move (not in species.moves)', () => {
    const side = patched({});
    expect(() =>
      validateAction(side, { kind: 'move', move: 'SUPER PUNCH', stance: 'A' }),
    ).toThrow(/cannot use/);
  });

  test('throws when a heavy move is requested while winded', () => {
    // EMBERCUB at ST=25 (the winded threshold inclusive) cannot use heavy.
    const side = patched({ st: 25 });
    expect(() =>
      validateAction(side, { kind: 'move', move: 'FX FLAME RUSH', stance: 'A' }),
    ).toThrow(/heavy locked/);
  });

  test('throws when a move cannot be afforded', () => {
    // FX EMBER SNAP costs 22; at ST=5 it should be unaffordable but not winded
    // (winded threshold is ≤25; affordability throws before winded would).
    const side = patched({ st: 5 });
    expect(() =>
      validateAction(side, { kind: 'move', move: 'FX EMBER SNAP', stance: 'A' }),
    ).toThrow(/Cannot afford/);
  });
});
