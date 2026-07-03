// Phase 1 GATE TEST: a 2v2 player battle is playable end-to-end.
// Drives the full battle pipeline with switching: open PKMN menu →
// pick the bench mon → switch commits → fight → KO the active →
// forced-switch picker → choose survivor → fight to wipe → onResolve.
//
// This is the Phase 1 sibling of coldstart.test.ts. Phase 0's gate
// proved a 1v1 cold-start loop works; Phase 1's gate proves a multi-
// mon player team works end-to-end.

import { describe, expect, test } from 'vitest';
import ch1BatchData from '../../docs/ch1-batch.json';
import movesData from '../../docs/moves.json';
import typechartData from '../../docs/typechart.json';
import {
  activeMon,
  createBattleState,
  createSide,
  createTeam,
  hasBenchSurvivor,
  isTeamWiped,
  loadDex,
  loadMoves,
  mulberry32,
  registerMoves,
  setActiveMember,
} from '../engine';
import type {
  Action,
  BattleState,
  DexEntryJson,
  MoveJson,
  RNG,
  SideState,
  TypeChart,
} from '../engine';
import { createBattleScene } from './scenes/battle';
import { drawBar } from './ui';

registerMoves(loadMoves(movesData as MoveJson[]));
const CH1 = loadDex(ch1BatchData as DexEntryJson[], 13);
const TYPECHART = typechartData as TypeChart;

// Stub Canvas — records fillText so tests can assert what's on screen.
interface RecordingCtx extends CanvasRenderingContext2D {
  readonly texts: string[];
  reset(): void;
}
function stubCtx(): RecordingCtx {
  const noop = () => {};
  const path = { fill: noop, stroke: noop, ellipse: noop };
  const texts: string[] = [];
  return new Proxy(
    { texts, reset: () => texts.splice(0) },
    {
      get(target, prop) {
        if (prop === 'texts') return (target as { texts: string[] }).texts;
        if (prop === 'reset') return (target as { reset: () => void }).reset;
        if (prop === 'fillText') return (text: string) => texts.push(String(text));
        if (prop === 'beginPath') return () => path;
        if (prop === 'measureText') return () => ({ width: 10 });
        if (prop === 'canvas') return { width: 320, height: 180 };
        if (prop === 'textBaseline' || prop === 'textAlign' || prop === 'lineWidth') return '';
        if (prop === 'fillStyle' || prop === 'strokeStyle' || prop === 'font') return '';
        return noop;
      },
      set() {
        return true;
      },
    },
  ) as unknown as RecordingCtx;
}

interface SceneOpts {
  readonly playerParty: readonly SideState[];
  readonly foeParty: readonly SideState[];
  readonly chooseFoeAction?: (state: BattleState, rng: RNG) => Action;
  readonly catchBreathUnlocked?: boolean;
  readonly intro?: readonly string[];
}
function buildScene(
  opts: SceneOpts,
  onResolve: (w: 'player' | 'foe') => void = () => {},
): ReturnType<typeof createBattleScene> {
  const state = createBattleState(
    createTeam(opts.playerParty.slice()),
    createTeam(opts.foeParty.slice()),
    { typeChart: TYPECHART },
  );
  return createBattleScene({
    state,
    rng: mulberry32(1),
    chooseFoeAction:
      opts.chooseFoeAction ?? (() => ({ kind: 'move', move: 'TACKLE', stance: 'G' })),
    intro: opts.intro ?? [],
    catchBreathUnlocked: opts.catchBreathUnlocked ?? false,
    canRun: true,
    onResolve,
  });
}

function drainResolve(scene: ReturnType<typeof createBattleScene>): void {
  // Resolve auto-advances one beat at a time (streaming + a short hold each).
  // Tick generously to drain the whole round to the next phase; ticking can't
  // over-advance (update() only drives resolve while phase==='resolve').
  for (let i = 0; i < 80; i += 1) scene.update?.(0.2);
}

