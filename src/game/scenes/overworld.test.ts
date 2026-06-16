// Cold-start warp round-trip regression. The seam acceptance was
// previously verified only via ?skip flags; this drives the scene
// programmatically to catch crashes a real walk would surface.
//
// Phase-5a-fixup additions: Hearthwick Pokémon Center door round-trip,
// Gen-2 tap-vs-hold input model, encounter-roll suppression on
// turn-in-place, and the post-battle encounter grace one-shot.

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createOverworldScene } from './overworld';
import type { InputKey } from '../scene';

interface MockFlags {
  has(flag: string): boolean;
  set(flag: string): void;
  unset(flag: string): void;
}

function mockFlags(): MockFlags {
  const set = new Set<string>();
  return {
    has: (f) => set.has(f),
    set: (f) => {
      set.add(f);
    },
    unset: (f) => {
      set.delete(f);
    },
  };
}

interface MockInputState {
  pressed(key: InputKey): boolean;
  press(key: InputKey): void;
  release(key: InputKey): void;
  releaseAll(): void;
}

function mockInput(): MockInputState {
  const held = new Set<InputKey>();
  return {
    pressed: (k) => held.has(k),
    press: (k) => {
      held.add(k);
    },
    release: (k) => {
      held.delete(k);
    },
    releaseAll: () => {
      held.clear();
    },
  };
}

// Advance update by enough ticks to cover duration at dt=0.02.
function tickStep(scene: ReturnType<typeof createOverworldScene>, durationSec = 0.22): void {
  const dt = 0.02;
  for (let t = 0; t < durationSec; t += dt) scene.update?.(dt);
}

// Tap-only: press for one tick + release. With the Gen-2 input model
// this turns the player to face `dir` WITHOUT starting a walk (the
// turn-hold timer is cancelled when the key releases before delay
// elapses). Useful for facing NPCs/signs before pressing A.
function tapTurn(
  scene: ReturnType<typeof createOverworldScene>,
  input: MockInputState,
  dir: 'up' | 'down' | 'left' | 'right',
): void {
  input.press(dir);
  scene.update?.(0.02);
  input.release(dir);
  scene.update?.(0.02);
}

// Walk one tile in `dir`. Holds the direction until the move actually
// starts (tile coordinate changes) — covers BOTH cases: facing already
// matches (immediate walk) and facing doesn't match (turn delay first).
// Releases as soon as the move is committed, then ticks out
// MOVE_DURATION so onStepFinish (warps, scripts, encounter rolls) runs.
function walkOne(
  scene: ReturnType<typeof createOverworldScene>,
  input: MockInputState,
  dir: 'up' | 'down' | 'left' | 'right',
): void {
  const startPos = scene.currentPosition();
  input.press(dir);
  // Hold until tx/ty change (the move committed). Cap to a generous
  // bound so a blocked direction doesn't loop forever — tx won't change
  // and the loop falls through to release.
  for (let i = 0; i < 30; i += 1) {
    scene.update?.(0.02);
    const p = scene.currentPosition();
    if (p.x !== startPos.x || p.y !== startPos.y) break;
  }
  input.release(dir);
  // Let the in-flight move complete + onStepFinish fire.
  for (let i = 0; i < 12; i += 1) scene.update?.(0.02);
}

