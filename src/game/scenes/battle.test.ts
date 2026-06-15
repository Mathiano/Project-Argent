// Regression: the battle scene used to crash on first render when a side
// referenced a CH1 move (THORN FLICK, GUST RAKE, HEADBUTT, ...) because
// the renderer reached into the LEGACY MOVES fixture instead of going
// through lookupMove (which also checks REGISTERED_MOVES). A real cold-
// start with a CH1 starter would freeze the canvas on the first menu
// frame — the user perceived it as "boots back to title".

import { describe, expect, test } from 'vitest';
import {
  SPECIES,
  activeMon,
  createBattleState,
  createSide,
  createTeam,
  loadDex,
  loadMoves,
  mulberry32,
  registerMoves,
  setActiveMember,
} from '../../engine';
import type {
  Action,
  BattleState,
  DexEntryJson,
  MoveJson,
  RNG,
  SideState,
} from '../../engine';
import ch1BatchData from '../../../docs/ch1-batch.json';
import movesData from '../../../docs/moves.json';
import { createBattleScene, degradeIntent, speedLabel, stanceCallout } from './battle';

// Stub CanvasRenderingContext2D — records every fillText so tests can
// assert what's on screen. Everything else is a no-op; we don't render
// pixels in Node.
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

// One-time CH1 move registration so lookupMove finds THORN FLICK etc.
registerMoves(loadMoves(movesData as MoveJson[]));
const CH1 = loadDex(ch1BatchData as DexEntryJson[], 13);

function ch1FoeAI(): (state: BattleState, rng: RNG) => Action {
  return (state, rng): Action => {
    void state;
    // Force a CH1 move (THORN FLICK is only in REGISTERED_MOVES) to
    // exercise the path that used to crash the renderer.
    void rng;
    return { kind: 'move', move: 'THORN FLICK', stance: 'A' };
  };
}

describe('battle scene — cold-start crash regression', () => {
  test('renders without throw when foe action references a CH1 (non-fixture) move', () => {
    const player = CH1.GRUBLEAF!;
    const foe = CH1.GRUBLEAF!;
    const state = createBattleState(
      createTeam([createSide(player)]),
      createTeam([createSide(foe)]),
    );

    const scene = createBattleScene({
      state,
      rng: mulberry32(1),
      chooseFoeAction: ch1FoeAI(),
      intro: [],
      catchBreathUnlocked: false,
      canRun: true,
      onResolve: () => {},
    });

    // Advance past intro+beginTurn so phase=menu and foeAction is set
    // to the CH1 move.
    scene.update?.(0.01);
    const ctx = stubCtx();
    expect(() => scene.draw(ctx)).not.toThrow();

    // Walking into the move menu also used to throw on the move list
    // (`MOVES[m]!` for THORN FLICK = undefined → .tier crash).
    scene.input?.('a'); // FIGHT
    expect(() => scene.draw(ctx)).not.toThrow();
  });

  test('CH1 starter (GRUBLEAF) species moves include non-fixture moves that need lookupMove', () => {
    // Sanity: the scenario this test guards actually exists in the data.
    const grubleaf = CH1.GRUBLEAF!;
    expect(grubleaf.moves).toContain('THORN FLICK');
    expect(grubleaf.moves).toContain('HEADBUTT');
  });
});

describe('battle menu — FIGHT must open the move list, NOT the Calls-locked dialog', () => {
  function makeWildScene(): ReturnType<typeof createBattleScene> {
    const player = CH1.GRUBLEAF!;
    const foe = CH1.FLITPECK!;
    const state = createBattleState(
      createTeam([createSide(player)]),
      createTeam([createSide(foe)]),
    );
    return createBattleScene({
      state,
      rng: mulberry32(1),
      chooseFoeAction: () => ({ kind: 'move', move: 'TACKLE', stance: 'G' }),
      // 2-line intro matches main.ts pushWildEncounter (`A wild X`, `appeared!`).
      intro: ['A wild FLITPECK', 'appeared!'],
      catchBreathUnlocked: false, // first wild battle — Calls locked
      canRun: true,
      onResolve: () => {},
    });
  }

  test('cold-start: A through 2-line intro lands at FIGHT; A opens move list (no Calls dialog)', () => {
    const scene = makeWildScene();
    const ctx = stubCtx();

    // Two A presses to clear the 2-line intro → beginTurn → phase=menu, cursor=0.
    scene.input?.('a');
    scene.input?.('a');
    // One A press should select FIGHT (cursor 0 default).
    scene.input?.('a');

    ctx.reset();
    scene.draw(ctx);
    // The move menu shows the player's moves down the left edge. If
    // FIGHT opened correctly we should see TACKLE listed. If the Calls-
    // locked dialog fired instead, we'd see "Calls unlock after" / "your
    // first win.".
    expect(ctx.texts.join('|')).toContain('TACKLE');
    expect(ctx.texts.join('|')).not.toContain('Calls unlock');
  });

  test('cursor skips the locked CALL row: DOWN from FIGHT lands on RUN, not CALL', () => {
    const scene = makeWildScene();
    const ctx = stubCtx();

    scene.input?.('a');
    scene.input?.('a');
    // DOWN from FIGHT must skip the greyed CALL row (Calls locked here)
    // and land on RUN. A then confirms RUN → "Got away safely!" dialog.
    scene.input?.('down');
    scene.input?.('a');

    ctx.reset();
    scene.draw(ctx);
    const screen = ctx.texts.join('|');
    expect(screen).toContain('Got away safely');
    expect(screen).not.toContain('Calls unlock');
  });

  test('START key acts as a second confirm — does NOT shortcut to CALL', () => {
    // Regression: an old START handler forced menuCursor=1 and dispatched
    // A, surfacing the Calls-locked dialog when the user thought they
    // were confirming FIGHT. START should now just confirm the focused
    // row (FIGHT by default → move list).
    const scene = makeWildScene();
    const ctx = stubCtx();

    // Use START to advance the intro and confirm FIGHT.
    scene.input?.('start');
    scene.input?.('start');
    scene.input?.('start');

    ctx.reset();
    scene.draw(ctx);
    const screen = ctx.texts.join('|');
    expect(screen).toContain('TACKLE');
    expect(screen).not.toContain('Calls unlock');
  });
});

