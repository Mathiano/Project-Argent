// UPDRAFT (GALE) — sim + surgical-scope gate.
// Updraft grants "act as if +1★ for tier-ACCESS" for a short window. This verifies
// (a) the surgical scope: it opens the tier-gate but grants NO actual ★ and does
// NOT touch the behind-penalty differential; (b) it is NOT degenerate: a GALE mon
// abusing it punches above its ★-weight but does not dominate the reader.
import { describe, expect, test } from 'vitest';
import ch1BatchData from '../../docs/ch1-batch.json';
import movesData from '../../docs/moves.json';
import typechartData from '../../docs/typechart.json';
import {
  activeMon,
  affordableAttacks,
  affordableMoves,
  createBattleState,
  createSide,
  createTeam,
  forcedAction,
  isTeamWiped,
  loadDex,
  loadMoves,
  lookupMove,
  mulberry32,
  registerMoves,
  resolveRound,
} from '../engine';
import type { Action, BattleState, DexEntryJson, MoveJson, RNG, Side, SideState, TypeChart } from '../engine';
import { reader } from './archetypes';

registerMoves(loadMoves(movesData as MoveJson[]));
const CH1 = loadDex(ch1BatchData as DexEntryJson[], 13);
const CHART = typechartData as TypeChart;
const UPDRAFT_BUFF = [{ kind: 'updraft', duration: 2 }] as const;

describe('UPDRAFT — surgical scope (tier-access only, no ★, no behind-penalty)', () => {
  test('GALE now carries UPDRAFT (real GALE technique) + STATIC HAZE (WING FLARE stand-in)', () => {
    for (const name of ['FLITPECK', 'GALEHAWK']) {
      expect(CH1[name]!.moves).toContain('UPDRAFT');
      expect(CH1[name]!.moves).not.toContain('SECOND WIND'); // the stand-in it replaced
    }
  });

  test('opens the tier-gate: a 0★ mon reaches the mid tier WHILE updraft is active', () => {
    const base = createSide(CH1.GALEHAWK!); // 0★, full stamina
    // WING CUT is a mid ATTACK (needs 1★ under phased-unlock) → locked at 0★.
    expect(affordableMoves(base)).not.toContain('WING CUT');
    const boosted = { ...base, buffs: UPDRAFT_BUFF };
    // +1 effective ★ for ACCESS → mid unlocked.
    expect(affordableMoves(boosted)).toContain('WING CUT');
    // …but NO actual ★ was granted (the buff sits in `buffs`, momentum untouched).
    expect(boosted.momentum).toBe(0);
  });

  test('the boost CAPS at mid: heavy/nuke stay gated by REAL ★ even with updraft', () => {
    // The anti-degeneracy cap: early HEAVY access wins the fragile glass-mirror
    // race (sim: a 0%-strategy → 74% purely off early DIVE BOMBs). So updraft
    // reaches up to MID only; the heavy needs the real 2★.
    const at1 = { ...createSide(CH1.GALEHAWK!), momentum: 1, buffs: UPDRAFT_BUFF }; // 1★ + updraft
    expect(affordableMoves(at1)).not.toContain('DIVE BOMB'); // heavy req 2 > mid → boost does NOT apply
    const at2 = { ...createSide(CH1.GALEHAWK!), momentum: 2 }; // real 2★, no updraft
    expect(affordableMoves(at2)).toContain('DIVE BOMB'); // earned it → unlocked
  });

  test('casting UPDRAFT grants NO actual ★ (buff applies, momentum unchanged)', () => {
    let state = createBattleState(
      createTeam([createSide(CH1.GALEHAWK!)]), // player, 0★
      createTeam([createSide(CH1.SILTSKIP!)]),
      { typeChart: CHART },
    );
    const before = activeMon(state.player).momentum;
    // Player casts UPDRAFT (a buff — self-applies); foe strikes. A technique cast
    // yields the STATUS, never ★ (no double-win) — so momentum cannot rise from it.
    const pA: Action = { kind: 'move', move: 'UPDRAFT', stance: 'G' };
    const fA: Action = { kind: 'move', move: 'TACKLE', stance: 'F' };
    state = resolveRound(state, pA, fA, mulberry32(3)).state;
    const me = activeMon(state.player);
    expect(me.momentum).toBe(before); // 0 → 0: no ★ from the cast
    expect((me.buffs ?? []).some((b) => b.kind === 'updraft')).toBe(true); // buff landed
  });
});

