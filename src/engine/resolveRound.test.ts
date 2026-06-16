import { describe, expect, test } from 'vitest';
import {
  COMBAT,
  SPECIES,
  activeMon,
  createBattleState,
  createSide,
  fixedRng,
  forcedAction,
  mulberry32,
  resolveRound,
  setActiveMember,
  validateAction,
} from './index';
import type { BattleState, SideState } from './index';

function makeState(playerKey = 'EMBERCUB', foeKey = 'AQUAFIN'): BattleState {
  return createBattleState(createSide(SPECIES[playerKey]!), createSide(SPECIES[foeKey]!));
}

// Patch the active mon of either side. With Team-based BattleState the team
// wraps a SideState; tests want to tweak HP/ST on the active mon to set up
// edge cases. setActiveMember rebuilds the team with the patched member.
function patchPlayer(state: BattleState, patch: Partial<SideState>): BattleState {
  const patched: SideState = { ...activeMon(state.player), ...patch };
  return { ...state, player: setActiveMember(state.player, patched) };
}

function patchFoe(state: BattleState, patch: Partial<SideState>): BattleState {
  const patched: SideState = { ...activeMon(state.foe), ...patch };
  return { ...state, foe: setActiveMember(state.foe, patched) };
}

// Convenience: read the active mon. Existing tests read state.player.hp etc.;
// at teamSize 1 the active mon IS the side, so this is the legacy view.
const pl = (s: BattleState): SideState => activeMon(s.player);
const fo = (s: BattleState): SideState => activeMon(s.foe);

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

describe('turn order — initiative (speed ÷ move weight) + the Fluid exception', () => {
  const firstActor = (events: ReadonlyArray<{ kind: string }>): string | null => {
    const ev = events.find((e) => e.kind === 'initiative') as { first?: string | null } | undefined;
    return ev?.first ?? null;
  };
  const firstStrike = (events: ReadonlyArray<{ kind: string; side?: string }>): string | null =>
    events.find((e) => e.kind === 'strike')?.side ?? null;

  test('the faster mon acts first (same move weight)', () => {
    // EMBERCUB spd 108 vs AQUAFIN spd 72, both TACKLE/Guard (non-clash).
    const r = resolveRound(
      makeState('EMBERCUB', 'AQUAFIN'),
      { kind: 'move', move: 'TACKLE', stance: 'G' },
      { kind: 'move', move: 'TACKLE', stance: 'G' },
      mulberry32(7),
    );
    expect(firstActor(r.events)).toBe('player');
    expect(firstStrike(r.events)).toBe('player');
  });

  test('SYMPTOM 1: a raw-SLOWER mon acts first with a LIGHTER move (init = spd ÷ weight)', () => {
    // SPROUTLE spd 84 + TACKLE (light, w0.85) → init 98.8.
    // EMBERCUB spd 108 + FLAME RUSH (heavy, w1.15) → init 93.9.
    // The slower-by-raw-speed SPROUTLE out-initiatives → acts FIRST. This
    // is CORRECT by the spec (Initiative: speed / move weight) — the
    // "SLOWER acted first" the player saw is the design, not a bug.
    const r = resolveRound(
      makeState('SPROUTLE', 'EMBERCUB'),
      { kind: 'move', move: 'TACKLE', stance: 'G' },
      { kind: 'move', move: 'FLAME RUSH', stance: 'G' },
      mulberry32(7),
    );
    expect(pl(makeState('SPROUTLE', 'EMBERCUB')).species.spd).toBeLessThan(
      fo(makeState('SPROUTLE', 'EMBERCUB')).species.spd,
    ); // raw-slower…
    expect(firstActor(r.events)).toBe('player'); // …yet acts first (lighter move)
    expect(firstStrike(r.events)).toBe('player');
  });

  test('FLUID exception: a raw-slower Fluid mon acts first vs a faster Guard mon', () => {
    // AQUAFIN spd 72 (Fluid) vs EMBERCUB spd 108 (Guard) — F-vs-G overrides
    // initiative entirely. The slower Fluid mon acts first, by design.
    const r = resolveRound(
      makeState('AQUAFIN', 'EMBERCUB'),
      { kind: 'move', move: 'TACKLE', stance: 'F' },
      { kind: 'move', move: 'TACKLE', stance: 'G' },
      mulberry32(7),
    );
    expect(firstActor(r.events)).toBe('player');
    // The Fluid-vs-Guard first action is an OPENING (slips past guard).
    expect(r.events.some((e) => e.kind === 'opening' && e.side === 'player')).toBe(true);
  });

  test('a rest (no move) always acts last (initiative < 0)', () => {
    const exhausted = patchPlayer(makeState('EMBERCUB', 'AQUAFIN'), { st: 0, exhausted: true });
    const r = resolveRound(
      exhausted,
      { kind: 'rest' },
      { kind: 'move', move: 'TACKLE', stance: 'G' },
      mulberry32(7),
    );
    expect(firstActor(r.events)).toBe('foe'); // the acting mon goes first
  });
});