describe('battle move menu — A commits the highlighted move; SELECT cycles stance', () => {
  function driveToMoveList(onResolve: (w: 'player' | 'foe') => void = () => {}): {
    scene: ReturnType<typeof createBattleScene>;
    foeMove: { kind: 'move'; move: string; stance: 'A' | 'G' | 'F' };
  } {
    const player = CH1.GRUBLEAF!;
    const foe = CH1.FLITPECK!;
    const state = createBattleState(
      createTeam([createSide(player)]),
      createTeam([createSide(foe)]),
    );
    const foeMove = { kind: 'move' as const, move: 'TACKLE', stance: 'G' as const };
    const scene = createBattleScene({
      state,
      rng: mulberry32(1),
      chooseFoeAction: () => foeMove,
      intro: ['A wild FLITPECK', 'appeared!'],
      catchBreathUnlocked: false,
      canRun: true,
      onResolve,
    });
    // 2 A's intro, 1 A confirms FIGHT → phase=move.
    scene.input?.('a');
    scene.input?.('a');
    scene.input?.('a');
    return { scene, foeMove };
  }

  test('pressing A on the move list commits the highlighted move (phase leaves move; resolve runs)', () => {
    const { scene } = driveToMoveList();
    const ctx = stubCtx();

    // Sanity: we're in the move list.
    ctx.reset();
    scene.draw(ctx);
    expect(ctx.texts.join('|')).toContain('TACKLE');

    // Press A to commit TACKLE → phase=resolve. drainResolve presses A
    // again to flush via skipResolve (no hold engaged yet), then ticks
    // briefly to let finishResolve → beginTurn / end-text settle.
    scene.input?.('a');
    drainResolve(scene);

    ctx.reset();
    scene.draw(ctx);
    const screen = ctx.texts.join('|');
    // After commit + resolve + next-turn beginTurn, the menu (or end
    // text) is back on screen — TACKLE should NOT still be drawn as
    // the cursor-prefixed move-list row. If A had been silently
    // dropped, we'd still be staring at "> TACKLE" with no progress.
    expect(screen).not.toContain('> TACKLE');
    // We expect either the FIGHT menu again, or end text.
    expect(screen.includes('FIGHT') || screen.includes('Press A')).toBe(true);
  });

  test('pressing A in the move list with a CH1 (registered-only) move still commits — no silent drop', () => {
    // GRUBLEAF has THORN FLICK (only in REGISTERED_MOVES, not LEGACY MOVES).
    // The earlier lookupMove fix means this should not throw; here we
    // verify A on THORN FLICK doesn't silently drop either.
    const { scene } = driveToMoveList();
    // Move cursor down once to land on THORN FLICK (GRUBLEAF moves order:
    // TACKLE, THORN FLICK, LEAF LASH, HEADBUTT).
    scene.input?.('down');
    scene.input?.('a');
    drainResolve(scene);

    const ctx = stubCtx();
    scene.draw(ctx);
    const screen = ctx.texts.join('|');
    expect(screen).not.toContain('> THORN FLICK');
  });

  test('SELECT in the move list cycles stance A → G → F → A (visible in the stance badge label)', () => {
    const { scene } = driveToMoveList();
    const ctx = stubCtx();

    ctx.reset();
    scene.draw(ctx);
    // Default stance is A (AGGR). The UI helper draws STANCE_NAME[stance]
    // — for 'A' that's "AGGR".
    expect(ctx.texts).toContain('AGGR');

    scene.input?.('select');
    ctx.reset();
    scene.draw(ctx);
    expect(ctx.texts).toContain('GUARD');

    scene.input?.('select');
    ctx.reset();
    scene.draw(ctx);
    expect(ctx.texts).toContain('FLUID');

    scene.input?.('select');
    ctx.reset();
    scene.draw(ctx);
    expect(ctx.texts).toContain('AGGR');
  });
});

describe('battle move menu — fits a FULL moveset (no spill off the panel)', () => {
  // Evolved mons carry up to 8 moves; GALEHAWK has 6. Build a scene with
  // a custom moveset and assert the renderer shows them all (window + scroll).
  function sceneWithMoves(moves: readonly string[]): ReturnType<typeof createBattleScene> {
    const player = { ...CH1.GALEHAWK!, moves };
    const state = createBattleState(
      createTeam([createSide(player)]),
      createTeam([createSide(CH1.FLITPECK!)]),
    );
    return createBattleScene({
      state,
      rng: mulberry32(1),
      chooseFoeAction: () => ({ kind: 'move', move: 'TACKLE', stance: 'G' }),
      intro: [],
      catchBreathUnlocked: false,
      canRun: true,
      onResolve: () => {},
    });
  }

  test('a 5-move mon renders ALL FIVE moves on one screen (the bug: 5th was sliced)', () => {
    const moves = ['TACKLE', 'GUST RAKE', 'WING CUT', 'HEADBUTT', 'DIVE BOMB'];
    const scene = sceneWithMoves(moves);
    scene.input?.('a'); // FIGHT → move list
    const ctx = stubCtx();
    scene.draw(ctx);
    const screen = ctx.texts.join('|');
    for (const m of moves) expect(screen).toContain(m);
  });

  test('a 6-move mon windows the list + scrolls to reveal the rest (no spill)', () => {
    const moves = ['TACKLE', 'GUST RAKE', 'WING CUT', 'HEADBUTT', 'DIVE BOMB', 'SCRATCH'];
    const scene = sceneWithMoves(moves);
    scene.input?.('a'); // FIGHT → move list
    let ctx = stubCtx();
    scene.draw(ctx);
    // The 6th is off-window initially (window of 5) + a ▼ indicator shows.
    expect(ctx.texts.join('|')).not.toContain('SCRATCH');
    expect(ctx.texts.join('|')).toContain('▼');
    // Scroll down past the window to reveal the 6th.
    for (let i = 0; i < 5; i += 1) scene.input?.('down');
    ctx = stubCtx();
    scene.draw(ctx);
    expect(ctx.texts.join('|')).toContain('SCRATCH');
  });
});

