// Phase 6.5 GATE — UI behaviour for the two record scenes:
//   Box: deposit moves a mon party→box + fires onChange; the last-mon
//        deposit is blocked with a message (party never empties).
//   Dex: the detail panel renders the three status states — CAUGHT full,
//        SEEN partial, UNSEEN unknown.

import { describe, expect, test } from 'vitest';
import ch1BatchData from '../../../docs/ch1-batch.json';
import movesData from '../../../docs/moves.json';
import { createSide, loadDex, loadMoves, registerMoves } from '../../engine';
import type { DexEntryJson, MoveJson, SideState, Species } from '../../engine';
import { createBoxMenuScene } from './boxMenu';
import { createDexMenuScene } from './dexMenu';
import type { DexUiEntry } from './dexMenu';
import type { DexStatus } from '../dex';

registerMoves(loadMoves(movesData as MoveJson[]));
const CH1 = loadDex(ch1BatchData as DexEntryJson[], 13);
const sp = (n: string): Species => CH1[n]!;

interface RecordingCtx extends CanvasRenderingContext2D {
  readonly texts: string[];
  reset(): void;
}
function stubCtx(): RecordingCtx {
  const noop = () => {};
  const texts: string[] = [];
  return new Proxy(
    { texts, reset: () => texts.splice(0) },
    {
      get(target, prop) {
        if (prop === 'texts') return (target as { texts: string[] }).texts;
        if (prop === 'reset') return (target as { reset: () => void }).reset;
        if (prop === 'fillText') return (text: string) => texts.push(String(text));
        if (prop === 'measureText') return () => ({ width: 10 });
        if (prop === 'canvas') return { width: 320, height: 180 };
        return noop;
      },
      set() {
        return true;
      },
    },
  ) as unknown as RecordingCtx;
}

describe('Phase 6.5 — Box UI', () => {
  function build(partyNames: string[], boxNames: string[]) {
    const party: SideState[] = partyNames.map((n) => createSide(sp(n)));
    const partyBond = partyNames.map((_, i) => 10 + i);
    const box: SideState[] = boxNames.map((n) => createSide(sp(n)));
    const boxBond = boxNames.map(() => 5);
    let changes = 0;
    let closed = 0;
    const scene = createBoxMenuScene({
      party,
      partyBond,
      box,
      boxBond,
      onChange: () => {
        changes += 1;
      },
      onClose: () => {
        closed += 1;
      },
    });
    return {
      scene,
      party,
      box,
      get changes() {
        return changes;
      },
      get closed() {
        return closed;
      },
    };
  }

  test('deposit moves a party mon into the box and fires onChange', () => {
    const h = build(['KINDRAKE', 'GRUBLEAF'], []);
    // Focus PARTY (default), move to the second mon, open action, DEPOSIT.
    h.scene.input?.('down'); // cursor → GRUBLEAF
    h.scene.input?.('a'); // open action popup (SUMMARY/DEPOSIT/BACK)
    h.scene.input?.('down'); // → DEPOSIT
    h.scene.input?.('a'); // confirm
    expect(h.party.map((m) => m.species.name)).toEqual(['KINDRAKE']);
    expect(h.box.map((m) => m.species.name)).toEqual(['GRUBLEAF']);
    expect(h.changes).toBe(1);
  });

  test('depositing the last mon is blocked with a message (no onChange)', () => {
    const h = build(['KINDRAKE'], []);
    h.scene.input?.('a'); // action popup
    h.scene.input?.('down'); // → DEPOSIT
    h.scene.input?.('a'); // attempt
    expect(h.party.length).toBe(1); // unchanged
    expect(h.changes).toBe(0);
    const ctx = stubCtx();
    h.scene.draw(ctx);
    expect(ctx.texts.join('|').toLowerCase()).toContain('last mon');
  });

  test('B from the browse view closes the scene', () => {
    const h = build(['KINDRAKE', 'GRUBLEAF'], []);
    h.scene.input?.('b');
    expect(h.closed).toBe(1);
  });
});

describe('Phase 6.5 — Dex UI status states', () => {
  const ENTRIES: readonly DexUiEntry[] = [
    { num: 1, name: 'KINDRAKE', types: ['FLAME'], flavor: 'A warm drake.', evoHint: 'Evolves into KILNDRAKE with a deep bond.' },
    { num: 2, name: 'FLITPECK', types: ['GALE'], flavor: 'A quick bird.', evoHint: 'No known evolution.' },
    { num: 3, name: 'GALEHAWK', types: ['GALE'], flavor: 'A proud raptor.', evoHint: 'No known evolution.' },
  ];
  const status: Record<string, DexStatus> = {
    KINDRAKE: 'caught',
    FLITPECK: 'seen',
    GALEHAWK: 'unseen',
  };

  function render(cursorDowns: number): string {
    const scene = createDexMenuScene({
      entries: ENTRIES,
      status: (n) => status[n] ?? 'unseen',
      onClose: () => {},
    });
    for (let i = 0; i < cursorDowns; i += 1) scene.input?.('down');
    const ctx = stubCtx();
    scene.draw(ctx);
    return ctx.texts.join('|');
  }

  test('CAUGHT entry shows full record (name, type, CAUGHT, flavor)', () => {
    const screen = render(0); // cursor on KINDRAKE
    expect(screen).toContain('KINDRAKE');
    expect(screen).toContain('CAUGHT');
    expect(screen).toContain('Type: FLAME');
    expect(screen).toContain('A warm drake.'); // flavor (wrapped, first words)
  });

  test('SEEN entry shows a partial record (name + SEEN, type hidden)', () => {
    const screen = render(1); // cursor on FLITPECK
    expect(screen).toContain('FLITPECK');
    expect(screen).toContain('SEEN');
    expect(screen).toContain('Type: ???'); // type withheld until caught
    expect(screen).not.toContain('A quick bird.'); // flavor withheld
  });

  test('UNSEEN entry shows unknown (??? / No data), name withheld', () => {
    const screen = render(2); // cursor on GALEHAWK
    expect(screen).toContain('???');
    expect(screen).toContain('No data.');
    // The detail panel must not reveal an unseen species' name.
    expect(screen).not.toContain('GALEHAWK');
  });

  test('header tallies seen + caught (caught counts as seen)', () => {
    const screen = render(0);
    // KINDRAKE caught + FLITPECK seen → 2 seen, 1 caught.
    expect(screen).toContain('S2 C1');
  });
});
