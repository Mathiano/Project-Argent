import { describe, expect, test } from 'vitest';
import { activeMon, forcedAction } from '../engine';
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

// A ★-SPENDING probe. The canonical v1 archetypes barely touch the Call
// economy (only stamina-reader Catch-Breaths, gated on momentum ≥ 1 — which
// the jumpstart's 1→2 bump doesn't change), so they can't actually exercise
// the jumpstart. This probe spends ★ greedily (Catch Breath whenever it has
// a charge and isn't near-full), so the extra early ★ genuinely changes its
// stamina trajectory — making the ≤3% gate a REAL measurement, not a vacuous
// one. It otherwise strikes with the stamina-reader's policy.
const callGreedy: BotArchetype = {
  name: 'call-greedy',
  chooseAction(state, side, rng, telegraph) {
    const me = activeMon(state[side]);
    if (forcedAction(me)) return forcedAction(me)!;
    if (me.momentum >= 1 && me.st < 70 && !me.exhausted) return { kind: 'catchBreath' };
    return staminaReader.chooseAction(state, side, rng, telegraph);
  },
};

// ── The ≤3% LADDER GATE (bond-core sim-gate) ─────────────────────────────
// Bond's ONLY combat effect is the Tier-I jumpstart (first read-win each
// battle banks a free ★). It is a read-economy NUDGE, not a stat change, so
// arming it on the player must shift the archetype ladder by ≤3 percentage
// points. This runs each rival-ladder cell twice — baseline (no jumpstart)
// vs player-armed — on the SAME seed, and asserts the shift stays in band.
// (The unarmed run is bit-identical to ladder.test.ts's locked baseline,
// which is the proof the engine change is additive.)

const RIVAL_SCALE = { atk: 0.85, dfn: 0.85 } as const;
const N = 2000;
const SEED = 1;
const GATE_PP = 3; // max allowed |Δ win%| in percentage points

const CELLS: ReadonlyArray<{ player: string; foe: string; archetype: BotArchetype }> = [
  { player: 'SPROUTLE', foe: 'EMBERCUB', archetype: staticGuard },
  { player: 'SPROUTLE', foe: 'EMBERCUB', archetype: brute },
  { player: 'SPROUTLE', foe: 'EMBERCUB', archetype: naiveTriangle },
  { player: 'SPROUTLE', foe: 'EMBERCUB', archetype: staminaReader },
  { player: 'SPROUTLE', foe: 'EMBERCUB', archetype: humanIsh },
  { player: 'EMBERCUB', foe: 'AQUAFIN', archetype: staticGuard },
  { player: 'EMBERCUB', foe: 'AQUAFIN', archetype: brute },
  { player: 'EMBERCUB', foe: 'AQUAFIN', archetype: naiveTriangle },
  { player: 'EMBERCUB', foe: 'AQUAFIN', archetype: staminaReader },
  { player: 'EMBERCUB', foe: 'AQUAFIN', archetype: humanIsh },
  { player: 'AQUAFIN', foe: 'SPROUTLE', archetype: staticGuard },
  { player: 'AQUAFIN', foe: 'SPROUTLE', archetype: brute },
  { player: 'AQUAFIN', foe: 'SPROUTLE', archetype: naiveTriangle },
  { player: 'AQUAFIN', foe: 'SPROUTLE', archetype: staminaReader },
  { player: 'AQUAFIN', foe: 'SPROUTLE', archetype: humanIsh },
];

