import { describe, expect, test } from 'vitest';
import {
  STATUS,
  activeMon,
  createBattleState,
  createSide,
  fixedRng,
  registerMoves,
  resolveRound,
  setActiveMember,
} from './index';
import type { Action, BattleEvent, BattleState, Species, SideState, Stance } from './index';

// ── Buffs / heals / cleanse effect moves (Increment 1b Wave C) — unit tests ──
// Heals self-apply (exposure in the cast-stance is the cost); SIPHON's lifesteal
// is READ-WIN-gated; cleanse clears the one debuff; GLASS EDGE is dealt-up AND
// taken-up (a real cost); SET STANCE strengthens Brace ONLY (guard-conditional);
// VEIL/Shrouded is engine-inert (the tell-hide is game-side). Typeless mirror
// (no type interaction), fixedRng([0]) pins variance to the 0.9 floor.

registerMoves({ TBOLT: { name: 'TBOLT', tier: 'mid', type: null } });

const WAVE_C = [
  'TIDE MEND', 'UNDERTOW', 'SIPHON', 'ENTANGLE', 'WANE', 'STEADY',
  'REFORGE', 'VEIL', 'SET STANCE', 'FOCUS UP', 'GLASS EDGE', 'SEAR',
];
const MON: Species = {
  name: 'MON',
  types: [],
  hp: 80,
  atk: 96,
  dfn: 96,
  spd: 90,
  moves: ['TBOLT', 'TACKLE', ...WAVE_C],
};

function fresh(): BattleState {
  return createBattleState(createSide(MON), createSide(MON));
}
const patchP = (s: BattleState, p: Partial<SideState>): BattleState =>
  ({ ...s, player: setActiveMember(s.player, { ...activeMon(s.player), ...p }) });
const pl = (s: BattleState) => activeMon(s.player);
const rng0 = () => fixedRng([0]);
const move = (m: string, stance: Stance): Action => ({ kind: 'move', move: m, stance });
const has = (evs: readonly BattleEvent[], p: (e: BattleEvent) => boolean) => evs.some(p);
// The damage on a side's landed strike/punish/opening this round.
function landed(evs: readonly BattleEvent[], side: 'player' | 'foe'): number {
  for (const e of evs) {
    if ((e.kind === 'strike' || e.kind === 'punish' || e.kind === 'opening') && e.side === side) {
      return e.damage;
    }
  }
  return 0;
}
// The hp healed by a side's recover event this round (-1 if none). Float — the
// engine emits `hp_after - hp_before`, so compare with toBeCloseTo.
function healed(evs: readonly BattleEvent[], side: 'player' | 'foe'): number {
  for (const e of evs) if (e.kind === 'recover' && e.side === side) return e.healed;
  return -1;
}

