// 2v2 regression: exercises switch / faint / forced-switch in one
// deterministic battle. The 1v1 path is already locked by the rival and
// Falkner ladders; this is the multi-mon canary so we notice if the
// switch flow drifts.

import { describe, expect, test } from 'vitest';
import {
  SPECIES,
  activeMon,
  createBattleState,
  createSide,
  createTeam,
  fixedRng,
  isTeamWiped,
  resolveRound,
} from '../engine';
import type { BattleEvent, BattleState } from '../engine';

function makeTwoVsTwoState(): BattleState {
  const playerTeam = createTeam([
    createSide(SPECIES.EMBERCUB!),
    createSide(SPECIES.AQUAFIN!),
  ]);
  const foeTeam = createTeam([
    createSide(SPECIES.AQUAFIN!),
    createSide(SPECIES.EMBERCUB!),
  ]);
  return createBattleState(playerTeam, foeTeam);
}

describe('2v2 team battle', () => {
  test('switch action emits switchOut + switchIn; switching mon does not strike', () => {
    const state = makeTwoVsTwoState();
    const r = resolveRound(
      state,
      { kind: 'switch', toIndex: 1 },
      { kind: 'move', move: 'TACKLE', stance: 'A' },
      fixedRng([0.5, 0.5]),
    );
    const out = r.events.find((e) => e.kind === 'switchOut' && e.side === 'player');
    const inEv = r.events.find((e) => e.kind === 'switchIn' && e.side === 'player');
    expect(out).toBeDefined();
    expect(inEv).toBeDefined();
    expect(out?.kind === 'switchOut' && out.species).toBe('EMBERCUB');
    expect(inEv?.kind === 'switchIn' && inEv.species).toBe('AQUAFIN');
    // The foe's TACKLE landed on the switched-in AQUAFIN — only one strike.
    const strikes = r.events.filter((e) => e.kind === 'strike');
    expect(strikes.length).toBe(1);
    expect(strikes[0]?.side).toBe('foe');
    expect(activeMon(r.state.player).species.name).toBe('AQUAFIN');
  });

  test('faint on the active mon emits faint + forcedSwitch when bench survives', () => {
    let state = makeTwoVsTwoState();
    // Drop player's active EMBERCUB to 1 hp so the foe's strike KOs it.
    const dying = { ...activeMon(state.player), hp: 1 };
    state = {
      ...state,
      player: { ...state.player, members: [dying, state.player.members[1]!] },
    };
    const r = resolveRound(
      state,
      { kind: 'move', move: 'TACKLE', stance: 'G' },
      { kind: 'move', move: 'TACKLE', stance: 'A' },
      fixedRng([0.5, 0.5]),
    );
    const ko = r.events.find((e) => e.kind === 'ko' && e.side === 'player');
    const faint = r.events.find((e) => e.kind === 'faint' && e.side === 'player');
    const forced = r.events.find((e) => e.kind === 'forcedSwitch' && e.side === 'player');
    expect(ko).toBeDefined();
    expect(faint).toBeDefined();
    expect(forced).toBeDefined();
    expect(forced?.kind === 'forcedSwitch' && forced.toIndex).toBe(1);
    expect(activeMon(r.state.player).species.name).toBe('AQUAFIN');
    expect(isTeamWiped(r.state.player)).toBe(false);
  });

  test('team wipe leaves no forcedSwitch and isTeamWiped reports true', () => {
    let state = makeTwoVsTwoState();
    // Both player mons at 1 hp: KO + no bench survivor → team wipe.
    const dying1 = { ...state.player.members[0]!, hp: 1 };
    const dying2 = { ...state.player.members[1]!, hp: 0 };
    state = { ...state, player: { ...state.player, members: [dying1, dying2] } };
    const r = resolveRound(
      state,
      { kind: 'move', move: 'TACKLE', stance: 'G' },
      { kind: 'move', move: 'TACKLE', stance: 'A' },
      fixedRng([0.5, 0.5]),
    );
    expect(r.events.some((e) => e.kind === 'faint' && e.side === 'player')).toBe(true);
    expect(r.events.some((e) => e.kind === 'forcedSwitch')).toBe(false);
    expect(isTeamWiped(r.state.player)).toBe(true);
  });

  test('deterministic with fixed seed — replay produces identical events', () => {
    const state = makeTwoVsTwoState();
    const a = resolveRound(
      state,
      { kind: 'switch', toIndex: 1 },
      { kind: 'move', move: 'TACKLE', stance: 'A' },
      fixedRng([0.5, 0.5]),
    );
    const b = resolveRound(
      state,
      { kind: 'switch', toIndex: 1 },
      { kind: 'move', move: 'TACKLE', stance: 'A' },
      fixedRng([0.5, 0.5]),
    );
    // Strip non-comparable fields off — events should match deeply.
    const norm = (events: readonly BattleEvent[]): readonly BattleEvent[] => events;
    expect(norm(a.events)).toEqual(norm(b.events));
    expect(activeMon(a.state.player).hp).toBe(activeMon(b.state.player).hp);
    expect(activeMon(a.state.foe).hp).toBe(activeMon(b.state.foe).hp);
  });

  test('switch is rejected on a fainted bench mon (validation throws)', () => {
    let state = makeTwoVsTwoState();
    const dead = { ...state.player.members[1]!, hp: 0 };
    state = {
      ...state,
      player: { ...state.player, members: [state.player.members[0]!, dead] },
    };
    expect(() =>
      resolveRound(
        state,
        { kind: 'switch', toIndex: 1 },
        { kind: 'move', move: 'TACKLE', stance: 'G' },
        fixedRng([0.5]),
      ),
    ).toThrow(/Cannot switch to fainted mon/);
  });
});
