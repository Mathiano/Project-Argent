import { describe, expect, test } from 'vitest';
import {
  SPECIES,
  activeMon,
  createBattleState,
  createSide,
  fixedRng,
  resolveRound,
  setActiveMember,
} from './index';
import type { Action, BattleState, SideState, TwoStep } from './index';

// ── Combat Layer 2 — two-step unit tests ─────────────────────────────────────
// Each two-step's resolution, the flipped triangle, phase-1 punish, the
// soft-counter-on-seen, Call-escape, and the L2.7 ★-award rule (esp. the
// "survives a non-punishing single-step → no ★" case). SPROUTLE mirror isolates
// the mechanics; fixedRng([0]) pins variance so damage comparisons are exact.

function mirror(): BattleState {
  return createBattleState(createSide(SPECIES.SPROUTLE!), createSide(SPECIES.SPROUTLE!));
}
function patchPlayer(s: BattleState, p: Partial<SideState>): BattleState {
  return { ...s, player: setActiveMember(s.player, { ...activeMon(s.player), ...p }) };
}
function patchFoe(s: BattleState, p: Partial<SideState>): BattleState {
  return { ...s, foe: setActiveMember(s.foe, { ...activeMon(s.foe), ...p }) };
}
const pl = (s: BattleState) => activeMon(s.player);
const fo = (s: BattleState) => activeMon(s.foe);
const rng0 = () => fixedRng([0]);
const winding = (step: TwoStep): { step: TwoStep; move: string } => ({ step, move: 'TACKLE' });
const ignored: Action = { kind: 'move', move: 'TACKLE', stance: 'A' }; // a releaser's passed action is overridden
const single = (stance: 'A' | 'F' | 'G'): Action => ({ kind: 'move', move: 'TACKLE', stance });
const commit = (stance: 'A' | 'F' | 'G'): Action => ({ kind: 'move', move: 'TACKLE', stance, commit: true });

// Damage dealt TO the foe / TO the player this round (mirror, full HP start).
const dmgToFoe = (s: BattleState, r: { state: BattleState }) => fo(s).hp - fo(r.state).hp;
const dmgToPlayer = (s: BattleState, r: { state: BattleState }) => pl(s).hp - pl(r.state).hp;

describe('two-step wind-up → release lifecycle', () => {
  test('committing sets `winding`; the next round RELEASES and clears it', () => {
    const s = mirror();
    // Round 1: player commits CHARGE, foe single-steps.
    const r1 = resolveRound(s, commit('A'), single('G'), rng0());
    expect(r1.events.some((e) => e.kind === 'windUp' && e.side === 'player')).toBe(true);
    expect(pl(r1.state).winding).toEqual(winding('charge'));
    // Round 2: the engine forces the release regardless of the passed action.
    const r2 = resolveRound(r1.state, ignored, single('F'), rng0());
    expect(r2.events.some((e) => e.kind === 'release' && e.side === 'player' && e.step === 'charge')).toBe(true);
    expect(pl(r2.state).winding).toBeUndefined();
  });
});

describe('each two-step’s release effect', () => {
  test('CHARGE pierces Guard — a guarding foe is NOT mitigated (≈ no guard)', () => {
    const base = patchPlayer(mirror(), { winding: winding('charge') });
    const vsGuard = resolveRound(base, ignored, single('G'), rng0());
    const vsFluid = resolveRound(base, ignored, single('F'), rng0());
    expect(vsGuard.events.some((e) => e.kind === 'release' && e.pierced === true)).toBe(true);
    // Guard is ALSO charge's soft-counter (×0.7 tilt). Were guard ALSO
    // mitigating (×0.6), vsGuard would be ~0.42× the unmitigated Fluid case;
    // because charge PIERCES the guard, only the soft tilt applies (~0.7×).
    const g = dmgToFoe(base, vsGuard);
    const f = dmgToFoe(base, vsFluid);
    expect(g).toBeLessThan(f); // soft tilt present
    expect(g).toBeGreaterThan(f * 0.6); // but guard's ×0.6 mitigation was PIERCED (else it'd be ~0.42f)
  });

  test('HIDE strikes from concealment — the releaser takes REDUCED incoming', () => {
    const hideBase = patchPlayer(mirror(), { winding: winding('hide') });
    const chargeBase = patchPlayer(mirror(), { winding: winding('charge') });
    // Same foe Aggressive counter-strike; the hider blunts more than the charger.
    const hideR = resolveRound(hideBase, ignored, single('A'), rng0());
    const chargeR = resolveRound(chargeBase, ignored, single('A'), rng0());
    expect(hideR.events.some((e) => e.kind === 'release' && e.concealed === true)).toBe(true);
    expect(dmgToPlayer(hideBase, hideR)).toBeLessThan(dmgToPlayer(chargeBase, chargeR));
  });

  test('FEINT punishes a defensive reaction — a guarding foe is DAZED (takes MORE)', () => {
    const base = patchPlayer(mirror(), { winding: winding('feint') });
    const vsGuard = resolveRound(base, ignored, single('G'), rng0());
    const vsFluid = resolveRound(base, ignored, single('F'), rng0());
    // The brace is punished (daze ×1.3, no mitigation) → more than vs a non-defensive foe.
    expect(dmgToFoe(base, vsGuard)).toBeGreaterThan(dmgToFoe(base, vsFluid));
  });
});

