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
import { createBattleScene, degradeIntent, focusIntentTell, infoLevelToReliability, speedLabel, stanceCallout } from './battle';
import type { FocusIntentInfo } from './battle';

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

  test('the 2×3 move grid shows both pools at once (no windowing / no scroll)', () => {
    // Battle-UI 2b-1: the flat windowed list became a 2×3 grid — 4 ATTACKS +
    // 2 TECHNIQUES, all shown at once, so there is NO scroll indicator. GRUBLEAF
    // is a real 4+2 mon: TACKLE/THORN FLICK/LEAF LASH/HEADBUTT + SIPHON/ENTANGLE.
    const { scene } = buildScene();
    scene.input?.('a'); // FIGHT → the grid
    const ctx = stubCtx();
    scene.draw(ctx);
    const screen = ctx.texts.join('|');
    expect(screen).toContain('ATTACKS');
    expect(screen).toContain('TECHNIQUES');
    // Every move in both pools renders (no windowing hides any).
    for (const name of ['TACKLE', 'THORN FLICK', 'LEAF LASH', 'HEADBUTT', 'SIPHON', 'ENTANGLE']) {
      expect(ctx.texts.some((t) => t.includes(name))).toBe(true);
    }
    // No scroll indicators — the grid never windows.
    expect(screen).not.toContain('▼');
    expect(screen).not.toContain('▲');
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
  // The Calls increment — extra passthroughs for the new Call flows.
  readonly devUnlockAllCalls?: boolean;
  readonly foeFocusInfo?: FocusIntentInfo;
  readonly bench?: boolean; // add a 2nd player mon (for COME BACK)
}

function buildScene(opts: SceneBuildOpts = {}): {
  scene: ReturnType<typeof createBattleScene>;
  resolved: { winner: 'player' | 'foe' | null };
} {
  const player = CH1.GRUBLEAF!;
  const foe = CH1.FLITPECK!;
  const members = opts.bench ? [createSide(player), createSide(SPECIES.EMBERCUB!)] : [createSide(player)];
  let state = createBattleState(
    createTeam(members),
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
    ...(opts.devUnlockAllCalls ? { devUnlockAllCalls: true } : {}),
    ...(opts.foeFocusInfo ? { foeFocusInfo: opts.foeFocusInfo } : {}),
    onResolve: (w) => {
      resolved.winner = w;
      opts.onResolve?.(w);
    },
  });
  return { scene, resolved };
}

// ── The Calls increment — the four new player-Call FLOWS ─────────────────────
describe('The Calls increment — new player Call flows', () => {
  // Navigate FIGHT menu → CALL submenu → step callCursor to a target Call by name.
  function openCallOn(scene: ReturnType<typeof createBattleScene>, name: string): RecordingCtx {
    scene.input?.('down'); // CALL row
    scene.input?.('a'); // open submenu
    const ctx = stubCtx();
    for (let i = 0; i < 12; i += 1) {
      ctx.reset();
      scene.draw(ctx);
      if (ctx.texts.join('|').includes(`>${name}`)) return ctx;
      scene.input?.('down');
    }
    return ctx;
  }

  test('READ THEM reveals the foe HONEST intent even through OPAQUE focus discipline', () => {
    const { scene } = buildScene({
      catchBreathUnlocked: true,
      devUnlockAllCalls: true,
      playerPatch: { momentum: 2 },
      foeAction: { kind: 'move', move: 'TACKLE', stance: 'A', commit: true }, // foe FOCUSES
      foeFocusInfo: { discipline: 'opaque', releases: ['heavy'] },
    });
    const ctx = openCallOn(scene, 'Read Them');
    expect(ctx.texts.join('|')).toContain('>Read Them');
    scene.input?.('a'); // shout
    scene.input?.('a'); // advance shout → the honest reveal line
    ctx.reset();
    scene.draw(ctx);
    // Opaque would read "is FOCUSING" / "gathering"; the honest bypass reveals the
    // open focus tell ("charging to …"). So the reveal must NOT be the opaque line.
    const screen = ctx.texts.join('|');
    expect(screen).toContain('charging');
  });

  test('THROW THEM OFF opens the stance-plant picker; confirming resolves the round', () => {
    const { scene } = buildScene({ catchBreathUnlocked: true, devUnlockAllCalls: true, playerPatch: { momentum: 2 } });
    openCallOn(scene, 'Throw Them Off');
    scene.input?.('a'); // open the plant picker
    let ctx = stubCtx();
    scene.draw(ctx);
    expect(ctx.texts.join('|')).toContain('plant a false read');
    scene.input?.('down'); // pick a different stance (Guard)
    scene.input?.('a'); // shout → commit throwOff
    scene.input?.('a'); // advance the shout
    // The round resolved (we left the picker into the resolve/log flow).
    ctx = stubCtx();
    scene.draw(ctx);
    expect(ctx.texts.join('|')).not.toContain('plant a false read');
  });

  test('THROW THEM OFF can be backed out of (B → Call submenu)', () => {
    const { scene } = buildScene({ catchBreathUnlocked: true, devUnlockAllCalls: true, playerPatch: { momentum: 2 } });
    openCallOn(scene, 'Throw Them Off');
    scene.input?.('a'); // open picker
    scene.input?.('b'); // back out
    const ctx = stubCtx();
    scene.draw(ctx);
    expect(ctx.texts.join('|')).toContain('Throw Them Off'); // back in the Call submenu
  });

  test('COME BACK opens the party picker and swaps in the bench mon', () => {
    const { scene } = buildScene({ catchBreathUnlocked: true, devUnlockAllCalls: true, bench: true, playerPatch: { momentum: 2 } });
    openCallOn(scene, 'Come Back');
    scene.input?.('a'); // open the party picker (has a bench survivor)
    scene.input?.('a'); // pick the bench mon → shout
    scene.input?.('a'); // advance the shout → commit comeBack
    // Drain the resolve; the incoming mon (EMBERCUB) should now be active.
    for (let i = 0; i < 60; i += 1) {
      scene.update?.(0.2);
      const ctx = stubCtx();
      scene.draw(ctx);
      if (ctx.texts.join('|').includes('EMBERCUB')) { expect(true).toBe(true); return; }
      scene.input?.('a');
    }
    throw new Error('COME BACK did not surface the swapped-in mon');
  });

  test('COME BACK is unavailable with no bench survivor (toast, no crash)', () => {
    const { scene } = buildScene({ catchBreathUnlocked: true, devUnlockAllCalls: true, playerPatch: { momentum: 2 } }); // 1-mon team
    openCallOn(scene, 'Come Back');
    scene.input?.('a'); // attempt → should toast, not open a picker
    const ctx = stubCtx();
    scene.draw(ctx);
    expect(ctx.texts.join('|')).toContain('No other mon');
  });

  test('SHAKE IT OFF is selectable when unlocked and fires without crashing', () => {
    const { scene } = buildScene({ catchBreathUnlocked: true, devUnlockAllCalls: true, playerPatch: { momentum: 2 } });
    const ctx = openCallOn(scene, 'Shake It Off');
    expect(ctx.texts.join('|')).toContain('>Shake It Off');
    scene.input?.('a'); // shout
    scene.input?.('a'); // commit shakeOff → resolve
    ctx.reset();
    scene.draw(ctx);
    expect(ctx.texts.join('|')).not.toContain('>Shake It Off'); // left the submenu
  });
});