describe('intent reliability ramp — degradeIntent (honest-partial model)', () => {
  const mv = (stance: 'A' | 'G' | 'F'): Action => ({ kind: 'move', move: 'TACKLE', stance });

  test('HONEST shows the EXACT stance in plain language', () => {
    expect(degradeIntent(mv('A'), 'GALEHAWK', 'honest', mulberry32(1)).line).toBe(
      'GALEHAWK attacks aggressively',
    );
    expect(degradeIntent(mv('G'), 'GALEHAWK', 'honest', mulberry32(1)).line).toBe('GALEHAWK braces');
    expect(degradeIntent(mv('F'), 'GALEHAWK', 'honest', mulberry32(1)).line).toBe(
      'GALEHAWK strikes with agility',
    );
  });

  test('a non-stance action (resting) reads plainly at every tier except opaque', () => {
    const rest: Action = { kind: 'rest' };
    expect(degradeIntent(rest, 'FLITPECK', 'honest', mulberry32(1)).line).toBe('FLITPECK is resting');
    expect(degradeIntent(rest, 'FLITPECK', 'ambiguous', mulberry32(1)).line).toBe(
      'FLITPECK is resting',
    );
    expect(degradeIntent(rest, 'FLITPECK', 'opaque', mulberry32(1)).line).toBeNull();
  });

  test('OPAQUE shows nothing — a blank line (pure cold read)', () => {
    expect(degradeIntent(mv('G'), 'FALKNER', 'opaque', mulberry32(1)).line).toBeNull();
  });

  test('AMBIGUOUS narrows to a hint that ALWAYS contains the true stance (never lies)', () => {
    const allows: Record<string, ReadonlyArray<'A' | 'G' | 'F'>> = {
      'intends to attack': ['A', 'F'],
      'looks focused': ['G', 'F'],
      'is hard to read': ['A', 'G'],
    };
    const rng = mulberry32(7);
    for (const truth of ['A', 'G', 'F'] as const) {
      const seen = new Set<string>();
      for (let i = 0; i < 300; i += 1) {
        const hint = degradeIntent(mv(truth), 'X', 'ambiguous', rng).line!.replace('X ', '');
        expect(allows[hint]).toBeDefined(); // it's one of the three honest hints
        expect(allows[hint]).toContain(truth); // and it NEVER excludes the true stance
        seen.add(hint);
      }
      // Each true stance is reachable by exactly TWO hints — both must appear,
      // so no hint collapses back into a perfect (1:1) tell.
      expect(seen.size).toBe(2);
    }
  });

  test('AMBIGUOUS hints are genuinely 50/50 — each hint comes from BOTH stances in its pair', () => {
    const rng = mulberry32(11);
    const sources: Record<string, Set<string>> = {
      'intends to attack': new Set(),
      'looks focused': new Set(),
      'is hard to read': new Set(),
    };
    for (const truth of ['A', 'G', 'F'] as const) {
      for (let i = 0; i < 300; i += 1) {
        const hint = degradeIntent(mv(truth), 'X', 'ambiguous', rng).line!.replace('X ', '');
        sources[hint]!.add(truth);
      }
    }
    expect(sources['intends to attack']).toEqual(new Set(['A', 'F']));
    expect(sources['looks focused']).toEqual(new Set(['G', 'F']));
    expect(sources['is hard to read']).toEqual(new Set(['A', 'G']));
  });

  test('degradeIntent never mutates the action it is handed', () => {
    const action = mv('A');
    degradeIntent(action, 'X', 'ambiguous', mulberry32(3));
    expect(action).toEqual({ kind: 'move', move: 'TACKLE', stance: 'A' });
  });
});

function intentScene(
  reliability: 'honest' | 'ambiguous' | 'opaque',
): ReturnType<typeof createBattleScene> {
  // Foe FLITPECK always commits TACKLE in GUARD ('G' → intent "braces",
  // resolution "braces with TACKLE!").
  const state = createBattleState(
    createTeam([createSide(CH1.GRUBLEAF!)]),
    createTeam([createSide(CH1.FLITPECK!)]),
  );
  return createBattleScene({
    state,
    rng: mulberry32(1),
    chooseFoeAction: () => ({ kind: 'move', move: 'TACKLE', stance: 'G' }),
    intro: [],
    catchBreathUnlocked: false,
    canRun: true,
    intentReliability: reliability,
    onResolve: () => {},
  });
}

describe('intent reliability ramp — the FOE INTENT bar (plain language, precision degraded)', () => {
  test('HONEST: the bar shows the EXACT stance in plain language', () => {
    const scene = intentScene('honest');
    scene.update?.(0.01); // → menu, foeAction committed, shownIntent computed
    const ctx = stubCtx();
    scene.draw(ctx);
    const screen = ctx.texts.join('|');
    expect(screen).toContain('FOE INTENT:');
    expect(screen).toContain('FLITPECK braces'); // exact stance, full clarity
  });

  test('AMBIGUOUS: the bar shows an honest narrow-to-2 hint, NOT the exact stance', () => {
    const scene = intentScene('ambiguous');
    scene.update?.(0.01);
    const ctx = stubCtx();
    scene.draw(ctx);
    const screen = ctx.texts.join('|');
    // The hint for a GUARD foe is one of the two whose pair contains G.
    expect(screen).toMatch(/looks focused|is hard to read/);
    expect(screen).not.toContain('FLITPECK braces'); // the exact stance is NOT revealed
  });

  test('OPAQUE: the bar shows a blank dash — no read at all', () => {
    const scene = intentScene('opaque');
    scene.update?.(0.01);
    const ctx = stubCtx();
    scene.draw(ctx);
    const screen = ctx.texts.join('|');
    expect(screen).toContain('FOE INTENT:');
    expect(screen).toContain('———'); // blank indicator — no read at all
    // No intent phrasing leaks (the foe's NAME still shows on its HP panel,
    // so we assert on the stance/hint vocabulary, not the species name).
    expect(screen).not.toMatch(
      /braces|attacks aggressively|strikes with agility|looks focused|hard to read|intends to attack/,
    );
  });
});