describe('overworld cold-start warp round-trip', () => {
  test('LAB → HEARTHWICK fires onWarp with the correct target', () => {
    // Phase 3 rewire: the lab now lives inside Hearthwick town.
    // Its south door warps to HEARTHWICK:fromLab (was ROUTE31:fromLab
    // when the lab was on the route).
    let warpTarget: string | null = null;
    const input = mockInput();
    const scene = createOverworldScene({
      map: 'LAB',
      spawn: 'default',
      inputState: input,
      flags: mockFlags(),
      onWarp: (target) => {
        warpTarget = target;
      },
      onEncounter: () => {},
      onTrainerBattle: () => {},
      onBossBattle: () => {},
    });

    // Phase 3 LAB default spawn is (5, 8) facing up. Door warp is at (5, 10).
    // Walk down twice to reach the door tile.
    walkOne(scene, input, 'down'); // (5, 9)
    walkOne(scene, input, 'down'); // (5, 10) → warp fires

    tickStep(scene, 0.4);

    expect(warpTarget).toBe('HEARTHWICK:fromLab');
  });

  test('round-trip: ROUTE31:fromHearthwick spawn is valid and walking back into the town door warps to HEARTHWICK:fromRoute', () => {
    // Phase 3 rewire: Route 31's northern building used to warp to
    // LAB:fromRoute (lab was on the route). It now warps to
    // HEARTHWICK:fromRoute (lab is inside Hearthwick town).
    let warpTarget: string | null = null;
    const input = mockInput();
    const scene = createOverworldScene({
      map: 'ROUTE31',
      spawn: 'fromHearthwick',
      inputState: input,
      flags: mockFlags(),
      onWarp: (target) => {
        warpTarget = target;
      },
      onEncounter: () => {},
      onTrainerBattle: () => {},
      onBossBattle: () => {},
      startFaded: true,
    });

    // Let the fade-in finish so input is accepted.
    tickStep(scene, 0.4);

    // ROUTE31 fromHearthwick spawn is (4, 5) facing down. The town
    // door warp is at (4, 4).
    walkOne(scene, input, 'up'); // (4, 4)

    // Fade timer for outbound warp.
    tickStep(scene, 0.4);

    expect(warpTarget).toBe('HEARTHWICK:fromRoute');
  });

  test('GYM:fromRoute spawn loads + the gym door at (7,15) warps back to VIOLET:fromGym', () => {
    let warpTarget: string | null = null;
    const input = mockInput();
    const scene = createOverworldScene({
      map: 'GYM',
      spawn: 'fromRoute',
      inputState: input,
      flags: mockFlags(),
      onWarp: (target) => {
        warpTarget = target;
      },
      onEncounter: () => {},
      onTrainerBattle: () => {},
      onBossBattle: () => {},
      startFaded: true,
    });

    tickStep(scene, 0.4);

    // GYM fromRoute spawn is (7, 14) facing up. Door warp is at (7, 15).
    walkOne(scene, input, 'down'); // (7, 15)

    tickStep(scene, 0.4);

    expect(warpTarget).toBe('VIOLET:fromGym');
  });
});

describe('Demo-complete — Violet City hub wires Route 31 → Violet → gym', () => {
  test('Route 31 south exit — a gap in the tree line — warps INTO Violet City', () => {
    let warpTarget: string | null = null;
    const input = mockInput();
    const scene = createOverworldScene({
      map: 'ROUTE31',
      spawn: 'fromViolet', // one tile north of the bottom-edge gap (Phase 7 route)
      inputState: input,
      flags: mockFlags(),
      onWarp: (target) => {
        warpTarget = target;
      },
      onEncounter: () => {},
      onTrainerBattle: () => {},
      onBossBattle: () => {},
      startFaded: true,
    });
    tickStep(scene, 0.4);
    walkOne(scene, input, 'down'); // onto the gap at (9,14) → warp
    tickStep(scene, 0.4);
    expect(warpTarget).toBe('VIOLET:fromRoute');
  });

  test('Violet (S3 re-orient): gym door entered walking DOWN; route exit is the NORTH edge', () => {
    // Phase 7 firstroad-fixes S3: the player walks Route 31 south and
    // emerges at Violet's TOP. The gym is at the south end (entered walking
    // DOWN onto its door); the route exit is the NORTH-edge gap (walk UP).
    let gymWarp: string | null = null;
    const input = mockInput();
    const gymScene = createOverworldScene({
      map: 'VIOLET',
      spawn: 'fromGym', // (9,11), one tile above the gym door at (9,12)
      inputState: input,
      flags: mockFlags(),
      onWarp: (t) => {
        gymWarp = t;
      },
      onEncounter: () => {},
      onTrainerBattle: () => {},
      onBossBattle: () => {},
      startFaded: true,
    });
    tickStep(gymScene, 0.4);
    walkOne(gymScene, input, 'down'); // onto the gym door (9,12) → warp
    tickStep(gymScene, 0.4);
    expect(gymWarp).toBe('GYM:fromRoute');

    // Route exit: spawn fromRoute (the north entrance at (9,1)); walking
    // UP onto the north-edge gap (9,0) warps back to Route 31.
    let routeWarp: string | null = null;
    const input2 = mockInput();
    const exitScene = createOverworldScene({
      map: 'VIOLET',
      spawn: 'fromRoute',
      inputState: input2,
      flags: mockFlags(),
      onWarp: (t) => {
        routeWarp = t;
      },
      onEncounter: () => {},
      onTrainerBattle: () => {},
      onBossBattle: () => {},
      startFaded: true,
    });
    tickStep(exitScene, 0.4);
    walkOne(exitScene, input2, 'up'); // onto the north-edge exit → warp
    tickStep(exitScene, 0.4);
    expect(routeWarp).toBe('ROUTE31:fromViolet');
  });
});

