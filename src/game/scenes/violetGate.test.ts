// Phase 7 GATE — the KAMON first-fight at the Violet→Route 32 exit.
// Integration (scripting + presence-gating), not combat: the obstacle is
// present pre-ZEPHYR and gone after; KAMON spawns post-ZEPHYR, blocks the exit,
// and fires the rival fight ONCE (gone after kamon_beaten); then the exit opens.
// The KAMON card's combat fairness is sim-gated separately (src/sim/rivalCard).

import { describe, expect, test } from 'vitest';
import { createOverworldScene } from './overworld';
import type { FlagStore } from './overworld';
import { getMap } from '../overworld/maps';
import type { InputKey } from '../scene';
import type { InputState } from '../input';

const GATE = { x: 6, y: 28 }; // the chokepoint tile (obstacle / KAMON)
const APPROACH = { x: 6, y: 27 }; // one tile north — where the player stands
const EXIT = { x: 6, y: 29 }; // the carved south warp → ROUTE32

function mockInput(): InputState & { press(k: InputKey): void; release(k: InputKey): void } {
  const held = new Set<InputKey>();
  return {
    pressed: (k: InputKey) => held.has(k),
    press: (k: InputKey) => void held.add(k),
    release: (k: InputKey) => void held.delete(k),
  };
}

function mockFlags(initial: string[] = []): FlagStore {
  const set = new Set<string>(initial);
  return { has: (f) => set.has(f), set: (f) => void set.add(f), unset: (f) => void set.delete(f) };
}

function makeViolet(flags: FlagStore) {
  const input = mockInput();
  let rivalFired = 0;
  let warpedTo: string | null = null;
  const scene = createOverworldScene({
    map: 'VIOLET',
    spawn: 'fromRoute',
    spawnAt: { x: APPROACH.x, y: APPROACH.y, facing: 'down' },
    inputState: input,
    flags,
    random: () => 0,
    onWarp: (t) => {
      warpedTo = t;
    },
    onEncounter: () => {},
    onTrainerBattle: () => {},
    onBossBattle: () => {},
    onRivalBattle: () => {
      rivalFired += 1;
    },
  });
  function walk(dir: 'up' | 'down' | 'left' | 'right'): void {
    input.press(dir);
    scene.update?.(0.02);
    input.release(dir);
    for (let i = 0; i < 14; i += 1) scene.update?.(0.02);
  }
  function pressA(times = 1): void {
    for (let i = 0; i < times; i += 1) scene.input?.('a');
  }
  // Press A until the rival fight fires (clears the pre-fight dialog), then
  // STOP — in the real game onRivalBattle pushes a battle scene so the
  // overworld stops receiving input; here it just counts, so don't over-press.
  function interactUntilFight(max = 10): void {
    for (let i = 0; i < max && rivalFired === 0; i += 1) scene.input?.('a');
  }
  return {
    scene,
    walk,
    pressA,
    interactUntilFight,
    pos: () => scene.currentPosition(),
    rivalFired: () => rivalFired,
    warpedTo: () => warpedTo,
    settle: () => {
      for (let i = 0; i < 40; i += 1) scene.update?.(0.02);
    },
  };
}

