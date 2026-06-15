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

// Locked n=2000 seed=1 baselines. Archetypes match docs/sim-archetypes.md
// (canonical v1, telegraph-aware). Each cell is exact (deterministic) — any
// drift means engine/AI/data changed.
//
// INTENTIONAL CATCH-BREATH RE-BASELINE (Phase 6b, 2026-06-15): Catch Breath
// restore went +35 flat → 50% of the 100-ST cap (+50); 4 cells shifted.
//
// ── INTENTIONAL TTK RE-BASELINE (2026-06-15) ─────────────────────────────
// Global HP:damage-ratio knob `COMBAT.hpScale` 1.0 → 1.30, to lengthen fights
// so reads/comebacks have room (KICKOFF-ttk-tuning.md, combat-depth Issue B).
// It scales every mon's maxHp uniformly — a LENGTH lever, not power — so ALL
// 15 cells moved. The win% RELATIONSHIPS are preserved and SHARPENED: the
// reading archetypes gain (more rounds → reads matter more) while pure-mash
// brute LOSES (longer fights expose it to more counters). Mean fight length
// rose from ~4-5 to ~6-10 rounds. Before → after wins:
//   SPROUTLE→EMBERCUB  staticGuard 1631→1856  brute 304→271  naive 1496→1594
//                      stamReader 1511→1663   human 1142→1233
//   EMBERCUB→AQUAFIN   staticGuard  930→1023  brute 320→249  naive  730→1004
//                      stamReader 1157→1184   human  932→974
//   AQUAFIN→SPROUTLE   staticGuard 1767→1934  brute 319→263  naive 1604→1695
//                      stamReader 1516→1633   human 1134→1243
// The Falkner ladder was re-locked to new bands in the same pass (see there).
const BASELINE: ReadonlyArray<{
  player: string;
  foe: string;
  archetype: BotArchetype;
  wins: number;
}> = [
  { player: 'SPROUTLE', foe: 'EMBERCUB', archetype: staticGuard, wins: 1856 },
  { player: 'SPROUTLE', foe: 'EMBERCUB', archetype: brute, wins: 271 },
  { player: 'SPROUTLE', foe: 'EMBERCUB', archetype: naiveTriangle, wins: 1594 },
  { player: 'SPROUTLE', foe: 'EMBERCUB', archetype: staminaReader, wins: 1663 },
  { player: 'SPROUTLE', foe: 'EMBERCUB', archetype: humanIsh, wins: 1233 },
  { player: 'EMBERCUB', foe: 'AQUAFIN', archetype: staticGuard, wins: 1023 },
  { player: 'EMBERCUB', foe: 'AQUAFIN', archetype: brute, wins: 249 },
  { player: 'EMBERCUB', foe: 'AQUAFIN', archetype: naiveTriangle, wins: 1004 },
  { player: 'EMBERCUB', foe: 'AQUAFIN', archetype: staminaReader, wins: 1184 },
  { player: 'EMBERCUB', foe: 'AQUAFIN', archetype: humanIsh, wins: 974 },
  { player: 'AQUAFIN', foe: 'SPROUTLE', archetype: staticGuard, wins: 1934 },
  { player: 'AQUAFIN', foe: 'SPROUTLE', archetype: brute, wins: 263 },
  { player: 'AQUAFIN', foe: 'SPROUTLE', archetype: naiveTriangle, wins: 1695 },
  { player: 'AQUAFIN', foe: 'SPROUTLE', archetype: staminaReader, wins: 1633 },
  { player: 'AQUAFIN', foe: 'SPROUTLE', archetype: humanIsh, wins: 1243 },
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
