import { describe, expect, test } from 'vitest';
import {
  COMBAT,
  SPECIES,
  activeMon,
  createBattleState,
  createSide,
  fixedRng,
  resolveRound,
  setActiveMember,
} from './index';
import type { Action, BattleEvent, BattleState, CallKind, SideState } from './index';

// ── Momentum / Call-economy effect moves (Increment 1b Wave A) — unit tests ──
// THUNDERCLAP/Sap Focus, SECOND WIND, DEAD SILENCE/Silence, WARCRY/Call Lock,
// CREEPING DOUBT/Doubt, FALSE ECHO/Echo, KINDLE/Attunement, SWARM/Amplify.
// Each plugs into the 1a mechanism (read-win to land debuffs; buffs self-cast)
// and the existing ★/Call sites. SPROUTLE mirror; fixedRng([0]) pins variance.
// None is exercised by the ladder bots → existing ladders bit-identical.

const ECONOMY_MOVES = [
  'THUNDERCLAP', 'DEAD SILENCE', 'FALSE ECHO', 'WARCRY', 'CREEPING DOUBT',
  'SECOND WIND', 'KINDLE', 'SWARM',
];
const addMoves = (sd: SideState): SideState => ({
  ...sd,
  species: { ...sd.species, moves: [...sd.species.moves, ...ECONOMY_MOVES] },
});
function withEco(): BattleState {
  const s = createBattleState(createSide(SPECIES.SPROUTLE!), createSide(SPECIES.SPROUTLE!));
  return {
    ...s,
    player: setActiveMember(s.player, addMoves(activeMon(s.player))),
    foe: setActiveMember(s.foe, addMoves(activeMon(s.foe))),
  };
}
function patchPlayer(s: BattleState, p: Partial<SideState>): BattleState {
  return { ...s, player: setActiveMember(s.player, { ...activeMon(s.player), ...p }) };
}
function patchFoe(s: BattleState, p: Partial<SideState>): BattleState {
  return { ...s, foe: setActiveMember(s.foe, { ...activeMon(s.foe), ...p }) };
}
const pl = (s: BattleState) => activeMon(s.player);
const foe = (s: BattleState) => activeMon(s.foe);
const rng0 = () => fixedRng([0]);
const move = (m: string, stance: 'A' | 'G' | 'F'): Action => ({ kind: 'move', move: m, stance });
const callAct = (c: CallKind): Action => ({ kind: 'call', call: c });
const has = (evs: readonly BattleEvent[], p: (e: BattleEvent) => boolean) => evs.some(p);
const callEv = (evs: readonly BattleEvent[], side: 'player' | 'foe') =>
  evs.find((e) => e.kind === 'call' && e.side === side) as { kind: 'call'; call: CallKind } | undefined;

describe('Sap Focus (THUNDERCLAP) — read-win drains 1★, instant (no lingering debuff)', () => {
  test('A>F read-win → foe loses 1★; fizzles when the read is lost', () => {
    const s = patchFoe(withEco(), { momentum: 2 });
    const win = resolveRound(s, move('THUNDERCLAP', 'A'), move('TACKLE', 'F'), rng0());
    expect(foe(win.state).momentum).toBe(1); // 2 → 1
    expect(foe(win.state).debuff).toBeUndefined(); // instant — no lingering status
    expect(has(win.events, (e) => e.kind === 'statusApply' && e.status === 'sapFocus')).toBe(true);

    // Cast in a losing stance (F vs A) → the read is lost → Sap fizzles (the
    // foe instead WINS the read A>F and banks a ★, so it is NOT sapped to 1).
    const lose = resolveRound(s, move('THUNDERCLAP', 'F'), move('TACKLE', 'A'), rng0());
    expect(has(lose.events, (e) => e.kind === 'statusApply')).toBe(false);
    expect(foe(lose.state).momentum).toBeGreaterThan(1); // not drained by Sap Focus
  });
});

describe('Second Wind — self-gain 1★ (buff, lands regardless of the read)', () => {
  test('cast in a LOSING stance still banks the ★ (capped)', () => {
    const s = patchPlayer(withEco(), { momentum: 0 });
    const r = resolveRound(s, move('SECOND WIND', 'F'), move('TACKLE', 'A'), rng0());
    expect(pl(r.state).momentum).toBe(1); // gained, despite losing the read
    expect((pl(r.state).buffs ?? []).some((b) => b.kind === 'secondWind')).toBe(false); // instant
  });
  test('does not exceed momentumCap', () => {
    const s = patchPlayer(withEco(), { momentum: COMBAT.momentumCap });
    const r = resolveRound(s, move('SECOND WIND', 'G'), move('TACKLE', 'G'), rng0());
    expect(pl(r.state).momentum).toBe(COMBAT.momentumCap);
  });
});

