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

// Per-ace LEVEL (the fairness knob) — keyed by the STOLEN species. Reset to a
// flat 1.0 (2026-06-21). The old per-pick spread (0.95–1.37) was tuned against
// the type-INERT engine (the move-vocab collision no-op'd CH1 type) and was
// silently compensating the starter BULK ASYMMETRY. With the type fix live that
// spread now stacks on top of REAL type advantage → over-strong KAMON. The
// honest baseline is 1.0; KAMON cannot be re-converged to a fair per-pick band
// until the starter-trio rebalance lands — the mirror-sim shows the residual
// imbalance is starter-bulk, not the triangle. **PENDING starter rebalance**
// (src/sim/rivalCard.test.ts — fairness assertions skipped until then).
export const KAMON_ACE_LEVEL: { readonly [stolen: string]: number } = {
  SILTSKIP: 1.0,
  KINDRAKE: 1.0,
  GRUBLEAF: 1.0,
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
