import { describe, expect, test } from 'vitest';
import {
  SPECIES,
  createBattleState,
  createSide,
  mulberry32,
  resolveRound,
} from '../engine';
import { BOND_MAX, BOND_STAGES, bondStage } from './catching';
import {
  CHALLENGE_CAP,
  JUMPSTART_STAGE,
  applyBondXp,
  bondAfterFight,
  bondXp,
  challengeFactor,
  hasJumpstart,
  powerIndex,
  stageProgress,
} from './bond';

// A representative species power (the fixture starters are ~even).
const PAR = powerIndex(SPECIES.SPROUTLE!);

describe('powerIndex — relative-challenge yardstick, never a stat source', () => {
  test('sums the four base stats', () => {
    const sp = SPECIES.SPROUTLE!;
    expect(powerIndex(sp)).toBe(sp.hp + sp.atk + sp.dfn + sp.spd);
  });
});

describe('challengeFactor — relative to THIS mon (the firewall axis)', () => {
  test('zero at/below the trivial floor (stomping a weakling)', () => {
    expect(challengeFactor(300, 300 * 0.7)).toBe(0);
    expect(challengeFactor(300, 150)).toBe(0); // half-power foe → trivial
  });
  test('1.0 at parity', () => {
    expect(challengeFactor(300, 300)).toBeCloseTo(1, 5);
  });
  test('scales past 1 when out-powered, capped', () => {
    expect(challengeFactor(300, 360)).toBeGreaterThan(1);
    expect(challengeFactor(300, 3000)).toBe(CHALLENGE_CAP);
  });
});

describe('bondXp — challenge-scaled (B2)', () => {
  const baseFight = { hpFracRemaining: 0.8 } as const;

  test('FIREWALL: a trivial wild yields exactly zero (no farming bond)', () => {
    expect(bondXp({ monPower: 300, foePower: 120, kind: 'wild', ...baseFight })).toBe(0);
    // …even repeated: zero stays zero, so a farming run never accrues.
    expect(bondXp({ monPower: 300, foePower: 120, kind: 'trainer', ...baseFight })).toBe(0);
  });

  test('a real near-level fight is MEANINGFUL, trainers above wilds', () => {
    const wild = bondXp({ monPower: 300, foePower: 300, kind: 'wild', ...baseFight });
    const trainer = bondXp({ monPower: 300, foePower: 300, kind: 'trainer', ...baseFight });
    expect(wild).toBeGreaterThan(0);
    expect(trainer).toBeGreaterThan(wild); // route/city trainers MATTER more
  });

  test('a boss clear is the big bonus even when it under-powers the mon', () => {
    const boss = bondXp({ monPower: 300, foePower: 200, kind: 'boss', ...baseFight });
    expect(boss).toBeGreaterThan(0); // bosses are never "trivial"
  });

  test('fight strain modulates by felt difficulty (sweep < normal < grind < clutch)', () => {
    const f = (hp: number) => bondXp({ monPower: 300, foePower: 300, kind: 'trainer', hpFracRemaining: hp });
    const sweep = f(0.95); // barely scratched
    const normal = f(0.6); // a normal win
    const grind = f(0.35); // a real grind
    const clutch = f(0.1); // survived on fumes
    const fainted = f(0); // fought and fell (in a won battle)
    expect(sweep).toBeLessThan(normal);
    expect(normal).toBeLessThan(grind);
    expect(grind).toBeLessThan(clutch);
    expect(fainted).toBe(normal); // neutral — a faint isn't rewarded above a hard-won survival
  });

  test('felt difficulty beats nominal power: sweeping a strong foe < grinding a parity foe', () => {
    // The fix for "type-advantaged sweep of a high-power foe over-rewards":
    const sweepStrong = bondXp({ monPower: 300, foePower: 420, kind: 'trainer', hpFracRemaining: 0.95 });
    const grindParity = bondXp({ monPower: 300, foePower: 300, kind: 'trainer', hpFracRemaining: 0.25 });
    expect(grindParity).toBeGreaterThan(sweepStrong);
  });
});

