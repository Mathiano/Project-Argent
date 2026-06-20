// KAMON — Rival Card v2 (Chapter 1, first fight). docs/kamon-rival-card-v2.md.
// The thesis made mechanical: KAMON steals the COUNTER-type to the player's
// pick (the type triangle), but his stolen starter fights at bond-factor 0.85
// (the hesitation — the trust isn't there). His type edge is offset by the
// absent bond → your bond is the equalizer. Pure data + a team builder (headless
// — lives in the engine so the game AND the sim can both use it); the AI is the
// `kamon` trainer profile (Aggressor/Single-only/Fixed/no-Calls).

import { createSide, createTeam } from './state';
import type { Species, StatScale, Team } from './types';

// The bond-factor on KAMON's stolen starter — the load-bearing thematic
// constant (main-story §7). Tune fairness via levels/stats, NEVER this number;
// his whole arc moves off it (0.85 → … → 1.0+ if he's redeemed).
export const KAMON_BOND_FACTOR = 0.85;

// The type-triangle steal: KAMON takes the starter that type-BEATS the player's
// pick (FLAME ← AQUA ← NATURE ← FLAME). CH1 starters: KINDRAKE (FLAME),
// GRUBLEAF (NATURE), SILTSKIP (AQUA).
export const KAMON_STEAL: { readonly [playerPick: string]: string } = {
  KINDRAKE: 'SILTSKIP', // AQUA beats FLAME
  GRUBLEAF: 'KINDRAKE', // FLAME beats NATURE
  SILTSKIP: 'GRUBLEAF', // NATURE beats AQUA
};

// Per-ace LEVEL (the fairness knob, sim-gated) — keyed by the STOLEN species. It
// compensates the CH1 starter trio's BULK ASYMMETRY (GRUBLEAF is a frail Dodger;
// KINDRAKE/SILTSKIP are bulky Wall/Counter-tank), which otherwise makes the
// matchups swing from free-win to wall. Applied AS A LEVEL (all stats) — the
// 0.85 hesitation then multiplies atk/dfn on top, so the constant is untouched.
// Tuned so each pick lands ~70-74% player-win vs the `reader` yardstick (see
// src/sim/rivalCard.test.ts). NOTE: the reader hard-counters KAMON's Aggressor
// stance, so these are reader-WORST-CASE levels (vs a human he's gentler).
export const KAMON_ACE_LEVEL: { readonly [stolen: string]: number } = {
  SILTSKIP: 1.14, // player picked KINDRAKE
  KINDRAKE: 0.95, // player picked GRUBLEAF
  GRUBLEAF: 1.37, // player picked SILTSKIP
};

// The starter KAMON steals, given the player's pick. Returns undefined for a
// non-CH1 lead (the fixture/demo path falls back to its own counter map).
export function kamonStolenStarter(playerPickName: string): string | undefined {
  return KAMON_STEAL[playerPickName];
}

// The ace's StatScale: the fairness LEVEL on all stats, with the 0.85 hesitation
// on atk/dfn on top (so the bond-factor is structurally separate + protected).
export function kamonAceScale(stolenName: string): StatScale {
  const lvl = KAMON_ACE_LEVEL[stolenName] ?? 1;
  return { hp: lvl, atk: lvl * KAMON_BOND_FACTOR, dfn: lvl * KAMON_BOND_FACTOR };
}

// Build KAMON's team: the stolen starter (counter-type) at its fairness level ×
// the 0.85 hesitation is the ACE; an optional caught chaff fights at NORMAL bond
// (no scale).
export function buildKamonTeam(stolenStarter: Species, chaff?: Species): Team {
  const ace = createSide(stolenStarter, kamonAceScale(stolenStarter.name));
  const members = chaff ? [ace, createSide(chaff)] : [ace];
  return createTeam(members);
}