describe('Silence / Call Lock — the foe cannot Call (no stun-lock; it can still act)', () => {
  test('a silenced Call is NEGATED: no call event, ★ not spent, the hit is NOT evaded', () => {
    const s = patchFoe(withEco(), { debuff: { kind: 'silence', duration: 2 }, momentum: 2 });
    const r = resolveRound(s, move('TACKLE', 'A'), callAct('getAway'), rng0());
    expect(callEv(r.events, 'foe')).toBeUndefined(); // the Call fizzled
    expect(foe(r.state).momentum).toBe(2); // ★ NOT spent
    expect(foe(r.state).hp).toBeLessThan(foe(s).hp); // getAway did NOT negate the strike
  });
  test('Call Lock negates the Call the same way', () => {
    const s = patchFoe(withEco(), { debuff: { kind: 'callLock', duration: 2 }, momentum: 2 });
    const r = resolveRound(s, move('TACKLE', 'A'), callAct('getAway'), rng0());
    expect(callEv(r.events, 'foe')).toBeUndefined();
    expect(foe(r.state).momentum).toBe(2);
  });
});

describe('Doubt — the foe’s Calls cost +1★ (negated if unaffordable)', () => {
  test('with 1★ the Call is unaffordable under Doubt → negated; with 2★ it spends 2', () => {
    const poor = patchFoe(withEco(), { debuff: { kind: 'doubt', duration: 3 }, momentum: 1 });
    const r1 = resolveRound(poor, move('TACKLE', 'G'), callAct('getAway'), rng0());
    expect(callEv(r1.events, 'foe')).toBeUndefined(); // can't afford the inflated cost
    expect(foe(r1.state).momentum).toBe(1); // not spent

    const rich = patchFoe(withEco(), { debuff: { kind: 'doubt', duration: 3 }, momentum: 2 });
    const r2 = resolveRound(rich, move('TACKLE', 'G'), callAct('getAway'), rng0());
    expect(callEv(r2.events, 'foe')?.call).toBe('getAway');
    expect(foe(r2.state).momentum).toBe(0); // 2 − (1+1)
  });
});

describe('Echo (FALSE ECHO) — re-maps the foe’s next Call to its last Call', () => {
  test('a chosen getAway comes out as the lastCall (recover); echo is consumed', () => {
    const s = patchFoe(withEco(), {
      debuff: { kind: 'echo', duration: 1 },
      momentum: 2,
      lastCall: 'recover',
      hp: 30, // so the re-mapped RECOVER visibly heals
    });
    const r = resolveRound(s, move('TACKLE', 'G'), callAct('getAway'), rng0());
    expect(callEv(r.events, 'foe')?.call).toBe('recover'); // re-mapped, not getAway
    expect(foe(r.state).debuff).toBeUndefined(); // echo consumed
    expect(has(r.events, (e) => e.kind === 'statusBreak' && e.status === 'echo')).toBe(true);
  });
});

describe('Attunement (KINDLE) — the next Call is cheaper (free); consumed', () => {
  test('a getAway with 1★ + Attunement costs 0 ★ and consumes the buff', () => {
    const s = patchPlayer(withEco(), { buffs: [{ kind: 'attunement', duration: 3 }], momentum: 1 });
    const r = resolveRound(s, callAct('getAway'), move('TACKLE', 'G'), rng0());
    expect(callEv(r.events, 'player')?.call).toBe('getAway');
    expect(pl(r.state).momentum).toBe(1); // free — ★ not spent
    expect((pl(r.state).buffs ?? []).some((b) => b.kind === 'attunement')).toBe(false); // consumed
  });
});

describe('Amplify (SWARM) — the next read-win banks double ★; consumed', () => {
  test('an A>F read-win with Amplify banks 2★ instead of 1', () => {
    const s = patchPlayer(withEco(), { buffs: [{ kind: 'amplify', duration: 3 }], momentum: 0 });
    const r = resolveRound(s, move('TACKLE', 'A'), move('TACKLE', 'F'), rng0());
    expect(pl(r.state).momentum).toBe(2); // 1 base + 1 amplify bonus
    expect((pl(r.state).buffs ?? []).some((b) => b.kind === 'amplify')).toBe(false); // consumed
    expect(has(r.events, (e) => e.kind === 'statusBreak' && e.status === 'amplify')).toBe(true);
  });
  test('Amplify is a read-win gate — a lost read banks nothing and keeps the buff', () => {
    const s = patchPlayer(withEco(), { buffs: [{ kind: 'amplify', duration: 3 }], momentum: 0 });
    const r = resolveRound(s, move('TACKLE', 'F'), move('TACKLE', 'A'), rng0()); // player loses A>F
    expect(pl(r.state).momentum).toBe(0); // no read-win → no ★
    expect((pl(r.state).buffs ?? []).some((b) => b.kind === 'amplify')).toBe(true); // still armed
  });
});

describe('read-win → economy debuff lands a status, NOT a ★', () => {
  test('a winning CREEPING DOUBT applies Doubt and banks no ★', () => {
    const s = withEco();
    const r = resolveRound(s, move('CREEPING DOUBT', 'F'), move('TACKLE', 'G'), rng0()); // F>G opening
    expect(foe(r.state).debuff?.kind).toBe('doubt');
    expect(pl(r.state).momentum).toBe(0); // status replaces the read-win ★
  });
});