describe('bond ≤3% ladder gate — Tier-I jumpstart (n=2000, seed=1)', () => {
  const report: string[] = [];
  let maxShift = 0;

  for (const cell of CELLS) {
    test(`${cell.player} vs ${cell.foe} — ${cell.archetype.name}: jumpstart shift ≤${GATE_PP}pp`, () => {
      const base = runLadder(
        {
          player: { archetype: cell.archetype, species: cell.player },
          foe: { archetype: rivalAI, species: cell.foe, scale: RIVAL_SCALE },
        },
        N,
        SEED,
      );
      const armed = runLadder(
        {
          player: { archetype: cell.archetype, species: cell.player, jumpstart: true },
          foe: { archetype: rivalAI, species: cell.foe, scale: RIVAL_SCALE },
        },
        N,
        SEED,
      );
      const shift = armed.playerWinPct - base.playerWinPct;
      maxShift = Math.max(maxShift, Math.abs(shift));
      report.push(
        `${cell.player.padEnd(9)} vs ${cell.foe.padEnd(9)} ${cell.archetype.name.padEnd(14)} ` +
          `base ${base.playerWinPct.toFixed(1).padStart(5)}%  armed ${armed.playerWinPct
            .toFixed(1)
            .padStart(5)}%  Δ ${(shift >= 0 ? '+' : '') + shift.toFixed(2)}pp`,
      );
      expect(Math.abs(shift)).toBeLessThanOrEqual(GATE_PP);
    });
  }

  test('report the ladder shift', () => {
    // Printed so the gate's actual numbers are visible in the run.
    console.log(
      '\n── Bond jumpstart ladder shift — CANONICAL archetypes (player armed vs baseline) ──\n' +
        report.join('\n') +
        `\n\nMax |Δ| across canonical cells: ${maxShift.toFixed(2)}pp (gate ${GATE_PP}pp)\n` +
        'NOTE: ~0pp is expected — the v1 archetypes barely spend ★ (only\n' +
        'stamina-reader Catch-Breaths, gated on momentum≥1, unchanged by the\n' +
        '1→2 jumpstart). The call-greedy probe below exercises it for real.\n',
    );
    expect(maxShift).toBeLessThanOrEqual(GATE_PP);
  });
});

describe('bond ≤3% ladder gate — ★-SPENDING probe (n=2000, seed=1)', () => {
  const matchups: ReadonlyArray<{ player: string; foe: string }> = [
    { player: 'SPROUTLE', foe: 'EMBERCUB' },
    { player: 'EMBERCUB', foe: 'AQUAFIN' },
    { player: 'AQUAFIN', foe: 'SPROUTLE' },
  ];
  const report: string[] = [];
  let maxShift = 0;

  for (const m of matchups) {
    test(`${m.player} vs ${m.foe} — call-greedy: jumpstart shift ≤${GATE_PP}pp`, () => {
      const base = runLadder(
        {
          player: { archetype: callGreedy, species: m.player },
          foe: { archetype: rivalAI, species: m.foe, scale: RIVAL_SCALE },
        },
        N,
        SEED,
      );
      const armed = runLadder(
        {
          player: { archetype: callGreedy, species: m.player, jumpstart: true },
          foe: { archetype: rivalAI, species: m.foe, scale: RIVAL_SCALE },
        },
        N,
        SEED,
      );
      const shift = armed.playerWinPct - base.playerWinPct;
      maxShift = Math.max(maxShift, Math.abs(shift));
      report.push(
        `${m.player.padEnd(9)} vs ${m.foe.padEnd(9)} call-greedy  ` +
          `base ${base.playerWinPct.toFixed(1).padStart(5)}%  armed ${armed.playerWinPct
            .toFixed(1)
            .padStart(5)}%  Δ ${(shift >= 0 ? '+' : '') + shift.toFixed(2)}pp`,
      );
      expect(Math.abs(shift)).toBeLessThanOrEqual(GATE_PP);
    });
  }

  test('report the ★-spending shift', () => {
    console.log(
      '\n── Bond jumpstart ladder shift — ★-SPENDING probe (call-greedy) ──\n' +
        report.join('\n') +
        `\n\nMax |Δ| (★-spending probe): ${maxShift.toFixed(2)}pp (gate ${GATE_PP}pp)\n`,
    );
    expect(maxShift).toBeLessThanOrEqual(GATE_PP);
  });
});
