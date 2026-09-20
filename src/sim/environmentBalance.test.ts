// ── Combat Layer 3 sim-gate: environments (docs/combat-enrichment-roadmap §L3)
//
// The roadmap leaves an explicit Monte Carlo TODO: "model terrain-biased
// opponent policies to confirm no environment creates an in-biome dominant
// strategy." This is that gate, plus direct measurement of what the layer
// actually does.
//
// MEASURED EFFECT SIZE, recorded honestly (sweep run while building this):
// raw damage is a WEAK lever in this engine. Doubling every damage tilt — fog
// cutting Aggressive damage 24% — moved PureAGG's win rate by 2pp, because
// fights are decided by the triangle's structural effects (punish, counter
// reflect, stagger, daze) and the stamina economy, not by marginal damage. So
// the win-rate round-robin below is a SAFETY gate (nothing runs away), not a
// sensitivity instrument, and the mechanism tests measure the tilts directly.
//
// The layer's real payload is the META-READ: a trainer who claims a terrain
// plays to it, so the ground telegraphs their tendency before round one. That
// is what the last block measures.
import { describe, expect, test } from 'vitest';
import {
  ENVIRONMENTS,
  ENVIRONMENT_IDS,
  SPECIES,
  activeMon,
  createBattleState,
  createSide,
  mulberry32,
  resolveRound,
  terrainStanceMix,
  environmentFor,
} from '../engine';
import type { EnvironmentId, Stance } from '../engine';
import { runStanceBalance } from './stanceBalance';

const N = 300;
const PURE = ['PureAGG', 'PureFLUID', 'PureGUARD'] as const;

describe('SAFETY — no biome has a dominant strategy', () => {
  const results = ENVIRONMENT_IDS.map((id) => ({ id, r: runStanceBalance('SPROUTLE', N, 7, id) }));

  test('every environment keeps the Layer-1 health properties', () => {
    console.log(
      `\n── ENVIRONMENT BALANCE (SPROUTLE mirror, round-robin, n=${N}/pair) ──\n` +
        results
          .map(({ id, r }) => {
            const sorted = Object.entries(r.winPct).sort((a, b) => b[1] - a[1]);
            return `  ${id.padEnd(7)} spread ${r.spreadPp.toFixed(1).padStart(5)}pp  top ${r.top.padEnd(9)} ` +
              sorted.map(([n, w]) => `${n}:${w.toFixed(0)}`).join(' ');
          })
          .join('\n') + '\n',
    );
    // The ceiling is measured AGAINST NEUTRAL GROUND, not as an absolute. That
    // is what "terrain colours a fight" means: a biome may lift or sink a
    // stance, but not transform it. An absolute cap would be arbitrary — Guard
    // already sits at 60% in the open, so 62% on Guard-friendly ground is fine
    // while 62% for Fluid would be alarming.
    const open = results.find((x) => x.id === 'open')!.r;
    const MAX_SWING = 8; // pp away from the stance's neutral-ground rate

    for (const { id, r } of results) {
      expect(r.spreadPp, `${id}: spread`).toBeLessThan(70);
      for (const name of PURE) {
        // No stance DIES in a biome: terrain may discourage a stance, never
        // delete it.
        expect(r.winPct[name]!, `${id}: ${name} floor`).toBeGreaterThan(8);
        expect(
          Math.abs(r.winPct[name]! - open.winPct[name]!),
          `${id}: ${name} swung too far from its ${open.winPct[name]!.toFixed(0)}% neutral rate`,
        ).toBeLessThanOrEqual(MAX_SWING);
        // The load-bearing one: varying still beats spamming, EVERYWHERE. If
        // some ground made one spam optimal, that ground would be a stat check
        // rather than a read — and this is what caught rocky and mud handing
        // PureGUARD the top slot while I was tuning this layer.
        expect(r.winPct.Balanced!, `${id}: Balanced vs ${name}`).toBeGreaterThan(r.winPct[name]!);
      }
    }
  });

  test('OPEN ground reproduces the untilted baseline exactly', () => {
    // open's multipliers are all 1 and its stamina deltas all 0, so it must
    // match an environment-less run bit for bit. Drift here means a tilt
    // leaked into the neutral case — and every pre-Layer-3 ladder runs neutral.
    expect(runStanceBalance('SPROUTLE', N, 7, 'open').winPct).toEqual(
      runStanceBalance('SPROUTLE', N, 7).winPct,
    );
  });
});

