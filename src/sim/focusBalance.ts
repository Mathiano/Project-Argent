// FOCUS balance Monte Carlo (the combat sim-gate for the FOCUS rebuild). The
// engine analogue of docs/argent_combat_montecarlo_focus.py: pit ACTION
// policies that may FOCUS (R1) + pick a hidden RELEASE (R2) round-robin through
// the REAL engine and measure win-rates + per-action usage.
//
// The gate: Adaptive (reading + occasional focus) TOPS; focus-spam sits BELOW
// balanced play; the three releases are used ~equally (no dominant release);
// single-step spam (FluidSpam) still loses (base triangle preserved); ~10pp
// spread. FOCUS_COST is the master lever.
//
// Mirror matchups (same species both sides) isolate the mechanics; deterministic
// given the seed.

import {
  SPECIES,
  activeMon,
  affordableMoves,
  forcedAction,
  createBattleState,
  createSide,
  isTeamWiped,
  mulberry32,
  resolveRound,
} from '../engine';
import type { Action, BattleState, ReleaseKind, RNG, Side, Stance } from '../engine';

export type ActionPolicy = (state: BattleState, side: Side, rng: RNG) => Action;
export type Option = Stance | ReleaseKind;

function other(side: Side): Side {
  return side === 'player' ? 'foe' : 'player';
}

function drawStance(mix: readonly [number, number, number], rng: RNG): Stance {
  const total = mix[0] + mix[1] + mix[2];
  let r = rng.next() * total;
  if ((r -= mix[0]) < 0) return 'A';
  if ((r -= mix[1]) < 0) return 'F';
  return 'G';
}
function drawRelease(mix: readonly [number, number, number], rng: RNG): ReleaseKind {
  const total = mix[0] + mix[1] + mix[2];
  let r = rng.next() * total;
  if ((r -= mix[0]) < 0) return 'heavy';
  if ((r -= mix[1]) < 0) return 'feint';
  return 'hide';
}
function sustainableMove(state: BattleState, side: Side): string | null {
  const me = activeMon(state[side]);
  const aff = affordableMoves(me);
  if (aff.length === 0) return null;
  return aff.includes('TACKLE') ? 'TACKLE' : aff[0]!;
}

// Policy factory: a base-stance mix, a focus rate (chance to initiate a Focus),
// a release mix (the R2 choice — uniform = no preferred release), a call
// threshold, and whether to spend ★ escaping a feared release.
export function makePolicy(
  baseMix: readonly [number, number, number],
  focusRate: number,
  releaseMix: readonly [number, number, number] = [1, 1, 1],
  callThresh = 0,
): ActionPolicy {
  return (state, side, rng) => {
    const me = activeMon(state[side]);
    // R2 — locked into releasing: pick the hidden release.
    if (me.focus !== undefined) return { kind: 'release', release: drawRelease(releaseMix, rng) };
    const forced = forcedAction(me);
    if (forced) return forced;
    // Clutch: the opponent is FOCUSING (a release is coming) — maybe ★-escape.
    const opp = activeMon(state[other(side)]);
    if (opp.focus !== undefined && me.momentum >= 1 && rng.next() < callThresh) {
      return { kind: 'call', call: 'getAway' };
    }
    const move = sustainableMove(state, side);
    if (move === null) return { kind: 'rest' };
    const stance = drawStance(baseMix, rng);
    if (rng.next() < focusRate) return { kind: 'move', move, stance, commit: true };
    return { kind: 'move', move, stance };
  };
}

export const POLICIES: { readonly [name: string]: ActionPolicy } = {
  // The old dominant single-step spam — must still lose (base triangle).
  FluidSpam: makePolicy([0.05, 0.9, 0.05], 0.0),
  // Pure single-step reading, no focus.
  BaseBalanced: makePolicy([0.34, 0.33, 0.33], 0.0, [1, 1, 1], 0.3),
  // Focus SPAMMERS — must sit BELOW balanced play (the focus cost bites).
  FocusLover: makePolicy([0.34, 0.33, 0.33], 0.65, [1, 1, 1], 0.4),
  HeavySpam: makePolicy([0.5, 0.2, 0.3], 0.65, [1, 0, 0], 0.3),
  FeintSpam: makePolicy([0.3, 0.3, 0.4], 0.65, [0, 1, 0], 0.3),
  HideSpam: makePolicy([0.2, 0.6, 0.2], 0.65, [0, 0, 1], 0.3),
  // Measured mix + heavy clutch-call use (escape feared releases) — the
  // intended "good" play that reads + spends ★ well.
  Adaptive: makePolicy([0.34, 0.33, 0.33], 0.28, [1, 1, 1], 0.85),
};