function drainResolve(scene: ReturnType<typeof createBattleScene>): void {
  // Resolve presents one beat at a time. ROUTINE beats auto-advance; the
  // CONSEQUENTIAL ones (KO/faint/break/Call) now WAIT for a press so they land
  // (playtest-polish-3). So drain by ticking AND pressing through any waiting
  // beat — but STOP at the menu / end-text (don't press past those; callers
  // assert on them).
  for (let i = 0; i < 200; i += 1) {
    scene.update?.(0.2);
    const ctx = stubCtx();
    scene.draw(ctx);
    const s = ctx.texts.join('|');
    if (/FIGHT|won the battle|team fell|Got away|fled|continue\./.test(s)) return;
    scene.input?.('a'); // nudge a waiting consequential beat (no-op past resolve)
  }
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
    expect(screen).toContain('★'); // ★ cost shows (drawn small + separate from the digit by the symbol pass)
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
    expect(screen).toContain('Not enough'); // ★ is drawn separately (symbol pass)
    expect(screen).not.toContain('catch your breath');

    // Dismiss → back in the submenu (not committed).
    scene.input?.('b');
    ctx.reset();
    scene.draw(ctx);
    expect(ctx.texts.join('|')).toContain('Catch Breath');
  });

  test('design-only Calls render greyed + LOCKED; the cursor skips them across the built Calls', () => {
    const { scene } = buildScene({ catchBreathUnlocked: true, playerPatch: { momentum: 1 } });
    scene.input?.('down');
    scene.input?.('a'); // submenu — cursor starts on Catch Breath (first built+unlocked)
    const ctx = stubCtx();
    scene.draw(ctx);
    let screen = ctx.texts.join('|');
    expect(screen).toContain('LOCKED'); // the design-only Calls (Recover/Dodge/Full Power) are labelled LOCKED
    expect(screen).toContain('>Catch Breath');
    // DOWN steps onto the Layer-2 escape Calls (now BUILT), skipping locked rows.
    scene.input?.('down');
    ctx.reset();
    scene.draw(ctx);
    screen = ctx.texts.join('|');
    expect(screen).toContain('>Get Away');
    // Shake It Off (the repurposed slot) is bond-gated → renders LOCKED at bond 0.
    expect(screen).toContain('Shake It Off ·LOCKED');
    // Only Catch Breath + Get Away are unlocked here, so DOWN WRAPS back to the
    // top (the cursor skips every locked row: Shake It Off / Recover / … / Come Back).
    scene.input?.('down');
    ctx.reset();
    scene.draw(ctx);
    expect(ctx.texts.join('|')).toContain('>Catch Breath');
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
    // The catchBreath beat streams + holds during resolve. Sample in SMALL
    // ticks (no presses) so the beat is caught while it's shown — the round
    // auto-advances past it otherwise.
    const ctx = stubCtx();
    let found = false;
    for (let i = 0; i < 400 && !found; i += 1) {
      scene.update?.(0.05);
      ctx.reset();
      scene.draw(ctx);
      const screen = ctx.texts.join('|');
      if (screen.includes('catches its breath') && screen.includes('50')) found = true;
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
    // GRUBLEAF two-pool moveset (4 ATTACKS + 2 TECHNIQUES = 6 served in one list):
    // ['TACKLE', 'THORN FLICK', 'LEAF LASH', 'HEADBUTT', 'SIPHON', 'ENTANGLE']
    scene.input?.('up'); // wraps to the LAST move (index 5) → ENTANGLE
    const ctx = stubCtx();
    scene.draw(ctx);
    expect(ctx.texts.some((t) => t.startsWith('>ENTANGLE'))).toBe(true);
    scene.input?.('down'); // wraps back to index 0 → TACKLE
    ctx.reset();
    scene.draw(ctx);
    expect(ctx.texts.some((t) => t.startsWith('>TACKLE'))).toBe(true);
  });

  test('A on a heavy move while winded (ST ≤ 25) surfaces "Too winded" — dismissable', () => {
    // CH1 starters at lvl 13 don't have heavies yet, so we test the
    // winded-locks-heavy rule with the legacy EMBERCUB (FX FLAME RUSH = heavy).
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
    // EMBERCUB moves: TACKLE, FX EMBER SNAP, FX FLAME RUSH (heavy at index 2).
    scene.input?.('down');
    scene.input?.('down');
    scene.input?.('a'); // confirm FX FLAME RUSH while winded → "Too winded"
    const ctx = stubCtx();
    scene.draw(ctx);
    expect(ctx.texts.join('|')).toContain('Too winded');
    // Dismissable — B backs out to the move list.
    scene.input?.('b');
    ctx.reset();
    scene.draw(ctx);
    expect(ctx.texts.some((t) => t.startsWith('>FX FLAME RUSH'))).toBe(true);
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

  test('a TECHNIQUE cannot enter the Focus two-step; an ATTACK still can', () => {
    // A technique Focused would have its status effect silently discarded (the
    // Focus path is rawHit-only) — so the charge/commit two-step is BLOCKED on a
    // technique. The ▶FOCUS indicator is drawn as separate '▶' + 'FOCUS' runs
    // (the symbol pass), so we assert on the 'FOCUS' text run.
    // GRUBLEAF grid: TACKLE/THORN FLICK/LEAF LASH/HEADBUTT (attacks 0–3),
    // SIPHON/ENTANGLE (techniques 4–5).
    const hasFocus = (ctx: ReturnType<typeof stubCtx>): boolean => ctx.texts.some((t) => t.includes('FOCUS'));
    const { scene } = buildScene();
    scene.input?.('a'); // FIGHT → grid, cursor on TACKLE (attack)
    scene.input?.('left'); // toggle charge ON (attack → chargeable)
    let ctx = stubCtx();
    scene.draw(ctx);
    expect(hasFocus(ctx)).toBe(true); // an ATTACK can Focus

    // Navigate to a TECHNIQUE (SIPHON, index 4).
    for (let i = 0; i < 4; i += 1) scene.input?.('down');
    ctx.reset();
    scene.draw(ctx);
    expect(ctx.texts.some((t) => t.startsWith('>SIPHON'))).toBe(true);
    expect(hasFocus(ctx)).toBe(false); // ▶FOCUS hidden on a technique

    // The charge toggle no-ops on a technique — still no ▶FOCUS.
    scene.input?.('left');
    ctx.reset();
    scene.draw(ctx);
    expect(hasFocus(ctx)).toBe(false);

    // Back to an ATTACK (TACKLE) — Focus is available again (the toggle persisted).
    for (let i = 0; i < 4; i += 1) scene.input?.('up');
    ctx.reset();
    scene.draw(ctx);
    expect(hasFocus(ctx)).toBe(true);
  });

  test('the release picker labels rows "HEAVY ATTACK" and shows the charged attack (2b-3 / Q2)', () => {
    // A mon mid-Focus (focus set) → beginTurn routes to the release phase. The
    // charged attack (focus.move) carries through the release, so the picker names
    // WHICH attack is releasing + labels the rows "<release> ATTACK" (not a bare
    // "HEAVY" that misreads as a damage tier). GRUBLEAF's LEAF LASH = mid/T1/NATURE.
    let state = createBattleState(
      createTeam([createSide(CH1.GRUBLEAF!)]),
      createTeam([createSide(CH1.FLITPECK!)]),
    );
    const patched: SideState = { ...activeMon(state.player), focus: { stance: 'A', move: 'LEAF LASH' } };
    state = { ...state, player: setActiveMember(state.player, patched) };
    const scene = createBattleScene({
      state,
      rng: mulberry32(1),
      chooseFoeAction: () => ({ kind: 'move', move: 'TACKLE', stance: 'A' }),
      intro: [],
      catchBreathUnlocked: false,
      canRun: true,
      onResolve: () => {},
    });
    scene.update?.(0.01); // beginTurn → phase 'release'
    const ctx = stubCtx();
    scene.draw(ctx);
    const screen = ctx.texts.join('|');
    // Rows read "<RELEASE> ATTACK", not bare "HEAVY".
    expect(ctx.texts.some((t) => t.includes('HEAVY ATTACK'))).toBe(true);
    expect(ctx.texts.some((t) => t.includes('FEINT ATTACK'))).toBe(true);
    expect(ctx.texts.some((t) => t.includes('HIDE ATTACK'))).toBe(true);
    // The charged attack is shown by name + its ATTACK detail line (badge/type/ST).
    expect(screen).toContain('RELEASING');
    expect(ctx.texts.some((t) => t.includes('LEAF LASH'))).toBe(true);
    expect(ctx.texts.some((t) => t.includes('T1 ATTACK'))).toBe(true);
  });
});

describe('battle resolve + end-text', () => {
  test('resolve auto-advances to the next turn (no longer stuck on the move list)', () => {
    const { scene } = buildScene();
    scene.input?.('a'); // FIGHT
    scene.input?.('a'); // TACKLE — commit → resolve
    drainResolve(scene); // beats stream + auto-advance to the next turn / end

    const ctx = stubCtx();
    scene.draw(ctx);
    const screen = ctx.texts.join('|');
    // Either back at FIGHT (next turn) or end-text — no longer "> TACKLE".
    expect(screen).not.toContain('> TACKLE');
    expect(screen.includes('FIGHT') || screen.includes('Press A')).toBe(true);
  });

  test('end-text dispatches onResolve once the round resolves', () => {
    // Player at 1 HP attacks Aggressive — foe Guards (default) → counter KOs.
    const { scene, resolved } = buildScene({ playerPatch: { hp: 1 } });
    scene.input?.('a'); // FIGHT
    scene.input?.('a'); // TACKLE — counter KOs player
    drainResolve(scene); // auto-advance the round to the end-text

    const ctx = stubCtx();
    scene.draw(ctx);
    expect(ctx.texts.join('|')).toContain('Your team fell');

    // End text is 2 lines — 2 A presses to advance past it, THEN onResolve fires.
    scene.input?.('a');
    scene.input?.('a');
    expect(resolved.winner).toBe('foe');
  });

  // FIX 2 (playtest-polish-3) — a consequential beat (a faint) is a HELD beat:
  // it LANDS (holds markedly longer, doesn't flash past) and a press advances
  // it. Routine beats keep their gentle auto-advance.
  test('a faint is a held, press-advanceable beat (it lands, does not flash past)', () => {
    const { scene } = buildScene({ playerPatch: { hp: 1 } });
    scene.input?.('a'); // FIGHT
    scene.input?.('a'); // TACKLE Aggressive → foe Guards → counter KOs the player
    // Step in small ticks until the faint line is FULLY shown (it streams in).
    let sawFaint = false;
    for (let i = 0; i < 60 && !sawFaint; i += 1) {
      scene.update?.(0.1);
      const c = stubCtx();
      scene.draw(c);
      if (c.texts.join('|').includes('fainted!')) sawFaint = true;
    }
    expect(sawFaint).toBe(true);
    // It's HOLDING (acknowledgment) — not yet flowed to the end-text.
    const held = stubCtx();
    scene.draw(held);
    expect(held.texts.join('|')).not.toContain('team fell');
    // A press advances past the held faint to the end-text.
    scene.input?.('a');
    const after = stubCtx();
    scene.draw(after);
    expect(after.texts.join('|')).toContain('team fell');
  });
});

describe('FOCUS outcome callouts (combat-focus-rebuild)', () => {
  // Collect ALL on-screen text across the resolve + R2 release pick (pressing
  // through held beats AND the release menu, whose cursor starts on HEAVY),
  // until the next menu / end-text.
  function collectResolveText(scene: ReturnType<typeof createBattleScene>): string {
    const seen: string[] = [];
    for (let i = 0; i < 200; i += 1) {
      scene.update?.(0.1);
      const c = stubCtx();
      scene.draw(c);
      seen.push(...c.texts);
      if (/FIGHT|won the battle|team fell/.test(c.texts.join('|'))) break;
      scene.input?.('a'); // advance held beats / confirm the (HEAVY) release
    }
    return seen.join('|');
  }

  test('R1 reads as a generic FOCUS; R2 HEAVY vs a guarding foe → CRUSHES THE BRACE', () => {
    const { scene } = buildScene(); // foe single-steps GUARD by default
    scene.input?.('a'); // FIGHT → move menu
    scene.input?.('left'); // toggle the COMMIT modifier (→ generic FOCUS)
    scene.input?.('a'); // commit FOCUS — round 1 (release HIDDEN)
    const text = collectResolveText(scene); // R1 focus + R2 release (HEAVY, cursor default)
    // R1 is a generic focus — "gathering energy", NOT a named release.
    expect(text).toContain('FOCUSING');
    expect(text).not.toContain('CHARGE'); // the old distinct-wind-up name is gone
    // R2 HEAVY vs the brace → the rotation win callout.
    expect(text).toContain('CRUSHES THE BRACE');
  });

  // KICKOFF-focus-damage-bugfix.md, Bug 2: a HEAVY-release KO must fire the
  // normal KO reaction — the held "fainted!" beat — not vanish the foe with no
  // acknowledgment. (The faint event always fired; the bug was the readout —
  // the faint never set the prominent center callout, so a flashy one-shot left
  // the callout stuck on the strike verb.) Lock the end-to-end KO flow here.
  test('a Focus→HEAVY release KO fires the held "fainted!" beat and reaches the win', () => {
    let state = createBattleState(
      createTeam([createSide(CH1.GRUBLEAF!)]),
      createTeam([createSide(CH1.FLITPECK!)]),
    );
    // Drop the foe to near-zero so the HEAVY release reliably KOs it.
    const lowFoe: SideState = { ...activeMon(state.foe), hp: 2 };
    state = { ...state, foe: setActiveMember(state.foe, lowFoe) };
    const scene = createBattleScene({
      state,
      rng: mulberry32(1),
      chooseFoeAction: () => ({ kind: 'move', move: 'TACKLE', stance: 'G' }), // brace → HEAVY crushes
      intro: [],
      catchBreathUnlocked: false,
      canRun: true,
      onResolve: () => {},
    });
    scene.update?.(0.01);
    scene.input?.('a'); // FIGHT
    scene.input?.('left'); // toggle COMMIT → FOCUS
    scene.input?.('a'); // commit FOCUS (R1)

    let sawFaint = false;
    let reachedWin = false;
    for (let i = 0; i < 400; i += 1) {
      scene.update?.(0.1);
      const c = stubCtx();
      scene.draw(c);
      const s = c.texts.join('|');
      if (s.includes('fainted!')) sawFaint = true;
      if (/won the battle|team fell/.test(s)) {
        reachedWin = true;
        break;
      }
      scene.input?.('a'); // advance held beats / confirm the (HEAVY) release
    }
    expect(sawFaint).toBe(true);
    expect(reachedWin).toBe(true);
  });
});

describe('momentum visibility (playtest-polish-3)', () => {
  test('BOTH the player’s and the foe’s ★/momentum meters render (the differential is visible)', () => {
    const { scene } = buildScene({ playerPatch: { momentum: 2 } });
    const ctx = stubCtx();
    scene.draw(ctx); // at the battle menu — panels visible
    const screen = ctx.texts.join('|');
    // Each meter is labelled MOMENTUM (the full word) — one per panel.
    expect(screen).toContain('MOMENTUM');
    // Playtest change: the foe's ★ is now SHOWN too (the mechanics run on the
    // momentum DIFFERENTIAL — behind-penalty + phased-unlock). Each meter is a
    // 3-slot triangle, so 6 ★ glyphs draw (3 player + 3 foe) — was 3 when the
    // foe's was hidden.
    const pips = ctx.texts.filter((t) => t === '★').length;
    expect(pips).toBe(6);
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

  test('Bug 1: a read-win increments USABLE ★ — the Call submenu reflects it (not just the callout)', () => {
    // GRUBLEAF Guard vs FLITPECK Aggressive → COUNTER → the player charges ★.
    const { scene } = buildScene({
      foeAction: { kind: 'move', move: 'TACKLE', stance: 'A' },
      catchBreathUnlocked: true,
    });
    pickStance(scene, 'G');
    drainResolve(scene);
    // FIGHT → CALL (PKMN + BALL are disabled on a solo, no-catch team).
    scene.input?.('down');
    scene.input?.('a'); // open the Call submenu
    const ctx = stubCtx();
    scene.draw(ctx);
    // The submenu reads the LIVE engine ★ (the resource Calls spend), so this
    // proves the read-win actually banked usable ★, not just fired a callout.
    // ★1 ≥ Catch Breath's cost (1) → the Call is now usable.
    expect(ctx.texts.join('|')).toContain('Your'); // "Your ★1" — ★ drawn separately now
    expect(ctx.texts).toContain('★');
  });

  test('stance label on opening: "FLUID slips past GUARD" when F attacks G', () => {
    const scene = driveStanceScenario('F', 'G', SPECIES.AQUAFIN!, SPECIES.EMBERCUB!, 42);
    pickStance(scene, 'F');
    expect(advanceUntilLog(scene, 'FLUID slips past GUARD', 12)).toBe(true);
  });

  test('Layer 1: Aggressive into Fluid shows the PUNISH beat (no dodge)', () => {
    const scene = createBattleScene({
      state: createBattleState(
        createTeam([createSide(SPECIES.AQUAFIN!)]),
        createTeam([createSide(SPECIES.EMBERCUB!)]),
      ),
      rng: { next: () => 0.5 },
      chooseFoeAction: () => ({ kind: 'move', move: 'TACKLE', stance: 'F' }),
      intro: [],
      catchBreathUnlocked: false,
      canRun: true,
      onResolve: () => {},
    });
    pickStance(scene, 'A'); // Aggressive vs the foe's Fluid → PUNISH (A>F)
    expect(advanceUntilLog(scene, 'PUNISH', 12)).toBe(true);
  });
});

describe('combat legibility (S1/S2) — pure callout + speed helpers', () => {
  test('stanceCallout names the rule for each triangle interaction', () => {
    expect(stanceCallout({ kind: 'counter' })).toContain('COUNTER');
    expect(stanceCallout({ kind: 'counter' })).toContain('GUARD');
    expect(stanceCallout({ kind: 'opening' })).toContain('OPENING');
    expect(stanceCallout({ kind: 'opening' })).toContain('FLUID');
    // Layer 1: Aggressive beats Fluid → the PUNISH callout names the rule.
    expect(stanceCallout({ kind: 'punish' })).toContain('PUNISH');
    expect(stanceCallout({ kind: 'punish' })).toContain('FLUID');
    // A normal strike is not itself a triangle teaching moment (the A-vs-F
    // case is a `punish` event now, not a strike).
    expect(stanceCallout({ kind: 'strike', attackerStance: 'A', defenderStance: 'F' })).toBeNull();
    expect(stanceCallout({ kind: 'strike', attackerStance: 'A', defenderStance: 'G' })).toBeNull();
    expect(stanceCallout({ kind: 'strike' })).toBeNull();
  });

  test('speedLabel reflects the player-vs-foe speed matchup', () => {
    expect(speedLabel(120, 80)).toBe('YOU FASTER');
    expect(speedLabel(80, 120)).toBe('YOU SLOWER');
    expect(speedLabel(100, 100)).toBe('SPEED EVEN');
  });

  test('the BASE SPD speed readout is NO LONGER on the intent bar (removed in 2b-1)', () => {
    // Battle-UI 2b-1 removed the persistent BASE SPD line (speed is settled; the
    // honest per-move "NEXT:" order preview in the move view carries what matters).
    // The FOE INTENT readout still renders; the speed label does not.
    const { scene } = buildScene();
    const ctx = stubCtx();
    scene.draw(ctx);
    const screen = ctx.texts.join('|');
    expect(screen).toContain('FOE INTENT');
    expect(screen).not.toContain('BASE SPD');
    expect(/YOU FASTER|YOU SLOWER|SPEED EVEN/.test(screen)).toBe(false);
  });
});

describe('battle text flow — stream + one-press-per-message (Presentation 1)', () => {
  test('the current beat STREAMS (reveals progressively, not an instant dump)', () => {
    const { scene } = buildScene();
    scene.input?.('a'); // FIGHT
    scene.input?.('a'); // TACKLE → resolve
    scene.update?.(0.02); // first beat set up + a sliver streamed
    const ctx = stubCtx();
    scene.draw(ctx);
    const partial = ctx.texts.join('|').length;
    // Tick more — the line reveals fully.
    for (let i = 0; i < 25; i += 1) scene.update?.(0.05);
    ctx.reset();
    scene.draw(ctx);
    const full = ctx.texts.join('|');
    expect(full).toContain('used TACKLE'); // fully revealed
    expect(full.length).toBeGreaterThan(partial); // progressive reveal (streamed)
  });

  test('ONE press finishes the current stream; it does NOT flush the whole round', () => {
    const { scene } = buildScene();
    scene.input?.('a'); // FIGHT
    scene.input?.('a'); // TACKLE → resolve
    scene.update?.(0.02); // start streaming the first beat
    scene.input?.('a'); // finish the stream (reveal the current line fully)
    const ctx = stubCtx();
    scene.draw(ctx);
    const screen = ctx.texts.join('|');
    expect(screen).toContain('used TACKLE'); // current line fully shown
    // NOT flushed to the end — still mid-resolve (no menu / end-text).
    expect(screen).not.toContain('Press A to continue');
    expect(screen).not.toContain('> FIGHT');
  });

  test('presses advance ONE beat at a time — the foe commit appears after, still resolving', () => {
    const { scene } = buildScene();
    scene.input?.('a'); // FIGHT
    scene.input?.('a'); // TACKLE → resolve
    // Walk the beats: a short tick to stream + a press to advance, a few times.
    for (let i = 0; i < 4; i += 1) {
      scene.update?.(0.3);
      scene.input?.('a');
    }
    const ctx = stubCtx();
    scene.draw(ctx);
    const screen = ctx.texts.join('|');
    expect(screen).toContain('GRUBLEAF used TACKLE'); // player commit beat
    // The foe commit is the plain-language stance confirmation (GUARD).
    expect(screen).toContain('FLITPECK braces with TACKLE!');
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
    expect(ctx.texts.join('|')).toContain('Not enough'); // ★ drawn separately (symbol pass)

    scene.input?.('b'); // dismiss → back to the submenu (its prior phase)
    ctx = stubCtx();
    scene.draw(ctx);
    expect(ctx.texts.join('|')).toContain('Catch Breath');
    expect(ctx.texts.join('|')).not.toContain('Not enough');
  });
});

// ── Combat Layer 4 Stage 1 — trainer FOCUS Foe-Intent tells (info-discipline) ──
// KICKOFF-falkner-tune-+-focus-intent.md Item 2: a profiled trainer's Focus
// narrows which release is coming per its information discipline, so an easy
// trainer's Focus is a learnable 50/50, not a blind 1/3 guess.
describe('FOCUS foe-intent tells (graduated by info level)', () => {
  // The truthful 2-of-3 narrowings: each phrase pairs exactly two releases.
  const PAIR: Record<string, readonly string[]> = {
    'focuses to attack': ['heavy', 'feint'],
    'focuses to outwit': ['hide', 'feint'],
    'focuses to move fast': ['heavy', 'hide'],
  };

  test('OPEN: each release narrows to a phrase whose pair CONTAINS that release', () => {
    for (const release of ['heavy', 'feint', 'hide'] as const) {
      const info: FocusIntentInfo = { discipline: 'open', salt: 'JAY' };
      const line = focusIntentTell([release], 'FOE', info);
      const phrase = line.slice('FOE '.length);
      expect(PAIR[phrase]).toBeDefined(); // it's one of the three narrowings
      expect(PAIR[phrase]).toContain(release); // and it's TRUTHFUL for this release
    }
  });

  test('OPEN narrowing is CONSISTENT per trainer (learnable) across calls', () => {
    const info: FocusIntentInfo = { discipline: 'open', salt: 'JAY' };
    expect(focusIntentTell(['heavy'], 'JAY', info)).toBe(focusIntentTell(['heavy'], 'JAY', info));
  });

  test('OPEN: a fixed-HEAVY tell stays a genuine 50/50 — its phrase pairs a 2nd release', () => {
    const line = focusIntentTell(['heavy'], 'JAY', { discipline: 'open', salt: 'JAY' });
    const phrase = line.slice('JAY '.length);
    expect(['focuses to attack', 'focuses to move fast']).toContain(phrase);
    expect(PAIR[phrase]!.length).toBe(2);
  });

  test('OPEN + VARIABLE {heavy,feint}: the tell is the lens that contains BOTH → truthful either way', () => {
    // A variable Charger can release HEAVY or FEINT; the only truthful, learnable
    // tell is "focuses to attack" ({heavy,feint}) — never a lens that excludes one.
    const line = focusIntentTell(['heavy', 'feint'], 'CHG', { discipline: 'open', salt: 'CHG' });
    expect(line).toBe('CHG focuses to attack');
  });

  test('VEILED: a non-specific tell (no narrowing)', () => {
    expect(focusIntentTell(['heavy'], 'FALKNER', { discipline: 'veiled' })).toBe('FALKNER is focusing intently');
  });

  test('OPAQUE: just FOCUSING (no information)', () => {
    expect(focusIntentTell(['heavy'], 'X', { discipline: 'opaque' })).toBe('X is FOCUSING');
  });

  test('degradeIntent routes a FOCUS COMMIT (WIND-UP) through the charging tell', () => {
    const rng = mulberry32(1);
    const commit = { kind: 'move' as const, move: 'TACKLE', stance: 'A' as const, commit: true };
    const open = degradeIntent(commit, 'JAY', 'honest', rng, { discipline: 'open', releases: ['heavy'], salt: 'JAY' });
    expect(open.line).toMatch(/JAY is charging to /); // WIND-UP verb, not "focuses to"
    const veiled = degradeIntent(commit, 'FALKNER', 'ambiguous', rng, { discipline: 'veiled', releases: ['heavy'] });
    expect(veiled.line).toBe('FALKNER is gathering intently'); // wind-up veiled
  });

  test('degradeIntent routes the MID-FOCUS RELEASE through the focuses tell', () => {
    const rng = mulberry32(1);
    const release = { kind: 'release' as const, release: 'hide' as const };
    const line = degradeIntent(release, 'AMBU', 'honest', rng, { discipline: 'open', releases: ['hide'], salt: 'AMBU' }).line!;
    expect(line).toMatch(/AMBU focuses to /); // RELEASE verb
    const phrase = line.slice('AMBU '.length);
    expect(PAIR[phrase]).toContain('hide'); // truthful for HIDE
  });

  test('no focus info (wild / unprofiled): wind-up → "is gathering", release → "is focusing"', () => {
    const rng = mulberry32(1);
    const commit = { kind: 'move' as const, move: 'TACKLE', stance: 'A' as const, commit: true };
    expect(degradeIntent(commit, 'WILD', 'honest', rng).line).toBe('WILD is gathering');
    const release = { kind: 'release' as const, release: 'heavy' as const };
    expect(degradeIntent(release, 'WILD', 'honest', rng).line).toBe('WILD is focusing');
  });
});

// ── Focus-tell PHASE clarity (KICKOFF-focus-tell-phase-clarity.md) ───────────
// The wind-up (R1) and release (R2) of one Focus must read as DIFFERENT phases
// (different verb) while keeping the SAME learned lens (open tier). The wind-up
// verb also flags the interrupt window.
describe('FOCUS tell — phase-aware verbs, consistent lens', () => {
  // Reverse-map each lens noun → the release pair it truthfully narrows.
  const LENS_PAIR: Record<string, readonly string[]> = {
    attack: ['heavy', 'feint'],
    outwit: ['hide', 'feint'],
    'move fast': ['heavy', 'hide'],
  };
  const lensOf = (line: string, name: string): string =>
    line.slice(`${name} `.length).replace(/^is charging to /, '').replace(/^focuses to /, '');

  test('OPEN: wind-up says "is charging to X", release says "focuses to X"', () => {
    const info: FocusIntentInfo = { discipline: 'open', salt: 'JAY' };
    const windup = focusIntentTell(['heavy'], 'JAY', info, 'windup');
    const release = focusIntentTell(['heavy'], 'JAY', info, 'release');
    expect(windup).toMatch(/^JAY is charging to /);
    expect(release).toMatch(/^JAY focuses to /);
    expect(windup).not.toBe(release); // the two phases read differently
  });

  test('OPEN: the LENS is identical across both phases of one Focus (learnable)', () => {
    for (const release of ['heavy', 'feint', 'hide'] as const) {
      const info: FocusIntentInfo = { discipline: 'open', salt: 'JAY' };
      const w = lensOf(focusIntentTell([release], 'JAY', info, 'windup'), 'JAY');
      const r = lensOf(focusIntentTell([release], 'JAY', info, 'release'), 'JAY');
      expect(w).toBe(r); // same lens, only the verb changed
    }
  });

  test('OPEN: the WIND-UP phrase truthfully CONTAINS the chosen release', () => {
    for (const release of ['heavy', 'feint', 'hide'] as const) {
      const line = focusIntentTell([release], 'FOE', { discipline: 'open', salt: 'FOE' }, 'windup');
      const lens = lensOf(line, 'FOE');
      expect(LENS_PAIR[lens]).toBeDefined();
      expect(LENS_PAIR[lens]).toContain(release);
    }
  });

  test('VEILED: "is gathering intently" (wind-up) → "is focusing intently" (release)', () => {
    expect(focusIntentTell(['heavy'], 'FALKNER', { discipline: 'veiled' }, 'windup')).toBe('FALKNER is gathering intently');
    expect(focusIntentTell(['heavy'], 'FALKNER', { discipline: 'veiled' }, 'release')).toBe('FALKNER is focusing intently');
  });

  test('OPAQUE: "is gathering..." (wind-up) → "is FOCUSING" (release)', () => {
    expect(focusIntentTell(['heavy'], 'X', { discipline: 'opaque' }, 'windup')).toBe('X is gathering...');
    expect(focusIntentTell(['heavy'], 'X', { discipline: 'opaque' }, 'release')).toBe('X is FOCUSING');
  });

  test('phase defaults to RELEASE (the existing phrases are unchanged)', () => {
    expect(focusIntentTell(['heavy'], 'FALKNER', { discipline: 'veiled' })).toBe('FALKNER is focusing intently');
    expect(focusIntentTell(['heavy'], 'X', { discipline: 'opaque' })).toBe('X is FOCUSING');
  });

  test('infoLevelToReliability maps the unified level onto the stance tell', () => {
    expect(infoLevelToReliability('open')).toBe('honest');
    expect(infoLevelToReliability('veiled')).toBe('ambiguous');
    expect(infoLevelToReliability('opaque')).toBe('opaque');
  });
});

describe('DEV TOOL — dev combat-log overlay (opt-in; surfaces BattleEvents)', () => {
  // Drive one committed round so the engine emits its event stream, which the
  // dev log records as it resolves. Returns the scene mid-resolve.
  function driveOneRound(devLog: boolean): ReturnType<typeof createBattleScene> {
    const player = CH1.GRUBLEAF!;
    const foe = CH1.FLITPECK!;
    const state = createBattleState(
      createTeam([createSide(player)]),
      createTeam([createSide(foe)]),
    );
    const scene = createBattleScene({
      state,
      rng: mulberry32(1),
      chooseFoeAction: () => ({ kind: 'move', move: 'TACKLE', stance: 'A' }),
      intro: [],
      catchBreathUnlocked: false,
      canRun: true,
      onResolve: () => {},
      devLog,
    });
    scene.update?.(0.01); // → phase=menu
    scene.input?.('a'); // FIGHT → move list
    scene.input?.('a'); // commit move[0] → phase=resolve
    scene.update?.(0.05); // apply the first batch of events (recordDevLog runs)
    return scene;
  }

  test('OFF by default: no overlay is drawn (nothing added to combat, engine untouched)', () => {
    const scene = driveOneRound(false);
    const ctx = stubCtx();
    scene.draw(ctx);
    expect(ctx.texts.join('|')).not.toContain('DEV COMBAT-LOG');
  });

  test('ON (opts.devLog): the overlay header + a narrated round event are drawn', () => {
    const scene = driveOneRound(true);
    const ctx = stubCtx();
    scene.draw(ctx);
    const screen = ctx.texts.join('|');
    // The overlay header renders...
    expect(screen).toContain('DEV COMBAT-LOG');
    // ...and it surfaces the raw engine events (the round-start separator is
    // the first event of every resolve).
    expect(screen).toContain('round 1');
  });

  // A ctx that records each fillText's Y so we can assert the overlay stays
  // within the 360px battle viewport (the layout-overflow fix). Everything else no-ops.
  function yCapturingCtx(): CanvasRenderingContext2D & { ys: number[] } {
    const noop = () => {};
    const ys: number[] = [];
    return new Proxy(
      { ys },
      {
        get(target, prop) {
          if (prop === 'ys') return (target as { ys: number[] }).ys;
          if (prop === 'fillText') return (_t: string, _x: number, y: number) => ys.push(y);
          if (prop === 'beginPath') return () => ({ fill: noop, stroke: noop, ellipse: noop });
          if (prop === 'measureText') return () => ({ width: 10 });
          if (prop === 'canvas') return { width: 320, height: 180 };
          return noop;
        },
        set: () => true,
      },
    ) as unknown as CanvasRenderingContext2D & { ys: number[] };
  }

  test('stays within the 360px battle viewport after many events — nothing renders off the bottom', () => {
    // Drive several rounds so the buffer overflows the fixed window (>15 lines,
    // the count that used to run off-screen). Then assert every drawn glyph's
    // bottom (y + 8px line) sits inside the viewport.
    const player = CH1.GRUBLEAF!;
    const foe = CH1.FLITPECK!;
    const state = createBattleState(
      createTeam([createSide(player)]),
      createTeam([createSide(foe)]),
    );
    const scene = createBattleScene({
      state,
      rng: mulberry32(1),
      chooseFoeAction: () => ({ kind: 'move', move: 'TACKLE', stance: 'A' }),
      intro: [],
      catchBreathUnlocked: false,
      canRun: true,
      onResolve: () => {},
      devLog: true,
    });
    scene.update?.(0.01); // → menu
    // Two full rounds' worth of events (well past the visible window).
    for (let r = 0; r < 2; r += 1) {
      scene.input?.('a'); // FIGHT
      scene.input?.('a'); // commit → resolve
      drainResolve(scene); // finish the round → back to menu (or end)
    }
    // Re-enter resolve so both the HUD log AND the (now-full) dev log render.
    scene.input?.('a');
    scene.input?.('a');
    scene.update?.(0.05);

    const ctx = yCapturingCtx();
    scene.draw(ctx);
    // The dev log captured more than one visible window of events...
    expect(ctx.ys.length).toBeGreaterThan(0);
    // ...and NOTHING is drawn below the viewport (8px glyph height + top y).
    // Battle-UI rebuild Part 2a: the battle scene runs at 640×360, so the dev-log
    // overlay (and the whole HUD) is bounded by the 360px battle viewport now.
    const maxBottom = Math.max(...ctx.ys) + 8;
    expect(maxBottom).toBeLessThanOrEqual(360);
  });
});

// ── Battle-UI v2 (beat 1) — panels + type: BOUNDS harness + CRISPNESS ────────
describe('battle UI v2 (beat 1) — panels + type', () => {
  const W = 640;
  const H = 360;

  // A ctx that records every fillRect/strokeRect + fillText WITH the active font
  // px, and a proportional measureText (≈ m3x6's 0.5em advance) so right-aligned
  // + width-derived placements resolve realistically for the bounds check.
  interface TextRec { x: number; y: number; text: string; px: number; align: string }
  function recordingCtx(): CanvasRenderingContext2D & {
    rects: { x: number; y: number; w: number; h: number }[];
    texts: TextRec[];
    fonts: string[];
  } {
    const rects: { x: number; y: number; w: number; h: number }[] = [];
    const texts: TextRec[] = [];
    const fonts: string[] = [];
    let font = '16px m3x6, monospace';
    let align = 'start';
    const px = (f: string): number => {
      const m = /(\d+)px/.exec(f);
      return m ? parseInt(m[1]!, 10) : 16;
    };
    const noop = () => {};
    return new Proxy(
      { rects, texts, fonts },
      {
        get(t, p) {
          if (p === 'rects') return (t as { rects: unknown }).rects;
          if (p === 'texts') return (t as { texts: unknown }).texts;
          if (p === 'fonts') return (t as { fonts: unknown }).fonts;
          if (p === 'fillRect' || p === 'strokeRect') {
            return (x: number, y: number, w: number, h: number) => rects.push({ x, y, w, h });
          }
          if (p === 'fillText') return (text: string, x: number, y: number) => texts.push({ x, y, text: String(text), px: px(font), align });
          // m3x6's real average advance is ~0.25em (UI_CHAR_W 4.0 @ 16px). Use a
          // CONSERVATIVE 0.3em: if a bound passes here it passes with margin live.
          if (p === 'measureText') return (s: string) => ({ width: String(s).length * px(font) * 0.3 });
          if (p === 'beginPath') return () => ({ fill: noop, stroke: noop, ellipse: noop });
          if (p === 'canvas') return { width: 320, height: 180 };
          if (p === 'font') return font;
          if (p === 'textAlign') return align;
          return noop;
        },
        set(_t, p, v) {
          if (p === 'font') {
            font = String(v);
            fonts.push(font);
          } else if (p === 'textAlign') align = String(v);
          return true;
        },
      },
    ) as unknown as CanvasRenderingContext2D & {
      rects: { x: number; y: number; w: number; h: number }[];
      texts: TextRec[];
      fonts: string[];
    };
  }

  function assertInBounds(ctx: ReturnType<typeof recordingCtx>, label: string): void {
    for (const r of ctx.rects) {
      expect(r.x, `${label}: rect x`).toBeGreaterThanOrEqual(0);
      expect(r.y, `${label}: rect y`).toBeGreaterThanOrEqual(0);
      expect(r.x + r.w, `${label}: rect right`).toBeLessThanOrEqual(W + 0.5);
      expect(r.y + r.h, `${label}: rect bottom`).toBeLessThanOrEqual(H + 0.5);
    }
    for (const t of ctx.texts) {
      const w = t.text.length * t.px * 0.3;
      // Account for the draw's textAlign (drawTextRight anchors the RIGHT edge).
      const left = t.align === 'right' ? t.x - w : t.align === 'center' ? t.x - w / 2 : t.x;
      const right = t.align === 'right' ? t.x : t.align === 'center' ? t.x + w / 2 : t.x + w;
      expect(left, `${label}: text "${t.text}" left`).toBeGreaterThanOrEqual(-1);
      expect(right, `${label}: text "${t.text}" right`).toBeLessThanOrEqual(W + 1);
      expect(t.y, `${label}: text "${t.text}" y`).toBeGreaterThanOrEqual(-1); // nudge can dip ~1px
      expect(t.y + t.px, `${label}: text "${t.text}" bottom`).toBeLessThanOrEqual(H + 1);
    }
  }

  // A rich scene: a long dual-typed name (badge width), a 2-mon team (bench), a
  // debuff on each side (top-right tags), ★ on the player (filled sockets).
  function richScene(bossCard?: unknown) {
    const player = { ...createSide(CH1.GRUBLEAF!), momentum: 2, debuff: { kind: 'burn', duration: 3 } };
    const bench = createSide(SPECIES.EMBERCUB!);
    const foe = { ...createSide(CH1.FLITPECK!), momentum: 1, debuff: { kind: 'bulwark', duration: 3 } as never };
    let state = createBattleState(createTeam([player, bench]), createTeam([foe]));
    if (bossCard) {
      state = { ...state, bossCard: bossCard as never, breakProgress: 1, phase: 1, rhythmAnchor: 0 };
    }
    return createBattleScene({
      state,
      rng: mulberry32(1),
      chooseFoeAction: () => ({ kind: 'move', move: 'TACKLE', stance: 'A' }),
      intro: [],
      catchBreathUnlocked: true,
      devUnlockAllCalls: true,
      canRun: true,
      onResolve: () => {},
      playerBond: [55, 10],
    });
  }

  const BOSS_CARD = {
    species: CH1.FLITPECK!,
    breakBar: 3,
    arenaSchedule: { rhythmEveryN: 3, heavyExtraCost: 5, heavyExtraInitWeight: 1.2, telegraphAheadBy: 1 },
    teamSize: 1,
  };

  test('every primitive stays within 640×360 across the menu/move/call phases (regular foe)', () => {
    const scene = richScene();
    scene.update?.(0.01); // → menu
    let ctx = recordingCtx();
    scene.draw(ctx);
    assertInBounds(ctx, 'menu');
    scene.input?.('a'); // FIGHT → move grid
    ctx = recordingCtx();
    scene.draw(ctx);
    assertInBounds(ctx, 'move');
  });

  test('every primitive stays within 640×360 in the CALL + THROW-OFF phases', () => {
    const scene = richScene();
    scene.update?.(0.01);
    scene.input?.('down'); // CALL row
    scene.input?.('a'); // Call submenu
    let ctx = recordingCtx();
    scene.draw(ctx);
    assertInBounds(ctx, 'call');
    // Step to Throw Them Off and open its plant picker.
    for (let i = 0; i < 10; i += 1) {
      ctx = recordingCtx();
      scene.draw(ctx);
      if (ctx.texts.some((t) => t.text.includes('>Throw Them Off'))) break;
      scene.input?.('down');
    }
    scene.input?.('a'); // open plant picker
    ctx = recordingCtx();
    scene.draw(ctx);
    assertInBounds(ctx, 'throwoff');
  });

  test('the integrated BREAK row + role tag stays within bounds (boss foe)', () => {
    const scene = richScene(BOSS_CARD);
    scene.update?.(0.01);
    const ctx = recordingCtx();
    scene.draw(ctx);
    assertInBounds(ctx, 'boss-menu');
    // The BREAK row renders its label + the role tag inside the (taller) panel.
    expect(ctx.texts.some((t) => t.text === 'BREAK')).toBe(true);
    expect(ctx.texts.some((t) => t.text === 'GYM LEADER')).toBe(true);
  });

  test('the primary tier is CRISP 32px (integer 2×); NO fuzzy 24px anywhere', () => {
    const scene = richScene(BOSS_CARD);
    scene.update?.(0.01);
    const ctx = recordingCtx();
    scene.draw(ctx);
    // The primary type tier renders at exactly 32px m3x6 (a crisp integer scale).
    expect(ctx.fonts.some((f) => f === '32px m3x6, monospace')).toBe(true);
    // The fine-print tier stays the global 16px. NO 24px (1.5× = fuzzy) is used.
    expect(ctx.fonts.some((f) => /\b24px\b/.test(f))).toBe(false);
  });

  test('the old separate PHASE/BREAK strip is GONE (no double-render): "PHASE n" not drawn', () => {
    const scene = richScene(BOSS_CARD);
    scene.update?.(0.01);
    const ctx = stubCtx();
    scene.draw(ctx);
    // The retired strip drew "PHASE 1"; the integrated row does not.
    expect(ctx.texts.join('|')).not.toMatch(/PHASE \d/);
  });

  test('the momentum star-socket meter renders (filled ★ sockets for the player)', () => {
    const scene = richScene();
    scene.update?.(0.01);
    const ctx = stubCtx();
    scene.draw(ctx);
    // Sockets draw the ★ glyph; the player holds 2★, the foe 1★ → several ★ drawn.
    const stars = ctx.texts.filter((t) => t === '★').length;
    expect(stars).toBeGreaterThanOrEqual(6); // 3 player + 3 foe sockets, min
  });
});