describe('Phase 5a fix — Hearthwick Pokémon Center door round-trip', () => {
  test('Hearthwick door tile (3, 11) warps INTO the Pokémon Center', () => {
    let warpTarget: string | null = null;
    const input = mockInput();
    const scene = createOverworldScene({
      map: 'HEARTHWICK',
      // Spawn close to the door so the test isn't sensitive to layout
      // drift on the rest of the map.
      spawn: 'fromCenter',
      inputState: input,
      flags: mockFlags(),
      onWarp: (target) => {
        warpTarget = target;
      },
      onEncounter: () => {},
      onTrainerBattle: () => {},
      onBossBattle: () => {},
      startFaded: true,
    });
    tickStep(scene, 0.4);

    // fromCenter spawn is (3, 12) facing down — one tile south of the
    // door at (3, 11). Walk up onto the door to fire the warp.
    walkOne(scene, input, 'up');
    tickStep(scene, 0.4);

    expect(warpTarget).toBe('HEARTHWICK_CENTER:fromHearthwick');
  });

  test('CENTER door tile warps BACK to Hearthwick — completing the round-trip', () => {
    let warpTarget: string | null = null;
    const input = mockInput();
    const scene = createOverworldScene({
      map: 'HEARTHWICK_CENTER',
      spawn: 'fromHearthwick',
      inputState: input,
      flags: mockFlags(),
      onWarp: (target) => {
        warpTarget = target;
      },
      onEncounter: () => {},
      onTrainerBattle: () => {},
      onBossBattle: () => {},
      startFaded: true,
    });
    tickStep(scene, 0.4);

    // Center fromHearthwick spawn is (4, 6) facing up; the south door
    // warp lives at (4, 7).
    walkOne(scene, input, 'down');
    tickStep(scene, 0.4);

    expect(warpTarget).toBe('HEARTHWICK:fromCenter');
  });
});

describe('Phase 5a fix — Gen-2 input model (tap turns, hold walks)', () => {
  test('tap of a new direction TURNS the player but does NOT move them', () => {
    const input = mockInput();
    const scene = createOverworldScene({
      map: 'LAB',
      spawn: 'default',
      inputState: input,
      flags: mockFlags(),
      onWarp: () => {},
      onEncounter: () => {},
      onTrainerBattle: () => {},
      onBossBattle: () => {},
    });
    const start = scene.currentPosition();
    expect(start.facing).toBe('up'); // LAB default spawn faces up.

    // Tap LEFT — should turn-only, no move.
    tapTurn(scene, input, 'left');

    const after = scene.currentPosition();
    expect(after.facing).toBe('left');
    expect(after.x).toBe(start.x);
    expect(after.y).toBe(start.y);
  });

  test('hold of a new direction TURNS then WALKS (single step on the press)', () => {
    const input = mockInput();
    const scene = createOverworldScene({
      map: 'LAB',
      spawn: 'default',
      inputState: input,
      flags: mockFlags(),
      onWarp: () => {},
      onEncounter: () => {},
      onTrainerBattle: () => {},
      onBossBattle: () => {},
    });
    const start = scene.currentPosition();
    // LAB default faces up; holding DOWN should turn-then-walk south.
    walkOne(scene, input, 'down');
    const after = scene.currentPosition();
    expect(after.facing).toBe('down');
    expect(after.y).toBe(start.y + 1);
    expect(after.x).toBe(start.x);
  });

  test('walking in the already-faced direction takes a single step (turnHold=0 fast path)', () => {
    // LAB default faces up. Holding UP exercises the "facing already
    // matches" branch where turnHold is set to 0 and the move starts
    // on the same tick as the rising edge — distinct from the
    // turn-then-walk case above.
    const input = mockInput();
    const scene = createOverworldScene({
      map: 'LAB',
      spawn: 'default',
      inputState: input,
      flags: mockFlags(),
      onWarp: () => {},
      onEncounter: () => {},
      onTrainerBattle: () => {},
      onBossBattle: () => {},
    });
    const start = scene.currentPosition();
    expect(start.facing).toBe('up');

    walkOne(scene, input, 'up');
    const after = scene.currentPosition();
    expect(after.y).toBe(start.y - 1);
    expect(after.facing).toBe('up');
  });

  test('continuous hold WALKS tile after tile (Gen-2 hold-to-walk)', () => {
    const input = mockInput();
    const scene = createOverworldScene({
      map: 'LAB',
      spawn: 'default',
      inputState: input,
      flags: mockFlags(),
      onWarp: () => {},
      onEncounter: () => {},
      onTrainerBattle: () => {},
      onBossBattle: () => {},
    });
    const start = scene.currentPosition();
    // Hold DOWN long enough for two full tiles of movement. With the
    // continuous-hold model the player should advance ≥2 tiles south
    // before stopping (door warp at (5, 10) ends the chain by firing
    // onWarp; for this test we only need to confirm ≥2 steps happened).
    input.press('down');
    for (let i = 0; i < 60; i += 1) scene.update?.(0.02);
    input.release('down');
    for (let i = 0; i < 4; i += 1) scene.update?.(0.02);

    const after = scene.currentPosition();
    expect(after.y).toBeGreaterThanOrEqual(start.y + 2);
  });
});

