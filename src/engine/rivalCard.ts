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
// the TWO-MON STAGE-1 CARD (2026-06-22, kamon-2mon-stage1). The card-shape fix
// landed: the prior commit's evolved-lead re-tune is SUPERSEDED. The starter's
// first evolution now gates on HIVE (badge 2 — evolution.ts), and the KAMON gate
// sits at Violet→Route 32 (after ZEPHYR, before HIVE) — so the developed lead is
// STILL STAGE 1. KAMON now fields TWO mons: a leading chaff (KAMON_CHAFF_SPECIES,
// a crudely-caught CH1 common) + the stolen-starter ACE (stage-1). The ace levels
// returned toward the original early-route band (~0.9–1.0) once the chaff carries
// part of the threat. Sim-gated against a representative stage-1 player team (the
// reader + starter + two caught commons): winnable-but-tense ~65–70%, tight across
// the three picks. See src/sim/rivalCard.test.ts.
export const KAMON_ACE_LEVEL: { readonly [stolen: string]: number } = {
  SILTSKIP: 1.05, // stolen when the player picks KINDRAKE → 65.4% (n=2000 seed=1)
  KINDRAKE: 0.95, // stolen when the player picks GRUBLEAF → 64.8% (FLAME>NATURE reined)
  GRUBLEAF: 0.95, // stolen when the player picks SILTSKIP → 69.3%
};

// KAMON's leading CHAFF — a crudely-caught route bird, the thematic foil to the
// craft the player learned (he grabs power; the player bonds it). FLITPECK is the
// chaff for a SIM reason as much as a flavour one: its GALE type is the only
// chaff that yields a TIGHT spread across the three picks (it's neutral both ways
// vs FLAME/AQUA, and its NATURE edge OFFSETS the player's TERRA common countering
// the FLAME ace — without it the spread floors at ~14pp). The chaff fights at
// NORMAL bond (no 0.85 hesitation — KAMON caught it himself); its LEVEL is the
// second fairness knob (alongside KAMON_ACE_LEVEL). The caller resolves the
// Species from its dex and passes it to buildKamonTeam.
//
// ⚠️ FLAG (deviation from the brief's "CH1-pool COMMON"): FLITPECK is rarity-
// tagged "uncommon", not "common". It's still a wild route mon (a crude grab),
// and GALE is the ONLY chaff type that meets the brief's "tight spread" target —
// so tightness wins over the rarity label. A Mathias call if the label matters.
export const KAMON_CHAFF_SPECIES = 'FLITPECK';

// The chaff's uniform stat LEVEL (the fairness knob — NO bond-factor; a caught
// common at normal bond). 1.0 = base species stats; 1.2 gives the lead enough
// teeth to make the 2-mon card tense without the spread blowing out. Tuned with
// KAMON_ACE_LEVEL against the stage-1 player team (src/sim/rivalCard.test.ts).
export const KAMON_CHAFF_LEVEL = 1.2;

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

// The chaff's StatScale: a uniform LEVEL on all stats, NO bond-factor (a common
// KAMON caught himself fights at normal bond — the 0.85 is the stolen STARTER's
// hesitation alone).
export function kamonChaffScale(): StatScale {
  const lvl = KAMON_CHAFF_LEVEL;
  return { hp: lvl, atk: lvl, dfn: lvl };
}

// Build KAMON's team. The two-mon CARD = the leading CHAFF (a crudely-caught
// common at its fairness level, normal bond) + the stolen-starter ACE (counter-
// type, at its fairness level × the 0.85 hesitation). The CHAFF LEADS — the
// throwaway softens the player before the starter duel finishes. Omit `chaff`
// for the SOLO fixture/demo path (the ?skip / EMBERCUB lead has no CH1 chaff).
export function buildKamonTeam(stolenStarter: Species, chaff?: Species): Team {
  const ace = createSide(stolenStarter, kamonAceScale(stolenStarter.name));
  const members = chaff ? [createSide(chaff, kamonChaffScale()), ace] : [ace];
  return createTeam(members);
}