describe('Phase 1 GATE — 2v2 player battle, voluntary + forced switching', () => {
  test('PKMN row is enabled when the bench has a survivor; cursor reaches it via DOWN', () => {
    const grub = createSide(CH1.GRUBLEAF!);
    const silt = createSide(CH1.SILTSKIP!);
    const scene = buildScene({
      playerParty: [grub, silt],
      foeParty: [createSide(CH1.FLITPECK!)],
    });
    // Menu open after the no-intro scene init. Menu order is now
    // FIGHT / CALLS / MONS / BALLS / RUN (2b-1). drawText prefixes a cursor
    // indicator ('> ' or '  ') so we match by substring.
    const ctx = stubCtx();
    scene.draw(ctx);
    expect(ctx.texts.some((t) => t.includes('FIGHT'))).toBe(true);
    expect(ctx.texts.some((t) => t.includes('MONS'))).toBe(true);

    // DOWN from FIGHT (enabled) — with CALLS locked (catchBreathUnlocked=false)
    // the cursor skips it and lands on MONS (enabled because the bench has
    // SILTSKIP).
    scene.input?.('down');
    ctx.reset();
    scene.draw(ctx);
    // The cursor prefix '>' must be next to MONS now.
    expect(ctx.texts.some((t) => t.includes('> MONS'))).toBe(true);
  });

  test('PKMN row is disabled (cursor skips) when the player has a single-mon "team"', () => {
    const scene = buildScene({
      playerParty: [createSide(CH1.GRUBLEAF!)],
      foeParty: [createSide(CH1.FLITPECK!)],
    });
    scene.input?.('down'); // FIGHT → ??
    const ctx = stubCtx();
    scene.draw(ctx);
    // Solo team → PKMN disabled, cursor skips past it. With CALL locked
    // too, DOWN from FIGHT lands on RUN.
    expect(ctx.texts.some((t) => t.includes('> RUN'))).toBe(true);
  });

  test('voluntary switch: PKMN → A on bench mon commits a switch action; foe still acts', () => {
    const grub = createSide(CH1.GRUBLEAF!);
    const silt = createSide(CH1.SILTSKIP!);
    const scene = buildScene({
      playerParty: [grub, silt],
      foeParty: [createSide(CH1.FLITPECK!)],
    });
    scene.input?.('down'); // FIGHT → PKMN
    scene.input?.('a'); // open party screen
    let ctx = stubCtx();
    scene.draw(ctx);
    expect(ctx.texts.some((t) => t.includes('PARTY') || t.includes('SEND OUT'))).toBe(true);
    // Default cursor lands on first selectable bench mon (SILTSKIP at idx 1).
    expect(ctx.texts.some((t) => t.includes('>SILTSKIP'))).toBe(true);

    // A confirms switch → commit → resolve. After the round, active is SILTSKIP.
    scene.input?.('a');
    drainResolve(scene);

    ctx = stubCtx();
    scene.draw(ctx);
    // Player panel name should now be SILTSKIP.
    expect(ctx.texts).toContain('SILTSKIP');
  });

  test('B cancels the voluntary party picker back to menu', () => {
    const grub = createSide(CH1.GRUBLEAF!);
    const silt = createSide(CH1.SILTSKIP!);
    const scene = buildScene({
      playerParty: [grub, silt],
      foeParty: [createSide(CH1.FLITPECK!)],
    });
    scene.input?.('down'); // FIGHT → PKMN
    scene.input?.('a'); // open party screen
    scene.input?.('b'); // cancel
    const ctx = stubCtx();
    scene.draw(ctx);
    // Back at the menu — FIGHT visible, PARTY not.
    expect(ctx.texts.some((t) => t.includes('FIGHT'))).toBe(true);
    expect(ctx.texts.some((t) => t.includes('PARTY'))).toBe(false);
  });

  test('forced switch on faint: party picker opens; player can override engine auto-pick', () => {
    // Lead at 1 HP. Foe is Aggressive vs player Guard → player counters
    // the foe but the foe's strike still lands first (player Guards =
    // initiative loss to A). Actually simpler: player TACKLE Aggressive,
    // foe TACKLE Guard → foe counters → counter KOs lead. Same setup
    // the end-text test uses.
    const lead = { ...createSide(CH1.GRUBLEAF!), hp: 1 };
    const bench1 = createSide(CH1.SILTSKIP!);
    const bench2 = createSide(CH1.KINDRAKE!);
    let switchedTo: number | null = null;
    const scene = buildScene({
      playerParty: [lead, bench1, bench2],
      foeParty: [createSide(CH1.FLITPECK!)],
      chooseFoeAction: () => ({ kind: 'move', move: 'TACKLE', stance: 'G' }),
    });
    scene.input?.('a'); // FIGHT
    scene.input?.('a'); // TACKLE → resolve, counter KOs lead, faint+forcedSwitch event
    drainResolve(scene); // resolve auto-advances; the faint's forcedSwitch opens the party picker

    let ctx = stubCtx();
    scene.draw(ctx);
    // The forced picker is up.
    expect(ctx.texts.some((t) => t.includes('SEND OUT'))).toBe(true);
    // Engine's auto-pick (firstSurvivor) is index 1 (SILTSKIP). Default
    // cursor is on that. Override with DOWN to KINDRAKE (index 2).
    scene.input?.('down');
    // Capture rendered cursor.
    ctx = stubCtx();
    scene.draw(ctx);
    expect(ctx.texts.some((t) => t.includes('>KINDRAKE'))).toBe(true);
    // A sends out KINDRAKE — the player's override of the auto-pick.
    scene.input?.('a');
    // Now phase='resolve' resumes — drain.
    drainResolve(scene);
    ctx = stubCtx();
    scene.draw(ctx);
    // KINDRAKE is the active now (not SILTSKIP, the auto-pick).
    expect(ctx.texts).toContain('KINDRAKE');
    // SILTSKIP also visible somewhere (bench indicator + survives).
    void switchedTo;
  });

  test('bond credit: a switched-in mon is reported as a participant (not just the lead)', () => {
    // Switch the lead out for the bench mon, then win with the bench mon —
    // onResolve must report BOTH party indices so bond credits the mon that
    // actually fought, not just slot 0.
    let participants: readonly number[] | null = null;
    const grub = createSide(CH1.GRUBLEAF!);
    const silt = createSide(CH1.SILTSKIP!);
    const foe = { ...createSide(CH1.FLITPECK!), hp: 1 }; // 1 HP → the switched-in mon KOs it
    const state = createBattleState(
      createTeam([grub, silt]),
      createTeam([foe]),
      { typeChart: TYPECHART },
    );
    const scene = createBattleScene({
      state,
      rng: mulberry32(1),
      chooseFoeAction: () => ({ kind: 'move', move: 'TACKLE', stance: 'G' }),
      intro: [],
      catchBreathUnlocked: false,
      canRun: true,
      onResolve: (_w, _final, parts) => {
        participants = parts;
      },
    });
    scene.input?.('down'); // FIGHT → PKMN
    scene.input?.('a'); // open party picker (SILTSKIP, idx 1)
    scene.input?.('a'); // confirm switch → commit → switchIn(player, 1)
    drainResolve(scene); // switch round resolves; back to menu, SILTSKIP active
    scene.input?.('a'); // FIGHT
    scene.input?.('a'); // TACKLE → KOs the 1-HP foe
    drainResolve(scene); // resolve → win → end-text
    scene.input?.('a'); // advance end-text line 1
    scene.input?.('a'); // advance end-text line 2 → onResolve
    expect(participants).not.toBeNull();
    expect([...participants!]).toEqual([0, 1]); // lead + switched-in mon both fought
  });

  test('forced switch: B is a no-op (player MUST pick), cannot back out', () => {
    const lead = { ...createSide(CH1.GRUBLEAF!), hp: 1 };
    const bench = createSide(CH1.SILTSKIP!);
    const scene = buildScene({
      playerParty: [lead, bench],
      foeParty: [createSide(CH1.FLITPECK!)],
    });
    scene.input?.('a'); // FIGHT
    scene.input?.('a'); // TACKLE → counter KO
    drainResolve(scene); // resolve auto-advances → forcedSwitch opens the party picker

    let ctx = stubCtx();
    scene.draw(ctx);
    expect(ctx.texts.some((t) => t.includes('SEND OUT'))).toBe(true);

    // B should do nothing — still in party picker.
    scene.input?.('b');
    ctx = stubCtx();
    scene.draw(ctx);
    expect(ctx.texts.some((t) => t.includes('SEND OUT'))).toBe(true);
  });

  test('team-wipe: lead faints with NO bench survivor → onResolve("foe") fires', () => {
    let resolved: 'player' | 'foe' | null = null;
    const lead = { ...createSide(CH1.GRUBLEAF!), hp: 1 };
    const dead = { ...createSide(CH1.SILTSKIP!), hp: 0 };
    const scene = buildScene(
      {
        playerParty: [lead, dead],
        foeParty: [createSide(CH1.FLITPECK!)],
      },
      (w) => {
        resolved = w;
      },
    );
    scene.input?.('a'); // FIGHT
    scene.input?.('a'); // TACKLE → counter KO; no bench survivor
    drainResolve(scene); // resolve auto-advances → end-text
    scene.input?.('a'); // advance end-text line 1
    scene.input?.('a'); // advance end-text line 2 → onResolve('foe')
    expect(resolved).toBe('foe');
  });
});

