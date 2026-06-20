import { describe, expect, test } from 'vitest';
import { runFalknerLadder } from './falknerLadder';

const SEED = 0x1f;
const N = 2000;

// Per-starter designed bands: KINDRAKE/SILTSKIP are the "fair" demo paths,
// GRUBLEAF is "hard-mode" (the prep answer is a GALE counter via catching, not
// a GRUBLEAF solo buff). The fair-vs-hard separation is the design contract.
//
// ── INTENTIONAL COMBAT-LAYER-1 RE-BASELINE (2026-06-19) ───────────────────
// The base-triangle fix (Aggressive beats Fluid + Fluid acts-first-but-loses
// + thrice-daze; combat-enrichment-roadmap.md). Falkner's GUSTBORNE/ace
// levers are UNCHANGED (gust=1.4, hp=1.15) — only the triangle moved, so all
// cells shifted; bands re-locked to the new measured win%. The FAIR-vs-HARD
// design is PRESERVED for every reading archetype — fair paths win big, the
// hard GRUBLEAF path loses (naive 100% fair vs 30% hard; stamina-reader 100%
// fair vs 27% hard; human-ish 96-97% fair vs 21% hard).
//
// ✅ The old TTK `brute` INVERSION is now RESOLVED (a side-benefit of the
// fix): Aggressive punishes Falkner's Fluid, so pure-mash brute rises on the
// fair paths (46-51%) ABOVE its hard path (18%) — fair > hard again, as the
// contract intends. (A no-read masher landing ~50% vs the boss is a Falkner
// boss-card tuning question, out of scope for the Layer-1 triangle; the
// stance-balance sim-gate is the balance check.)
//
// ── INTENTIONAL COMBAT-LAYER-4-STAGE-1 RE-BASELINE (2026-06-20) ────────────
// Falkner now FOCUSES on his signature gust (trainer-AI Stage 1: his "gust"
// rounds sometimes wind up a FOCUS→HEAVY two-step instead of a single-step
// DIVE BOMB; KICKOFF-trainer-ai-layer4-stage1.md). His GUSTBORNE/ace levers are
// UNCHANGED — only his policy gained the two-step. The READING archetypes are
// essentially UNCHANGED (his gust-focus is readable; naive/stamina hold 100%
// fair · 30/27 hard exactly as before) — the fair-vs-hard contract is intact.
// The shift is the NO-READ mashers (button-masher, brute) RISING on the fair
// paths (+~5 / +~14): a focus deals 0 and eats a free hit, so raw Aggression
// punishes the wind-up (on-thesis — focusing is risky vs an aggressor). This is
// the same masher/boss-card tuning matter noted above, now a touch higher; out
// of scope for Stage 1 (the reading fight, which the pillar is about, is intact
// and now RICHER — it gains the two-step read). Bands re-locked to the measured
// seed=0x1f values.
type Tier = 'fair' | 'hard';
function tierOf(player: string): Tier {
  // GALE walls KINDRAKE and SILTSKIP counters the dive — the fair demo
  // paths. GALE hits NATURE ×1.3, so GRUBLEAF alone is the hard run.
  return player === 'GRUBLEAF' ? 'hard' : 'fair';
}

// Acceptance bands [loInclusive, hiInclusive] in win%, re-locked to the
// TTK-1.30 measured values (each comfortably contains its exact, deterministic
// seed=0x1f result).
// Re-locked to the Layer-4-Stage-1 measured values (Falkner Focuses; seed=0x1f).
const BANDS: { readonly [a: string]: { readonly [t in Tier]: readonly [number, number] } } = {
  'button-masher': { fair: [55, 70], hard: [1, 13] }, // 63.1/62.6 fair · 5.7 hard
  brute: { fair: [54, 72], hard: [14, 32] }, // 62.5/64.3 fair · 23.4 hard
  'naive-triangle': { fair: [94, 100], hard: [22, 40] }, // 100/100 fair · 30.4 hard (unchanged)
  'stamina-reader': { fair: [92, 100], hard: [18, 36] }, // 100/99.6 fair · 26.7 hard (unchanged)
  'human-ish': { fair: [84, 100], hard: [13, 31] }, // 92.3/90.9 fair · 20.5 hard
};

describe('Falkner ladder regression (n=2000, seed=0x1f, gust=1.4 hp=1.15) — designed bands', () => {
  const cells = runFalknerLadder({
    gustBorneDmgMult: 1.4,
    aceHpMult: 1.15,
    n: N,
    seed: SEED,
  });

  for (const cell of cells) {
    const tier = tierOf(cell.player);
    const band = BANDS[cell.archetype]?.[tier];
    test(`${cell.player} (${tier}) vs Falkner — ${cell.archetype} in ${band?.[0]}–${band?.[1]}%`, () => {
      expect(band).toBeDefined();
      expect(cell.winPct).toBeGreaterThanOrEqual(band![0]);
      expect(cell.winPct).toBeLessThanOrEqual(band![1]);
    });
  }
});
