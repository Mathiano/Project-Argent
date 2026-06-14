// Cold-start warp round-trip regression. The seam acceptance was
// previously verified only via ?skip flags; this drives the scene
// programmatically to catch crashes a real walk would surface.

import { describe, expect, test } from 'vitest';
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

// Press for ONE tick (just enough for pollMovement to start the move),
// then release so we don't over-step, then tick out the move duration.
function walkOne(
  scene: ReturnType<typeof createOverworldScene>,
  input: MockInputState,
  dir: 'up' | 'down' | 'left' | 'right',
): void {
  input.press(dir);
  scene.update?.(0.02);
  input.release(dir);
  // Move duration is 0.18s; 12 ticks of 0.02 = 0.24s — runs onStepFinish.
  for (let i = 0; i < 12; i += 1) scene.update?.(0.02);
}

describe('overworld cold-start warp round-trip', () => {
  test('LAB → ROUTE31 fires onWarp with the correct target', () => {
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

    // Default LAB spawn is (6, 7) facing down. Door warp is at (4, 8).
    // Walk left twice, then down once onto the door tile.
    walkOne(scene, input, 'left'); // (5, 7)
    walkOne(scene, input, 'left'); // (4, 7)
    walkOne(scene, input, 'down'); // (4, 8) — onStepFinish queues warp + starts fadeOut

    // Run the fade timer (FADE_DURATION = 0.25s) to completion.
    tickStep(scene, 0.4);

    expect(warpTarget).toBe('ROUTE31:fromLab');
  });

  test('round-trip: ROUTE31:fromLab spawn is valid and walking back into the LAB door warps to LAB:fromRoute', () => {
    let warpTarget: string | null = null;
    const input = mockInput();
    const scene = createOverworldScene({
      map: 'ROUTE31',
      spawn: 'fromLab',
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

    // ROUTE31 fromLab spawn is (4, 5) facing down. The LAB door warp is at (4, 4).
    walkOne(scene, input, 'up'); // (4, 4)

    // Fade timer for outbound warp.
    tickStep(scene, 0.4);

    expect(warpTarget).toBe('LAB:fromRoute');
  });

  test('GYM:fromRoute spawn loads + the gym door at (7,15) warps back to ROUTE31:fromGym', () => {
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

    expect(warpTarget).toBe('ROUTE31:fromGym');
  });
});
