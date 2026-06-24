// The pause-menu back-press emits ui-cancel (the one new emit site of SFX slice 3 —
// presentation-only; it rides the gameEvents bus, the audio subscriber turns it into
// the cancel blip). B = back/cancel; START toggles the menu closed without a cancel.

import { afterEach, describe, expect, test } from 'vitest';
import { createPauseMenuScene } from './pauseMenu';
import { clearGameEventListeners, onGameEvent } from '../gameEvents';
import type { GameEventKind } from '../gameEvents';

function harness() {
  const kinds: GameEventKind[] = [];
  onGameEvent((e) => kinds.push(e.kind));
  let closed = 0;
  const scene = createPauseMenuScene({
    onPokemon: () => {},
    onBag: () => {},
    onDex: () => {},
    onSave: () => {},
    onOptions: () => {},
    onClose: () => (closed += 1),
  });
  return { kinds, scene, closed: () => closed };
}

describe('pause menu — back/cancel emit (slice 3)', () => {
  afterEach(() => clearGameEventListeners());

  test('B (back) emits ui-cancel and closes', () => {
    const h = harness();
    h.scene.input?.('b');
    expect(h.kinds).toContain('ui-cancel');
    expect(h.closed()).toBe(1);
  });

  test('START closes without a ui-cancel (it is a toggle, not a cancel)', () => {
    const h = harness();
    h.scene.input?.('start');
    expect(h.kinds).not.toContain('ui-cancel');
    expect(h.closed()).toBe(1);
  });

  test('cursor moves still emit menu-move, not ui-cancel', () => {
    const h = harness();
    h.scene.input?.('down');
    expect(h.kinds).toContain('menu-move');
    expect(h.kinds).not.toContain('ui-cancel');
  });
});
