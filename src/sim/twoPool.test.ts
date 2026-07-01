// Two-pool model (docs/combat-design-canonical.md §2) — Part A gate.
// Verifies the 4-ATTACKS / 2-TECHNIQUES slot structure across the CH1 dex + the
// permanent fixtures, and that equipped techniques are actually SERVED + USABLE
// in a live battle (not just present in data).
import { describe, expect, test } from 'vitest';
import ch1BatchData from '../../docs/ch1-batch.json';
import movesData from '../../docs/moves.json';
import typechartData from '../../docs/typechart.json';
import {
  activeMon,
  affordableTechniques,
  attackPool,
  createBattleState,
  createSide,
  createTeam,
  loadDex,
  loadMoves,
  movePoolIssues,
  mulberry32,
  registerMoves,
  resolveRound,
  SPECIES,
  techniquePool,
  trainerPolicy,
  TRAINER_PROFILES,
} from '../engine';
import type { DexEntryJson, MoveJson, TypeChart } from '../engine';
import { reader } from './archetypes';

registerMoves(loadMoves(movesData as MoveJson[]));
const CH1 = loadDex(ch1BatchData as DexEntryJson[], 13);
const CHART = typechartData as TypeChart;
const CH1_NAMES = Object.keys(CH1);

describe('two-pool model §2 — slot structure', () => {
  test('every CH1 mon passes pool integrity (≥1 light Basic, ≤4 attacks, ≤2 techniques)', () => {
    for (const name of CH1_NAMES) {
      expect(movePoolIssues(CH1[name]!), name).toEqual([]);
    }
  });

  test('every CH1 mon has EXACTLY 2 techniques + a light Basic in its attacks', () => {
    for (const name of CH1_NAMES) {
      const sp = CH1[name]!;
      expect(techniquePool(sp).length, `${name} techniques`).toBe(2);
      const attacks = attackPool(sp);
      expect(attacks.length, `${name} attacks ≥1`).toBeGreaterThanOrEqual(1);
      expect(attacks.length, `${name} attacks ≤4`).toBeLessThanOrEqual(4);
      expect(attacks.includes('TACKLE'), `${name} has the TACKLE Basic`).toBe(true);
    }
  });

  test('the permanent fixtures still pass (attack-only, ≥1 Basic — no techniques equipped)', () => {
    for (const name of ['EMBERCUB', 'SPROUTLE', 'AQUAFIN', 'FUZZLET']) {
      const sp = SPECIES[name]!;
      expect(movePoolIssues(sp), name).toEqual([]);
      expect(techniquePool(sp).length, `${name} techniques`).toBe(0);
    }
  });

  test('a Basic-less pool is REJECTED by the integrity gate', () => {
    const bad = { ...CH1.KINDRAKE!, name: 'BADMON', moves: ['EMBER SNAP', 'SEAR'] }; // no light
    expect(movePoolIssues(bad).some((i) => i.includes('no Tier-0/light Basic'))).toBe(true);
  });
});

describe('two-pool model §2 — engine serves + battles FEATURE techniques', () => {
  test('a teched CH1 mon serves both pools (SEAR/KINDLE affordable at 0★)', () => {
    const side = createSide(CH1.KINDRAKE!); // 0★, full stamina
    const techs = affordableTechniques(side);
    expect(techs).toContain('SEAR');
    expect(techs).toContain('KINDLE');
  });

  test('a profiled trainer on a teched mon actually CASTS a technique in battle', () => {
    // Bruiser (aggressor, single-only) on KINDRAKE vs a reader. Over a batch of
    // seeded battles the trainer's tech-cast branch fires — proving techniques
    // are equipped AND selected by the AI, not merely present in data.
    const techNames = new Set(techniquePool(CH1.KINDRAKE!));
    const bruiser = trainerPolicy(TRAINER_PROFILES.bruiser!);
    let sawTechnique = false;
    for (let seed = 1; seed <= 40 && !sawTechnique; seed += 1) {
      const rng = mulberry32(seed);
      let state = createBattleState(
        createTeam([createSide(CH1.SILTSKIP!)]),
        createTeam([createSide(CH1.KINDRAKE!)]),
        { typeChart: CHART },
      );
      for (let r = 0; r < 30; r += 1) {
        const fA = bruiser(state, 'foe', rng);
        if (fA.kind === 'move' && techNames.has(fA.move)) sawTechnique = true;
        const pA = reader.chooseAction(state, 'player', rng, fA);
        const res = resolveRound(state, pA, fA, rng);
        state = res.state;
        if (activeMon(state.player).hp <= 0 || activeMon(state.foe).hp <= 0) break;
      }
    }
    expect(sawTechnique).toBe(true);
  });
});
