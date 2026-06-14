// Phase 4 GATE: the pause menu opens from the overworld, POKEMON
// reflects the real run.party, SUMMARY shows the moveset, and party
// REORDER mutates the live array (which main.ts shares with the save
// path so the new order persists).

import { describe, expect, test } from 'vitest';
import ch1BatchData from '../../docs/ch1-batch.json';
import movesData from '../../docs/moves.json';
import {
  createSide,
  loadDex,
  loadMoves,
  registerMoves,
} from '../engine';
import type { DexEntryJson, MoveJson, SideState } from '../engine';
import { createPauseMenuScene } from './scenes/pauseMenu';
import { createPartyMenuScene } from './scenes/partyMenu';

registerMoves(loadMoves(movesData as MoveJson[]));
const CH1 = loadDex(ch1BatchData as DexEntryJson[], 13);

// Recording context — mirrors the helper used by battle/team tests.
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

describe('Phase 4 — pause menu', () => {
  function buildPause(): {
    scene: ReturnType<typeof createPauseMenuScene>;
    calls: Record<'pokemon' | 'bag' | 'save' | 'options' | 'close', number>;
  } {
    const calls = { pokemon: 0, bag: 0, save: 0, options: 0, close: 0 };
    const scene = createPauseMenuScene({
      onPokemon: () => {
        calls.pokemon += 1;
      },
      onBag: () => {
        calls.bag += 1;
      },
      onSave: () => {
        calls.save += 1;
      },
      onOptions: () => {
        calls.options += 1;
      },
      onClose: () => {
        calls.close += 1;
      },
    });
    return { scene, calls };
  }

  test('renders POKEMON / BAG / SAVE / OPTIONS / BOX (greyed) / EXIT rows', () => {
    const { scene } = buildPause();
    const ctx = stubCtx();
    scene.draw(ctx);
    const screen = ctx.texts.join('|');
    expect(screen).toContain('POKEMON');
    expect(screen).toContain('BAG');
    expect(screen).toContain('SAVE');
    expect(screen).toContain('OPTIONS');
    expect(screen).toContain('BOX');
    expect(screen).toContain('EXIT');
    // Phase 5a: BAG is no longer greyed. BOX still labelled with the
    // phase it ships in (Phase 6 catching).
    expect(screen).toContain('BOX (Phase 6)');
    expect(screen).not.toContain('BAG (Phase 5)');
  });

  test('A on POKEMON invokes onPokemon (push party menu)', () => {
    const { scene, calls } = buildPause();
    // Cursor defaults to row 0 (POKEMON).
    scene.input?.('a');
    expect(calls.pokemon).toBe(1);
    expect(calls.save).toBe(0);
  });

  test('A on BAG invokes onBag (Phase 5a — was greyed in Phase 4)', () => {
    const { scene, calls } = buildPause();
    // POKEMON → BAG (cursor 1)
    scene.input?.('down');
    scene.input?.('a');
    expect(calls.bag).toBe(1);
  });

  test('cursor skips greyed BOX row on DOWN', () => {
    const { scene, calls } = buildPause();
    // POKEMON (0) → BAG (1) → SAVE (2) → OPTIONS (3) → (skip BOX 4) → EXIT (5)
    scene.input?.('down'); // BAG
    scene.input?.('down'); // SAVE
    scene.input?.('down'); // OPTIONS
    scene.input?.('down'); // skip BOX → EXIT
    scene.input?.('a'); // confirm EXIT
    expect(calls.close).toBe(1);
  });

  test('A on SAVE invokes onSave and flashes a "Saved." confirmation', () => {
    const { scene, calls } = buildPause();
    // POKEMON → BAG → SAVE
    scene.input?.('down');
    scene.input?.('down');
    scene.input?.('a');
    expect(calls.save).toBe(1);
    const ctx = stubCtx();
    scene.draw(ctx);
    expect(ctx.texts.join('|')).toContain('Saved.');
  });

  test('B / START closes the menu (calls onClose)', () => {
    const { scene, calls } = buildPause();
    scene.input?.('b');
    expect(calls.close).toBe(1);
    scene.input?.('start');
    expect(calls.close).toBe(2);
  });
});

