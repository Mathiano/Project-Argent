import { describe, expect, test } from 'vitest';
import { runFalknerLadder } from './falknerLadder';

const SEED = 0x1f;
const N = 2000;

// Per-starter designed bands: KINDRAKE/SILTSKIP are the "fair" demo paths,
// GRUBLEAF is "hard-mode" (the prep answer is a GALE counter via catching, not
// a GRUBLEAF solo buff). The fair-vs-hard separation is the design contract.
//
// ── INTENTIONAL TTK RE-BASELINE (2026-06-15) ─────────────────────────────
// Global `COMBAT.hpScale` 1.0 → 1.30 (KICKOFF-ttk-tuning.md): every mon's
// maxHp scaled to lengthen fights. Falkner's GUSTBORNE/ace levers are
// UNCHANGED (gust=1.4, hp=1.15); only the HP ratio moved, so all cells
// shifted and the bands are re-locked to the new measured win%. The
// FAIR-vs-HARD design is PRESERVED for every reading archetype — fair paths
// still win big, the hard path still loses (naive 81-86% fair vs 18% hard;
// stamina-reader 100% fair vs 3% hard; human-ish 87-89% fair vs 7% hard).
// The fair demo paths now breathe at ~5-7 rounds (was ~4-5) → more room for
// the 2-read Break/phase play; the hard GRUBLEAF path stays a ~3-round
// blowout BY DESIGN (it's meant to be lost without a GALE counter).
//
// ⚠️ FLAGGED DISTORTION: the `brute` archetype (pure-mash, ZERO reads — the
// pathological control, not a real player) INVERTS under longer TTK:
// GRUBLEAF-hard 34.8% now exceeds KINDRAKE-fair 8.3%. This is confined to the
// no-read archetype (its absolute numbers are low-signal/chaotic); every
// READ-based archetype preserves fair >> hard. Locked as measured + flagged,
// rather than bending the TTK knob around a non-player archetype.
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
  'button-masher': { fair: [42, 58], hard: [3, 13] }, // 50.7/51.6 fair · 6.8 hard
  brute: { fair: [4, 18], hard: [27, 43] }, // 8.3/11.9 fair · 34.8 hard (inverted — see note)
  'naive-triangle': { fair: [74, 92], hard: [10, 28] }, // 86.1/81.0 fair · 18.2 hard
  'stamina-reader': { fair: [94, 100], hard: [0, 12] }, // 100/100 fair · 3.2 hard
  'human-ish': { fair: [80, 95], hard: [2, 16] }, // 87.5/89.2 fair · 7.2 hard
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