describe('Phase 1 — HP bar render contract on switch-in (regression)', () => {
  test('after a voluntary switch, the player panel shows the new mon (never the old) before any new round', () => {
    // SILTSKIP lead (67/67) switches to GRUBLEAF (54/54). Pre-fix the
    // panel read activeMon(state.player) so the NAME swapped to
    // GRUBLEAF immediately while display.hp lagged at 67 → bar showed
    // 67/54 = 124% overflow on a panel named GRUBLEAF. The fix routes
    // panel reads through display (which carries species + maxHp
    // together), so name and hp stay paired.
    const silt = createSide(CH1.SILTSKIP!);
    const grub = createSide(CH1.GRUBLEAF!);
    const scene = buildScene({
      playerParty: [silt, grub],
      foeParty: [createSide(CH1.FLITPECK!)],
    });

    // Initial draw: SILTSKIP is the active.
    let ctx = stubCtx();
    scene.draw(ctx);
    expect(ctx.texts).toContain('SILTSKIP');

    // Open PKMN → confirm switch to GRUBLEAF → commit fires.
    scene.input?.('down');
    scene.input?.('a');
    scene.input?.('a');
    // Drain the switch round (auto-advances) to the next turn.
    drainResolve(scene);

    ctx = stubCtx();
    scene.draw(ctx);
    // After the switch round, GRUBLEAF is active. The panel shows it.
    expect(ctx.texts).toContain('GRUBLEAF');
    // And SILTSKIP is no longer the active label — only appears in
    // bench indicators (color, not text).
    expect(ctx.texts).not.toContain('SILTSKIP');
  });

  test('drawBar clamps fill to width (defensive: even if value > max, no overflow)', () => {
    // Belt-and-suspenders: import drawBar and call directly with a
    // value > max. Verify via a recording ctx that the second fillRect
    // (the fill, not the background) uses width <= bar width.
    // (The first fillRect is the empty background with width = w.)
    type Rect = { w: number };
    const rects: Rect[] = [];
    const ctx: Partial<CanvasRenderingContext2D> = {
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 0,
      fillRect: (_x: number, _y: number, w: number) => {
        rects.push({ w });
      },
      strokeRect: () => {},
    };
    drawBar(ctx as CanvasRenderingContext2D, 0, 0, 100, 200, 100, '#0f0'); // value=200 > max=100
    // First rect = background (w=100). Second rect = fill (should be ≤100).
    expect(rects.length).toBeGreaterThanOrEqual(2);
    expect(rects[1]!.w).toBeLessThanOrEqual(100);
  });
});