export interface FocusBalanceResult {
  readonly winPct: { readonly [name: string]: number };
  readonly spreadPp: number;
  readonly top: string;
  readonly bottom: string;
  readonly usagePct: { readonly [k in Option]: number };
}

// What a side is DOING this round: a release round counts the release; a focus
// commit counts its base stance's... no — a focus initiation isn't a single
// stance, so we count the RELEASE it leads to (next round). Here we count: a
// release (R2) as its release; a single-step move as its stance; a focus
// initiation is implicit (its release is counted next round).
function classify(state: BattleState, side: Side, action: Action): Option | null {
  const me = activeMon(state[side]);
  if (me.focus !== undefined) return action.kind === 'release' ? action.release : 'heavy';
  if (action.kind === 'release') return action.release;
  if (action.kind === 'move' && action.commit !== true) return action.stance;
  return null; // focus initiation / rest / call — not a terminal option here
}

function battle(
  polA: ActionPolicy,
  polB: ActionPolicy,
  speciesName: string,
  rng: RNG,
  usage: Record<Option, number>,
  maxRounds = 80,
): number {
  let state = createBattleState(createSide(SPECIES[speciesName]!), createSide(SPECIES[speciesName]!));
  for (let i = 0; i < maxRounds; i += 1) {
    const aA = polA(state, 'player', rng);
    const aB = polB(state, 'foe', rng);
    const opt = classify(state, 'player', aA);
    if (opt !== null) usage[opt] += 1;
    const r = resolveRound(state, aA, aB, rng);
    state = r.state;
    const plDead = isTeamWiped(state.player);
    const foeDead = isTeamWiped(state.foe);
    if (plDead && foeDead) return 0.5;
    if (foeDead) return 1;
    if (plDead) return 0;
  }
  const pl = activeMon(state.player).hp;
  const fo = activeMon(state.foe).hp;
  return pl > fo ? 1 : fo > pl ? 0 : 0.5;
}

export function runFocusBalance(speciesName = 'SPROUTLE', nPerPair = 400, seed = 1): FocusBalanceResult {
  const names = Object.keys(POLICIES);
  const wins: { [k: string]: number } = {};
  const games: { [k: string]: number } = {};
  const usage: Record<Option, number> = { A: 0, F: 0, G: 0, heavy: 0, feint: 0, hide: 0 };
  for (const n of names) {
    wins[n] = 0;
    games[n] = 0;
  }
  let s = seed;
  for (const na of names) {
    for (const nb of names) {
      if (na === nb) continue;
      for (let i = 0; i < nPerPair; i += 1) {
        const score = battle(POLICIES[na]!, POLICIES[nb]!, speciesName, mulberry32(s), usage);
        s += 1;
        wins[na]! += score;
        games[na]! += 1;
      }
    }
  }
  const winPct: { [k: string]: number } = {};
  for (const n of names) winPct[n] = (wins[n]! / games[n]!) * 100;
  const vals = Object.values(winPct);
  const spreadPp = Math.max(...vals) - Math.min(...vals);
  const top = names.reduce((a, b) => (winPct[b]! > winPct[a]! ? b : a), names[0]!);
  const bottom = names.reduce((a, b) => (winPct[b]! < winPct[a]! ? b : a), names[0]!);
  const totalUse = (Object.values(usage) as number[]).reduce((a, b) => a + b, 0) || 1;
  const usagePct = {
    A: (usage.A / totalUse) * 100,
    F: (usage.F / totalUse) * 100,
    G: (usage.G / totalUse) * 100,
    heavy: (usage.heavy / totalUse) * 100,
    feint: (usage.feint / totalUse) * 100,
    hide: (usage.hide / totalUse) * 100,
  };
  return { winPct, spreadPp, top, bottom, usagePct };
}
