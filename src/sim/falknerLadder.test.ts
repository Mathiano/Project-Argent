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
type Tier = 'fair' | 'hard';
function tierOf(player: string): Tier {
  // GALE walls KINDRAKE and SILTSKIP counters the dive — the fair demo
  // paths. GALE hits NATURE ×1.3, so GRUBLEAF alone is the hard run.
  return player === 'GRUBLEAF' ? 'hard' : 'fair';
}

// Acceptance bands [loInclusive, hiInclusive] in win%, re-locked to the
// TTK-1.30 measured values (each comfortably contains its exact, deterministic
// seed=0x1f result).
const BANDS: { readonly [a: string]: { readonly [t in Tier]: readonly [number, number] } } = {
  'button-masher': { fair: [50, 66], hard: [1, 13] }, // 58.4/58.3 fair · 6.2 hard
  brute: { fair: [38, 58], hard: [10, 26] }, // 46.5/50.6 fair · 18.3 hard (inversion resolved)
  'naive-triangle': { fair: [94, 100], hard: [22, 40] }, // 100/100 fair · 30.4 hard
  'stamina-reader': { fair: [94, 100], hard: [18, 36] }, // 100/100 fair · 26.7 hard
  'human-ish': { fair: [88, 100], hard: [13, 31] }, // 96.9/96.1 fair · 21.4 hard
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