describe('heals — TIDE MEND / UNDERTOW / SIPHON', () => {
  test('TIDE MEND self-heals ~tideMendHealPct of maxHp (a recover event), even on a lost read', () => {
    // Player casts TIDE MEND in Aggressive but the foe Braces (A vs G — NOT a
    // read-win): the heal STILL lands (buffs self-apply; exposure is the cost).
    const s = patchP(fresh(), { hp: 30 });
    const r = resolveRound(s, move('TIDE MEND', 'A'), move('TACKLE', 'G'), rng0());
    const max = pl(r.state).maxHp;
    expect(healed(r.events, 'player')).toBeCloseTo(Math.round(max * STATUS.tideMendHealPct), 3);
  });

  test('UNDERTOW HoT heals each tick while the buff is active', () => {
    const s = patchP(fresh(), { hp: 30, buffs: [{ kind: 'undertow', duration: 3 }] });
    const r = resolveRound(s, move('TACKLE', 'G'), move('TACKLE', 'G'), rng0());
    const max = pl(r.state).maxHp;
    expect(healed(r.events, 'player')).toBeCloseTo(Math.round(max * STATUS.undertowHealPct), 3);
    expect(has(r.events, (e) => e.kind === 'statusTick' && e.side === 'player' && e.status === 'undertow')).toBe(true);
  });

  test('SIPHON lifesteal heals ONLY on a read-win (F>G opening), and replaces the ★', () => {
    const s = patchP(fresh(), { hp: 30 });
    const r = resolveRound(s, move('SIPHON', 'F'), move('TACKLE', 'G'), rng0()); // F>G opening = read-win
    const max = pl(r.state).maxHp;
    expect(healed(r.events, 'player')).toBeCloseTo(Math.round(max * STATUS.siphonHealPct), 3);
    expect(pl(r.state).momentum).toBe(0); // the heal (status) replaces the read-win ★
  });

  test('SIPHON FIZZLES on a lost/neutral read (chip only, no heal)', () => {
    const s = patchP(fresh(), { hp: 30 });
    // F vs A is neither punish (A>F) nor opening (F>G) → the normal branch, no
    // read-win for the caster → the lifesteal does not land.
    const r = resolveRound(s, move('SIPHON', 'F'), move('TACKLE', 'A'), rng0());
    expect(has(r.events, (e) => e.kind === 'recover' && e.side === 'player')).toBe(false);
  });
});

describe('cleanse — WANE / STEADY / REFORGE', () => {
  test('WANE clears the bearer’s single debuff (statusBreak), always lands', () => {
    const s = patchP(fresh(), { debuff: { kind: 'burn', duration: 3 } });
    const r = resolveRound(s, move('WANE', 'G'), move('TACKLE', 'G'), rng0());
    expect(pl(r.state).debuff).toBeUndefined();
    expect(has(r.events, (e) => e.kind === 'statusBreak' && e.side === 'player' && e.status === 'burn')).toBe(true);
  });

  test('REFORGE cleanses AND heals a little', () => {
    const s = patchP(fresh(), { hp: 30, debuff: { kind: 'drained', duration: 3 } });
    const r = resolveRound(s, move('REFORGE', 'G'), move('TACKLE', 'G'), rng0());
    const max = pl(r.state).maxHp;
    expect(pl(r.state).debuff).toBeUndefined();
    expect(healed(r.events, 'player')).toBeCloseTo(Math.round(max * STATUS.reforgeHealPct), 3);
  });

  test('cleanse with no debuff is a no-op (no statusBreak)', () => {
    const r = resolveRound(fresh(), move('STEADY', 'G'), move('TACKLE', 'G'), rng0());
    expect(has(r.events, (e) => e.kind === 'statusBreak' && e.side === 'player')).toBe(false);
  });
});

describe('offense buffs — GLASS EDGE / FOCUS UP deal more', () => {
  // Player Aggressive vs foe Fluid → a PUNISH; the ratio with/without the buff
  // isolates the dealt-multiplier (the branch is constant).
  const punishDmg = (buff?: SideState['buffs']): number => {
    const base = fresh();
    const s = buff ? patchP(base, { buffs: buff }) : base;
    const r = resolveRound(s, move('TACKLE', 'A'), move('TACKLE', 'F'), rng0());
    return landed(r.events, 'player');
  };

  test('GLASS EDGE amplifies the bearer’s strike by glassEdgeDamageDealt', () => {
    const ratio = punishDmg([{ kind: 'glassEdge', duration: 2 }]) / punishDmg();
    expect(ratio).toBeCloseTo(STATUS.glassEdgeDamageDealt, 4);
  });

  test('FOCUS UP amplifies the bearer’s strike by focusUpDamageDealt', () => {
    const ratio = punishDmg([{ kind: 'focusUp', duration: 3 }]) / punishDmg();
    expect(ratio).toBeCloseTo(STATUS.focusUpDamageDealt, 4);
  });
});