describe('intent reliability ramp — resolution always confirms the stance (the teaching loop)', () => {
  // After the round resolves, the log names the foe's committed stance in plain
  // language at EVERY tier — so the player learns whether their read was right.
  for (const reliability of ['honest', 'ambiguous', 'opaque'] as const) {
    test(`${reliability}: resolution confirms stance AND move ("FLITPECK braces with TACKLE!")`, () => {
      const scene = intentScene(reliability);
      scene.update?.(0.01); // → menu
      scene.input?.('a'); // FIGHT → move list
      scene.input?.('a'); // commit first move → resolve
      const seen: string[] = [];
      // Engage each held beat with a FULL update BEFORE releasing — a short
      // tick leaves the beat un-held, so an early A would skipResolve past it.
      for (let i = 0; i < 12; i += 1) {
        scene.update?.(1.0); // advance to / hold the next consequential beat
        const ctx = stubCtx();
        scene.draw(ctx);
        seen.push(...ctx.texts);
        scene.input?.('a'); // release the hold → auto-play resumes
      }
      // The confirmation names the STANCE (the read outcome) AND the MOVE
      // (what landed) — neither feedback piece is lost.
      expect(seen.join('|')).toContain('FLITPECK braces with TACKLE!');
    });
  }
});

describe('intent reliability ramp — engine integrity (the display NEVER touches resolution)', () => {
  // A foe AI that CONSUMES the engine rng each turn: if the display feint
  // leaked into opts.rng, the ambiguous run's foe stances would diverge and
  // damage would differ. Identical final state ⇒ the engine stream is intact.
  function rngFoe(): (s: BattleState, rng: RNG) => Action {
    return (_s, rng): Action => ({
      kind: 'move',
      move: 'TACKLE',
      stance: rng.next() < 0.5 ? 'A' : 'G',
    });
  }

  function runBattle(reliability: 'honest' | 'ambiguous'): BattleState | null {
    let final: BattleState | null = null;
    const state = createBattleState(
      createTeam([createSide(CH1.GRUBLEAF!)]),
      createTeam([createSide(CH1.FLITPECK!)]),
    );
    const scene = createBattleScene({
      state,
      rng: mulberry32(99),
      chooseFoeAction: rngFoe(),
      intro: [],
      catchBreathUnlocked: false,
      canRun: false,
      intentReliability: reliability,
      onResolve: (_w, fs) => {
        final = fs;
      },
    });
    scene.update?.(0.01);
    for (let i = 0; i < 80 && final === null; i += 1) {
      scene.input?.('a'); // FIGHT → move list
      scene.input?.('a'); // commit first move
      drainResolve(scene);
    }
    return final;
  }

  test('HONEST and AMBIGUOUS resolve to a byte-identical final state', () => {
    const honest = runBattle('honest');
    const ambiguous = runBattle('ambiguous');
    expect(honest).not.toBeNull();
    expect(ambiguous).not.toBeNull();
    const vitals = (s: BattleState): unknown =>
      (['player', 'foe'] as const).map((side) =>
        s[side].members.map((m) => ({ hp: m.hp, st: m.st, momentum: m.momentum })),
      );
    expect(vitals(ambiguous!)).toEqual(vitals(honest!));
  });
});

// ---- Phase 0 gap coverage ---------------------------------------------------
// One complete pass over the battle-input layer. Every gap surfaced in the
// kickoff is pinned here: CALL paths, RUN/STAY paths, move cursor wrap,
// winded/affordability rejection, B-back, forced rest, resolve A-skip,
// end-text A-dispatch, and the B-on-dialog dismissable/forced split.

interface SceneBuildOpts {
  readonly catchBreathUnlocked?: boolean;
  readonly canRun?: boolean;
  readonly playerPatch?: Partial<SideState>;
  readonly intro?: readonly string[];
  readonly foeAction?: Action;
  readonly onResolve?: (w: 'player' | 'foe') => void;
}

function buildScene(opts: SceneBuildOpts = {}): {
  scene: ReturnType<typeof createBattleScene>;
  resolved: { winner: 'player' | 'foe' | null };
} {
  const player = CH1.GRUBLEAF!;
  const foe = CH1.FLITPECK!;
  let state = createBattleState(
    createTeam([createSide(player)]),
    createTeam([createSide(foe)]),
  );
  if (opts.playerPatch) {
    const patched: SideState = { ...activeMon(state.player), ...opts.playerPatch };
    state = { ...state, player: setActiveMember(state.player, patched) };
  }
  const resolved: { winner: 'player' | 'foe' | null } = { winner: null };
  const scene = createBattleScene({
    state,
    rng: mulberry32(1),
    chooseFoeAction: () => opts.foeAction ?? { kind: 'move', move: 'TACKLE', stance: 'G' },
    intro: opts.intro ?? [],
    catchBreathUnlocked: opts.catchBreathUnlocked ?? false,
    canRun: opts.canRun ?? true,
    onResolve: (w) => {
      resolved.winner = w;
      opts.onResolve?.(w);
    },
  });
  return { scene, resolved };
}

function drainResolve(scene: ReturnType<typeof createBattleScene>): void {
  // Resolve now HOLDS on consequential events (commit, dodge/opening/
  // counter/clash, eff-≠-1 strike, faint, break) until A/Start. A press
  // when not held still flushes via skipResolve. For tests we want a
  // deterministic, fast drain — press A first (no hold yet, so this
  // triggers skipResolve and flushes the round in one go), then tick
  // briefly to let the subsequent setText / beginTurn settle.
  scene.input?.('a');
  for (let i = 0; i < 5; i += 1) scene.update?.(0.1);
}