describe('Phase 5a fix — encounter rolls only on real moves + post-battle grace', () => {
  // Math.random is stubbed to 0 so the per-step encounter check would
  // always fire (rate is checked as `Math.random() < zone.rate`, and
  // any rate > 0 succeeds at value 0). Lets us prove the GATING logic
  // (turn-vs-move, grace flag) without false negatives from RNG.
  beforeEach(() => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('turning in place while standing on a grass tile does NOT roll an encounter', () => {
    let encounters = 0;
    const input = mockInput();
    const scene = createOverworldScene({
      map: 'ROUTE31',
      // Drop the player onto a tall-grass encounter tile directly (the
      // left grass column, encounter_zone cols 2-3 rows 5-9).
      spawn: 'default',
      spawnAt: { x: 2, y: 6, facing: 'down' },
      inputState: input,
      flags: mockFlags(),
      onWarp: () => {},
      onEncounter: () => {
        encounters += 1;
      },
      onTrainerBattle: () => {},
      onBossBattle: () => {},
    });
    tickStep(scene, 0.1);

    // Tap-turn through every direction. None should roll an encounter
    // because onStepFinish only runs after a real move completes.
    tapTurn(scene, input, 'left');
    tapTurn(scene, input, 'up');
    tapTurn(scene, input, 'right');
    tapTurn(scene, input, 'down');

    expect(encounters).toBe(0);
  });

  test('post-battle grace: armPostBattleGrace skips exactly ONE encounter roll', () => {
    let encounters = 0;
    const input = mockInput();
    const scene = createOverworldScene({
      map: 'ROUTE31',
      // Start ABOVE the left grass column (encounter_zone cols 2-3 rows
      // 5-9) and walk DOWN into it twice.
      spawn: 'default',
      spawnAt: { x: 2, y: 4, facing: 'down' },
      inputState: input,
      flags: mockFlags(),
      onWarp: () => {},
      onEncounter: () => {
        encounters += 1;
      },
      onTrainerBattle: () => {},
      onBossBattle: () => {},
    });
    tickStep(scene, 0.1);

    // Arm the grace as main.ts does after a battle pop.
    scene.armPostBattleGrace();

    // First step onto grass — grace consumed, no encounter despite
    // Math.random() = 0.
    walkOne(scene, input, 'down'); // → (2, 5), in the encounter zone
    expect(encounters).toBe(0);

    // Second step — grace already spent, encounter fires.
    walkOne(scene, input, 'down'); // → (2, 6), still in the zone
    expect(encounters).toBe(1);
  });
});