describe('Phase 4 — party menu', () => {
  function buildPartyScene(party: SideState[]): {
    scene: ReturnType<typeof createPartyMenuScene>;
    reorderCalls: number;
    closeCalls: number;
    party: SideState[];
  } {
    let reorderCalls = 0;
    let closeCalls = 0;
    const scene = createPartyMenuScene({
      party,
      onReorder: () => {
        reorderCalls += 1;
      },
      onClose: () => {
        closeCalls += 1;
      },
    });
    return {
      scene,
      get reorderCalls() {
        return reorderCalls;
      },
      get closeCalls() {
        return closeCalls;
      },
      party,
    } as unknown as {
      scene: ReturnType<typeof createPartyMenuScene>;
      reorderCalls: number;
      closeCalls: number;
      party: SideState[];
    };
  }

  test('list reflects the live run.party (species names rendered in order)', () => {
    const party = [createSide(CH1.GRUBLEAF!), createSide(CH1.KINDRAKE!), createSide(CH1.SILTSKIP!)];
    const { scene } = buildPartyScene(party);
    const ctx = stubCtx();
    scene.draw(ctx);
    const screen = ctx.texts.join('|');
    expect(screen).toContain('GRUBLEAF');
    expect(screen).toContain('KINDRAKE');
    expect(screen).toContain('SILTSKIP');
    // Lead label sits on the first row.
    const grubIdx = ctx.texts.findIndex((t) => t.includes('GRUBLEAF'));
    const leadIdx = ctx.texts.findIndex((t) => t === 'LEAD');
    expect(leadIdx).toBeGreaterThanOrEqual(grubIdx);
  });

  test('damaged HP shows damaged in the list (matches writeback)', () => {
    const grub = { ...createSide(CH1.GRUBLEAF!), hp: 12 };
    const { scene } = buildPartyScene([grub, createSide(CH1.KINDRAKE!)]);
    const ctx = stubCtx();
    scene.draw(ctx);
    expect(ctx.texts.join('|')).toContain('12/');
  });

  test('A on a mon opens the action sub-menu (SUMMARY / MOVE / BACK)', () => {
    const { scene } = buildPartyScene([
      createSide(CH1.GRUBLEAF!),
      createSide(CH1.SILTSKIP!),
    ]);
    scene.input?.('a');
    const ctx = stubCtx();
    scene.draw(ctx);
    const screen = ctx.texts.join('|');
    expect(screen).toContain('SUMMARY');
    expect(screen).toContain('MOVE');
    expect(screen).toContain('BACK');
  });

  test('SUMMARY shows the moveset with tier tags', () => {
    const { scene } = buildPartyScene([createSide(CH1.GRUBLEAF!)]);
    scene.input?.('a'); // action sub-menu
    scene.input?.('a'); // SUMMARY (cursor 0)
    const ctx = stubCtx();
    scene.draw(ctx);
    const screen = ctx.texts.join('|');
    // GRUBLEAF at lvl 13: TACKLE / THORN FLICK / LEAF LASH / HEADBUTT.
    expect(screen).toContain('TACKLE');
    expect(screen).toContain('THORN FLICK');
    expect(screen).toContain('LEAF LASH');
    expect(screen).toContain('HEADBUTT');
    // Bond placeholder (the forward-hook for the bond system).
    expect(screen).toContain('BOND');
    expect(screen).toContain('pending');
  });

  test('reorder swaps the lead with the second mon and fires onReorder', () => {
    let reorderCalls = 0;
    const party = [createSide(CH1.GRUBLEAF!), createSide(CH1.SILTSKIP!)];
    const scene = createPartyMenuScene({
      party,
      onReorder: () => {
        reorderCalls += 1;
      },
      onClose: () => {},
    });
    // Cursor on GRUBLEAF (idx 0).
    scene.input?.('a'); // action menu
    scene.input?.('down'); // MOVE (cursor 1)
    scene.input?.('a'); // enter reorder
    scene.input?.('down'); // swap GRUBLEAF ↔ SILTSKIP
    scene.input?.('a'); // confirm placement
    expect(party[0]!.species.name).toBe('SILTSKIP');
    expect(party[1]!.species.name).toBe('GRUBLEAF');
    expect(reorderCalls).toBe(1);
  });

  test('B in list mode closes back to pause', () => {
    let closeCalls = 0;
    const scene = createPartyMenuScene({
      party: [createSide(CH1.GRUBLEAF!)],
      onReorder: () => {},
      onClose: () => {
        closeCalls += 1;
      },
    });
    scene.input?.('b');
    expect(closeCalls).toBe(1);
  });

  test('reorder caps at array bounds (no swap when at the top)', () => {
    const party = [createSide(CH1.GRUBLEAF!), createSide(CH1.SILTSKIP!)];
    const scene = createPartyMenuScene({
      party,
      onReorder: () => {},
      onClose: () => {},
    });
    scene.input?.('a'); // action
    scene.input?.('down'); // MOVE
    scene.input?.('a'); // reorder, lifted at idx 0
    scene.input?.('up'); // no-op (already at top)
    expect(party[0]!.species.name).toBe('GRUBLEAF');
  });
});