describe('GLASS EDGE — the taken-up is a REAL cost', () => {
  // Foe Aggressive vs the bearer in Fluid → a PUNISH on the bearer; the ratio
  // with/without the glassEdge buff on the DEFENDER isolates the taken-multiplier.
  const takenDmg = (buff?: SideState['buffs']): number => {
    const base = fresh();
    const s = buff ? patchP(base, { buffs: buff }) : base;
    const r = resolveRound(s, move('TACKLE', 'F'), move('TACKLE', 'A'), rng0());
    return landed(r.events, 'foe'); // the foe's punish ON the player
  };

  test('a GLASS EDGE bearer takes glassEdgeDamageTaken× more', () => {
    const ratio = takenDmg([{ kind: 'glassEdge', duration: 2 }]) / takenDmg();
    expect(ratio).toBeCloseTo(STATUS.glassEdgeDamageTaken, 4);
  });
});

describe('SET STANCE — stronger Brace, but ONLY when bracing (poker)', () => {
  // Foe Aggressive strikes the player. With SET STANCE the player takes less
  // ONLY in Guard; in Aggressive the buff does nothing (it is not a flat DR).
  const incoming = (playerStance: Stance, withBuff: boolean): number => {
    const base = fresh();
    const s = withBuff ? patchP(base, { buffs: [{ kind: 'setStance', duration: 3 }] }) : base;
    const r = resolveRound(s, move('TACKLE', playerStance), move('TACKLE', 'A'), rng0());
    return landed(r.events, 'foe');
  };

  test('bracing (Guard) takes setStanceGuardTaken× less with the buff', () => {
    const ratio = incoming('G', true) / incoming('G', false);
    expect(ratio).toBeCloseTo(STATUS.setStanceGuardTaken, 4);
  });

  test('NOT bracing (Fluid) → the buff gives no mitigation (conditional, not a flat DR)', () => {
    // Foe A vs player F → a PUNISH on the player (defStance F, not G) → SET STANCE
    // does nothing. (Player A would CLASH with the foe's A; F isolates the branch.)
    const ratio = incoming('F', true) / incoming('F', false);
    expect(ratio).toBeCloseTo(1, 4);
  });
});

describe('VEIL / Shrouded — engine-inert (the tell-hide is game-side)', () => {
  test('holding Shrouded changes NO combat number (dealt or taken)', () => {
    const base = fresh();
    const shrouded = patchP(base, { buffs: [{ kind: 'shrouded', duration: 3 }] });
    const a = resolveRound(base, move('TACKLE', 'A'), move('TACKLE', 'F'), rng0());
    const b = resolveRound(shrouded, move('TACKLE', 'A'), move('TACKLE', 'F'), rng0());
    expect(landed(b.events, 'player')).toBeCloseTo(landed(a.events, 'player'), 6);
    expect(landed(b.events, 'foe')).toBeCloseTo(landed(a.events, 'foe'), 6);
  });

  test('casting VEIL applies a bounded Shrouded buff (duration = baseDuration)', () => {
    const r = resolveRound(fresh(), move('VEIL', 'G'), move('TACKLE', 'G'), rng0());
    const buff = (pl(r.state).buffs ?? []).find((x) => x.kind === 'shrouded');
    expect(buff?.duration).toBe(STATUS.baseDuration);
  });
});

describe('ENTANGLE — defensive DR buff (distinct from BULWARK → stacks)', () => {
  const takenDmg = (buffs?: SideState['buffs']): number => {
    const base = fresh();
    const s = buffs ? patchP(base, { buffs }) : base;
    const r = resolveRound(s, move('TACKLE', 'F'), move('TACKLE', 'A'), rng0());
    return landed(r.events, 'foe');
  };
  test('ENTANGLE reduces incoming by entangleDamageTaken×', () => {
    const ratio = takenDmg([{ kind: 'entangle', duration: 3 }]) / takenDmg();
    expect(ratio).toBeCloseTo(STATUS.entangleDamageTaken, 4);
  });
});
