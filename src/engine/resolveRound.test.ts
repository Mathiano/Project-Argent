import { describe, expect, test } from 'vitest';
import {
  COMBAT,
  SPECIES,
  createBattleState,
  createSide,
  fixedRng,
  forcedAction,
  mulberry32,
  resolveRound,
  validateAction,
} from './index';
import type { BattleState, SideState } from './index';

function makeState(playerKey = 'EMBERCUB', foeKey = 'AQUAFIN'): BattleState {
  return createBattleState(createSide(SPECIES[playerKey]!), createSide(SPECIES[foeKey]!));
}

function patchPlayer(state: BattleState, patch: Partial<SideState>): BattleState {
  return { ...state, player: { ...state.player, ...patch } };
}

function patchFoe(state: BattleState, patch: Partial<SideState>): BattleState {
  return { ...state, foe: { ...state.foe, ...patch } };
}

describe('counter survival rule', () => {
  test('counter fires when the defender survives the hit', () => {
    const result = resolveRound(
      makeState(),
      { kind: 'move', move: 'TACKLE', stance: 'G' },
      { kind: 'move', move: 'TACKLE', stance: 'A' },
      mulberry32(42),
    );
    expect(result.events.some((e) => e.kind === 'counter' && e.side === 'player')).toBe(true);
  });

  test('counter does not fire when the hit KOs the defender', () => {
    const state = patchPlayer(makeState(), { hp: 1 });
    const result = resolveRound(
      state,
      { kind: 'move', move: 'TACKLE', stance: 'G' },
      { kind: 'move', move: 'TACKLE', stance: 'A' },
      mulberry32(42),
    );
    expect(result.events.some((e) => e.kind === 'counter')).toBe(false);
    expect(result.events.some((e) => e.kind === 'ko' && e.side === 'player')).toBe(true);
  });
});

describe('KO mid-exchange', () => {
  test('second strike is suppressed when the first KOs', () => {
    // EMBERCUB (spd 108) acts before AQUAFIN (spd 72) at TACKLE weight.
    const state = patchFoe(makeState(), { hp: 1 });
    const result = resolveRound(
      state,
      { kind: 'move', move: 'TACKLE', stance: 'A' },
      { kind: 'move', move: 'TACKLE', stance: 'G' },
      mulberry32(42),
    );
    const strikes = result.events.filter((e) => e.kind === 'strike');
    expect(strikes.length).toBe(1);
    expect(strikes[0]?.side).toBe('player');
    expect(result.events.some((e) => e.kind === 'ko' && e.side === 'foe')).toBe(true);
    // No counter from a dead defender either.
    expect(result.events.some((e) => e.kind === 'counter')).toBe(false);
  });
});

describe('exhaustion', () => {
  test('exhausted side is forced to rest', () => {
    const exhausted: SideState = { ...createSide(SPECIES.EMBERCUB!), st: 0, exhausted: true };
    expect(forcedAction(exhausted)).toEqual({ kind: 'rest' });
  });

  test('rest restores +25 ST and clears the exhausted flag', () => {
    const state = patchPlayer(makeState(), { st: 0, exhausted: true });
    const result = resolveRound(
      state,
      { kind: 'rest' },
      { kind: 'move', move: 'TACKLE', stance: 'G' },
      mulberry32(42),
    );
    expect(result.state.player.exhausted).toBe(false);
    expect(result.state.player.st).toBe(COMBAT.restRegen);
  });

  test('exhausted defender takes 1.25× damage that round', () => {
    // Both states rest the player so only foe strikes (one variance pull).
    // Softlock (st=5, not exhausted) is the baseline; exhausted (st=0, exh=true) the test.
    const softlocked = patchPlayer(makeState(), { st: 5, exhausted: false });
    const exhausted = patchPlayer(makeState(), { st: 0, exhausted: true });

    const baseRng = fixedRng([0.5]);
    const exhRng = fixedRng([0.5]);

    const baseResult = resolveRound(
      softlocked,
      { kind: 'rest' },
      { kind: 'move', move: 'TACKLE', stance: 'A' },
      baseRng,
    );
    const exhResult = resolveRound(
      exhausted,
      { kind: 'rest' },
      { kind: 'move', move: 'TACKLE', stance: 'A' },
      exhRng,
    );

    const baseDmg = softlocked.player.hp - baseResult.state.player.hp;
    const exhDmg = exhausted.player.hp - exhResult.state.player.hp;
    expect(baseDmg).toBeGreaterThan(0);
    expect(exhDmg / baseDmg).toBeCloseTo(COMBAT.exhTaken, 4);
  });
});

