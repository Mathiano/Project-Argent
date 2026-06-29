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
import type { Action, BattleEvent, BattleState, SideState } from './index';

// ── Effect-move MECHANISM (Increment 1a) — engine unit tests ────────────────
// The 3 sample techniques (SEAR=Burn debuff, STATIC HAZE=Daze debuff, BULWARK=
// damage-reduction buff) exercise: cast-in-a-stance via the EXISTING triangle,
// read-win debuff application (fizzle on a loss), self-cast buffs (land
// regardless of the read), reduced chip damage, status-instead-of-★, and the
// status lifecycle (apply / tick / clear). SPROUTLE mirror (typeless techniques
// → neutral); fixedRng([0]) pins variance (0.9) so damage ratios are exact.
// None of this is exercised by the ladder bots → the ladders stay bit-identical
// (asserted by their unchanged numbers).

function mirror(): BattleState {
  return createBattleState(createSide(SPECIES.SPROUTLE!), createSide(SPECIES.SPROUTLE!));
}
const addTech = (sd: SideState): SideState => ({
  ...sd,
  species: { ...sd.species, moves: [...sd.species.moves, 'SEAR', 'STATIC HAZE', 'BULWARK'] },
});
function withTech(s: BattleState): BattleState {
  return {
    ...s,
    player: setActiveMember(s.player, addTech(activeMon(s.player))),
    foe: setActiveMember(s.foe, addTech(activeMon(s.foe))),
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
const has = (evs: readonly BattleEvent[], pred: (e: BattleEvent) => boolean) => evs.some(pred);

describe('cast-in-a-stance: a DEBUFF lands only on a read-win', () => {
  test('SEAR cast in A vs a Fluid foe (A>F read-win) → Burn applied, chip lands, NO ★', () => {
    const s = withTech(mirror());
    const r = resolveRound(s, move('SEAR', 'A'), move('TACKLE', 'F'), rng0());

    // Burn debuff on the foe, at the base duration.
    expect(foe(r.state).debuff).toEqual({ kind: 'burn', duration: STATUS.baseDuration });
    expect(has(r.events, (e) => e.kind === 'statusApply' && e.side === 'foe' && e.status === 'burn')).toBe(true);
    // It resolved through the EXISTING triangle as a punish (cast-stance won).
    expect(has(r.events, (e) => e.kind === 'punish' && e.side === 'player')).toBe(true);
    // Status REPLACES the ★ — the caster banks no momentum this turn.
    expect(pl(r.state).momentum).toBe(0);
    expect(has(r.events, (e) => e.kind === 'momentum' && e.side === 'player')).toBe(false);
  });

  test('SEAR cast in F vs an Aggressive foe (caster LOSES the read) → FIZZLES, caster punished', () => {
    const s = withTech(mirror());
    const r = resolveRound(s, move('SEAR', 'F'), move('TACKLE', 'A'), rng0());

    // No status — the debuff fizzled (only chip landed).
    expect(foe(r.state).debuff).toBeUndefined();
    expect(has(r.events, (e) => e.kind === 'statusApply')).toBe(false);
    // The caster is punished EXACTLY as an attacker would be in that stance:
    // the foe out-read it (A>F) and banks the ★.
    expect(has(r.events, (e) => e.kind === 'punish' && e.side === 'foe')).toBe(true);
    expect(foe(r.state).momentum).toBe(1);
  });

  test('an ATTACK winning the same read banks a ★ (the contrast that proves status-instead-of-★)', () => {
    const s = withTech(mirror());
    const r = resolveRound(s, move('TACKLE', 'A'), move('TACKLE', 'F'), rng0());
    expect(has(r.events, (e) => e.kind === 'punish' && e.side === 'player')).toBe(true);
    expect(pl(r.state).momentum).toBe(1); // an attack DOES bank ★ on the read-win
  });
});

describe('cast-in-a-stance: a BUFF self-applies regardless of the read', () => {
  test('BULWARK cast in F vs an Aggressive foe (caster LOSES the read) → buff still lands', () => {
    const s = withTech(mirror());
    const r = resolveRound(s, move('BULWARK', 'F'), move('TACKLE', 'A'), rng0());
    // Buff landed on self even though the cast-stance lost the read (the foe
    // punished the exposed cast — exposure is the cost, not a fizzle).
    expect(pl(r.state).buffs).toEqual([{ kind: 'bulwark', duration: STATUS.baseDuration }]);
    expect(has(r.events, (e) => e.kind === 'statusApply' && e.side === 'player' && e.status === 'bulwark')).toBe(true);
    expect(has(r.events, (e) => e.kind === 'punish' && e.side === 'foe')).toBe(true);
  });
});

describe('BULWARK buff mitigates incoming damage by 25%', () => {
  test('a buffed defender takes exactly 0.75× the punish damage (same RNG)', () => {
    const base = withTech(mirror());
    const buffed = patchPlayer(base, { buffs: [{ kind: 'bulwark', duration: 3 }] });
    // Player F vs foe A → the foe punishes the player; measure the player's loss.
    const rB = resolveRound(base, move('TACKLE', 'F'), move('TACKLE', 'A'), rng0());
    const rU = resolveRound(buffed, move('TACKLE', 'F'), move('TACKLE', 'A'), rng0());
    const lossBase = pl(base).hp - pl(rB.state).hp;
    const lossBuffed = pl(buffed).hp - pl(rU.state).hp;
    expect(lossBase).toBeGreaterThan(0);
    expect(lossBuffed / lossBase).toBeCloseTo(STATUS.bulwarkDamageTaken, 5); // 0.75
  });
});

describe('status lifecycle: tick (Burn DoT) → decrement → clear', () => {
  test('a Burn ticks DoT each round and clears at expiry; the debuff field empties', () => {
    let s = withTech(mirror());
    s = patchFoe(s, { debuff: { kind: 'burn', duration: 2 } }); // 2 rounds left
    const foeMaxHp = foe(s).maxHp;
    const expectedDot = Math.round(foeMaxHp * STATUS.burnDotPct);

    // Round 1: DoT ticks, duration 2→1.
    const r1 = resolveRound(s, move('TACKLE', 'G'), move('TACKLE', 'G'), rng0());
    expect(
      has(
        r1.events,
        (e) => e.kind === 'statusTick' && e.side === 'foe' && e.status === 'burn' && e.remaining === 1 && e.damage === expectedDot,
      ),
    ).toBe(true);
    expect(foe(r1.state).debuff).toEqual({ kind: 'burn', duration: 1 });

    // Round 2: final tick, duration 1→0, the status clears.
    const r2 = resolveRound(r1.state, move('TACKLE', 'G'), move('TACKLE', 'G'), rng0());
    expect(has(r2.events, (e) => e.kind === 'statusTick' && e.side === 'foe' && e.status === 'burn' && e.remaining === 0)).toBe(true);
    expect(has(r2.events, (e) => e.kind === 'statusClear' && e.side === 'foe' && e.status === 'burn')).toBe(true);
    expect(foe(r2.state).debuff).toBeUndefined();
  });

  test('a freshly-cast Burn does NOT tick on its own cast round (exposure-cost rule)', () => {
    const s = withTech(mirror());
    const r = resolveRound(s, move('SEAR', 'A'), move('TACKLE', 'F'), rng0());
    // Applied this round at full duration; no tick fired for it yet.
    expect(foe(r.state).debuff).toEqual({ kind: 'burn', duration: STATUS.baseDuration });
    expect(has(r.events, (e) => e.kind === 'statusTick' && e.side === 'foe')).toBe(false);
  });

  test('STATIC HAZE applies a Daze debuff on a read-win (state carried; tell-effect is game-side)', () => {
    const s = withTech(mirror());
    const r = resolveRound(s, move('STATIC HAZE', 'F'), move('TACKLE', 'G'), rng0()); // F>G opening = read-win
    expect(foe(r.state).debuff).toEqual({ kind: 'daze', duration: STATUS.baseDuration });
    expect(has(r.events, (e) => e.kind === 'opening' && e.side === 'player')).toBe(true);
    expect(pl(r.state).momentum).toBe(0); // status, not ★
  });
});

describe('buff stacking: distinct buffs stack, the same buff refreshes (DR)', () => {
  test('re-casting BULWARK refreshes its duration — it does NOT stack a 2nd instance', () => {
    let s = withTech(mirror());
    s = patchPlayer(s, { buffs: [{ kind: 'bulwark', duration: 2 }] }); // survives the tick (2→1)
    // Cast BULWARK again in F vs an A foe (loses the read, but a buff lands).
    const r = resolveRound(s, move('BULWARK', 'F'), move('TACKLE', 'A'), rng0());
    const buffs = pl(r.state).buffs ?? [];
    // The pre-existing instance ticked 2→1, then the recast REFRESHED it in
    // place to the base duration — ONE instance, not two (no compounding DR).
    expect(buffs.filter((b) => b.kind === 'bulwark')).toHaveLength(1);
    expect(buffs[0]!.duration).toBe(STATUS.baseDuration);
  });
});

describe('one debuff at a time (new replaces old)', () => {
  test('a fresh debuff replaces the existing one', () => {
    let s = withTech(mirror());
    s = patchFoe(s, { debuff: { kind: 'daze', duration: 3 } });
    // Player lands SEAR on a read-win → Burn replaces the Daze.
    const r = resolveRound(s, move('SEAR', 'A'), move('TACKLE', 'F'), rng0());
    expect(foe(r.state).debuff?.kind).toBe('burn');
  });
});
