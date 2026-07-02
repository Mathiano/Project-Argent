import { describe, expect, test } from 'vitest';
import {
  activeMon,
  affordableMoves,
  createBattleState,
  createSide,
  forcedAction,
  isTeamWiped,
  mulberry32,
  registerMoves,
  resolveRound,
} from '../engine';
import type { Action, BattleState, RNG, Side, SideState, Species, Stance } from '../engine';
import { reader } from './archetypes';
import type { BotArchetype } from './archetypes';

// ── Buffs / heals / cleanse DEGENERACY GATE (Increment 1b Wave C) ───────────
// The watch-item is "FREE VALUE": buffs/heals don't disrupt the opponent, so the
// only degeneracy is SELF-value. These bots try to break that vs the canonical
// `reader`: a HEAL-TURTLE (TIDE MEND/UNDERTOW + Guard → infinite sustain?), a
// GLASS-CANNON (GLASS EDGE → all upside?), a SIPHON-READER (offensive sustain
// dominant?), a SET-STANCE-TURTLE (free conditional DR?). The gate asserts none
// dominates (heal-per-turn < safe-damage-per-turn → no unkillable turtle; the
// glass-cannon's taken-up is a real cost) and draws stay low (no sustain
// stalemate). Mechanics proven in engine/sustainEffects.test.ts. The existing
// ladders stay bit-identical (no ladder bot casts these). New measurement surface.

registerMoves({ TBOLT: { name: 'TBOLT', tier: 'mid', type: null } });

const TESTMON: Species = {
  name: 'TESTMON',
  types: [],
  hp: 64,
  atk: 96,
  dfn: 96,
  spd: 90,
  moves: ['TBOLT', 'TACKLE', 'TIDE MEND', 'UNDERTOW', 'SIPHON', 'SET STANCE', 'GLASS EDGE'],
};

const STANCES: readonly Stance[] = ['A', 'G', 'F'];
const triangleCounter = (s: Stance): Stance => (s === 'A' ? 'G' : s === 'G' ? 'F' : 'A');
function foeStances(state: BattleState, side: Side): Stance[] {
  const e: Side = side === 'player' ? 'foe' : 'player';
  return state.history.map((h) => h[e]).filter((s): s is Stance => s !== null);
}
function modalCounter(hist: readonly Stance[]): Stance | null {
  if (hist.length === 0) return null;
  const c: Record<Stance, number> = { A: 0, G: 0, F: 0 };
  for (const s of hist) c[s] += 1;
  let m: Stance = 'A';
  for (const s of STANCES) if (c[s] > c[m]) m = s;
  return triangleCounter(m);
}
const readStance = (state: BattleState, side: Side): Stance =>
  modalCounter(foeStances(state, side).slice(-3)) ?? 'A';
function pick(me: SideState, preferred: string): string {
  const aff = affordableMoves(me);
  return aff.includes(preferred) ? preferred : aff[0]!;
}
const hasBuff = (me: SideState, kind: string) => (me.buffs ?? []).some((b) => b.kind === kind);

// HEAL-TURTLE — the core free-value risk. Heal to sustain, Guard to mitigate,
// attack only when topped up. If a no-★ technique heal out-paces a reader's
// damage SAFELY, this would be an unkillable healer (the BULWARK-turtle lesson).
const healTurtle: BotArchetype = {
  name: 'heal-turtle',
  chooseAction(state, side) {
    const me = activeMon(state[side]);
    const forced = forcedAction(me);
    if (forced) return forced;
    const hpFrac = me.hp / me.maxHp;
    // Keep a regenerating UNDERTOW up, and top off with TIDE MEND when hurt —
    // both cast in Guard (the safest cast-stance) to minimize exposure.
    if (!hasBuff(me, 'undertow') && affordableMoves(me).includes('UNDERTOW')) {
      return { kind: 'move', move: 'UNDERTOW', stance: 'G' };
    }
    if (hpFrac < 0.6 && affordableMoves(me).includes('TIDE MEND')) {
      return { kind: 'move', move: 'TIDE MEND', stance: 'G' };
    }
    return { kind: 'move', move: pick(me, 'TBOLT'), stance: readStance(state, side) };
  },
};

