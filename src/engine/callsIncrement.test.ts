import { describe, expect, test } from 'vitest';
import {
  SPECIES,
  activeMon,
  createBattleState,
  createSide,
  createTeam,
  mulberry32,
  resolveRound,
  setActiveMember,
  validateActionTeam,
} from './index';
import type { Action, BattleState, SideState } from './index';

// ── The Calls increment (docs/calls-expansion-design.md) — engine surfaces ───
// SHAKE IT OFF (cleanse), READ THEM (inert/presentation), THROW THEM OFF
// (history plant), COME BACK (protected switch). READ THEM has no engine effect
// by design (game-side reveal) — covered by "inert" below.

const foeAttack: Action = { kind: 'move', move: 'TACKLE', stance: 'A' };

function withPlayer(patch: Partial<SideState>): BattleState {
  const s = createBattleState(createSide(SPECIES.SPROUTLE!), createSide(SPECIES.SPROUTLE!));
  return { ...s, player: setActiveMember(s.player, { ...activeMon(s.player), ...patch }) };
}

describe('SHAKE IT OFF — the owed cleanse', () => {
  test('clears the active debuff (statusBreak) and spends ★; forgoes the strike', () => {
    const st = withPlayer({ momentum: 2, debuff: { kind: 'burn', duration: 3 } });
    const r = resolveRound(st, { kind: 'call', call: 'shakeOff' }, foeAttack, mulberry32(1));
    expect(r.events.some((e) => e.kind === 'statusBreak' && e.side === 'player' && e.status === 'burn')).toBe(true);
    const pl = activeMon(r.state.player);
    expect(pl.debuff).toBeUndefined(); // cleansed
    expect(pl.momentum).toBe(1); // ★ spent
    expect(pl.hp).toBeLessThan(activeMon(st.player).hp); // took the foe's hit (no evade)
  });

  test('with no debuff it is a legal no-op (still spends ★) — ★-bound, not DR-bound', () => {
    const st = withPlayer({ momentum: 1 });
    const r = resolveRound(st, { kind: 'call', call: 'shakeOff' }, foeAttack, mulberry32(2));
    expect(activeMon(r.state.player).momentum).toBe(0); // the ★ economy is the only throttle
  });
});

describe('THROW THEM OFF — plant the lie in history', () => {
  test('records the player-chosen plantStance (not null) into this round history', () => {
    const st = withPlayer({ momentum: 1 });
    const r = resolveRound(st, { kind: 'call', call: 'throwOff', plantStance: 'A' }, foeAttack, mulberry32(3));
    const last = r.state.history[r.state.history.length - 1]!;
    expect(last.player).toBe('A'); // the lie a history-reader consults
    expect(activeMon(r.state.player).momentum).toBe(0); // ★ spent, strike forgone
  });

  test('a plain Call still records null (bit-identical) — only throwOff plants', () => {
    const st = withPlayer({ momentum: 1 });
    const r = resolveRound(st, { kind: 'call', call: 'getAway' }, foeAttack, mulberry32(3));
    expect(r.state.history[r.state.history.length - 1]!.player).toBeNull();
  });
});

describe('READ THEM — presentation-only, mechanically inert', () => {
  test('spends ★, forgoes the strike, and has NO combat effect (no heal/status/swap)', () => {
    const st = withPlayer({ momentum: 2 });
    const r = resolveRound(st, { kind: 'call', call: 'readThem' }, foeAttack, mulberry32(4));
    const pl = activeMon(r.state.player);
    expect(pl.momentum).toBe(1); // ★ spent
    expect(pl.hp).toBeLessThan(activeMon(st.player).hp); // took the foe's hit
    // No recover / cleanse / switch side-effects leaked in.
    expect(r.events.some((e) => e.kind === 'recover' || e.kind === 'statusBreak' || e.kind === 'switchIn')).toBe(false);
  });
});

describe('COME BACK — the protected switch', () => {
  function twoMonPlayer(activePatch: Partial<SideState> = {}): BattleState {
    const p0 = { ...createSide(SPECIES.SPROUTLE!), ...activePatch };
    const p1 = createSide(SPECIES.EMBERCUB!); // distinct species → detect the swap
    return createBattleState(createTeam([p0, p1]), createSide(SPECIES.SPROUTLE!));
  }

  test('swaps in the bench mon AND negates the incoming hit (no free hit eaten)', () => {
    const st = twoMonPlayer({ momentum: 2 });
    const r = resolveRound(st, { kind: 'call', call: 'comeBack', toIndex: 1 }, foeAttack, mulberry32(5));
    expect(r.events.some((e) => e.kind === 'switchOut' && e.side === 'player')).toBe(true);
    expect(r.events.some((e) => e.kind === 'switchIn' && e.side === 'player' && e.toIndex === 1)).toBe(true);
    expect(r.state.player.active).toBe(1);
    const incoming = activeMon(r.state.player);
    expect(incoming.species.name).toBe('EMBERCUB');
    expect(incoming.hp).toBe(incoming.maxHp); // the incoming mon took the round's hit NEGATED
  });

  test('the recalled mon keeps its ★-spent state on the bench', () => {
    const st = twoMonPlayer({ momentum: 2 });
    const r = resolveRound(st, { kind: 'call', call: 'comeBack', toIndex: 1 }, foeAttack, mulberry32(6));
    expect(r.state.player.members[0]!.momentum).toBe(1); // 1★ spent by the outgoing caller
  });

  test('NO-FREE-VALUE: it is illegal without a valid bench target (not a universal dodge)', () => {
    const oneMon = createSide(SPECIES.SPROUTLE!, undefined, undefined);
    const oneMonStarred = setActiveMember(createTeam([{ ...oneMon, momentum: 2 }]), { ...oneMon, momentum: 2 });
    // 1-mon team: target 1 out of range → illegal (its value is the swap, not the evade).
    expect(() => validateActionTeam(oneMonStarred, { kind: 'call', call: 'comeBack', toIndex: 1 })).toThrow();
    // missing target → illegal.
    expect(() => validateActionTeam(oneMonStarred, { kind: 'call', call: 'comeBack' })).toThrow();
    // switching to the fainted bench mon → illegal.
    const fainted = createTeam([{ ...oneMon, momentum: 2 }, { ...createSide(SPECIES.EMBERCUB!), hp: 0 }]);
    expect(() => validateActionTeam(fainted, { kind: 'call', call: 'comeBack', toIndex: 1 })).toThrow();
  });
});