describe('the FLIPPED triangle (both release): HIDE > CHARGE > FEINT > HIDE', () => {
  const cases: Array<[TwoStep, TwoStep, 'player' | 'foe' | null]> = [
    ['hide', 'charge', 'player'],
    ['charge', 'feint', 'player'],
    ['feint', 'hide', 'player'],
    ['charge', 'hide', 'foe'],
    ['feint', 'charge', 'foe'],
    ['hide', 'feint', 'foe'],
    ['charge', 'charge', null],
  ];
  for (const [plStep, foeStep, winner] of cases) {
    test(`${plStep} vs ${foeStep} → flip winner ${winner ?? 'none'} (+★ to winner)`, () => {
      let s = patchPlayer(mirror(), { winding: winding(plStep) });
      s = patchFoe(s, { winding: winding(foeStep) });
      const r = resolveRound(s, ignored, ignored, rng0());
      expect(r.events.some((e) => e.kind === 'flipResolve' && e.winner === winner)).toBe(true);
      const plStar = r.events.some((e) => e.kind === 'momentum' && e.side === 'player');
      const foeStar = r.events.some((e) => e.kind === 'momentum' && e.side === 'foe');
      expect(plStar).toBe(winner === 'player');
      expect(foeStar).toBe(winner === 'foe');
    });
  }
});

describe('phase-1 vulnerability + the L2.7 ★-award rule', () => {
  test('a single-step PUNISHER reads the wind-up → it earns ★ (L2.7 case 2)', () => {
    // Foe commits CHARGE; player single-steps AGGRESSIVE (charge.punishedBy = [A]).
    const s = mirror();
    const r = resolveRound(s, single('A'), commit('A'), rng0());
    expect(r.events.some((e) => e.kind === 'phase1Punish' && e.side === 'player' && e.step === 'charge')).toBe(true);
    expect(r.events.some((e) => e.kind === 'momentum' && e.side === 'player')).toBe(true);
    // The foe still carries the wind-up into next round.
    expect(fo(r.state).winding).toEqual(winding('charge'));
  });

  test('SURVIVING a non-punishing single-step grants NO ★ (L2.7 case 3 — the key case)', () => {
    // Foe commits CHARGE; player single-steps GUARD (NOT in charge.punishedBy).
    const s = mirror();
    const r = resolveRound(s, single('G'), commit('A'), rng0());
    expect(r.events.some((e) => e.kind === 'phase1Punish')).toBe(false);
    expect(r.events.some((e) => e.kind === 'momentum')).toBe(false); // surviving a gamble is not a read
    expect(fo(r.state).winding).toEqual(winding('charge')); // still winding (it survived to release)
  });

  test('a RELEASE vs a single-step grants NO ★ either way (phase-1 already resolved)', () => {
    const base = patchPlayer(mirror(), { winding: winding('charge') });
    const r = resolveRound(base, ignored, single('F'), rng0());
    expect(r.events.some((e) => e.kind === 'release' && e.side === 'player')).toBe(true);
    expect(r.events.some((e) => e.kind === 'momentum')).toBe(false);
  });
});

describe('SOFT counter on a SEEN release (L2.5 — tilts, never negates)', () => {
  test('the soft-counter stance blunts a charge release but does NOT negate it', () => {
    const base = patchPlayer(mirror(), { winding: winding('charge') });
    // charge.softCounterStance = 'G'. Compare a soft-countering Guard vs a
    // non-soft Fluid (both fail to mitigate via pierce, so the gap is the soft tilt).
    const soft = resolveRound(base, ignored, single('G'), rng0());
    const notSoft = resolveRound(base, ignored, single('F'), rng0());
    const softDmg = dmgToFoe(base, soft);
    const fullDmg = dmgToFoe(base, notSoft);
    expect(softDmg).toBeLessThan(fullDmg); // tilted down
    expect(softDmg).toBeGreaterThan(0); // but NOT negated — still lands
  });
});

describe('Call escape from a committed enemy Charge (L2.6 — ★-powered)', () => {
  test('GET AWAY = guaranteed no-hit; spends 1 ★', () => {
    // Foe is releasing CHARGE; player has ★ and calls GET AWAY.
    let s = patchFoe(mirror(), { winding: winding('charge') });
    s = patchPlayer(s, { momentum: 2 });
    const r = resolveRound(s, { kind: 'call', call: 'getAway' }, ignored, rng0());
    expect(r.events.some((e) => e.kind === 'call' && e.side === 'player' && e.call === 'getAway')).toBe(true);
    expect(dmgToPlayer(s, r)).toBe(0); // no-hit
    expect(pl(r.state).momentum).toBe(1); // spent 1 ★
  });

  test('HANG IN THERE = cannot drop below 1 hp this round', () => {
    let s = patchFoe(mirror(), { winding: winding('charge') });
    s = patchPlayer(s, { momentum: 1, hp: 5 }); // a charge release would otherwise KO
    const r = resolveRound(s, { kind: 'call', call: 'hangInThere' }, ignored, rng0());
    expect(pl(r.state).hp).toBe(1); // floored, not KO'd
    expect(r.events.some((e) => e.kind === 'ko')).toBe(false);
  });
});