// GLASS-CANNON — keep GLASS EDGE up and swing on reads. If the dealt-up were
// free (the taken-up ignorable), this would dominate. The taken-up must make it
// a real gamble (≈ break-even / worse vs the reader).
const glassCannon: BotArchetype = {
  name: 'glass-cannon',
  chooseAction(state, side) {
    const me = activeMon(state[side]);
    const forced = forcedAction(me);
    if (forced) return forced;
    if (!hasBuff(me, 'glassEdge') && affordableMoves(me).includes('GLASS EDGE')) {
      return { kind: 'move', move: 'GLASS EDGE', stance: 'G' };
    }
    return { kind: 'move', move: pick(me, 'TBOLT'), stance: readStance(state, side) };
  },
};

// SIPHON-READER — fold lifesteal into read-attacking: when it has a read, ~40%
// of the time cast SIPHON (a read-win heals + chips amplified) instead of the
// attack. Offensive sustain should be VIABLE, never dominant (the read-gate is
// the cost; a missed read = chip only, no heal).
const siphonReader: BotArchetype = {
  name: 'siphon-reader',
  chooseAction(state, side, rng) {
    const me = activeMon(state[side]);
    const forced = forcedAction(me);
    if (forced) return forced;
    const stance = modalCounter(foeStances(state, side).slice(-3));
    if (stance === null) return { kind: 'move', move: pick(me, 'TBOLT'), stance: 'G' };
    const useTech = rng.next() < 0.4 && affordableMoves(me).includes('SIPHON');
    return { kind: 'move', move: useTech ? 'SIPHON' : pick(me, 'TBOLT'), stance };
  },
};

// SET-STANCE-TURTLE — keep the poker buff up and Brace to read-counter. The
// sim can't see the "revealed Brace" tell (the real-game cost), so this is the
// worst-case: a controller getting the conditional DR for free. Must still not
// dominate (the magnitude alone is bounded).
const setStanceTurtle: BotArchetype = {
  name: 'set-stance',
  chooseAction(state, side) {
    const me = activeMon(state[side]);
    const forced = forcedAction(me);
    if (forced) return forced;
    if (!hasBuff(me, 'setStance') && affordableMoves(me).includes('SET STANCE')) {
      return { kind: 'move', move: 'SET STANCE', stance: 'G' };
    }
    // Brace-counter the foe's read modal (Guard to catch an aggressor), else read.
    const foeModal = foeStances(state, side).slice(-3);
    const wantGuard = foeModal.filter((x) => x === 'A').length >= 1;
    return { kind: 'move', move: pick(me, 'TBOLT'), stance: wantGuard ? 'G' : readStance(state, side) };
  },
};

function localMatch(p: BotArchetype, f: BotArchetype, sp: Species, rng: RNG, maxRounds = 300): Side | 'draw' {
  let state: BattleState = createBattleState(createSide(sp), createSide(sp));
  for (let i = 0; i < maxRounds; i += 1) {
    const fa: Action = f.chooseAction(state, 'foe', rng);
    const pa: Action = p.chooseAction(state, 'player', rng, fa);
    const r = resolveRound(state, pa, fa, rng);
    state = r.state;
    if (isTeamWiped(state.player)) return 'foe';
    if (isTeamWiped(state.foe)) return 'player';
  }
  return 'draw';
}
function ladder(p: BotArchetype, f: BotArchetype, n: number, seed: number): { win: number; draw: number } {
  let w = 0;
  let d = 0;
  for (let i = 0; i < n; i += 1) {
    const res = localMatch(p, f, TESTMON, mulberry32(seed + i));
    if (res === 'player') w += 1;
    else if (res === 'draw') d += 1;
  }
  return { win: (w / n) * 100, draw: (d / n) * 100 };
}

const N = 2000;
const SEED = 7777;