describe('stamina softlock', () => {
  test('a side with no affordable moves auto-rests', () => {
    const side: SideState = { ...createSide(SPECIES.EMBERCUB!), st: 5, exhausted: false };
    expect(forcedAction(side)).toEqual({ kind: 'rest' });
  });

  test('softlock rest restores +25 ST without setting exhausted', () => {
    const state = patchPlayer(makeState(), { st: 5, exhausted: false });
    const result = resolveRound(
      state,
      { kind: 'rest' },
      { kind: 'move', move: 'TACKLE', stance: 'G' },
      mulberry32(42),
    );
    expect(result.state.player.exhausted).toBe(false);
    expect(result.state.player.st).toBe(5 + COMBAT.restRegen);
  });
});

describe('winded lock', () => {
  test('heavy moves are blocked while winded', () => {
    const state = patchPlayer(makeState(), { st: COMBAT.winded });
    expect(() =>
      validateAction(state.player, { kind: 'move', move: 'FLAME RUSH', stance: 'A' }),
    ).toThrow();
  });

  test('mid moves are still allowed while winded', () => {
    const state = patchPlayer(makeState(), { st: COMBAT.winded });
    expect(() =>
      validateAction(state.player, { kind: 'move', move: 'EMBER SNAP', stance: 'A' }),
    ).not.toThrow();
  });
});

describe('stagger initiative', () => {
  test('staggered side acts second next round even if normally faster', () => {
    // Round 1: EMBERCUB (108) attacks AQUAFIN (72) Guard → gets countered → staggered.
    const r1 = resolveRound(
      makeState(),
      { kind: 'move', move: 'TACKLE', stance: 'A' },
      { kind: 'move', move: 'TACKLE', stance: 'G' },
      mulberry32(42),
    );
    expect(r1.state.player.staggered).toBe(true);

    // Round 2: with EMBERCUB staggered, AQUAFIN should act first.
    const r2 = resolveRound(
      r1.state,
      { kind: 'move', move: 'TACKLE', stance: 'A' },
      { kind: 'move', move: 'TACKLE', stance: 'G' },
      mulberry32(99),
    );
    const firstStrike = r2.events.find((e) => e.kind === 'strike');
    expect(firstStrike?.side).toBe('foe');
  });
});

describe('clash', () => {
  test('winner strikes and gains momentum; loser whiffs and is staggered', () => {
    // fixedRng: [clashRoll, variance]. plWins when clashRoll < psc/(psc+fsc).
    const rng = fixedRng([0.0, 0.5]);
    const result = resolveRound(
      makeState(),
      { kind: 'move', move: 'TACKLE', stance: 'A' },
      { kind: 'move', move: 'TACKLE', stance: 'A' },
      rng,
    );
    expect(result.events.some((e) => e.kind === 'clash' && e.winner === 'player')).toBe(true);
    const strikes = result.events.filter((e) => e.kind === 'strike');
    expect(strikes.length).toBe(1);
    expect(strikes[0]?.side).toBe('player');
    expect(result.state.player.momentum).toBe(1);
    expect(result.state.foe.momentum).toBe(0);
    expect(result.state.foe.staggered).toBe(true);
  });

  test('foe wins clash with a high roll', () => {
    // EMBERCUB st*spd = 10800, AQUAFIN st*spd = 7200 → p(player wins) = 0.6.
    // A roll of 0.999 picks foe.
    const rng = fixedRng([0.999, 0.5]);
    const result = resolveRound(
      makeState(),
      { kind: 'move', move: 'TACKLE', stance: 'A' },
      { kind: 'move', move: 'TACKLE', stance: 'A' },
      rng,
    );
    expect(result.events.some((e) => e.kind === 'clash' && e.winner === 'foe')).toBe(true);
    expect(result.state.foe.momentum).toBe(1);
    expect(result.state.player.staggered).toBe(true);
  });
});

describe('Fluid-vs-Guard ordering override', () => {
  test('Fluid acts first against Guard even when slower', () => {
    // Slow side as player on purpose: AQUAFIN (72) vs EMBERCUB (108).
    const state = createBattleState(createSide(SPECIES.AQUAFIN!), createSide(SPECIES.EMBERCUB!));
    const result = resolveRound(
      state,
      { kind: 'move', move: 'TACKLE', stance: 'F' },
      { kind: 'move', move: 'TACKLE', stance: 'G' },
      mulberry32(42),
    );
    // The player's Fluid attack produces an `opening` event before any foe strike.
    const firstRelevant = result.events.find(
      (e) => e.kind === 'opening' || e.kind === 'strike',
    );
    expect(firstRelevant?.kind).toBe('opening');
  });
});