describe('applyBondXp — diminishing-returns / widening curve (B3)', () => {
  test('monotonic and clamped to [0, 100]', () => {
    expect(applyBondXp(10, 20)).toBeGreaterThan(10);
    expect(applyBondXp(10, 0)).toBe(10);
    expect(applyBondXp(99.9, 99999)).toBeLessThanOrEqual(BOND_MAX);
    expect(applyBondXp(0, -5)).toBe(0);
  });

  test('the SAME xp moves a low-bond mon further than a high-bond mon', () => {
    const lowGain = applyBondXp(5, 15) - 5;
    const highGain = applyBondXp(80, 15) - 80;
    expect(lowGain).toBeGreaterThan(highGain);
  });

  test('TIER THRESHOLDS WIDEN: each stage costs more real-fight xp than the last', () => {
    // xp (effort) needed to climb from the floor of stage s to the floor of
    // stage s+1, measured by inverting the value curve at the stage maxes.
    const widths: number[] = [];
    let prevValue = 0;
    for (const s of BOND_STAGES) {
      // find xp to go from prevValue up to s.max
      let xp = 0;
      // binary search the xp that lands at s.max (cheap + exact enough)
      let lo = 0;
      let hi = 100000;
      for (let i = 0; i < 60; i += 1) {
        const mid = (lo + hi) / 2;
        if (applyBondXp(prevValue, mid) < s.max) lo = mid;
        else hi = mid;
      }
      xp = (lo + hi) / 2;
      widths.push(xp);
      prevValue = s.max;
    }
    // Each successive stage (after the first) demands strictly more xp.
    for (let i = 2; i < widths.length - 1; i += 1) {
      // skip the final (Inseparable→100 asymptote) which is effectively ∞
      expect(widths[i]!).toBeGreaterThan(widths[i - 1]!);
    }
  });
});

describe('scenarios — the gate (growth feel, firewall, renewable)', () => {
  test('bond GROWS on real trainer fights near the mon’s level (a felt step)', () => {
    const start = 10; // a starter’s opening bond (stage 1)
    // One fight is perceptible; a few real fights cross into the next stage
    // (at the campaign pace a single win no longer jumps a whole stage).
    expect(bondAfterFight(start, { monPower: PAR, foePower: PAR, kind: 'trainer', hpFracRemaining: 0.6 }))
      .toBeGreaterThan(start);
    let bond = start;
    for (let i = 0; i < 5; i += 1) {
      bond = bondAfterFight(bond, { monPower: PAR, foePower: PAR, kind: 'trainer', hpFracRemaining: 0.6 });
    }
    expect(bondStage(bond)).toBeGreaterThan(bondStage(start)); // a felt step
  });

  test('FIREWALL: farming weak wilds is NEAR-ZERO across many repeats', () => {
    let bond = 10;
    for (let i = 0; i < 50; i += 1) {
      bond = bondAfterFight(bond, {
        monPower: PAR,
        foePower: PAR * 0.4, // a much weaker wild — trivial for this mon
        kind: 'wild',
        hpFracRemaining: 1,
      });
    }
    expect(bond).toBe(10); // 50 farmed stomps → no movement at all
  });

  test('RENEWABLE: a fresh under-powered mon earns meaningful bond from parity foes', () => {
    // A weak/early species (low absolute power) fighting opposition near ITS
    // OWN level — a real challenge FOR IT, so bond flows even late-game.
    const weakMon = Math.round(PAR * 0.5);
    const start = 5; // freshly caught
    let bond = start;
    for (let i = 0; i < 12; i += 1) {
      bond = bondAfterFight(bond, {
        monPower: weakMon,
        foePower: weakMon, // appropriate opposition (parity for the weak mon)
        kind: 'trainer',
        hpFracRemaining: 0.5,
      });
    }
    expect(bond).toBeGreaterThan(start + 10); // it genuinely climbs over time
    expect(bondStage(bond)).toBeGreaterThanOrEqual(2);
  });
});

