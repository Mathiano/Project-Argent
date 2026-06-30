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
//
// ── INTENTIONAL RE-BASELINE (2026-06-20, KICKOFF-falkner-tune-+-focus-intent) —
// Item 1: the 3/6/9 gust beat now reliably CHARGES (FOCUS→HEAVY at rate 0.7
// when a heavy is affordable, else DIVE BOMB), so his signature lands ON his
// signature beats instead of a coin-flip that stamina-drain often skipped. The
// READING archetypes are STILL essentially unchanged (naive/stamina 100% fair ·
// 30/27 hard) — fair-vs-hard intact. The no-read mashers rise a little more
// (brute fair ~64→72, button-masher ~63→66) as the more-reliable gust exposes
// more free wind-up hits; capped at 0.7 (a pure always-charge spiked brute to
// ~85 — too far). On the HARD skill path mashing is still punished (button 5 /
// brute 25 < readers 30/27). Bands re-locked to the seed=0x1f values.
type Tier = 'fair' | 'hard';
function tierOf(player: string): Tier {
  // GALE walls KINDRAKE and SILTSKIP counters the dive — the fair demo
  // paths. GALE hits NATURE ×1.3, so GRUBLEAF alone is the hard run.
  return player === 'GRUBLEAF' ? 'hard' : 'fair';
}

// Acceptance bands [loInclusive, hiInclusive] in win%, re-locked to the
// TTK-1.30 measured values (each comfortably contains its exact, deterministic
// seed=0x1f result).
// ── INTENTIONAL STARTER-TRIO REBALANCE RE-BASELINE (2026-06-21) ────────────
// starter-trio-rebalance.md RESOLUTION: the trio was re-shaped to a shared
// budget 330 (GRUBLEAF softened Dodger→fast-bruiser hp54→68/dfn69→84/spd125→90;
// SILTSKIP's bulk reined dfn106→98/spd67→78; KINDRAKE held, hp64→66/spd57→59),
// landing ~50% RPS in the mirror-sim. Because KINDRAKE *and* SILTSKIP stats
// moved, ALL cells shifted — not just GRUBLEAF:
//   · GRUBLEAF (hard) ROSE off its ~2-3% type-disadvantage floor (it now has
//     real bulk): mashers ~7-11, readers ~19-27. Still clearly the HARD run
//     (every cell well under its fair counterpart; the answer is still a GALE
//     counter via catching, not a GRUBLEAF solo buff — see tierOf).
//   · SILTSKIP (fair) DROPPED on the no-read masher cells (button 65→54, brute
//     72→63) — reining its bulk means it no longer free-walls a mindless masher
//     (on-thesis). Its reading cells hold (naive 100, stamina 97, human 82).
//   · KINDRAKE (fair, the held anchor) essentially unchanged (~71/72/100/100/92).
// The FAIR-vs-HARD contract is intact for every reading archetype. Bands
// re-locked to the seed=0x1f measured values.
// ── INTENTIONAL SPINE-1 RE-BASELINE (2026-06-30, phased-unlock + Falkner ★-econ)
// Phased-unlock (★ gates attack tiers) made battles open light-only and ramp as
// ★ accrues — core combat math, so ALL cells moved. It also ★-starved Falkner
// (his DIVE BOMB is a heavy = 2★), so he was adapted to LIVE in the ★-economy:
// (1) banked opening ★ (FALKNER_OPENING_MOMENTUM = 2 — "comes prepared"), (2) a
// hold-vs-spend Catch Breath (won't drain ★ below the heavy gate), (3) a modest
// read rate so he contests instead of being ★-snowballed, and — the key fix —
// (4) breakBar 2→4: at 2 a perfect reader Break-spammed him every ~2 rounds,
// resetting his gust cadence so DIVE BOMB NEVER fired (a 100% pushover). At 4 the
// gust holds and DIVE BOMB fires in EVERY matchup (~1.3/fight). Result: a fair,
// GENTLE tutorial boss. The FAIR-vs-HARD contract is intact and now cleaner —
// every fair cell ≫ its hard cell, and on the hard path mashing is still punished
// below reading (button 8.8 / brute 5.0 < naive 16.5 / stamina 14.4 / human 14.7).
// Bands re-locked to the seed=0x1f measured values.
const BANDS: { readonly [a: string]: { readonly [t in Tier]: readonly [number, number] } } = {
  'button-masher': { fair: [42, 70], hard: [3, 16] }, // KIND 63.0 / SILT 47.8 fair · 8.8 hard
  brute: { fair: [40, 60], hard: [1, 12] }, // KIND 50.6 / SILT 47.1 fair · 5.0 hard
  'naive-triangle': { fair: [50, 85], hard: [10, 24] }, // KIND 78.2 / SILT 56.7 fair · 16.5 hard
  'stamina-reader': { fair: [49, 83], hard: [8, 22] }, // KIND 75.3 / SILT 56.6 fair · 14.4 hard
  'human-ish': { fair: [51, 86], hard: [8, 22] }, // KIND 78.3 / SILT 58.3 fair · 14.7 hard
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
