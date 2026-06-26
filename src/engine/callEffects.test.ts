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
import type { Action, BattleEvent, BattleState, SideState } from './index';

// ── Call effects (Lane B, docs/call-effects-design.md) — engine unit tests ──
// Recover (heal 50% maxHp), Dodge (full evade), Full Power (+50% next attack).
// SPROUTLE mirror; fixedRng([0]) pins variance so damage ratios are exact.
// These actions never appear in sim/legacy runs → the ladders stay bit-identical
// (asserted separately by the unchanged ladder numbers).

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
const rng0 = () => fixedRng([0]);
const single = (stance: 'A' | 'G' | 'F'): Action => ({ kind: 'move', move: 'TACKLE', stance });
const call = (c: 'getAway' | 'dodge' | 'recover' | 'hangInThere'): Action => ({ kind: 'call', call: c });
const focusState = (stance: 'A' | 'G' | 'F') => ({ stance, move: 'TACKLE' });
const release: Action = { kind: 'release', release: 'heavy' };
const dmgToPlayer = (s: BattleState, r: { state: BattleState }) => pl(s).hp - pl(r.state).hp;

const playerStrike = (evs: readonly BattleEvent[]) =>
  evs.find((e) => e.kind === 'strike' && e.side === 'player') as
    | { kind: 'strike'; damage: number }
    | undefined;

describe('RECOVER (★1) — heal 50% maxHp', () => {
  test('heals exactly round(maxHp · recoverPct) and spends 1 ★', () => {
    // Player Recovers; foe also Calls (Get Away) so NO strike lands → the heal
    // is observed cleanly. Both at ★1 (Calls need ≥1 momentum).
    let s = mirror();
    s = patchPlayer(s, { hp: 10, momentum: 1 });
    s = patchFoe(s, { momentum: 1 });
    const maxHp = pl(s).maxHp;
    const r = resolveRound(s, call('recover'), call('getAway'), rng0());

    const ev = r.events.find((e) => e.kind === 'recover') as { healed: number } | undefined;
    expect(ev).toBeDefined();
    expect(ev!.healed).toBe(Math.round(maxHp * COMBAT.recoverPct));
    expect(pl(r.state).hp).toBe(10 + Math.round(maxHp * COMBAT.recoverPct));
    expect(pl(r.state).momentum).toBe(0); // spent the ★
  });

  test('clamps at maxHp (no overheal)', () => {
    let s = mirror();
    const maxHp = pl(s).maxHp;
    s = patchPlayer(s, { hp: maxHp - 3, momentum: 1 });
    s = patchFoe(s, { momentum: 1 });
    const r = resolveRound(s, call('recover'), call('getAway'), rng0());
    expect(pl(r.state).hp).toBe(maxHp);
    const ev = r.events.find((e) => e.kind === 'recover') as { healed: number };
    expect(ev.healed).toBe(3);
  });
});

describe('DODGE (★1) — full evade', () => {
  test('negates the incoming attack completely and spends 1 ★', () => {
    let s = mirror();
    s = patchPlayer(s, { momentum: 1 });
    const before = pl(s).hp;
    const r = resolveRound(s, call('dodge'), single('A'), rng0());
    expect(pl(r.state).hp).toBe(before); // took zero damage
    expect(pl(r.state).momentum).toBe(0);
    expect(r.events.some((e) => e.kind === 'call' && e.side === 'player' && e.call === 'dodge')).toBe(true);
  });
});

describe('GET AWAY (★1, Fix 3) — graze: 25% of the hit, Dodge stays clean', () => {
  test('Get Away takes exactly getAwayGraze× the hit; Dodge 0; Hang In There full', () => {
    // Same foe RELEASE (heavy) into the caller, three escapes from one base
    // state (each spends 1 ★). All three are CALLS → identical resolution path
    // + identical rng draws, so the only difference is the damage applied:
    //   Dodge        → 0 (clean evade)
    //   Hang In There → the FULL release damage (no 1-hp floor at full HP)
    //   Get Away      → getAwayGraze × that full damage (the graze).
    const base = patchPlayer(patchFoe(mirror(), { focus: focusState('A') }), { momentum: 2 });
    const dGet = dmgToPlayer(base, resolveRound(base, call('getAway'), release, rng0()));
    const dDodge = dmgToPlayer(base, resolveRound(base, call('dodge'), release, rng0()));
    const dHang = dmgToPlayer(base, resolveRound(base, call('hangInThere'), release, rng0()));
    expect(dDodge).toBe(0);
    expect(dGet).toBeGreaterThan(0); // no longer a clean evade
    expect(dHang).toBeGreaterThan(dGet); // the graze is much smaller than a full hit
    expect(dGet).toBeCloseTo(dHang * COMBAT.getAwayGraze, 5); // exactly 25%
  });
});

describe('FULL POWER (★2) — +50% on the next attack', () => {
  test('a buffed strike deals exactly 1.5× the unbuffed strike (same seed)', () => {
    // G vs G — a normal hit on both sides, no triangle counter, so the only
    // difference is the +50% buff. Same fixed rng → exact ×1.5.
    const base = patchPlayer(mirror(), { momentum: 2 });
    const normal = resolveRound(base, single('G'), single('G'), rng0());
    const buffed = resolveRound(
      base,
      { kind: 'move', move: 'TACKLE', stance: 'G', fullPower: true },
      single('G'),
      rng0(),
    );
    const n = playerStrike(normal.events);
    const b = playerStrike(buffed.events);
    expect(n).toBeDefined();
    expect(b).toBeDefined();
    expect(b!.damage / n!.damage).toBeCloseTo(COMBAT.fullPowerMult, 5);
  });

  test('spends 2 ★ and emits a fullPower event', () => {
    const base = patchPlayer(mirror(), { momentum: 2 });
    const r = resolveRound(
      base,
      { kind: 'move', move: 'TACKLE', stance: 'G', fullPower: true },
      single('G'),
      rng0(),
    );
    expect(r.events.some((e) => e.kind === 'fullPower' && e.side === 'player')).toBe(true);
    expect(pl(r.state).momentum).toBe(0); // 2 → 0
  });

  test('the +50% also applies when the attack hits a FOCUSING foe (focus path)', () => {
    // Player attacks; foe is mid-focus (commit). The strike becomes the focus
    // COST — buffed it should be 1.5× the unbuffed cost (same seed).
    const base = patchPlayer(mirror(), { momentum: 2 });
    const focusCommit: Action = { kind: 'move', move: 'TACKLE', stance: 'A', commit: true };
    const cost = (r: { events: readonly BattleEvent[] }) =>
      (r.events.find((e) => e.kind === 'focus' && e.side === 'foe') as { costDamage: number }).costDamage;
    const normal = resolveRound(base, single('A'), focusCommit, rng0());
    const buffed = resolveRound(
      base,
      { kind: 'move', move: 'TACKLE', stance: 'A', fullPower: true },
      focusCommit,
      rng0(),
    );
    expect(cost(buffed) / cost(normal)).toBeCloseTo(COMBAT.fullPowerMult, 5);
  });
});
