import { describe, expect, test } from 'vitest';
import {
  brute,
  humanIsh,
  naiveTriangle,
  rivalAI,
  staminaReader,
  staticGuard,
} from './archetypes';
import type { BotArchetype } from './archetypes';
import { runLadder } from './ladder';

const RIVAL_SCALE = { atk: 0.85, dfn: 0.85 } as const;
const N = 2000;
const SEED = 1;

// Locked n=2000 seed=1 baselines, captured 2026-06-12 against engine v0.3.
// Archetypes match docs/sim-archetypes.md (canonical v1, telegraph-aware).
// Each cell is exact (deterministic) — any drift means engine/AI/data changed.
//
// INTENTIONAL CATCH-BREATH RE-BASELINE (Phase 6b, 2026-06-15): Catch
// Breath restore went +35 flat → 50% of the 100-ST cap (+50). The
// stamina-reader + human-ish bots use Catch Breath, so exactly 4 cells
// shifted (the 11 cells with no Catch-Breath usage are byte-identical):
//   EMBERCUB→AQUAFIN stamina-reader  1059 → 1157  (+98, +4.9pp)
//   EMBERCUB→AQUAFIN human-ish        889 → 932   (+43, +2.2pp)
//   AQUAFIN→SPROUTLE human-ish       1131 → 1134  (+3,  +0.2pp)
//   SPROUTLE→EMBERCUB human-ish      1141 → 1142  (+1,  +0.1pp)
// The Falkner ladder stayed inside its designed bands (no re-lock there).
const BASELINE: ReadonlyArray<{
  player: string;
  foe: string;
  archetype: BotArchetype;
  wins: number;
}> = [
  { player: 'SPROUTLE', foe: 'EMBERCUB', archetype: staticGuard, wins: 1631 },
  { player: 'SPROUTLE', foe: 'EMBERCUB', archetype: brute, wins: 304 },
  { player: 'SPROUTLE', foe: 'EMBERCUB', archetype: naiveTriangle, wins: 1496 },
  { player: 'SPROUTLE', foe: 'EMBERCUB', archetype: staminaReader, wins: 1511 },
  { player: 'SPROUTLE', foe: 'EMBERCUB', archetype: humanIsh, wins: 1142 },
  { player: 'EMBERCUB', foe: 'AQUAFIN', archetype: staticGuard, wins: 930 },
  { player: 'EMBERCUB', foe: 'AQUAFIN', archetype: brute, wins: 320 },
  { player: 'EMBERCUB', foe: 'AQUAFIN', archetype: naiveTriangle, wins: 730 },
  { player: 'EMBERCUB', foe: 'AQUAFIN', archetype: staminaReader, wins: 1157 },
  { player: 'EMBERCUB', foe: 'AQUAFIN', archetype: humanIsh, wins: 932 },
  { player: 'AQUAFIN', foe: 'SPROUTLE', archetype: staticGuard, wins: 1767 },
  { player: 'AQUAFIN', foe: 'SPROUTLE', archetype: brute, wins: 319 },
  { player: 'AQUAFIN', foe: 'SPROUTLE', archetype: naiveTriangle, wins: 1604 },
  { player: 'AQUAFIN', foe: 'SPROUTLE', archetype: staminaReader, wins: 1516 },
  { player: 'AQUAFIN', foe: 'SPROUTLE', archetype: humanIsh, wins: 1134 },
];

describe('rival ladder regressions (n=2000, seed=1)', () => {
  for (const cell of BASELINE) {
    test(`${cell.player} vs ${cell.foe} — ${cell.archetype.name} → ${cell.wins}/${N} wins`, () => {
      const stats = runLadder(
        {
          player: { archetype: cell.archetype, species: cell.player },
          foe: { archetype: rivalAI, species: cell.foe, scale: RIVAL_SCALE },
        },
        N,
        SEED,
      );
      expect(stats.wins).toBe(cell.wins);
    });
  }
});