function heaviestAttack(me: SideState): string {
  const atk = affordableAttacks(me);
  return atk.find((n) => lookupMove(n).tier === 'heavy') ?? atk.find((n) => lookupMove(n).tier === 'mid') ?? atk[0]!;
}
// Keeps updraft up, then swings the heaviest affordable attack. `castStance` = 'G'
// is the WORST case for the gate (the buff-cast in Guard also counters an
// aggressive foe); 'F' isolates the pure tier-access edge (a glass GALE's natural
// initiative stance).
function updraftBot(castStance: 'G' | 'F') {
  return {
    name: `updraft-${castStance}`,
    chooseAction(state: BattleState, side: Side): Action {
      const me = activeMon(state[side]);
      const forced = forcedAction(me);
      if (forced) return forced;
      const has = (me.buffs ?? []).some((b) => b.kind === 'updraft');
      if (!has && affordableMoves(me).includes('UPDRAFT')) return { kind: 'move', move: 'UPDRAFT', stance: castStance };
      return { kind: 'move', move: heaviestAttack(me), stance: 'A' };
    },
  };
}
// Control: identical aggressive-heavy play but NEVER casts updraft.
const bruteNoUpdraft = {
  name: 'brute-no-updraft',
  chooseAction(state: BattleState, side: Side): Action {
    const me = activeMon(state[side]);
    const forced = forcedAction(me);
    if (forced) return forced;
    return { kind: 'move', move: heaviestAttack(me), stance: 'A' };
  },
};

function ladder(
  player: { chooseAction: (s: BattleState, side: Side, rng: RNG) => Action },
  n: number,
  seed: number,
): number {
  let wins = 0;
  for (let i = 0; i < n; i += 1) {
    const rng = mulberry32(seed + i);
    let state = createBattleState(
      createTeam([createSide(CH1.GALEHAWK!)]),
      createTeam([createSide(CH1.GALEHAWK!)]),
      { typeChart: CHART },
    );
    let out: 'player' | 'foe' | 'draw' = 'draw';
    for (let r = 0; r < 200; r += 1) {
      const fA = reader.chooseAction(state, 'foe', rng);
      const pA = player.chooseAction(state, 'player', rng);
      state = resolveRound(state, pA, fA, rng).state;
      if (isTeamWiped(state.foe)) { out = 'player'; break; }
      if (isTeamWiped(state.player)) { out = 'foe'; break; }
    }
    if (out === 'player') wins += 1;
  }
  return (wins / n) * 100;
}

describe('UPDRAFT — not degenerate (punches above weight, does not dominate)', () => {
  test('sanity: reader vs reader on GALEHAWK ≈ 50%', () => {
    const w = ladder(reader, 2000, 11);
    expect(w).toBeGreaterThan(40);
    expect(w).toBeLessThan(60);
  });

  test('the WORST case (updraft cast in Guard + heavy attempts) does NOT dominate', () => {
    // With the mid-cap the early-heavy exploit is gone: this collapses to the
    // brute's fate (aggressive-into-the-reader's-counters) rather than snowballing
    // early DIVE BOMBs. (Pre-cap this was 74%.)
    const w = ladder(updraftBot('G'), 2000, 11);
    // eslint-disable-next-line no-console
    console.log(`updraft-in-Guard (worst case) vs reader → win ${w.toFixed(1)}%`);
    expect(w).toBeLessThan(60);
  });

  test('IDENTITY holds: updraft gives GALE a real edge (beats the no-updraft brute) without dominating', () => {
    const brute = ladder(bruteNoUpdraft, 2000, 11); // aggressive-heavy, no early access → the reader punishes it
    const updraft = ladder(updraftBot('F'), 2000, 11); // same, but updraft opens early MID access
    // eslint-disable-next-line no-console
    console.log(`brute-no-updraft ${brute.toFixed(1)}%  vs  updraft-in-Fluid ${updraft.toFixed(1)}%`);
    expect(updraft).toBeGreaterThan(brute); // Updraft's early mid-access is a genuine edge…
    expect(updraft).toBeLessThan(60); // …but not a dominant strategy.
  });
});
