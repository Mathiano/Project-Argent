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

// Per-ace LEVEL (the fairness knob) — keyed by the STOLEN species. RE-CONVERGED
// off the BALANCED trio (2026-06-21, starter-trio-rebalance.md RESOLUTION). With
// the trio now budget-balanced (mirror-sim ~50% RPS each), the per-pick spread
// collapsed to a TIGHT band around ~1.0 — 0.90–1.03 — versus the old 0.95–1.37
// that was papering over the bulk asymmetry. Each pick lands winnable-but-tense
// (player ~66–72%, n=2000 seed=1): KINDRAKE-pick 72.0% · GRUBLEAF-pick 70.3% ·
// SILTSKIP-pick 65.7%. The lone sub-1.0 (KINDRAKE, the ace stolen vs a GRUBLEAF
// pick) is the FLAME>NATURE type counter being reined so the grass pick isn't a
// wall. Sim-gated: src/sim/rivalCard.test.ts.
export const KAMON_ACE_LEVEL: { readonly [stolen: string]: number } = {
  SILTSKIP: 1.03, // stolen when the player picks KINDRAKE
  KINDRAKE: 0.9, // stolen when the player picks GRUBLEAF (rein the FLAME>NATURE wall)
  GRUBLEAF: 1.02, // stolen when the player picks SILTSKIP
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