describe('hasJumpstart — the one effect’s unlock (B5)', () => {
  test('locked at the freshly-met first stage, unlocked from stage 2', () => {
    expect(hasJumpstart(5)).toBe(false); // Wary (stage 1)
    expect(hasJumpstart(BOND_STAGES[0]!.max)).toBe(false); // top of stage 1
    expect(hasJumpstart(BOND_STAGES[0]!.max + 1)).toBe(true); // into stage 2
    expect(bondStage(BOND_STAGES[0]!.max + 1)).toBe(JUMPSTART_STAGE);
  });
});

describe('stageProgress — the visible meter (B4)', () => {
  test('runs 0..1 within a stage and is full at the top stage', () => {
    expect(stageProgress(BOND_STAGES[0]!.max + 1)).toBeGreaterThanOrEqual(0);
    expect(stageProgress(BOND_STAGES[0]!.max + 1)).toBeLessThan(0.2);
    expect(stageProgress(100)).toBe(1); // Inseparable — nowhere further
  });
});

describe('NO STAT PATH: bond never touches HP/ATK/DFN/SPD', () => {
  test('arming the jumpstart leaves every base stat identical', () => {
    const plain = createSide(SPECIES.SPROUTLE!);
    const armed = createSide(SPECIES.SPROUTLE!, undefined, { jumpstartArmed: true });
    expect(armed.maxHp).toBe(plain.maxHp);
    expect(armed.hp).toBe(plain.hp);
    expect(armed.species.atk).toBe(plain.species.atk);
    expect(armed.species.dfn).toBe(plain.species.dfn);
    expect(armed.species.spd).toBe(plain.species.spd);
    expect(armed.jumpstartArmed).toBe(true);
    expect(plain.jumpstartArmed).toBeUndefined(); // absent field → bit-identical
  });
});

describe('jumpstart fires END-TO-END in the engine (B5)', () => {
  test('an armed mon’s first read-win banks an EXTRA ★ + emits bondJumpstart, then disarms', () => {
    const rng = mulberry32(7);
    // Player guards (armed); foe goes Aggressive → the foe’s strike is
    // COUNTERED (a read-win) when the player survives, granting momentum.
    const player = createSide(SPECIES.SPROUTLE!, undefined, { jumpstartArmed: true });
    const foe = createSide(SPECIES.EMBERCUB!);
    const state = createBattleState(player, foe);
    const r = resolveRound(
      state,
      { kind: 'move', move: 'TACKLE', stance: 'G' },
      { kind: 'move', move: 'TACKLE', stance: 'A' },
      rng,
    );
    const counter = r.events.find((e) => e.kind === 'counter' && e.side === 'player');
    expect(counter).toBeDefined(); // the read-win happened
    const jump = r.events.find((e) => e.kind === 'bondJumpstart' && e.side === 'player');
    expect(jump).toBeDefined(); // the jumpstart fired
    // One read-win banked TWO ★ (normal +1, jumpstart +1).
    const pl = r.state.player.members[r.state.player.active]!;
    expect(pl.momentum).toBe(2);
    expect(pl.jumpstartArmed).toBe(false); // spent — once per battle
  });

  test('an UNARMED mon’s first read-win banks only one ★ and emits no jumpstart', () => {
    const rng = mulberry32(7);
    const player = createSide(SPECIES.SPROUTLE!); // not armed
    const foe = createSide(SPECIES.EMBERCUB!);
    const state = createBattleState(player, foe);
    const r = resolveRound(
      state,
      { kind: 'move', move: 'TACKLE', stance: 'G' },
      { kind: 'move', move: 'TACKLE', stance: 'A' },
      rng,
    );
    expect(r.events.some((e) => e.kind === 'counter' && e.side === 'player')).toBe(true);
    expect(r.events.some((e) => e.kind === 'bondJumpstart')).toBe(false);
    const pl = r.state.player.members[r.state.player.active]!;
    expect(pl.momentum).toBe(1);
  });
});