describe('Phase 1 — bench indicators + engine team-wipe contract', () => {
  test('engine: hasBenchSurvivor + isTeamWiped track team state correctly across switches', () => {
    // Pure-engine sanity that the renderer's PKMN-enabled predicate
    // matches the canon helper.
    const aliveTeam = createTeam([
      createSide(CH1.GRUBLEAF!),
      createSide(CH1.SILTSKIP!),
    ]);
    expect(hasBenchSurvivor(aliveTeam)).toBe(true);
    expect(isTeamWiped(aliveTeam)).toBe(false);

    const benchDead = createTeam([
      createSide(CH1.GRUBLEAF!),
      { ...createSide(CH1.SILTSKIP!), hp: 0 },
    ]);
    expect(hasBenchSurvivor(benchDead)).toBe(false);
    expect(isTeamWiped(benchDead)).toBe(false);

    const wiped = createTeam([
      { ...createSide(CH1.GRUBLEAF!), hp: 0 },
      { ...createSide(CH1.SILTSKIP!), hp: 0 },
    ]);
    expect(isTeamWiped(wiped)).toBe(true);
  });

  test('setActiveMember preserves the team shape (no member mutation, just active swap)', () => {
    const team = createTeam([
      createSide(CH1.GRUBLEAF!),
      createSide(CH1.SILTSKIP!),
    ]);
    const patched = { ...activeMon(team), hp: 1 };
    const next = setActiveMember(team, patched);
    expect(next.members.length).toBe(team.members.length);
    expect(next.active).toBe(team.active);
    expect(activeMon(next).hp).toBe(1);
  });
});

describe('legibility — ★/Call economy reads (bond-feel-polish #1-3)', () => {
  test('CALL row states the reason inline: unlocked but no ★ → "needs ★"; the ★=0 hint shows', () => {
    const scene = buildScene({
      playerParty: [createSide(CH1.GRUBLEAF!)],
      foeParty: [createSide(CH1.FLITPECK!)],
      catchBreathUnlocked: true, // Call available, but the mon starts at 0 ★
    });
    const ctx = stubCtx();
    scene.draw(ctx);
    const screen = ctx.texts.join('|');
    // Battle-UI tune: the rail keyword (CALLS, 32px) + its fine-print NOTE
    // ("needs ★") are now SEPARATE draws (32px tier ≠ fine-print tier).
    expect(screen).toContain('CALLS'); // the rail keyword
    expect(screen).toContain('needs'); // the inline reason (note)
    expect(screen).toContain('win a read to charge'); // the 0-★ micro-hint
    expect(screen.includes('MOMENTUM')).toBe(true); // the ★ pips are labelled
  });

  test('CALL row reads "locked" when Calls are not yet unlocked', () => {
    const scene = buildScene({
      playerParty: [createSide(CH1.GRUBLEAF!)],
      foeParty: [createSide(CH1.FLITPECK!)],
      catchBreathUnlocked: false,
    });
    const ctx = stubCtx();
    scene.draw(ctx);
    const screen = ctx.texts.join('|');
    expect(screen).toContain('CALLS'); // the rail keyword
    expect(screen).toContain('locked'); // the inline reason (note)
  });
});