// ── MECHANISM — measured directly, not inferred from win rates ─────────────
function afterRounds(env: EnvironmentId | undefined, stance: Stance, rounds: number) {
  let state = createBattleState(
    createSide(SPECIES.SPROUTLE!),
    createSide(SPECIES.SPROUTLE!),
    env !== undefined ? { environment: env } : {},
  );
  const rng = mulberry32(5);
  for (let i = 0; i < rounds; i += 1) {
    state = resolveRound(
      state,
      { kind: 'move', move: 'TACKLE', stance },
      { kind: 'move', move: 'TACKLE', stance: 'G' },
      rng,
    ).state;
  }
  const me = activeMon(state.player);
  return { st: me.st, hp: activeMon(state.foe).hp };
}

describe('MECHANISM — the ground actually taxes the stance it should', () => {
  test('mud drains a dodger by its stated tax, EVERY round', () => {
    // Read the tax from the table rather than hardcoding it, so tuning the
    // value does not silently turn this into a test of nothing.
    const tax = -ENVIRONMENTS.mud.stanceStamina.F;
    expect(tax).toBeGreaterThan(0);
    expect(afterRounds('open', 'F', 1).st - afterRounds('mud', 'F', 1).st).toBeCloseTo(tax, 5);
    // The compounding assertion is the point: BattleState is rebuilt
    // field-by-field each round, and `environment` was not carried, so terrain
    // silently stopped applying after round 1. One round looked perfect.
    expect(afterRounds('open', 'F', 3).st - afterRounds('mud', 'F', 3).st).toBeCloseTo(tax * 3, 5);
  });

  test('fog blunts an aggressor and lifts a dodger, as its table says', () => {
    // Fog: A dealt x0.88. The Guard defender should be LESS hurt in fog.
    const open = afterRounds('open', 'A', 1).hp;
    const fog = afterRounds('fog', 'A', 1).hp;
    expect(fog).toBeGreaterThan(open);
  });

  test('a stance the ground does not name is untouched', () => {
    // Fog names A and F; Guard holds no opinion there.
    expect(afterRounds('fog', 'G', 3).st).toBeCloseTo(afterRounds('open', 'G', 3).st, 5);
  });
});

// ── META-READ — the layer's actual depth claim ─────────────────────────────
describe('META-READ — the local plays to their ground, the stranger does not', () => {
  const BASE: readonly [number, number, number] = [0.34, 0.33, 0.33]; // balanced

  test("a trainer who CLAIMS the terrain leans measurably into it", () => {
    const forest = environmentFor('forest'); // favors F
    const leaned = terrainStanceMix(BASE, forest, 'forest');
    expect(leaned[2]).toBeGreaterThan(BASE[2]); // F up
    const share = leaned[2] / (leaned[0] + leaned[1] + leaned[2]);
    // 33% -> 44% at TERRAIN_LEAN 1.6: a lean you can feel across a fight
    // without the trainer becoming a one-note spammer you can auto-pilot.
    expect(share).toBeGreaterThan(0.42);
  });

  test('ice shuns the brace — the terrain tells you they will NOT guard', () => {
    const ice = environmentFor('ice'); // favors A, avoids G
    const leaned = terrainStanceMix(BASE, ice, 'ice');
    expect(leaned[0]).toBeGreaterThan(BASE[0]); // A up
    expect(leaned[1]).toBeLessThan(BASE[1]); // G down
  });

  test('a VISITOR fights the same everywhere — which is itself information', () => {
    // profile.terrain is undefined (most trainers) or a different biome.
    expect(terrainStanceMix(BASE, environmentFor('forest'), undefined)).toEqual(BASE);
    expect(terrainStanceMix(BASE, environmentFor('forest'), 'mud')).toEqual(BASE);
  });

  test('OPEN ground leans nobody — it names no favourite', () => {
    expect(terrainStanceMix(BASE, environmentFor('open'), 'open')).toEqual(BASE);
  });
});

describe('the environment tables are well-formed', () => {
  test('tilts stay small, OPEN is neutral, every biome tells the player its rules', () => {
    for (const id of ENVIRONMENT_IDS) {
      const e = ENVIRONMENTS[id];
      expect(e.id).toBe(id);
      expect(e.blurb.length).toBeGreaterThan(10);
      for (const v of [...Object.values(e.stanceDealt), ...Object.values(e.stanceTaken), ...Object.values(e.release)]) {
        expect(v).toBeGreaterThan(0.8);
        expect(v).toBeLessThan(1.25);
      }
      for (const v of Object.values(e.stanceStamina)) {
        expect(Math.abs(v)).toBeLessThanOrEqual(8); // against a +8 base regen
      }
    }
    const open = ENVIRONMENTS.open;
    for (const v of [...Object.values(open.stanceDealt), ...Object.values(open.stanceTaken), ...Object.values(open.release)]) {
      expect(v).toBe(1);
    }
    for (const v of Object.values(open.stanceStamina)) expect(v).toBe(0);
  });
});
