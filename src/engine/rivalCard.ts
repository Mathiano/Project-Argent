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

// Per-ace LEVEL (the fairness knob) — keyed by the STOLEN species. RE-TUNED for
// the POST-FALKNER PLACEMENT (2026-06-22, kamon-first-fight integration). The
// fight moved from "early-route first fight" to the Violet→Route 32 gate, AFTER
// the ZEPHYR badge — which is also the badge that GATES the starter's evolution
// (evolution.ts, bond stage 3 + ZEPHYR). The expected developed player's lead
// is therefore the STAGE-2 EVOLVED form, and at the OLD ~1.0 levels the fight
// was trivial (evolved player win% 99.7 / 81.8 / 99.8, n=2000 seed=1 — two near
// auto-wins). Re-converged so the EVOLVED matchup lands winnable-but-tense again
// (player ~67%, tight): KINDRAKE-pick 67.8% · GRUBLEAF-pick 66.7% · SILTSKIP-
// pick 67.6%. Sim-gated: src/sim/rivalCard.test.ts (post-Falkner gate).
//
// ⚠️ FLAG — STRUCTURAL TENSION (a design call for a fuller fix): a SOLO stage-1
// ace can't be fair for BOTH an evolved and an unevolved lead at once (they're
// an evolution of stats apart; the 0.85 bond-factor is locked, so LEVEL is the
// only knob and the matchup is a cliff). Tuned for the EXPECTED (evolved) team,
// an UNEVOLVED lead now faces a near-unwinnable KAMON for 2/3 picks (win% 9.6 /
// 53.9 / 2.4). This is MITIGATED by the gate's both-advance design (no soft-lock
// — a loss still has KAMON leave + the exit open). The proper long-term fix is a
// CARD-SHAPE change (give KAMON a 2nd mon — buildKamonTeam already supports a
// chaff — or an evolved ace), which is Mathias's design call; NOT done here.
export const KAMON_ACE_LEVEL: { readonly [stolen: string]: number } = {
  SILTSKIP: 1.21, // stolen when the player picks KINDRAKE (evolved KILNDRAKE → 67.8%)
  KINDRAKE: 0.94, // stolen when the player picks GRUBLEAF (FLAME>NATURE reined; VINESNAP → 66.7%)
  GRUBLEAF: 1.24, // stolen when the player picks SILTSKIP (evolved BRACKSLAP → 67.6%)
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
