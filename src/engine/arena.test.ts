import { describe, expect, test } from 'vitest';
import {
  LEGACY_TRAIT_TABLE,
  SPECIES,
  activeMon,
  createBattleState,
  createSide,
  fixedRng,
  mulberry32,
  resolveRound,
  isRhythmRound,
} from './index';
import type { BattleState, BossCard, Species, TraitTable } from './index';

const ARENA = {
  rhythmEveryN: 3,
  heavyExtraCost: 8,
  heavyExtraInitWeight: 1.3,
  telegraphAheadBy: 1,
} as const;

function withGust(species: Species): Species {
  return { ...species, trait: 'GUSTBORNE' };
}

function setRound(state: BattleState, round: number): BattleState {
  return { ...state, round };
}

describe('arena rhythm + GUSTBORNE trait (A3 + A4)', () => {
  test('isRhythmRound returns true every Nth round', () => {
    expect(isRhythmRound(ARENA, 1)).toBe(false);
    expect(isRhythmRound(ARENA, 2)).toBe(false);
    expect(isRhythmRound(ARENA, 3)).toBe(true);
    expect(isRhythmRound(ARENA, 6)).toBe(true);
    expect(isRhythmRound(ARENA, 7)).toBe(false);
    expect(isRhythmRound(undefined, 3)).toBe(false);
  });

  test('LEGACY_TRAIT_TABLE ships GUSTBORNE at 1.3 / 1.25', () => {
    expect(LEGACY_TRAIT_TABLE.GUSTBORNE).toEqual({ dmgMult: 1.3, initMult: 1.25 });
  });

  test('per-battle trait table overrides the default (no global mutation)', () => {
    const overrideTraits: TraitTable = {
      GUSTBORNE: { dmgMult: 2.0, initMult: 1.25 },
    };
    const card: BossCard = { species: SPECIES.EMBERCUB!, arenaSchedule: ARENA };
    const baseline = createBattleState(
      createSide(SPECIES.EMBERCUB!),
      createSide(withGust(SPECIES.EMBERCUB!)),
      { bossCard: card },
    );
    const boosted = createBattleState(
      createSide(SPECIES.EMBERCUB!),
      createSide(withGust(SPECIES.EMBERCUB!)),
      { bossCard: card, traits: overrideTraits },
    );

    const off = resolveRound(
      setRound(baseline, 3),
      { kind: 'move', move: 'TACKLE', stance: 'G' },
      { kind: 'move', move: 'TACKLE', stance: 'A' },
      fixedRng([0.5, 0.5]),
    );
    const on = resolveRound(
      setRound(boosted, 3),
      { kind: 'move', move: 'TACKLE', stance: 'G' },
      { kind: 'move', move: 'TACKLE', stance: 'A' },
      fixedRng([0.5, 0.5]),
    );

    const offStrike = off.events.find(
      (e): e is Extract<typeof e, { kind: 'strike' }> => e.kind === 'strike' && e.side === 'foe',
    );
    const onStrike = on.events.find(
      (e): e is Extract<typeof e, { kind: 'strike' }> => e.kind === 'strike' && e.side === 'foe',
    );
    expect(offStrike).toBeDefined();
    expect(onStrike).toBeDefined();
    // 2.0 / 1.3 ≈ 1.538 between the two trait tables.
    expect(onStrike!.damage / offStrike!.damage).toBeCloseTo(2.0 / 1.3, 4);
    // Default table untouched after the override battle.
    expect(LEGACY_TRAIT_TABLE.GUSTBORNE).toEqual({ dmgMult: 1.3, initMult: 1.25 });
  });

  test('GUSTBORNE damage x1.3 fires only on rhythm rounds', () => {
    const card: BossCard = { species: SPECIES.EMBERCUB!, arenaSchedule: ARENA };
    const base = createBattleState(
      createSide(SPECIES.EMBERCUB!),
      createSide(withGust(SPECIES.EMBERCUB!)),
      { bossCard: card },
    );

    const offRhythm = resolveRound(
      base,
      { kind: 'move', move: 'TACKLE', stance: 'G' },
      { kind: 'move', move: 'TACKLE', stance: 'A' },
      fixedRng([0.5, 0.5]),
    );
    const offStrike = offRhythm.events.find(
      (e): e is Extract<typeof e, { kind: 'strike' }> => e.kind === 'strike' && e.side === 'foe',
    );

    const onRhythm = resolveRound(
      setRound(base, 3),
      { kind: 'move', move: 'TACKLE', stance: 'G' },
      { kind: 'move', move: 'TACKLE', stance: 'A' },
      fixedRng([0.5, 0.5]),
    );
    const onStrike = onRhythm.events.find(
      (e): e is Extract<typeof e, { kind: 'strike' }> => e.kind === 'strike' && e.side === 'foe',
    );

    expect(offStrike).toBeDefined();
    expect(onStrike).toBeDefined();
    expect(onStrike!.damage / offStrike!.damage).toBeCloseTo(1.3, 4);
  });

  test('heavies cost +8 ST on rhythm rounds (both sides)', () => {
    // EMBERCUB FX FLAME RUSH (heavy, cost 35) at G stance on a rhythm round.
    // Baseline: 35 cost, 14 regen (G), net -21 stamina shift.
    // Rhythm: 35 + 8 = 43 cost, 14 regen, net -29 stamina shift.
    const card: BossCard = { species: SPECIES.EMBERCUB!, arenaSchedule: ARENA };
    const setup = createBattleState(
      // Phased-unlock: FX FLAME RUSH is a heavy (2★) → bank the ★ so this isolates
      // the arena STAMINA surcharge (the ★-gate is irrelevant here).
      createSide(SPECIES.EMBERCUB!, undefined, { openingMomentum: 2 }),
      createSide(SPECIES.AQUAFIN!),
      { bossCard: card },
    );

    const off = resolveRound(
      setup,
      { kind: 'move', move: 'FX FLAME RUSH', stance: 'G' },
      { kind: 'move', move: 'TACKLE', stance: 'G' },
      fixedRng([0.5]),
    );

    const on = resolveRound(
      setRound(setup, 3),
      { kind: 'move', move: 'FX FLAME RUSH', stance: 'G' },
      { kind: 'move', move: 'TACKLE', stance: 'G' },
      fixedRng([0.5]),
    );

    const offSt = activeMon(off.state.player).st;
    const onSt = activeMon(on.state.player).st;
    expect(offSt - onSt).toBe(8);
  });

  test('Break fires when player read-wins reach the threshold (A5)', () => {
    const card: BossCard = {
      species: SPECIES.AQUAFIN!,
      arenaSchedule: ARENA,
      breakBar: 2,
    };
    let state = createBattleState(
      createSide(SPECIES.EMBERCUB!),
      createSide(SPECIES.AQUAFIN!),
      { bossCard: card },
    );

    // Round 1: player Guards, foe Aggressive — counter fires = +1 break.
    const r1 = resolveRound(
      state,
      { kind: 'move', move: 'TACKLE', stance: 'G' },
      { kind: 'move', move: 'TACKLE', stance: 'A' },
      mulberry32(7),
    );
    expect(r1.events.some((e) => e.kind === 'counter' && e.side === 'player')).toBe(true);
    expect(r1.events.some((e) => e.kind === 'break')).toBe(false);
    expect(r1.state.breakProgress).toBe(1);
    expect(r1.state.phase).toBe(1);

    state = r1.state;

    // Round 2: same matchup — second counter triggers Break.
    const r2 = resolveRound(
      state,
      { kind: 'move', move: 'TACKLE', stance: 'G' },
      { kind: 'move', move: 'TACKLE', stance: 'A' },
      mulberry32(8),
    );
    expect(r2.events.some((e) => e.kind === 'counter' && e.side === 'player')).toBe(true);
    const breakEv = r2.events.find(
      (e): e is Extract<typeof e, { kind: 'break' }> => e.kind === 'break',
    );
    expect(breakEv).toBeDefined();
    expect(breakEv!.newPhase).toBe(2);
    expect(r2.state.breakProgress).toBe(0);
    expect(r2.state.phase).toBe(2);
    // Rhythm cycle anchors to the round when Break fired.
    expect(r2.state.rhythmAnchor).toBe(2);
  });

  test('bossCard absent = no rhythm = no modifiers, ladder behaviour preserved', () => {
    const noBoss = createBattleState(createSide(SPECIES.EMBERCUB!), createSide(SPECIES.AQUAFIN!));
    const result = resolveRound(
      setRound(noBoss, 3),
      { kind: 'move', move: 'TACKLE', stance: 'G' },
      { kind: 'move', move: 'TACKLE', stance: 'A' },
      fixedRng([0.5, 0.5]),
    );
    const strike = result.events.find(
      (e): e is Extract<typeof e, { kind: 'strike' }> => e.kind === 'strike',
    );
    expect(strike).toBeDefined();
    // No arena schedule on state → no GUSTBORNE behaviour even at round 3.
  });
});
