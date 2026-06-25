// Bond legibility (Lane A) regression. The bond system is LIVE; this lane
// DISPLAYS it. These tests pin the three surfaces' presentation contracts
// (docs/bond-legibility-design.md) — the bond bar reads the right stage, the
// post-win advance caps within a stage (a tier-cross is the post-fight beat),
// the tier-up beat is enriched, and the read-win reaction fires on the
// player's momentum event. Bond MATH is untouched (sim-gated elsewhere).

import { describe, expect, test, beforeEach } from 'vitest';
import {
  createBattleState,
  createSide,
  createTeam,
  loadDex,
  loadMoves,
  mulberry32,
  registerMoves,
} from '../engine';
import type { Action, BattleState, DexEntryJson, MoveJson, RNG } from '../engine';
import ch1BatchData from '../../docs/ch1-batch.json';
import movesData from '../../docs/moves.json';
import { createBattleScene } from './scenes/battle';
import { createBondStageScene } from './scenes/bondStage';
import { drawBondBar } from './bondBar';
import { bondAfterFight, stageCeiling, stageProgress } from './bond';
import { bondStageName, BOND_STAGES } from './catching';
import { clearGameEventListeners, onGameEvent } from './gameEvents';
import type { GameEvent } from './gameEvents';

// Recording ctx — captures fillText so we can assert what's on screen.
interface RecordingCtx extends CanvasRenderingContext2D {
  readonly texts: string[];
  reset(): void;
}
function stubCtx(): RecordingCtx {
  const noop = () => {};
  const texts: string[] = [];
  return new Proxy(
    { texts, reset: () => texts.splice(0) },
    {
      get(target, prop) {
        if (prop === 'texts') return (target as { texts: string[] }).texts;
        if (prop === 'reset') return (target as { reset: () => void }).reset;
        if (prop === 'fillText') return (text: string) => texts.push(String(text));
        if (prop === 'beginPath') return () => ({ fill: noop, stroke: noop, ellipse: noop });
        if (prop === 'measureText') return () => ({ width: 10 });
        if (prop === 'canvas') return { width: 320, height: 180 };
        return noop;
      },
      set: () => true,
    },
  ) as unknown as RecordingCtx;
}

registerMoves(loadMoves(movesData as MoveJson[]));
const CH1 = loadDex(ch1BatchData as DexEntryJson[], 13);

// ---- ① bond bar: reads the right stage ----------------------------------

describe('bond bar — surfaces the existing stage + progress (no recompute)', () => {
  test('drawBondBar prints the named stage for a given bond value', () => {
    const ctx = stubCtx();
    drawBondBar(ctx, 0, 0, 120, 40); // 40 → Companions (stage 3)
    expect(bondStageName(40)).toBe('Companions');
    expect(ctx.texts.some((t) => t.includes('Companions'))).toBe(true);
  });

  test('the value→stage→progress mapping is the live bond math', () => {
    // Each stage boundary reads as that stage's name; progress is 0..1 within.
    for (const s of BOND_STAGES) {
      expect(bondStageName(s.max)).toBe(s.name);
      expect(stageProgress(s.max)).toBeCloseTo(1, 5);
    }
    // Mid-stage-1 (Wary 0–15): half-ish progress, not full.
    expect(stageProgress(7)).toBeGreaterThan(0);
    expect(stageProgress(7)).toBeLessThan(1);
  });

  test('the battle scene draws the ACTIVE mon bond bar when bond is threaded', () => {
    const player = CH1.GRUBLEAF!;
    const foe = CH1.GRUBLEAF!;
    const state = createBattleState(createTeam([createSide(player)]), createTeam([createSide(foe)]));
    const scene = createBattleScene({
      state,
      rng: mulberry32(1),
      chooseFoeAction: (): Action => ({ kind: 'move', move: 'THORN FLICK', stance: 'F' }),
      intro: [],
      catchBreathUnlocked: false,
      canRun: true,
      playerBond: [40], // Companions
      onResolve: () => {},
    });
    scene.update?.(0.01); // past intro → menu
    const ctx = stubCtx();
    scene.draw(ctx);
    expect(ctx.texts.some((t) => t.includes('Companions'))).toBe(true);
  });

  test('no bond bar drawn when bond is not threaded (sim / isolated callers)', () => {
    const player = CH1.GRUBLEAF!;
    const state = createBattleState(createTeam([createSide(player)]), createTeam([createSide(player)]));
    const scene = createBattleScene({
      state,
      rng: mulberry32(1),
      chooseFoeAction: (): Action => ({ kind: 'move', move: 'THORN FLICK', stance: 'F' }),
      intro: [],
      catchBreathUnlocked: false,
      canRun: true,
      onResolve: () => {},
    });
    scene.update?.(0.01);
    const ctx = stubCtx();
    scene.draw(ctx);
    // No stage name leaks onto the HUD when there's no bond to show.
    const names = BOND_STAGES.map((s) => s.name);
    expect(ctx.texts.some((t) => names.some((n) => t.includes(n)))).toBe(false);
  });
});

