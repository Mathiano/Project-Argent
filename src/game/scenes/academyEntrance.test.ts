// Academy entrance — the run-ending soft-lock fix (#12) + KAMON disposition (#13).
//
// The Academy door (13,22) is walled (academy, solid) on three sides; its ONLY
// walkable approach is (13,21) from the north. The post-gym ACADEMY USHER used to
// sit ON (13,21) — and NPCs are always solid — so it blocked the single entry path
// and ended the run. Fix: the Usher now stands BESIDE the door (14,21), guiding not
// blocking. This mirrors the Violet gate egress walk-tests (violetGate.test).
//
// KAMON: the only Violet KAMON is the SOUTH-gate rival fight (6,28) — far from the
// Academy approach. This pins that he is not on the Academy entrance path.

import { describe, expect, test } from 'vitest';
import { createOverworldScene } from './overworld';
import type { FlagStore } from './overworld';
import { getMap } from '../overworld/maps';
import type { InputKey } from '../scene';
import type { InputState } from '../input';

const DOOR = { x: 13, y: 22 }; // academy_door (the warp)
const APPROACH = { x: 13, y: 21 }; // the ONLY walkable cell into the door
const NORTH = { x: 13, y: 20 }; // one tile further north, in the square

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
function makeViolet(flags: FlagStore, at: { x: number; y: number }) {
  const input = mockInput();
  let warpedTo: string | null = null;
  const scene = createOverworldScene({
    map: 'VIOLET',
    spawn: 'fromRoute',
    spawnAt: { x: at.x, y: at.y, facing: 'down' },
    inputState: input,
    flags,
    random: () => 0,
    onWarp: (t) => { warpedTo = t; },
    onEncounter: () => {},
    onTrainerBattle: () => {},
    onBossBattle: () => {},
    onRivalBattle: () => {},
  });
  function walk(dir: 'up' | 'down' | 'left' | 'right'): void {
    input.press(dir);
    scene.update?.(0.02);
    input.release(dir);
    for (let i = 0; i < 14; i += 1) scene.update?.(0.02);
  }
  return {
    walk,
    pos: () => scene.currentPosition(),
    warpedTo: () => warpedTo,
    settle: () => { for (let i = 0; i < 40; i += 1) scene.update?.(0.02); },
  };
}

describe('Academy entrance — map wiring (#12/#13)', () => {
  const v = getMap('VIOLET');
  const npcAt = (x: number, y: number) =>
    v.objects.filter((o) => o.type === 'npc' && o.x === x && o.y === y);

  test('the door warp is ungated + walkable; its only approach (13,21) is clear of NPCs', () => {
    const warp = v.objects.find((o) => o.type === 'warp' && o.x === DOOR.x && o.y === DOOR.y) as
      | Extract<typeof v.objects[number], { type: 'warp' }> | undefined;
    expect(warp?.target).toBe('VIOLET_ACADEMY:fromViolet');
    expect(warp && 'requiresFlag' in warp).toBe(false); // enterable anytime
    expect(npcAt(APPROACH.x, APPROACH.y)).toHaveLength(0); // ← the soft-lock fix: nothing sits on the approach
  });

  test('the Usher stands BESIDE the door (14,21), still gated to academy_promoted', () => {
    const usher = npcAt(14, 21).find((o) => JSON.stringify(o).includes('ACADEMY USHER')) as
      | Extract<typeof v.objects[number], { type: 'npc' }> | undefined;
    expect(usher).toBeDefined();
    expect(usher!.requiresFlag).toBe('academy_promoted');
  });

  test('KAMON is the SOUTH-gate rival fight, not on the Academy approach', () => {
    const kamons = v.objects.filter((o) => o.type === 'npc' && JSON.stringify(o).includes('KAMON'));
    expect(kamons.length).toBeGreaterThan(0);
    for (const k of kamons) {
      const kn = k as { x: number; y: number };
      expect(kn.y).toBe(28); // all KAMON markers live at the south gate (row 28), not the Academy (row 21/22)
      expect(`${kn.x},${kn.y}`).not.toBe(`${APPROACH.x},${APPROACH.y}`);
    }
  });
});

describe('Academy entrance — walkable post-academy_promoted (no soft-lock)', () => {
  test('the player walks from the square through the door into the Academy', () => {
    // academy_promoted → the Usher is present (beside the door); zephyr_earned →
    // KAMON is present (at the south gate, NOT beaten) — proving neither blocks here.
    const h = makeViolet(mockFlags(['academy_promoted', 'zephyr_earned']), NORTH);
    h.walk('down'); // (13,20) → (13,21): the approach is NOT blocked by the Usher
    expect(h.pos()).toMatchObject(APPROACH);
    h.walk('down'); // (13,21) → step onto the door warp (13,22)
    h.settle();
    expect(h.warpedTo()).toBe('VIOLET_ACADEMY:fromViolet'); // entered — no soft-lock
  });

  test('even with KAMON present-and-unbeaten, the Academy entrance is unaffected', () => {
    const h = makeViolet(mockFlags(['academy_promoted', 'zephyr_earned']), APPROACH);
    h.walk('down'); // straight onto the door from the approach
    h.settle();
    expect(h.warpedTo()).toBe('VIOLET_ACADEMY:fromViolet');
  });
});