describe('battle menu — CALL paths (Call-menu sprint: submenu + shout + exit)', () => {
  test('CALL opens a SUBMENU (does not instant-fire); the full Call set shows', () => {
    const { scene } = buildScene({
      catchBreathUnlocked: true,
      playerPatch: { momentum: 1, st: 30 },
    });
    scene.input?.('down'); // FIGHT → CALL row
    scene.input?.('a'); // open the Call submenu
    const ctx = stubCtx();
    scene.draw(ctx);
    const screen = ctx.texts.join('|');
    // The whole set is visible (what you grow into), with ★ costs.
    expect(screen).toContain('Catch Breath');
    expect(screen).toContain('Recover');
    expect(screen).toContain('Dodge');
    expect(screen).toContain('★1');
    // It did NOT instant-fire (no resolve log line like "catch your breath").
    expect(screen).not.toContain('catch your breath');
  });

  test('B in the Call submenu backs out to the battle menu (fixes the misclick trap)', () => {
    const { scene } = buildScene({ catchBreathUnlocked: true, playerPatch: { momentum: 1 } });
    scene.input?.('down');
    scene.input?.('a'); // submenu
    scene.input?.('b'); // exit
    const ctx = stubCtx();
    scene.draw(ctx);
    expect(ctx.texts.join('|')).toContain('FIGHT'); // back at the battle menu
  });

  test('committing Catch Breath shows a NAMED trainer shout, then applies +ST', () => {
    const { scene } = buildScene({
      catchBreathUnlocked: true,
      playerPatch: { momentum: 1, st: 30 },
    });
    scene.input?.('down');
    scene.input?.('a'); // submenu (cursor on Catch Breath)
    scene.input?.('a'); // fire → shout line
    const ctx = stubCtx();
    scene.draw(ctx);
    const shout = ctx.texts.join('|');
    // The shout names the mon (GRUBLEAF) and is the trainer command.
    expect(shout).toContain('GRUBLEAF');
    expect(shout).toContain('catch your breath');

    // Advance the shout → commit → resolve applies the +ST effect.
    scene.input?.('a');
    drainResolve(scene);
    ctx.reset();
    scene.draw(ctx);
    // Back at the FIGHT menu after the round; the Call resolved.
    expect(ctx.texts.join('|')).toContain('FIGHT');
  });

  test('an unaffordable Catch Breath (★0) greys + toasts on A — no commit', () => {
    const { scene } = buildScene({
      catchBreathUnlocked: true,
      playerPatch: { momentum: 0 },
    });
    scene.input?.('down');
    scene.input?.('a'); // submenu — Catch Breath greyed (unaffordable)
    scene.input?.('a'); // A on it → "not enough ★" toast, NOT a commit
    const ctx = stubCtx();
    scene.draw(ctx);
    const screen = ctx.texts.join('|');
    expect(screen).toContain('Not enough ★');
    expect(screen).not.toContain('catch your breath');

    // Dismiss → back in the submenu (not committed).
    scene.input?.('b');
    ctx.reset();
    scene.draw(ctx);
    expect(ctx.texts.join('|')).toContain('Catch Breath');
  });

  test('design-only Calls render greyed + LOCKED (cursor skips them, stays on Catch Breath)', () => {
    const { scene } = buildScene({ catchBreathUnlocked: true, playerPatch: { momentum: 1 } });
    scene.input?.('down');
    scene.input?.('a'); // submenu
    // DOWN repeatedly must keep the cursor on the only unlocked Call
    // (Catch Breath) — the locked ones are skipped.
    scene.input?.('down');
    scene.input?.('down');
    const ctx = stubCtx();
    scene.draw(ctx);
    const screen = ctx.texts.join('|');
    expect(screen).toContain('LOCKED'); // locked Calls labelled
    // The cursor marker '>' sits on Catch Breath (it's drawn as "> Catch Breath...").
    expect(screen).toContain('>Catch Breath');
  });

  test('Catch Breath resolves with a VISIBLE stamina effect (+50) — legibility (S4)', () => {
    const { scene } = buildScene({
      catchBreathUnlocked: true,
      playerPatch: { momentum: 1, st: 30 },
    });
    scene.input?.('down'); // CALL
    scene.input?.('a'); // submenu
    scene.input?.('a'); // Catch Breath → shout
    scene.input?.('a'); // advance shout → commit catchBreath → resolve
    // The catchBreath event now HOLDS (consequential). Auto-advance via
    // update() to ENGAGE each hold (an early A would skipResolve past it),
    // draw/check, then release the hold with A and continue.
    const ctx = stubCtx();
    let found = false;
    for (let i = 0; i < 25 && !found; i += 1) {
      for (let j = 0; j < 5; j += 1) scene.update?.(0.5); // advance to the next HELD beat
      ctx.reset();
      scene.draw(ctx);
      const screen = ctx.texts.join('|');
      if (screen.includes('catches its breath') && screen.includes('50')) found = true;
      else scene.input?.('a'); // release this hold, continue to the next
    }
    expect(found).toBe(true);
  });
});

describe('battle menu — RUN / STAY paths', () => {
  test('A on RUN (canRun true) shows "Got away safely!" then onResolve("foe")', () => {
    const { scene, resolved } = buildScene({ canRun: true });
    // CALL locked → DOWN from FIGHT skips it, lands on RUN.
    scene.input?.('down');
    scene.input?.('a');
    const ctx = stubCtx();
    scene.draw(ctx);
    expect(ctx.texts.join('|')).toContain('Got away safely');
    // Forced dialog — A advances; onResolve fires.
    scene.input?.('a');
    expect(resolved.winner).toBe('foe');
  });

  test('A on STAY (canRun false) shows "No running from a rival!" dialog — dismissable', () => {
    const { scene, resolved } = buildScene({ canRun: false });
    scene.input?.('down');
    scene.input?.('a');
    const ctx = stubCtx();
    scene.draw(ctx);
    expect(ctx.texts.join('|')).toContain('No running');
    // Not onResolve — battle continues.
    expect(resolved.winner).toBeNull();
    // B dismisses → back to menu.
    scene.input?.('b');
    ctx.reset();
    scene.draw(ctx);
    expect(ctx.texts.join('|')).toContain('FIGHT');
  });
});