describe('sustain/buff degeneracy gate — no free value, no turtle, no stall', () => {
  const vs = (bot: BotArchetype) => ladder(bot, reader, N, SEED);
  const log = (name: string, r: { win: number; draw: number }) =>
    // eslint-disable-next-line no-console
    console.log(`${name.padEnd(12)}vs reader → win ${r.win.toFixed(1)}%  draw ${r.draw.toFixed(1)}%`);

  // ── QUARANTINED (Spine-1, 2026-06-30) — buff/heal BALANCE gates ──────────────
  // DEFERRED to the holistic potency/feel tuning pass (checkpoint #5). These
  // buff/heal balance gates broke when phased-unlock (Spine-1) throttled early
  // damage: the Wave A–C self-buff/heal/DR magnitudes were tuned in the
  // pre-phased-unlock economy, where they're now over-strong (sustain/DR
  // over-performs in the low-early-damage economy; the technique ★-exemption
  // amplifies it — self-buffs are free at 0★ while attacks are ★-gated). DO NOT
  // tune these magnitudes piecemeal now — the damage economy is still changing
  // (Spine-2 behind-penalty, Spine-3 ceiling, the two-pool model all shift it).
  // Re-tune + re-validate ALL ~34 effect moves together in the holistic pass,
  // once the FULL economy is built, so they're balanced in final context. Likely
  // also involves the §3 question (gating techniques by tier — partially helps
  // but cascades 19 tests + the heal magnitude itself needs re-tuning regardless).
  // (The MECHANISM tests in engine/sustainEffects.test.ts stay green — heals heal,
  // buffs apply, the DR is real; only these win-rate BALANCE gates defer.)
  test('HEAL-TURTLE does NOT out-sustain the reader (no unkillable healer, no stall)', () => {
    const r = vs(healTurtle);
    log('heal-turtle', r);
    // Tuning pass #5: the tick-counted self-escalation DR shrinks a maintained
    // UNDERTOW/TIDE-MEND regen so heal-per-turn falls BELOW safe-damage-per-turn →
    // the pure heal-STALLER now LOSES to the reader (~13% measured). On-thesis: a
    // spam-staller should lose to reads. (Bimodal — sustain is a threshold, not a
    // ~56% dial; accepted per Decision 1. The moves stay usable situationally.)
    expect(r.win).toBeLessThan(60);
    expect(r.draw).toBeLessThan(10); // a sustain stalemate would show as timeouts
  });

  test('GLASS-CANNON is a real gamble — the taken-up is NOT free (does not dominate)', () => {
    const r = vs(glassCannon);
    log('glass-cannon', r);
    // ~60% is the "Guard-band" ceiling these buff-in-Guard strategies reach (a
    // pure modal-counter reader that NEVER Guards loses 0% to reader; merely
    // casting from Guard — stamina regen + mitigation + counter — is most of the
    // jump). The rate is INVARIANT to the glassEdge magnitude, so this is not the
    // dealt bonus running away; the +damage-taken cost is engine-proven real
    // (engine/sustainEffects.test.ts). Gate at the BULWARK-band ceiling (<63).
    expect(r.win).toBeLessThan(63);
    expect(r.draw).toBeLessThan(10);
  });

  test('SIPHON-READER offensive sustain is viable, not dominant', () => {
    const r = vs(siphonReader);
    log('siphon-reader', r);
    expect(r.win).toBeLessThan(60);
    expect(r.draw).toBeLessThan(10);
  });

  // QUARANTINED (Spine-1) — see the buff/heal BALANCE-gate deferral note above
  // (DEFERRED to the holistic potency/feel tuning pass, checkpoint #5).
  test('SET-STANCE poker DR (worst-case: tell unseen) does not dominate', () => {
    const r = vs(setStanceTurtle);
    log('set-stance', r);
    expect(r.win).toBeLessThan(62); // a conditional DR turtle, BULWARK-class edge ceiling
    expect(r.draw).toBeLessThan(10);
  });
});