describe('Violet→Route 32 gate — map wiring', () => {
  const v = getMap('VIOLET');
  const atGate = v.objects.filter((o) => o.type === 'npc' && o.x === GATE.x && o.y === GATE.y) as Extract<
    typeof v.objects[number],
    { type: 'npc' }
  >[];

  test('an obstacle + KAMON occupy the gate tile, mutually exclusive on ZEPHYR', () => {
    const obstacle = atGate.find((n) => n.hiddenAfterFlag === 'zephyr_earned' && !n.requiresFlag);
    const kamon = atGate.find((n) => n.requiresFlag === 'zephyr_earned');
    expect(obstacle).toBeDefined();
    expect(kamon).toBeDefined();
    expect(kamon!.hiddenAfterFlag).toBe('kamon_beaten'); // gone once beaten
  });

  test('KAMON interact fires the rival fight', () => {
    const kamon = atGate.find((n) => n.requiresFlag === 'zephyr_earned')!;
    expect(kamon.interact.some((c) => c.kind === 'start-rival-battle')).toBe(true);
  });

  test('the south exit warps to the ROUTE 32 stub, which loads + warps back', () => {
    const warp = v.objects.find((o) => o.type === 'warp' && o.x === EXIT.x && o.y === EXIT.y) as
      | Extract<typeof v.objects[number], { type: 'warp' }>
      | undefined;
    expect(warp?.target).toBe('ROUTE32:fromViolet');
    const r32 = getMap('ROUTE32');
    expect(r32.objects.some((o) => o.type === 'warp' && o.target === 'VIOLET:fromRoute32')).toBe(true);
  });

  test('the obstacle is FLAVOR, not the fight (no start-rival-battle on it)', () => {
    const obstacle = atGate.find((n) => n.hiddenAfterFlag === 'zephyr_earned' && !n.requiresFlag)!;
    expect(obstacle.interact.some((c) => c.kind === 'start-rival-battle')).toBe(false);
    // it still reads (interactable blockage), so the player learns why it's shut
    expect(JSON.stringify(obstacle.interact)).toMatch(/ROUTE 32|gym|south/i);
  });

  test('KAMON runs a placeholder pre-fight line BEFORE the battle fires', () => {
    const kamon = atGate.find((n) => n.requiresFlag === 'zephyr_earned')!;
    const kinds = kamon.interact.map((c) => c.kind);
    expect(kinds[0]).toBe('dialog'); // the pre-fight voice (placeholder) comes first
    expect(kinds[kinds.length - 1]).toBe('start-rival-battle'); // then the fight
  });

  test('NO SOFT-LOCK: the reopen is gated SOLELY on kamon_beaten (so a LOSS opens it too)', () => {
    // KAMON despawns on kamon_beaten alone — main.ts sets that flag on BOTH a win
    // and a loss (loss heals first), so either outcome clears the gate. There must
    // be no separate win-only flag on KAMON or on the south warp.
    const kamon = atGate.find((n) => n.requiresFlag === 'zephyr_earned')!;
    expect(kamon.hiddenAfterFlag).toBe('kamon_beaten');
    expect(kamon.blockedUntilFlag).toBeUndefined(); // not a "beat to pass" win-gate — presence-gated only
    const warp = v.objects.find((o) => o.type === 'warp' && o.x === EXIT.x && o.y === EXIT.y) as
      | Extract<typeof v.objects[number], { type: 'warp' }>
      | undefined;
    // the exit itself carries no flag gate — it opens the moment KAMON is gone
    expect(warp && 'requiresFlag' in warp).toBe(false);
    expect(warp && 'hiddenAfterFlag' in warp).toBe(false);
  });
});

describe('Violet→Route 32 gate — transition behavior', () => {
  test('PRE-ZEPHYR: the obstacle blocks the way south', () => {
    const h = makeViolet(mockFlags()); // no flags
    h.walk('down');
    expect(h.pos()).toMatchObject({ x: APPROACH.x, y: APPROACH.y }); // didn't move — blocked
  });

  test('POST-ZEPHYR: obstacle gone, KAMON blocks + interact fires the fight ONCE', () => {
    const h = makeViolet(mockFlags(['zephyr_earned']));
    h.walk('down');
    expect(h.pos()).toMatchObject({ x: APPROACH.x, y: APPROACH.y }); // still blocked — now by KAMON
    h.interactUntilFight(); // interact: clear the pre-fight dialog → start-rival-battle
    expect(h.rivalFired()).toBe(1);
  });

  test('POST-BEATEN: KAMON gone, the exit opens (reach it + warp to ROUTE 32)', () => {
    const h = makeViolet(mockFlags(['zephyr_earned', 'kamon_beaten']));
    // KAMON is gone — interacting does nothing (the fight already happened once).
    h.pressA(4);
    expect(h.rivalFired()).toBe(0);
    h.walk('down'); // onto the now-clear gate tile
    expect(h.pos()).toMatchObject({ x: GATE.x, y: GATE.y });
    h.walk('down'); // onto the exit warp tile
    h.settle();
    expect(h.warpedTo()).toBe('ROUTE32:fromViolet');
  });
});