describe('battle move list — cursor wrap + rejection paths + B-back', () => {
  test('UP wraps from move 0 to the last move; DOWN wraps from last to 0', () => {
    const { scene } = buildScene();
    scene.input?.('a'); // FIGHT
    // GRUBLEAF: ['TACKLE', 'THORN FLICK', 'LEAF LASH', 'HEADBUTT']
    scene.input?.('up'); // wraps to index 3 → HEADBUTT
    const ctx = stubCtx();
    scene.draw(ctx);
    expect(ctx.texts.some((t) => t.startsWith('>HEADBUTT'))).toBe(true);
    scene.input?.('down'); // wraps back to index 0 → TACKLE
    ctx.reset();
    scene.draw(ctx);
    expect(ctx.texts.some((t) => t.startsWith('>TACKLE'))).toBe(true);
  });

  test('A on a heavy move while winded (ST ≤ 25) surfaces "Too winded" — dismissable', () => {
    // CH1 starters at lvl 13 don't have heavies yet, so we test the
    // winded-locks-heavy rule with the legacy EMBERCUB (FLAME RUSH = heavy).
    let state = createBattleState(
      createTeam([createSide(SPECIES.EMBERCUB!)]),
      createTeam([createSide(SPECIES.AQUAFIN!)]),
    );
    const patched: SideState = { ...activeMon(state.player), st: 25 };
    state = { ...state, player: setActiveMember(state.player, patched) };
    const scene = createBattleScene({
      state,
      rng: mulberry32(1),
      chooseFoeAction: () => ({ kind: 'move', move: 'TACKLE', stance: 'G' }),
      intro: [],
      catchBreathUnlocked: false,
      canRun: true,
      onResolve: () => {},
    });
    scene.input?.('a'); // FIGHT → move list
    // EMBERCUB moves: TACKLE, EMBER SNAP, FLAME RUSH (heavy at index 2).
    scene.input?.('down');
    scene.input?.('down');
    scene.input?.('a'); // confirm FLAME RUSH while winded → "Too winded"
    const ctx = stubCtx();
    scene.draw(ctx);
    expect(ctx.texts.join('|')).toContain('Too winded');
    // Dismissable — B backs out to the move list.
    scene.input?.('b');
    ctx.reset();
    scene.draw(ctx);
    expect(ctx.texts.some((t) => t.startsWith('>FLAME RUSH'))).toBe(true);
  });

  test('A on an unaffordable move surfaces "Not enough stamina!" — dismissable', () => {
    // GRUBLEAF moves: TACKLE(12), THORN FLICK(12), LEAF LASH(22), HEADBUTT(22).
    // ST=15 keeps the lights affordable (no auto-rest) but a mid is over.
    // Cursor down twice to a mid move (LEAF LASH); A → "Not enough stamina".
    const { scene } = buildScene({ playerPatch: { st: 15 } });
    scene.input?.('a'); // FIGHT
    scene.input?.('down'); // → THORN FLICK
    scene.input?.('down'); // → LEAF LASH (mid, 22 ST)
    scene.input?.('a'); // confirm → unaffordable
    const ctx = stubCtx();
    scene.draw(ctx);
    expect(ctx.texts.join('|')).toContain('Not enough stamina');
    // B dismisses → back to move list.
    scene.input?.('b');
    ctx.reset();
    scene.draw(ctx);
    expect(ctx.texts.some((t) => t.startsWith('>LEAF LASH'))).toBe(true);
  });

  test('B in the move list returns to the menu', () => {
    const { scene } = buildScene();
    scene.input?.('a'); // FIGHT → move
    scene.input?.('b'); // back
    const ctx = stubCtx();
    scene.draw(ctx);
    // FIGHT/CALL/RUN visible again.
    const screen = ctx.texts.join('|');
    expect(screen).toContain('FIGHT');
    expect(screen).not.toContain('>TACKLE');
  });
});

describe('battle resolve + end-text', () => {
  test('A in resolve phase skips the event animation (drains to next turn immediately)', () => {
    const { scene } = buildScene();
    scene.input?.('a'); // FIGHT
    scene.input?.('a'); // TACKLE — commit → resolve

    // Don't tick; instead press A — skipResolve should drain events
    // synchronously and either return to menu or end the battle.
    scene.input?.('a');

    const ctx = stubCtx();
    scene.draw(ctx);
    const screen = ctx.texts.join('|');
    // Either back at FIGHT (next turn) or end-text — no longer "> TACKLE".
    expect(screen).not.toContain('> TACKLE');
    expect(screen.includes('FIGHT') || screen.includes('Press A')).toBe(true);
  });

  test('A on end-text dispatches onResolve (battle leaves the scene)', () => {
    // Player at 1 HP attacks Aggressive — foe Guards (default foeAction
    // in buildScene) → counter reflects 0.5×preMit, KOs the 1-HP player.
    const { scene, resolved } = buildScene({ playerPatch: { hp: 1 } });
    scene.input?.('a'); // FIGHT
    scene.input?.('a'); // TACKLE — counter KOs player
    scene.input?.('a'); // skipResolve → finishResolve → setText("Your team fell.","Press A to continue.")

    const ctx = stubCtx();
    scene.draw(ctx);
    expect(ctx.texts.join('|')).toContain('Your team fell');

    // End text is 2 lines — 2 A presses to advance past it, THEN onResolve fires.
    scene.input?.('a');
    scene.input?.('a');
    expect(resolved.winner).toBe('foe');
  });
});

describe('battle forced action (exhausted)', () => {
  test('beginTurn on an exhausted active mon auto-commits rest (player never sees menu)', () => {
    const { scene } = buildScene({ playerPatch: { st: 0, exhausted: true } });
    // No intro → beginTurn fires at scene init. forcedAction returns rest.
    // commit({kind:'rest'}) puts phase='resolve' immediately. No menu draws.
    const ctx = stubCtx();
    scene.draw(ctx);
    const screen = ctx.texts.join('|');
    // No FIGHT menu — we're in resolve, drawing the log instead.
    expect(screen).not.toContain('> FIGHT');
    expect(screen).not.toContain('> TACKLE');
  });
});

