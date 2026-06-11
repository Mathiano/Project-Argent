import { describe, expect, test } from 'vitest';
import {
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

// Locked n=2000 seed=1 baselines, captured 2026-06-11 against engine v0.3.
// Each cell is exact (deterministic) — any drift means engine/AI/data changed.
// Per KICKOFF: POC table at n=40 is superseded; these are the new sim gate.
const BASELINE: ReadonlyArray<{
  player: string;
  foe: string;
  archetype: BotArchetype;
  wins: number;
}> = [
  { player: 'SPROUTLE', foe: 'EMBERCUB', archetype: staticGuard, wins: 1775 },
  { player: 'SPROUTLE', foe: 'EMBERCUB', archetype: naiveTriangle, wins: 733 },
  { player: 'SPROUTLE', foe: 'EMBERCUB', archetype: staminaReader, wins: 738 },
  { player: 'SPROUTLE', foe: 'EMBERCUB', archetype: humanIsh, wins: 639 },
  { player: 'EMBERCUB', foe: 'AQUAFIN', archetype: staticGuard, wins: 1141 },
  { player: 'EMBERCUB', foe: 'AQUAFIN', archetype: naiveTriangle, wins: 1079 },
  { player: 'EMBERCUB', foe: 'AQUAFIN', archetype: staminaReader, wins: 1018 },
  { player: 'EMBERCUB', foe: 'AQUAFIN', archetype: humanIsh, wins: 948 },
  { player: 'AQUAFIN', foe: 'SPROUTLE', archetype: staticGuard, wins: 1895 },
  { player: 'AQUAFIN', foe: 'SPROUTLE', archetype: naiveTriangle, wins: 857 },
  { player: 'AQUAFIN', foe: 'SPROUTLE', archetype: staminaReader, wins: 789 },
  { player: 'AQUAFIN', foe: 'SPROUTLE', archetype: humanIsh, wins: 721 },
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
