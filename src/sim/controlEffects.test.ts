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

// ── Control & resource DEGENERACY GATE (Increment 1b Wave B) ────────────────
// The watch-item: CONTROL lock-down. A stance-lock that's too easy/long could
// chain-lock the foe to death. These bots try exactly that vs the reader: a
// freezer (FROST BIND on reads), a taunter (CHALLENGE → forced-Aggressive →
// Brace counter), a drainer (TOXIC SAP resource pressure). The gate asserts
// none dominates — escapability (read-win to apply, bounded durations, DR→
// resist, the foe can Call/rest) holds — and that draws stay low (no
// resource-starve softlock). Mechanics proven in engine/controlEffects.test.ts.

registerMoves({ TBOLT: { name: 'TBOLT', tier: 'mid', type: null } });

const TESTMON: Species = {
  name: 'TESTMON',
  types: [],
  hp: 64,
  atk: 96,
  dfn: 96,
  spd: 90,
  moves: ['TBOLT', 'TACKLE', 'FROST BIND', 'CHALLENGE', 'TOXIC SAP'],
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
const theFoe = (state: BattleState, side: Side): SideState =>
  activeMon(state[side === 'player' ? 'foe' : 'player']);

// Lock the reader, THEN CAPITALIZE: while the foe is frozen to a known stance,
// counter it for a guaranteed read-win (punish/opening/counter); otherwise land
// FROST BIND on a read. This is the real lock-down risk — a controller that
// locks then freely punishes.
const freezer: BotArchetype = {
  name: 'freezer',
  chooseAction(state, side) {
    const me = activeMon(state[side]);
    const forced = forcedAction(me);
    if (forced) return forced;
    const fz = theFoe(state, side).debuff;
    if (fz?.kind === 'frozen' && fz.stance !== undefined) {
      // Foe locked to a known stance → counter it with an attack (capitalize).
      return { kind: 'move', move: pick(me, 'TBOLT'), stance: triangleCounter(fz.stance) };
    }
    const stance = readStance(state, side);
    if (affordableMoves(me).includes('FROST BIND')) return { kind: 'move', move: 'FROST BIND', stance };
    return { kind: 'move', move: pick(me, 'TBOLT'), stance };
  },
};

// Taunt → the foe is forced Aggressive next round → Brace (Guard) to counter it.
const taunter: BotArchetype = {
  name: 'taunter',
  chooseAction(state, side) {
    const me = activeMon(state[side]);
    const forced = forcedAction(me);
    if (forced) return forced;
    if (theFoe(state, side).debuff?.kind === 'taunt') return { kind: 'move', move: pick(me, 'TBOLT'), stance: 'G' };
    const stance = readStance(state, side);
    if (affordableMoves(me).includes('CHALLENGE')) return { kind: 'move', move: 'CHALLENGE', stance };
    return { kind: 'move', move: pick(me, 'TBOLT'), stance };
  },
};

// Resource pressure: TOXIC SAP on reads, else attack.
const drainer: BotArchetype = {
  name: 'drainer',
  chooseAction(state, side) {
    const me = activeMon(state[side]);
    const forced = forcedAction(me);
    if (forced) return forced;
    const stance = readStance(state, side);
    if (affordableMoves(me).includes('TOXIC SAP')) return { kind: 'move', move: 'TOXIC SAP', stance };
    return { kind: 'move', move: pick(me, 'TBOLT'), stance };
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
const SEED = 4242;

describe('control/resource degeneracy gate — no lock-down, no resource softlock', () => {
  const vs = (bot: BotArchetype) => ladder(bot, reader, N, SEED);
  const log = (name: string, r: { win: number; draw: number }) =>
    // eslint-disable-next-line no-console
    console.log(`${name.padEnd(10)}vs reader → win ${r.win.toFixed(1)}%  draw ${r.draw.toFixed(1)}%`);

  test('FROST BIND freezer does NOT chain-lock the reader to death (escapable)', () => {
    const r = vs(freezer);
    log('freezer', r);
    expect(r.win).toBeLessThan(60);
    expect(r.draw).toBeLessThan(10);
  });

  test('Taunt→Brace is not an unbreakable forced-loss loop', () => {
    const r = vs(taunter);
    log('taunter', r);
    expect(r.win).toBeLessThan(60);
    expect(r.draw).toBeLessThan(10);
  });

  test('TOXIC SAP resource pressure does not soft-lock (low draws) nor dominate', () => {
    const r = vs(drainer);
    log('drainer', r);
    expect(r.win).toBeLessThan(60);
    expect(r.draw).toBeLessThan(10); // a resource softlock would show as timeout draws
  });
});