describe('no mutual KO / no posthumous attack (the ruling, locked across seeds)', () => {
  // Both actives at low HP, every stance pairing, many seeds: a round must
  // NEVER leave both mons at 0 (no mutual KO), and the side that was KO'd
  // must never strike after its own ko event (no posthumous attack).
  const stances = ['A', 'G', 'F'] as const;
  test('one lethal exchange never produces two faints or a posthumous strike', () => {
    for (let seed = 1; seed <= 60; seed += 1) {
      for (const ps of stances) {
        for (const fs of stances) {
          let state = makeState('EMBERCUB', 'AQUAFIN');
          state = patchPlayer(state, { hp: 2 });
          state = patchFoe(state, { hp: 2 });
          const r = resolveRound(
            state,
            { kind: 'move', move: 'TACKLE', stance: ps },
            { kind: 'move', move: 'TACKLE', stance: fs },
            mulberry32(seed),
          );
          // No mutual KO.
          expect(pl(r.state).hp <= 0 && fo(r.state).hp <= 0).toBe(false);
          // No posthumous strike: once a side is KO'd, it never strikes after.
          let plKO = false;
          let foeKO = false;
          for (const ev of r.events) {
            if (ev.kind === 'ko') {
              if (ev.side === 'player') plKO = true;
              else foeKO = true;
            }
            if (ev.kind === 'strike') {
              if (ev.side === 'player') expect(plKO).toBe(false);
              if (ev.side === 'foe') expect(foeKO).toBe(false);
            }
          }
        }
      }
    }
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
    expect(pl(result.state).exhausted).toBe(false);
    expect(pl(result.state).st).toBe(COMBAT.restRegen);
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

    const baseDmg = pl(softlocked).hp - pl(baseResult.state).hp;
    const exhDmg = pl(exhausted).hp - pl(exhResult.state).hp;
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
    expect(pl(result.state).exhausted).toBe(false);
    expect(pl(result.state).st).toBe(5 + COMBAT.restRegen);
  });
});

describe('winded lock', () => {
  test('heavy moves are blocked while winded', () => {
    const state = patchPlayer(makeState(), { st: COMBAT.winded });
    expect(() =>
      validateAction(pl(state), { kind: 'move', move: 'FLAME RUSH', stance: 'A' }),
    ).toThrow();
  });

  test('mid moves are still allowed while winded', () => {
    const state = patchPlayer(makeState(), { st: COMBAT.winded });
    expect(() =>
      validateAction(pl(state), { kind: 'move', move: 'EMBER SNAP', stance: 'A' }),
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
    expect(pl(r1.state).staggered).toBe(true);

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
    expect(pl(result.state).momentum).toBe(1);
    expect(fo(result.state).momentum).toBe(0);
    expect(fo(result.state).staggered).toBe(true);
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
    expect(fo(result.state).momentum).toBe(1);
    expect(pl(result.state).staggered).toBe(true);
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
    expect(pl(result.state).momentum).toBe(1);
    expect(fo(result.state).momentum).toBe(0);
  });

  test('opening grants momentum to the attacker', () => {
    const result = resolveRound(
      makeState(),
      { kind: 'move', move: 'TACKLE', stance: 'F' },
      { kind: 'move', move: 'TACKLE', stance: 'G' },
      mulberry32(42),
    );
    expect(pl(result.state).momentum).toBe(1);
    expect(fo(result.state).momentum).toBe(0);
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
    expect(fo(result.state).momentum).toBe(1);
  });

  test('momentum caps at 2', () => {
    const state = patchPlayer(makeState(), { momentum: COMBAT.momentumCap });
    const result = resolveRound(
      state,
      { kind: 'move', move: 'TACKLE', stance: 'F' },
      { kind: 'move', move: 'TACKLE', stance: 'G' },
      mulberry32(7),
    );
    expect(pl(result.state).momentum).toBe(COMBAT.momentumCap);
    expect(result.events.some((e) => e.kind === 'momentum' && e.side === 'player')).toBe(false);
  });
});

describe('Catch Breath call', () => {
  test('spends 1 momentum and restores 50% of max ST (+50)', () => {
    const state = patchPlayer(makeState(), { momentum: 2, st: 30 });
    const result = resolveRound(
      state,
      { kind: 'catchBreath' },
      { kind: 'move', move: 'TACKLE', stance: 'G' },
      mulberry32(42),
    );
    expect(pl(result.state).momentum).toBe(1);
    // Phase 6b — Catch Breath restores 50% of the 100-ST cap (= +50).
    const restore = Math.round(100 * COMBAT.catchBreathRestorePct);
    expect(restore).toBe(50);
    expect(pl(result.state).st).toBe(Math.min(100, 30 + restore));
  });

  test('Catch Breath is illegal with 0 momentum', () => {
    const state = makeState();
    expect(() => validateAction(pl(state), { kind: 'catchBreath' })).toThrow();
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
    expect(fo(a.state).hp).toBe(fo(b.state).hp);
    expect(pl(a.state).hp).toBe(pl(b.state).hp);
    expect(a.events).toEqual(b.events);
  });
});