describe('resolve cadence + stance labels — legibility pass', () => {
  test('EVERY strike holds (turn-order beat: faster mon visibly first, then slower)', () => {
    const { scene } = buildScene({
      foeAction: { kind: 'move', move: 'TACKLE', stance: 'G' },
    });
    scene.input?.('a'); // FIGHT
    scene.input?.('a'); // TACKLE → resolve
    scene.update?.(1.0);
    const ctx = stubCtx();
    scene.draw(ctx);
    // Held on the first consequential event (commit). Player's commit
    // line is on the log; the foe's commit hasn't fired yet.
    expect(ctx.texts.join('|')).toContain('used TACKLE');
  });

  // Helper: drive an EMBERCUB-vs-AQUAFIN scenario to a specific stance-
  // interaction event, sampling the log WHILE still in resolve. We
  // advance through holds one-by-one without skipResolve so the log
  // accumulates the lines we want to see.
  function driveStanceScenario(
    _playerStance: 'A' | 'G' | 'F',
    foeStance: 'A' | 'G' | 'F',
    playerSpecies: import('../../engine').Species,
    foeSpecies: import('../../engine').Species,
    rngSeed: number,
  ): ReturnType<typeof createBattleScene> {
    return createBattleScene({
      state: createBattleState(
        createTeam([createSide(playerSpecies)]),
        createTeam([createSide(foeSpecies)]),
      ),
      rng: mulberry32(rngSeed),
      chooseFoeAction: () => ({ kind: 'move', move: 'TACKLE', stance: foeStance }),
      intro: [],
      catchBreathUnlocked: false,
      canRun: true,
      onResolve: () => {},
    });
  }
  function pickStance(scene: ReturnType<typeof createBattleScene>, st: 'A' | 'G' | 'F'): void {
    scene.input?.('a'); // FIGHT
    if (st === 'G') scene.input?.('select');
    else if (st === 'F') {
      scene.input?.('select');
      scene.input?.('select');
    }
    scene.input?.('a'); // commit TACKLE/<stance>
  }
  function logContains(scene: ReturnType<typeof createBattleScene>, target: string): boolean {
    const ctx = stubCtx();
    scene.draw(ctx);
    return ctx.texts.join('|').includes(target);
  }
  // Advance through holds + cadence, sampling the on-screen log every
  // step. Returns true when the target string surfaces (the test's
  // assertion is "this stance label appears in the log at some point
  // during resolve"). Stops if max iterations elapse without a match.
  function advanceUntilLog(
    scene: ReturnType<typeof createBattleScene>,
    target: string,
    maxIters: number,
  ): boolean {
    for (let i = 0; i < maxIters; i += 1) {
      if (logContains(scene, target)) return true;
      scene.update?.(1.0);
      scene.input?.('a');
    }
    return logContains(scene, target);
  }

  test('explanatory callout on counter: "COUNTER! ... GUARD turns ..." when G defends vs A', () => {
    const scene = driveStanceScenario('G', 'A', SPECIES.EMBERCUB!, SPECIES.AQUAFIN!, 42);
    pickStance(scene, 'G');
    expect(advanceUntilLog(scene, 'COUNTER', 12)).toBe(true);
  });

  test('stance label on opening: "FLUID slips past GUARD" when F attacks G', () => {
    const scene = driveStanceScenario('F', 'G', SPECIES.AQUAFIN!, SPECIES.EMBERCUB!, 42);
    pickStance(scene, 'F');
    expect(advanceUntilLog(scene, 'FLUID slips past GUARD', 12)).toBe(true);
  });

  test('stance label on dodge: "FLUID dodged" when A attacks F and the speed roll lands', () => {
    const scene = createBattleScene({
      state: createBattleState(
        createTeam([createSide(SPECIES.AQUAFIN!)]),
        createTeam([createSide(SPECIES.EMBERCUB!)]),
      ),
      // First draw: variance. Second: dodge roll. Force a low dodge
      // roll so the dodge always succeeds (p ≈ 0.9 from speed ratio).
      rng: {
        next: (() => {
          const seq = [0.5, 0.05, 0.5, 0.05, 0.5, 0.05, 0.5, 0.05];
          let i = 0;
          return () => seq[i++ % seq.length]!;
        })(),
      },
      chooseFoeAction: () => ({ kind: 'move', move: 'TACKLE', stance: 'F' }),
      intro: [],
      catchBreathUnlocked: false,
      canRun: true,
      onResolve: () => {},
    });
    pickStance(scene, 'A');
    expect(advanceUntilLog(scene, 'DODGE', 12)).toBe(true);
  });

  test('explanatory callout when an Aggressive strike LANDS on Fluid (no dodge): "too slow to evade"', () => {
    // A-vs-F where the dodge roll FAILS (forced high) → the strike lands
    // and the callout names the rule: the attacker was faster.
    const scene = createBattleScene({
      state: createBattleState(
        createTeam([createSide(SPECIES.AQUAFIN!)]),
        createTeam([createSide(SPECIES.EMBERCUB!)]),
      ),
      // [variance, dodge-roll] repeating — dodge roll 0.99 > p ⇒ no dodge.
      rng: {
        next: (() => {
          const seq = [0.5, 0.99, 0.5, 0.99, 0.5, 0.99, 0.5, 0.99];
          let i = 0;
          return () => seq[i++ % seq.length]!;
        })(),
      },
      chooseFoeAction: () => ({ kind: 'move', move: 'TACKLE', stance: 'F' }),
      intro: [],
      catchBreathUnlocked: false,
      canRun: true,
      onResolve: () => {},
    });
    pickStance(scene, 'A');
    expect(advanceUntilLog(scene, 'evade', 12)).toBe(true);
  });
});

