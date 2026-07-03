// SFX slice 2 — the new overworld emit sites fire on the right action: a textbox
// opening (dialogue-open), paging it forward (dialogue-advance), and stepping through
// a building DOOR (door-enter) — but NOT a route-edge warp. Presentation-only emits;
// they ride the existing gameEvents bus (the audio subscriber turns them into sound).

import { afterEach, describe, expect, test } from 'vitest';
import { createOverworldScene } from './overworld';
import { getMap } from '../overworld/maps';
import type { MapObject } from '../overworld/types';
import { clearGameEventListeners, onGameEvent } from '../gameEvents';
import type { GameEvent, GameEventKind } from '../gameEvents';
import type { InputKey } from '../scene';
import type { InputState } from '../input';

function mockInput(): InputState & { press(k: InputKey): void; release(k: InputKey): void } {
  const held = new Set<InputKey>();
  return {
    pressed: (k: InputKey) => held.has(k),
    press: (k: InputKey) => void held.add(k),
    release: (k: InputKey) => void held.delete(k),
  };
}
function mockFlags() {
  const set = new Set<string>();
  return { has: (f: string) => set.has(f), set: (f: string) => void set.add(f), unset: (f: string) => void set.delete(f) };
}

// Build a Hearthwick scene at a spawn + record every emitted event kind.
function harness(at: { x: number; y: number; facing: 'up' | 'down' | 'left' | 'right' }) {
  const input = mockInput();
  const kinds: GameEventKind[] = [];
  onGameEvent((e: GameEvent) => kinds.push(e.kind));
  const scene = createOverworldScene({
    map: 'HEARTHWICK',
    spawn: 'fromHouse',
    spawnAt: at,
    inputState: input,
    flags: mockFlags(),
    random: () => 0.999, // no wild rolls (Hearthwick has none anyway)
    onWarp: () => {},
    onEncounter: () => {},
    onTrainerBattle: () => {},
    onBossBattle: () => {},
  });
  const press = (k: InputKey) => scene.input?.(k);
  const walk = (dir: 'up' | 'down' | 'left' | 'right') => {
    input.press(dir);
    for (let i = 0; i < 30 && /* until it moves */ true; i += 1) scene.update?.(0.02);
    input.release(dir);
    for (let i = 0; i < 16; i += 1) scene.update?.(0.02);
  };
  return { kinds, press, walk };
}

describe('overworld audio emit sites (slice 2)', () => {
  afterEach(() => clearGameEventListeners());

  test('talking to a sign emits dialogue-open, then paging emits dialogue-advance', () => {
    // Authored town: sign_pokecenter sits at (10,26); stand just below (10,27) facing up.
    const h = harness({ x: 10, y: 27, facing: 'up' });
    h.press('a'); // face the sign → openDialog
    expect(h.kinds).toContain('dialogue-open');
    expect(h.kinds).not.toContain('dialogue-advance');
    h.press('a'); // page the conversation forward
    expect(h.kinds.filter((k) => k === 'dialogue-advance').length).toBeGreaterThanOrEqual(1);
  });

  test('stepping through a BUILDING DOOR emits door-enter', () => {
    // Player-home door is warp_player_home @(7,13) → HOUSE (interior); spawn just below
    // (7,14) and walk up onto it. (Imported map: door-enter keys off the non-ROUTE warp.)
    const h = harness({ x: 7, y: 14, facing: 'up' });
    h.walk('up');
    expect(h.kinds).toContain('door-enter');
  });

  test('a route-EDGE warp (ROUTE target, not a building) does NOT emit door-enter', () => {
    // The south exit warp_to_route31 @(18,35) → ROUTE31; approach from (19,35) facing left.
    const h = harness({ x: 19, y: 35, facing: 'left' });
    h.walk('left');
    expect(h.kinds).not.toContain('door-enter');
  });
});

describe('overworld audio emit sites — building doors vs the route edge', () => {
  test('Hearthwick: building-door warps carry door:true; the route-edge exit does not', () => {
    // The authored (Tiled) town has no door-tile LABELS — door-enter keys off the
    // warp's explicit `door` flag (set on building-entrance warps by the wiring).
    const m = getMap('HEARTHWICK');
    const warpAt = (x: number, y: number) =>
      m.objects.find((o): o is Extract<MapObject, { type: 'warp' }> => o.type === 'warp' && o.x === x && o.y === y);
    expect(warpAt(7, 13)).toMatchObject({ target: 'HOUSE:fromHearthwick', door: true }); // building door → blip
    const south = warpAt(18, 35);
    expect(south?.target).toBe('ROUTE31:fromHearthwick'); // route edge → no blip
    expect(south?.door).toBeUndefined();
  });
});