// ---- ① post-fight advance: caps within the stage ------------------------

describe('post-win bond advance — fills within a stage; a cross is the beat', () => {
  test('a within-stage gain advances to the awarded value', () => {
    const from = 31; // Companions (30–45)
    const target = bondAfterFight(from, { monPower: 200, foePower: 200, kind: 'trainer', hpFracRemaining: 0.4 });
    const capped = Math.min(target, stageCeiling(from));
    // The fight gives a real (sub-stage) gain, so the bar advances but does
    // not reach the stage ceiling → no cross, the bar shows the new value.
    expect(target).toBeGreaterThan(from);
    expect(capped).toBe(target);
    expect(capped).toBeLessThan(stageCeiling(from));
  });

  test('a gain that would cross a stage is clamped to the stage ceiling', () => {
    const from = 14; // Wary, ceiling 15 — a strong win would cross to Warming
    const target = bondAfterFight(from, { monPower: 80, foePower: 200, kind: 'boss', hpFracRemaining: 0.1 });
    expect(target).toBeGreaterThan(stageCeiling(from)); // it really does cross
    const capped = Math.min(target, stageCeiling(from));
    expect(capped).toBe(stageCeiling(from)); // the in-combat bar fills to 100% only
  });
});

// ---- ② tier-up beat: enriched -------------------------------------------

describe('tier-up beat — enriched reward event (not a rebuild)', () => {
  test('names the deepening, the transition, and sweeps the bond bar', () => {
    const scene = createBondStageScene({
      species: 'GRUBLEAF',
      fromName: 'Wary',
      toName: 'Warming',
      toValue: 22,
      unlocksCalls: true,
      onContinue: () => {},
    });
    const ctx = stubCtx();
    scene.update?.(0.3);
    scene.draw(ctx);
    expect(ctx.texts.some((t) => t.includes('YOUR BOND DEEPENED'))).toBe(true);
    expect(ctx.texts.some((t) => t.includes('Warming'))).toBe(true);
    // The unlock acknowledgment still rides the Warming bond moment.
    expect(ctx.texts.some((t) => t.includes('CALL'))).toBe(true);
  });
});

// ---- ③ read-win reaction: fires on the player momentum event ------------

describe('read-win reaction — fires on the player ★ gain, hidden for the foe', () => {
  beforeEach(() => clearGameEventListeners());

  function drivePlayerReadWin(): GameEvent[] {
    const events: GameEvent[] = [];
    onGameEvent((e) => events.push(e));
    const player = CH1.GRUBLEAF!;
    const foe = CH1.GRUBLEAF!;
    const state = createBattleState(createTeam([createSide(player)]), createTeam([createSide(foe)]));
    // Foe always commits FLUID; player commits AGGRESSIVE (stance A is the
    // menu default) → A>F PUNISH, a guaranteed player read-win → +★.
    const foeAI = (_s: BattleState, _r: RNG): Action => ({ kind: 'move', move: 'THORN FLICK', stance: 'F' });
    const scene = createBattleScene({
      state,
      rng: mulberry32(7),
      chooseFoeAction: foeAI,
      intro: [],
      catchBreathUnlocked: false,
      canRun: true,
      playerBond: [10],
      onResolve: () => {},
    });
    scene.update?.(0.01); // → menu
    scene.input?.('a'); // FIGHT → move menu
    scene.input?.('a'); // confirm first move, default stance A → commit → resolve
    // Pump the resolve: skip beat holds and drain the event stream.
    for (let i = 0; i < 60; i += 1) {
      scene.update?.(0.2);
      scene.input?.('a');
    }
    return events;
  }

  test('a player read-win emits a read-win event for the player side', () => {
    const events = drivePlayerReadWin();
    const readWins = events.filter((e) => e.kind === 'read-win');
    expect(readWins.length).toBeGreaterThan(0);
    expect(readWins.every((e) => e.kind === 'read-win' && e.side === 'player')).toBe(true);
    // Sanity: the player's PUNISH (A>F) landed this round — the read that
    // banked the ★ the reaction rides.
    expect(events.some((e) => e.kind === 'hit-landed' && e.side === 'player')).toBe(true);
  });
});
