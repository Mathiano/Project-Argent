// SFX slice 2 — the new overworld emit sites fire on the right action: a textbox
// opening (dialogue-open), paging it forward (dialogue-advance), and stepping through
// a building DOOR (door-enter) — but NOT a route-edge warp. Presentation-only emits;
// they ride the existing gameEvents bus (the audio subscriber turns them into sound).

import { afterEach, describe, expect, test } from 'vitest';
import { createOverworldScene } from './overworld';
import { getMap } from '../overworld/maps';
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
    // The HEARTHWICK sign sits at (1,5); stand at (2,5) facing it.
    const h = harness({ x: 2, y: 5, facing: 'left' });
    h.press('a'); // face the sign → openDialog
    expect(h.kinds).toContain('dialogue-open');
    expect(h.kinds).not.toContain('dialogue-advance');
    h.press('a'); // page the conversation forward
    expect(h.kinds.filter((k) => k === 'dialogue-advance').length).toBeGreaterThanOrEqual(1);
  });

  test('stepping through a BUILDING DOOR emits door-enter', () => {
    // Player house door is the wall_door at (3,3); spawn just below (3,4), walk up onto it.
    const h = harness({ x: 3, y: 4, facing: 'up' });
    h.walk('up');
    expect(h.kinds).toContain('door-enter');
  });

  test('a route-EDGE warp (path tile, not a door) does NOT emit door-enter', () => {
    // The south exit to Route 31 is the path_exit tile at (9,13); walk onto it from (9,12).
    const h = harness({ x: 9, y: 12, facing: 'down' });
    h.walk('down');
    expect(h.kinds).not.toContain('door-enter');
  });
});

describe('overworld audio emit sites — the door tiles are real, the edge is not', () => {
  test('Hearthwick: the house-door warp sits on a door tile; the south exit does not', () => {
    const m = getMap('HEARTHWICK');
    const labelAt = (x: number, y: number) => {
      const ch = m.tiles.split('\n')[y]?.[x];
      return ch ? m.tileset[ch]?.label : undefined;
    };
    expect(labelAt(3, 3)).toContain('door'); // building door
    expect(labelAt(9, 13)).not.toContain('door'); // route edge (path_exit)
  });
});
