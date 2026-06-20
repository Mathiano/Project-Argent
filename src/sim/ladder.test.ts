import { describe, expect, test } from 'vitest';
import {
  brute,
  humanIsh,
  kamonRivalBot,
  naiveTriangle,
  staminaReader,
  staticGuard,
} from './archetypes';
import type { BotArchetype } from './archetypes';
import { runLadder } from './ladder';

const RIVAL_SCALE = { atk: 0.85, dfn: 0.85 } as const;
const N = 2000;
const SEED = 1;

// Locked n=2000 seed=1 baselines. Archetypes match docs/sim-archetypes.md
// (canonical v1, telegraph-aware). Each cell is exact (deterministic) — any
// drift means engine/AI/data changed.
//
// INTENTIONAL CATCH-BREATH RE-BASELINE (Phase 6b, 2026-06-15): Catch Breath
// restore went +35 flat → 50% of the 100-ST cap (+50); 4 cells shifted.
// INTENTIONAL TTK RE-BASELINE (2026-06-15): COMBAT.hpScale 1.0 → 1.30.
//
// ── INTENTIONAL COMBAT-LAYER-1 RE-BASELINE (2026-06-19) ───────────────────
// The base-triangle fix (combat-enrichment-roadmap.md): AGGRESSIVE now BEATS
// FLUID (was a Fluid dodge → now an Aggressive PUNISH), Fluid acts-first but
// loses that exchange, the ★-award flips with the edge, and thrice-repeat
// self-dazes. This CHANGES combat outcomes, so all 15 cells moved — an
// intended re-baseline, NOT drift. The stance-balance sim-gate
// (stanceBalance.test.ts) is the real validation (PureFLUID collapsed from
// dominant to a losing spam). The READING archetypes rise (naive-triangle's
// counter + the now-fixed stamina-reader both read the NEW triangle); the
// stamina-reader's stance logic was updated to the live triangle (it used to
// counter Aggressive with Fluid — the old dodge — which now LOSES). Cells
// are exact + deterministic at seed=1.
//
// ── INTENTIONAL KAMON-RIVAL-CARD-v2 RE-BASELINE (2026-06-20) ──────────────────
// The rival fight's foe AI is now the v2 RIVAL profile's earliest rung
// (`kamonRivalBot` = Aggressor/Single-only/Fixed/no-Calls via the trainer tree),
// replacing the bespoke `rivalAI` here (docs/kamon-rival-card-v2.md). Player vs
// their COUNTER-type at 0.85 is unchanged (the triangle steal + bond-factor).
// All 15 cells shifted — INTENDED, not drift. `rivalAI` is unchanged and still
// used by the BOND ladders (which stay bit-identical). The thesis shows in the
// hardest cell (EMBERCUB into its AQUAFIN counter): the READERS land ~40–53% —
// fair-but-tense, the bond/read offsetting the type edge. Exact at seed=1.
const BASELINE: ReadonlyArray<{
  player: string;
  foe: string;
  archetype: BotArchetype;
  wins: number;
}> = [
  { player: 'SPROUTLE', foe: 'EMBERCUB', archetype: staticGuard, wins: 1253 },
  { player: 'SPROUTLE', foe: 'EMBERCUB', archetype: brute, wins: 362 },
  { player: 'SPROUTLE', foe: 'EMBERCUB', archetype: naiveTriangle, wins: 1921 },
  { player: 'SPROUTLE', foe: 'EMBERCUB', archetype: staminaReader, wins: 1912 },
  { player: 'SPROUTLE', foe: 'EMBERCUB', archetype: humanIsh, wins: 1338 },
  { player: 'EMBERCUB', foe: 'AQUAFIN', archetype: staticGuard, wins: 144 },
  { player: 'EMBERCUB', foe: 'AQUAFIN', archetype: brute, wins: 275 },
  { player: 'EMBERCUB', foe: 'AQUAFIN', archetype: naiveTriangle, wins: 1066 },
  { player: 'EMBERCUB', foe: 'AQUAFIN', archetype: staminaReader, wins: 805 },
  { player: 'EMBERCUB', foe: 'AQUAFIN', archetype: humanIsh, wins: 468 },
  { player: 'AQUAFIN', foe: 'SPROUTLE', archetype: staticGuard, wins: 1184 },
  { player: 'AQUAFIN', foe: 'SPROUTLE', archetype: brute, wins: 343 },
  { player: 'AQUAFIN', foe: 'SPROUTLE', archetype: naiveTriangle, wins: 1938 },
  { player: 'AQUAFIN', foe: 'SPROUTLE', archetype: staminaReader, wins: 1914 },
  { player: 'AQUAFIN', foe: 'SPROUTLE', archetype: humanIsh, wins: 1333 },
];

describe('rival ladder regressions (n=2000, seed=1)', () => {
  for (const cell of BASELINE) {
    test(`${cell.player} vs ${cell.foe} — ${cell.archetype.name} → ${cell.wins}/${N} wins`, () => {
      const stats = runLadder(
        {
          player: { archetype: cell.archetype, species: cell.player },
          foe: { archetype: kamonRivalBot, species: cell.foe, scale: RIVAL_SCALE },
        },
        N,
        SEED,
      );
      expect(stats.wins).toBe(cell.wins);
    });
  }
});