describe('combat legibility (S1/S2) — pure callout + speed helpers', () => {
  test('stanceCallout names the rule for each triangle interaction', () => {
    expect(stanceCallout({ kind: 'counter' })).toContain('COUNTER');
    expect(stanceCallout({ kind: 'counter' })).toContain('GUARD');
    expect(stanceCallout({ kind: 'opening' })).toContain('OPENING');
    expect(stanceCallout({ kind: 'opening' })).toContain('FLUID');
    expect(stanceCallout({ kind: 'dodge' })).toContain('DODGE');
    expect(stanceCallout({ kind: 'dodge' })).toContain('faster');
    // Aggressive strike that LANDED on Fluid = failed dodge = "too slow".
    expect(stanceCallout({ kind: 'strike', attackerStance: 'A', defenderStance: 'F' })).toContain('too slow');
    // A normal strike (not A-vs-F) is not a triangle teaching moment.
    expect(stanceCallout({ kind: 'strike', attackerStance: 'A', defenderStance: 'G' })).toBeNull();
    expect(stanceCallout({ kind: 'strike' })).toBeNull();
  });

  test('speedLabel reflects the player-vs-foe speed matchup', () => {
    expect(speedLabel(120, 80)).toBe('YOU FASTER');
    expect(speedLabel(80, 120)).toBe('YOU SLOWER');
    expect(speedLabel(100, 100)).toBe('SPEED EVEN');
  });

  test('the speed indicator is drawn on the intent bar while choosing', () => {
    // GRUBLEAF vs FLITPECK — buildScene starts at the FIGHT menu, where
    // the intent bar (and the speed readout) render.
    const { scene } = buildScene();
    const ctx = stubCtx();
    scene.draw(ctx);
    const screen = ctx.texts.join('|');
    expect(/YOU FASTER|YOU SLOWER|SPEED EVEN/.test(screen)).toBe(true);
  });
});

describe('resolve cadence — auto-play pauses on consequential lines until A/Start', () => {
  test('auto-play stops at the first consequential event (commit log line); next tick does not advance', () => {
    const { scene } = buildScene();
    scene.input?.('a'); // FIGHT
    scene.input?.('a'); // TACKLE → phase=resolve, no hold yet, no events processed

    // Tick a single STEP_SEC. The first non-hold event (roundStart) is
    // applied, then the second (player's commit) is applied AND the
    // hold engages — auto-advance stops.
    scene.update?.(1.0);

    // Capture the log on screen at this paused state.
    const ctx = stubCtx();
    scene.draw(ctx);
    const before = ctx.texts.join('|');

    // Tick a LOT more — without input, the screen must not change.
    for (let i = 0; i < 30; i += 1) scene.update?.(1.0);

    ctx.reset();
    scene.draw(ctx);
    const after = ctx.texts.join('|');
    expect(after).toBe(before);
    // Sanity: the commit line did make it onto the log.
    expect(before).toContain('used TACKLE');
  });

  test('A on a held resolve releases just that hold; auto-play resumes (does NOT skip to end)', () => {
    const { scene } = buildScene();
    scene.input?.('a'); // FIGHT
    scene.input?.('a'); // TACKLE → resolve
    scene.update?.(1.0); // first hold (commit)

    // Release the hold — auto-play continues to the next event, which
    // for a non-clash A-vs-G round is the next commit (also held).
    scene.input?.('a');
    scene.update?.(1.0);

    const ctx = stubCtx();
    scene.draw(ctx);
    // We should be at the foe's commit (held) now — two commit log lines
    // on screen, but NOT yet finished (resolve hasn't called beginTurn).
    const screen = ctx.texts.join('|');
    expect(screen).toContain('GRUBLEAF used TACKLE');
    // The foe's commit line is now the plain-language stance confirmation
    // (honest-partial model) — GUARD → "braces with <move>!" (names stance AND
    // move; was "Foe FLITPECK used TACKLE").
    expect(screen).toContain('FLITPECK braces with TACKLE!');
    // Still in resolve phase: no FIGHT menu, no end-text yet.
    expect(screen).not.toContain('>FIGHT');
    expect(screen).not.toContain('Press A to continue');
  });

  test('A when NOT held flushes the rest fast (skipResolve), past every remaining event', () => {
    // Drive to a steady "between holds" state, then A flushes to end.
    const { scene } = buildScene();
    scene.input?.('a'); // FIGHT
    scene.input?.('a'); // TACKLE → resolve
    // No ticks yet → no hold engaged → A press triggers skipResolve.
    scene.input?.('a');

    // Settle.
    for (let i = 0; i < 5; i += 1) scene.update?.(0.1);

    const ctx = stubCtx();
    scene.draw(ctx);
    const screen = ctx.texts.join('|');
    // Resolve done; back at menu (or end-text on KO). Either way the
    // hold is gone and we're past resolve.
    expect(screen.includes('FIGHT') || screen.includes('Press A')).toBe(true);
  });
});

describe('B-on-dialog: dismissable backs out; forced is a no-op', () => {
  test('B on a forced/sequential dialog (intro) does nothing — A/Start advance only', () => {
    const { scene } = buildScene({
      intro: ['A wild FLITPECK', 'appeared!'],
    });
    // B at intro line 1 should do nothing — text stays.
    scene.input?.('b');
    const ctx = stubCtx();
    scene.draw(ctx);
    // Still seeing the intro text — not advanced to menu.
    expect(ctx.texts.join('|')).toContain('A wild FLITPECK');
    expect(ctx.texts.join('|')).not.toContain('FIGHT');
  });

  test('B on the unaffordable-Call dismissable toast backs out to the Call submenu', () => {
    // catchBreathUnlocked=true, momentum=0 → CALL → submenu → A on the
    // greyed Catch Breath = "Not enough ★" dismissable toast.
    const { scene } = buildScene({
      catchBreathUnlocked: true,
      playerPatch: { momentum: 0 },
    });
    scene.input?.('down'); // CALL row
    scene.input?.('a'); // open submenu
    scene.input?.('a'); // A on the unaffordable Catch Breath → toast
    let ctx = stubCtx();
    scene.draw(ctx);
    expect(ctx.texts.join('|')).toContain('Not enough ★');

    scene.input?.('b'); // dismiss → back to the submenu (its prior phase)
    ctx = stubCtx();
    scene.draw(ctx);
    expect(ctx.texts.join('|')).toContain('Catch Breath');
    expect(ctx.texts.join('|')).not.toContain('Not enough ★');
  });
});
