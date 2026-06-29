import { describe, expect, test } from 'vitest';
import {
  STATUS,
  SPECIES,
  activeMon,
  createBattleState,
  createSide,
  fixedRng,
  resolveRound,
  setActiveMember,
} from './index';
import type { Action, BattleEvent, BattleState, SideState, Stance } from './index';

// ── Control & resource effect moves (Increment 1b Wave B) — unit tests ──────
// FROST BIND/Frozen + MIND SNARE/Inception + CHALLENGE/Taunt (stance-locks),
// TOXIC SAP/Drained + LEECH BITE/Sap (stamina), CORRODE (anti-utility). Control
// is ENGINE-ENFORCED (the forced stance threads through resolution + history)
// and ESCAPABLE (read-win to apply, bounded durations, diminishing returns →
// RESIST, foe can Call/rest). SPROUTLE mirror; fixedRng([0]) pins variance.

const WAVE_B = ['FROST BIND', 'MIND SNARE', 'CHALLENGE', 'TOXIC SAP', 'LEECH BITE', 'CORRODE', 'SEAR'];
const addMoves = (sd: SideState): SideState => ({
  ...sd,
  species: { ...sd.species, moves: [...sd.species.moves, ...WAVE_B] },
});
function withB(): BattleState {
  const s = createBattleState(createSide(SPECIES.SPROUTLE!), createSide(SPECIES.SPROUTLE!));
  return {
    ...s,
    player: setActiveMember(s.player, addMoves(activeMon(s.player))),
    foe: setActiveMember(s.foe, addMoves(activeMon(s.foe))),
  };
}
const patchFoe = (s: BattleState, p: Partial<SideState>): BattleState =>
  ({ ...s, foe: setActiveMember(s.foe, { ...activeMon(s.foe), ...p }) });
const pl = (s: BattleState) => activeMon(s.player);
const foe = (s: BattleState) => activeMon(s.foe);
const rng0 = () => fixedRng([0]);
const move = (m: string, stance: Stance): Action => ({ kind: 'move', move: m, stance });
const has = (evs: readonly BattleEvent[], p: (e: BattleEvent) => boolean) => evs.some(p);
const lastFoeStance = (s: BattleState) => s.history[s.history.length - 1]!.foe;

describe('stance-lock control — the forced stance is ENGINE-ENFORCED', () => {
  test('a Frozen foe is overridden to its locked stance (flows to resolution + history)', () => {
    // Foe locked to GUARD; it TRIES Aggressive. Player plays Fluid → because the
    // foe is forced to G, F>G OPENING fires (it would not vs the foe's chosen A).
    const s = patchFoe(withB(), { debuff: { kind: 'frozen', duration: 2, stance: 'G' } });
    const r = resolveRound(s, move('TACKLE', 'F'), move('TACKLE', 'A'), rng0());
    expect(lastFoeStance(r.state)).toBe('G'); // forced, not the chosen 'A'
    expect(has(r.events, (e) => e.kind === 'opening' && e.side === 'player')).toBe(true);
  });

  test('Taunt forces Aggressive for one round (sets up the Brace counter), then clears', () => {
    const s = patchFoe(withB(), { debuff: { kind: 'taunt', duration: 1, stance: 'A' } });
    const r = resolveRound(s, move('TACKLE', 'G'), move('TACKLE', 'F'), rng0()); // foe wants F
    expect(lastFoeStance(r.state)).toBe('A'); // forced Aggressive
    expect(has(r.events, (e) => e.kind === 'counter' && e.side === 'player')).toBe(true); // G counters A
    expect(foe(r.state).debuff).toBeUndefined(); // 1-round lock expired
  });

  test('a Frozen foe can still Call (escapability valve — stance-lock binds only moves)', () => {
    const s = patchFoe(withB(), { debuff: { kind: 'frozen', duration: 2, stance: 'G' }, momentum: 1 });
    const r = resolveRound(s, move('TACKLE', 'A'), { kind: 'call', call: 'getAway' }, rng0());
    expect(has(r.events, (e) => e.kind === 'call' && e.side === 'foe')).toBe(true); // the Call went through
  });
});

describe('control escapability — diminishing returns RESIST a sustained lock', () => {
  test('re-applying Frozen while active eventually RESISTS (cannot chain-lock to death)', () => {
    // Foe already locked twice (applied:2); a third landing this round resists.
    const s = patchFoe(withB(), { debuff: { kind: 'frozen', duration: 2, applied: 2, stance: 'G' } });
    // Player lands FROST BIND on a read-win (F>G opening vs the forced-G foe).
    const r = resolveRound(s, move('FROST BIND', 'F'), move('TACKLE', 'A'), rng0());
    expect(has(r.events, (e) => e.kind === 'statusResist' && e.side === 'foe' && e.status === 'frozen')).toBe(true);
  });

  test('FROST BIND lands a fresh Frozen on a read-win, carrying the foe’s current stance', () => {
    const s = withB();
    const r = resolveRound(s, move('FROST BIND', 'F'), move('TACKLE', 'G'), rng0()); // F>G opening
    expect(foe(r.state).debuff?.kind).toBe('frozen');
    expect(foe(r.state).debuff?.stance).toBe('G'); // locked to the stance it held
    expect(pl(r.state).momentum).toBe(0); // status replaces the read-win ★
  });
});

describe('resource effects — stamina pressure (bounded)', () => {
  test('Drained bleeds stamina each round (a stamina event of −drainedStaminaDot)', () => {
    const s = patchFoe(withB(), { debuff: { kind: 'drained', duration: 3 }, st: 60 });
    const r = resolveRound(s, move('TACKLE', 'G'), move('TACKLE', 'G'), rng0());
    expect(has(r.events, (e) => e.kind === 'stamina' && e.side === 'foe' && e.netDelta === -STATUS.drainedStaminaDot)).toBe(true);
    expect(foe(r.state).debuff?.duration).toBe(2); // ticked down
  });

  test('Sap (LEECH BITE) burst-drains stamina on a read-win, instantly (no lingering debuff)', () => {
    const s = patchFoe(withB(), { st: 70 });
    const r = resolveRound(s, move('LEECH BITE', 'A'), move('TACKLE', 'F'), rng0()); // A>F read-win
    expect(has(r.events, (e) => e.kind === 'stamina' && e.side === 'foe' && e.netDelta === -STATUS.sapStaminaBurst)).toBe(true);
    expect(foe(r.state).debuff).toBeUndefined(); // instant — no lingering status
  });
});

describe('Corrode — the bearer’s next technique FIZZLES (anti-utility), consumed', () => {
  test('a Corroded foe’s SEAR lands no Burn and Corrode is consumed', () => {
    const s = patchFoe(withB(), { debuff: { kind: 'corrode', duration: 3 } });
    // Foe casts SEAR on a read-win (A>F) — but Corrode fizzles the Burn.
    const r = resolveRound(s, move('TACKLE', 'F'), move('SEAR', 'A'), rng0());
    expect(pl(r.state).debuff).toBeUndefined(); // no Burn applied — SEAR fizzled
    expect(foe(r.state).debuff).toBeUndefined(); // Corrode consumed
    expect(has(r.events, (e) => e.kind === 'statusBreak' && e.status === 'corrode')).toBe(true);
  });
});
