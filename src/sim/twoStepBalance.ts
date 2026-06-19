// Two-step balance Monte Carlo (Combat Layer 2 sim-gate). The engine analogue
// of docs/argent_combat_montecarlo_twolayer.py: pit ACTION policies that may
// initiate two-steps (CHARGE/HIDE/FEINT) round-robin through the REAL engine
// and measure win-rates + per-action usage.
//
// The gate the kickoff demands: NO dominant strategy (two-step-SPAM sits BELOW
// balanced/adaptive play; spread small), EVERY option used (no dead weight),
// and single-stance spam (incl. FluidSpam) still loses (Layer 1 preserved).
//
// Mirror matchups (same species both sides) isolate the action triangle from
// type/stat asymmetry. Engine-headless; deterministic given the seed.

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
  twoStepForStance,
} from '../engine';
import type { Action, BattleState, RNG, Side, Stance, TwoStep } from '../engine';

// An action-level policy: returns a legal Action for `side` this round.
export type ActionPolicy = (state: BattleState, side: Side, rng: RNG) => Action;

const STANCES: readonly Stance[] = ['A', 'F', 'G'];

// All six measured options (3 base + 3 two-step) for usage accounting.
export type Option = Stance | TwoStep;

function other(side: Side): Side {
  return side === 'player' ? 'foe' : 'player';
}

function drawStance(mix: readonly [number, number, number], rng: RNG): Stance {
  // mix = [pA, pF, pG], normalized.
  const total = mix[0] + mix[1] + mix[2];
  let r = rng.next() * total;
  if ((r -= mix[0]) < 0) return 'A';
  if ((r -= mix[1]) < 0) return 'F';
  return 'G';
}

function sustainableMove(state: BattleState, side: Side): string | null {
  const me = activeMon(state[side]);
  const aff = affordableMoves(me);
  if (aff.length === 0) return null;
  return aff.includes('TACKLE') ? 'TACKLE' : aff[0]!;
}

// The single-step stance that SOFT-counters each releasing two-step (a seen
// release tilts down; mirrors TWO_STEP.softCounterStance — a STRATEGY choice,
// kept local to the policy).
const SOFT_COUNTER: { readonly [k in 'charge' | 'hide' | 'feint']: Stance } = {
  charge: 'G',
  hide: 'A',
  feint: 'F',
};

// Policy factory mirroring the MC's make_policy: a base-stance mix, a two-step
// rate, and a call threshold (spend ★ to GET AWAY from an enemy Charge). With
// `readReleases`, the policy REACTS to a SEEN incoming release (the wind-up is
// blind, but the release telegraphs the round before): escape a Charge with a
// Call, else play the soft-counter stance to blunt it (the intended use of
// the layer — read the commitment, don't just spam it).
export function makePolicy(
  baseMix: readonly [number, number, number],
  twoStepRate: number,
  callThresh = 0,
  readReleases = false,
): ActionPolicy {
  return (state, side, rng) => {
    const me = activeMon(state[side]);
    // Locked into a release this round — the engine overrides; any action is
    // fine (validation is skipped for a winding mon).
    if (me.winding !== undefined) return { kind: 'rest' };
    const forced = forcedAction(me);
    if (forced) return forced;
    const opp = activeMon(state[other(side)]);
    const incoming = opp.winding; // a release is telegraphed this round
    // Clutch escape: an enemy Charge is releasing — spend ★ to bail.
    if (incoming !== undefined && incoming.step === 'charge' && me.momentum >= 1 && rng.next() < callThresh) {
      return { kind: 'call', call: 'getAway' };
    }
    const move = sustainableMove(state, side);
    if (move === null) return { kind: 'rest' };
    // Read a seen release: blunt it with the soft-counter single-step.
    if (readReleases && incoming !== undefined) {
      return { kind: 'move', move, stance: SOFT_COUNTER[incoming.step] };
    }
    const stance = drawStance(baseMix, rng);
    if (rng.next() < twoStepRate) {
      return { kind: 'move', move, stance, commit: true };
    }
    return { kind: 'move', move, stance };
  };
}

export const POLICIES: { readonly [name: string]: ActionPolicy } = {
  // The old dominant — must still lose (Layer 1 preserved).
  FluidSpam: makePolicy([0.05, 0.9, 0.05], 0.0),
  // Solid single-step reading, no two-steps.
  BaseBalanced: makePolicy([0.34, 0.33, 0.33], 0.0, 0.3),
  // Two-step SPAMMERS — must sit BELOW balanced play.
  ChargeSpam: makePolicy([0.8, 0.1, 0.1], 0.75, 0.2),
  HideSpam: makePolicy([0.1, 0.8, 0.1], 0.75, 0.2),
  FeintSpam: makePolicy([0.1, 0.1, 0.8], 0.75, 0.2),
  // Escalates to two-steps often (but varies the base).
  TwoStepLover: makePolicy([0.34, 0.33, 0.33], 0.6, 0.4),
  // Measured mix incl. some two-steps + READS incoming releases (soft-counter
  // / clutch Call) — the intended "good" play: read the commitment, don't spam.
  Adaptive: makePolicy([0.34, 0.33, 0.33], 0.28, 0.6, true),
};

export interface TwoStepBalanceResult {
  readonly winPct: { readonly [name: string]: number };
  readonly spreadPp: number;
  readonly top: string;
  readonly bottom: string;
  // Per-option usage across ALL measured decisions (fraction, %).
  readonly usagePct: { readonly [k in Option]: number };
}

// Classify what a side's mon is DOING this round for usage accounting: a
// release round counts as its two-step (it occupies that round); a commit
// counts as the two-step; a plain move counts as its base stance.
function classify(state: BattleState, side: Side, action: Action): Option | null {
  const me = activeMon(state[side]);
  if (me.winding !== undefined) return me.winding.step;
  if (action.kind === 'move') {
    if (action.commit === true) return twoStepForStance(action.stance);
    return action.stance;
  }
  return null; // rest / call — not one of the six options
}

// One mirror battle: polA (player) vs polB (foe). Returns A's score and tallies
// A's per-option usage into `usage`.
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

export function runTwoStepBalance(speciesName = 'SPROUTLE', nPerPair = 400, seed = 1): TwoStepBalanceResult {
  const names = Object.keys(POLICIES);
  const wins: { [k: string]: number } = {};
  const games: { [k: string]: number } = {};
  const usage: Record<Option, number> = { A: 0, F: 0, G: 0, charge: 0, hide: 0, feint: 0 };
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
    charge: (usage.charge / totalUse) * 100,
    hide: (usage.hide / totalUse) * 100,
    feint: (usage.feint / totalUse) * 100,
  };
  return { winPct, spreadPp, top, bottom, usagePct };
}
