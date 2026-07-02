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

// ── Effect-move DEGENERACY GATE (Increment 1a) ──────────────────────────────
// The first sim-gated combat increment. This is the EXPECTED-to-move "ladder":
// it pits technique-using strategies against the canonical `reader` yardstick
// to confirm NO degenerate line emerges — mindless technique-spam loses (the
// reduced chip + read-gated debuff makes reckless casting a losing trade), a
// stacked-buff turtle does not dominate, and a competent technique user is
// VIABLE but not oppressive. The read-war stays central. (The existing ladders
// stay bit-identical — proven by their unchanged numbers — because no ladder
// bot casts a technique. This file is the new measurement surface.)

// A clean typeless mid damage move so the reader's pickMidOrLight grabs a real
// attack, never a technique. (Techniques are typeless in the fixture too.)
registerMoves({ TBOLT: { name: 'TBOLT', tier: 'mid', type: null } });

// Fair-fight mirror species — typeless (all neutral), carries an attack + the
// two relevant techniques. Both sides use it, so the only variable is STRATEGY.
const TESTMON: Species = {
  name: 'TESTMON',
  types: [],
  hp: 64,
  atk: 96,
  dfn: 96,
  spd: 90,
  moves: ['TBOLT', 'TACKLE', 'SEAR', 'BULWARK'],
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
// The preferred move if its (base tier) cost is affordable, else the first
// affordable fallback — mirrors how the stock archetypes never emit an
// unaffordable move (forcedAction only covers the no-move-affordable case).
function pick(me: SideState, preferred: string): string {
  const aff = affordableMoves(me);
  return aff.includes(preferred) ? preferred : aff[0]!;
}

// Mindless technique spam: always SEAR (never a real attack). Should LOSE — it
// deals only reduced chip and its Burn lands only when the stance happens to
// win the read.
const searSpammer: BotArchetype = {
  name: 'sear-spammer',
  chooseAction(state, side) {
    const me = activeMon(state[side]);
    const forced = forcedAction(me);
    if (forced) return forced;
    const stance = modalCounter(foeStances(state, side).slice(-3)) ?? 'A';
    return { kind: 'move', move: pick(me, 'SEAR'), stance };
  },
};

// Buff user: keep a single BULWARK up (refreshing it when it lapses) for
// standing damage reduction, otherwise attack. Tests whether a free-landing
// buff plus solid offense becomes oppressive.
const bulwarkTurtle: BotArchetype = {
  name: 'bulwark-turtle',
  chooseAction(state, side) {
    const me = activeMon(state[side]);
    const forced = forcedAction(me);
    if (forced) return forced;
    const hasBulwark = (me.buffs ?? []).some((b) => b.kind === 'bulwark');
    if (!hasBulwark && affordableMoves(me).includes('BULWARK')) {
      return { kind: 'move', move: 'BULWARK', stance: 'G' };
    }
    const stance = modalCounter(foeStances(state, side).slice(-3)) ?? 'A';
    return { kind: 'move', move: pick(me, 'TBOLT'), stance };
  },
};

// Competent technique MIXER: plays like the reader (attacks on its read), but
// ~35% of the time when it has a read it substitutes SEAR to land Burn instead
// of attacking. Tests that folding occasional technique use into solid play is
// VIABLE — neither a free win nor a trap.
const searReader: BotArchetype = {
  name: 'sear-reader',
  chooseAction(state, side, rng) {
    const me = activeMon(state[side]);
    const forced = forcedAction(me);
    if (forced) return forced;
    const stance = modalCounter(foeStances(state, side).slice(-3));
    if (stance === null) return { kind: 'move', move: pick(me, 'TBOLT'), stance: 'G' };
    const wantFluid = stance === 'F' && me.st < 40;
    const castStance: Stance = wantFluid ? 'G' : stance;
    // Occasionally cast SEAR (a read-win lands Burn); otherwise attack.
    const useTech = !wantFluid && rng.next() < 0.35 && affordableMoves(me).includes('SEAR');
    return { kind: 'move', move: useTech ? 'SEAR' : pick(me, 'TBOLT'), stance: castStance };
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
const SEED = 9001;

describe('effect-move degeneracy gate — technique play is viable, not dominant', () => {
  const vsReader = (bot: BotArchetype) => ladder(bot, reader, N, SEED);

  test('sanity: reader vs reader ≈ 50%', () => {
    const r = ladder(reader, reader, N, SEED);
    // eslint-disable-next-line no-console
    console.log(`reader vs reader        → win ${r.win.toFixed(1)}%  draw ${r.draw.toFixed(1)}%`);
    expect(r.win).toBeGreaterThan(42);
    expect(r.win).toBeLessThan(58);
  });

  test('mindless SEAR-spam LOSES utterly (reduced chip + read-gated status ≠ a damage race)', () => {
    const r = vsReader(searSpammer);
    // eslint-disable-next-line no-console
    console.log(`sear-spammer vs reader  → win ${r.win.toFixed(1)}%  draw ${r.draw.toFixed(1)}%`);
    expect(r.win).toBeLessThan(15); // measured ~0% — reckless technique spam is a hard loss
  });

  // ── QUARANTINED (Spine-1, 2026-06-30) — buff/DR BALANCE gate ─────────────────
  // DEFERRED to the holistic potency/feel tuning pass (checkpoint #5). This DR
  // balance gate broke when phased-unlock (Spine-1) throttled early damage: the
  // Wave A–C self-buff/heal/DR magnitudes were tuned in the pre-phased-unlock
  // economy, where they're now over-strong (sustain/DR over-performs in the
  // low-early-damage economy; the technique ★-exemption amplifies it — self-buffs
  // are free at 0★ while attacks are ★-gated). DO NOT tune these magnitudes
  // piecemeal now — the damage economy is still changing (Spine-2 behind-penalty,
  // Spine-3 ceiling, the two-pool model all shift it). Re-tune + re-validate ALL
  // ~34 effect moves together in the holistic pass, once the FULL economy is
  // built, so they're balanced in final context. Likely also involves the §3
  // question (gating techniques by tier — partially helps but cascades 19 tests +
  // the heal magnitude itself needs re-tuning regardless). (The MECHANISM tests in
  // engine/effectMoves.test.ts stay green — only this win-rate BALANCE gate defers.)
  test('BULWARK-turtle gets a modest edge but does NOT dominate (self-escalation DR)', () => {
    const r = vsReader(bulwarkTurtle);
    // eslint-disable-next-line no-console
    console.log(`bulwark-turtle vs reader→ win ${r.win.toFixed(1)}%  draw ${r.draw.toFixed(1)}%`);
    // Tuning pass #5: the tick-counted self-escalation DR caps a held BULWARK's
    // mitigation as it's maintained → ~55.6% (measured). A REAL buff at the ~56%
    // ceiling (a modifier, not a spam-threshold), never free invulnerability.
    expect(r.win).toBeLessThan(62);
  });

  test('occasional technique use is a real tempo cost, not a free win (reads gate the payoff)', () => {
    const r = vsReader(searReader);
    // eslint-disable-next-line no-console
    console.log(`sear-reader vs reader   → win ${r.win.toFixed(1)}%  draw ${r.draw.toFixed(1)}%`);
    // Measured ~32%: a mixer that substitutes SEAR ~35% of the time underperforms
    // pure read-attacking (50%) — techniques cost tempo when the read misses — yet
    // it clears spam (~0%): reads still matter. Playable, never dominant. (Exact
    // technique potency is 1b tuning with the full roster.)
    expect(r.win).toBeGreaterThan(20);
    expect(r.win).toBeLessThan(60);
  });
});