describe('momentum charging on each read-win', () => {
  test('counter grants momentum to the defender', () => {
    const result = resolveRound(
      makeState(),
      { kind: 'move', move: 'TACKLE', stance: 'G' },
      { kind: 'move', move: 'TACKLE', stance: 'A' },
      mulberry32(42),
    );
    expect(result.state.player.momentum).toBe(1);
    expect(result.state.foe.momentum).toBe(0);
  });

  test('opening grants momentum to the attacker', () => {
    const result = resolveRound(
      makeState(),
      { kind: 'move', move: 'TACKLE', stance: 'F' },
      { kind: 'move', move: 'TACKLE', stance: 'G' },
      mulberry32(42),
    );
    expect(result.state.player.momentum).toBe(1);
    expect(result.state.foe.momentum).toBe(0);
  });

  test('dodge grants momentum to the defender', () => {
    // AQUAFIN attacks Aggressive into EMBERCUB Fluid; speed ratio 108/72 - 1 = 0.5 → p ≈ 0.9.
    const state = createBattleState(createSide(SPECIES.AQUAFIN!), createSide(SPECIES.EMBERCUB!));
    const rng = fixedRng([0.5, 0.1]); // variance, dodge roll
    const result = resolveRound(
      state,
      { kind: 'move', move: 'TACKLE', stance: 'A' },
      { kind: 'move', move: 'TACKLE', stance: 'F' },
      rng,
    );
    expect(result.events.some((e) => e.kind === 'dodge' && e.side === 'foe')).toBe(true);
    expect(result.state.foe.momentum).toBe(1);
  });

  test('momentum caps at 2', () => {
    const state = patchPlayer(makeState(), { momentum: COMBAT.momentumCap });
    const result = resolveRound(
      state,
      { kind: 'move', move: 'TACKLE', stance: 'F' },
      { kind: 'move', move: 'TACKLE', stance: 'G' },
      mulberry32(7),
    );
    expect(result.state.player.momentum).toBe(COMBAT.momentumCap);
    expect(result.events.some((e) => e.kind === 'momentum' && e.side === 'player')).toBe(false);
  });
});

describe('Catch Breath call', () => {
  test('spends 1 momentum and restores +35 ST', () => {
    const state = patchPlayer(makeState(), { momentum: 2, st: 30 });
    const result = resolveRound(
      state,
      { kind: 'catchBreath' },
      { kind: 'move', move: 'TACKLE', stance: 'G' },
      mulberry32(42),
    );
    expect(result.state.player.momentum).toBe(1);
    expect(result.state.player.st).toBe(30 + COMBAT.catchBreathRestore);
  });

  test('Catch Breath is illegal with 0 momentum', () => {
    const state = makeState();
    expect(() => validateAction(state.player, { kind: 'catchBreath' })).toThrow();
  });
});

describe('injected type chart (A1)', () => {
  test('a custom chart applied at battle setup changes effectiveness', () => {
    // Both EMBERCUB (Flame) so the foe's EMBER SNAP fires Flame-into-Flame.
    const mirror = createBattleState(createSide(SPECIES.EMBERCUB!), createSide(SPECIES.EMBERCUB!));
    const baseline = resolveRound(
      mirror,
      { kind: 'move', move: 'TACKLE', stance: 'A' },
      { kind: 'move', move: 'EMBER SNAP', stance: 'G' },
      fixedRng([0.5, 0.5]),
    );
    // Foe EMBER SNAP is type 'Flame'; defender (player EMBERCUB) is also 'Flame'.
    // Legacy chart has no Flame->Flame entry so effectiveness should be 1.
    const baselineStrike = baseline.events.find(
      (e): e is Extract<typeof e, { kind: 'strike' }> => e.kind === 'strike' && e.side === 'foe',
    );
    expect(baselineStrike?.effectiveness).toBe(1);

    // Now inject a chart that makes Flame super-effective vs Flame.
    const flameAmplifier = {
      Flame: { Flame: 2 },
    };
    const stateWithChart = createBattleState(
      createSide(SPECIES.EMBERCUB!),
      createSide(SPECIES.EMBERCUB!),
      { typeChart: flameAmplifier },
    );
    const result = resolveRound(
      stateWithChart,
      { kind: 'move', move: 'TACKLE', stance: 'A' },
      { kind: 'move', move: 'EMBER SNAP', stance: 'G' },
      fixedRng([0.5, 0.5]),
    );
    const struck = result.events.find(
      (e): e is Extract<typeof e, { kind: 'strike' }> => e.kind === 'strike' && e.side === 'foe',
    );
    expect(struck?.effectiveness).toBe(2);
  });
});

describe('determinism', () => {
  test('two runs with the same seed produce identical results', () => {
    const a = resolveRound(
      makeState(),
      { kind: 'move', move: 'TACKLE', stance: 'A' },
      { kind: 'move', move: 'TACKLE', stance: 'G' },
      mulberry32(123),
    );
    const b = resolveRound(
      makeState(),
      { kind: 'move', move: 'TACKLE', stance: 'A' },
      { kind: 'move', move: 'TACKLE', stance: 'G' },
      mulberry32(123),
    );
    expect(a.state.foe.hp).toBe(b.state.foe.hp);
    expect(a.state.player.hp).toBe(b.state.player.hp);
    expect(a.events).toEqual(b.events);
  });
});
