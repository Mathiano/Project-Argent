// Phase 5a items + bag — pure-function tests for the effect pipeline,
// the bag helpers, the bag UI scene (use-item happy path), and the
// Pokémon Center heal-party script verb wired to the NURSE NPC.

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
import { createBagMenuScene } from './scenes/bagMenu';
import { createOverworldScene } from './scenes/overworld';
import type { InputKey } from './scene';
import {
  ITEMS,
  POCKETS,
  applyItemEffect,
  bagAdd,
  bagByPocket,
  bagConsume,
  lookupItem,
} from './items';
import type { BagEntry } from './items';

// Lightweight ctx stub — bag scene only needs the methods to no-op.
function stubCtx(): CanvasRenderingContext2D {
  const noop = () => {};
  return new Proxy(
    {},
    {
      get(_t, prop) {
        if (prop === 'measureText') return () => ({ width: 10 });
        if (prop === 'canvas') return { width: 320, height: 180 };
        return noop;
      },
      set() {
        return true;
      },
    },
  ) as unknown as CanvasRenderingContext2D;
}

function mockFlags(): { has(f: string): boolean; set(f: string): void; unset(f: string): void } {
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

function mockInput(): {
  pressed(k: InputKey): boolean;
  press(k: InputKey): void;
  release(k: InputKey): void;
  releaseAll(): void;
} {
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

registerMoves(loadMoves(movesData as MoveJson[]));
const CH1 = loadDex(ch1BatchData as DexEntryJson[], 13);

describe('items registry + lookup', () => {
  test('ships POTION / SUPER POTION / FULL HEAL in the medicine pocket', () => {
    expect(ITEMS.POTION!.category).toBe('medicine');
    expect(ITEMS['SUPER POTION']!.category).toBe('medicine');
    expect(ITEMS['FULL HEAL']!.category).toBe('medicine');
  });

  test('POCKETS lists all five pocket categories in display order', () => {
    expect(POCKETS).toEqual(['medicine', 'items', 'berries', 'keyitems', 'balls']);
  });

  test('lookupItem throws on unknown ids (loud-fail)', () => {
    expect(() => lookupItem('NOT_A_REAL_ITEM')).toThrow(/unknown item/);
  });
});

describe('applyItemEffect', () => {
  test('POTION heals 20 HP, clamped to maxHp', () => {
    const grub = createSide(CH1.GRUBLEAF!);
    const wounded = { ...grub, hp: 10 };
    const { result, delta, noop } = applyItemEffect(wounded, ITEMS.POTION!);
    expect(noop).toBe(false);
    expect(result.hp).toBe(30);
    expect(delta.hp).toBe(20);
  });

  test('POTION on a near-full mon clamps the heal to maxHp (no over-fill)', () => {
    const grub = createSide(CH1.GRUBLEAF!); // maxHp 54
    const lightlyWounded = { ...grub, hp: 50 };
    const { result, delta } = applyItemEffect(lightlyWounded, ITEMS.POTION!);
    expect(result.hp).toBe(54);
    expect(delta.hp).toBe(4);
  });

  test('POTION on a full mon is a no-op (UI cue, no waste)', () => {
    const grub = createSide(CH1.GRUBLEAF!);
    const { result, noop } = applyItemEffect(grub, ITEMS.POTION!);
    expect(noop).toBe(true);
    expect(result).toBe(grub);
  });

  test('POTION cannot revive a fainted mon (Phase 5a — no Revive yet)', () => {
    const grub = createSide(CH1.GRUBLEAF!);
    const fainted = { ...grub, hp: 0 };
    const { result, noop } = applyItemEffect(fainted, ITEMS.POTION!);
    expect(noop).toBe(true);
    expect(result.hp).toBe(0);
  });

  test('SUPER POTION heals 50 HP', () => {
    const grub = createSide(CH1.GRUBLEAF!);
    const wounded = { ...grub, hp: 4 };
    const { result } = applyItemEffect(wounded, ITEMS['SUPER POTION']!);
    expect(result.hp).toBe(Math.min(grub.maxHp, 4 + 50));
  });

  test('FULL HEAL restores HP to full AND clears exhausted/staggered', () => {
    const grub = createSide(CH1.GRUBLEAF!);
    const broken = { ...grub, hp: 1, exhausted: true, staggered: true };
    const { result, delta } = applyItemEffect(broken, ITEMS['FULL HEAL']!);
    expect(result.hp).toBe(grub.maxHp);
    expect(result.exhausted).toBe(false);
    expect(result.staggered).toBe(false);
    expect(delta.statusCleared).toBe(true);
  });
});

describe('bag helpers (add / consume / pocket grouping)', () => {
  test('bagAdd stacks with an existing entry of the same id', () => {
    const bag: BagEntry[] = [];
    bagAdd(bag, 'POTION', 2);
    bagAdd(bag, 'POTION', 1);
    expect(bag.length).toBe(1);
    expect(bag[0]!.qty).toBe(3);
  });

  test('bagAdd creates a new entry for a different id', () => {
    const bag: BagEntry[] = [{ itemId: 'POTION', qty: 1 }];
    bagAdd(bag, 'SUPER POTION', 1);
    expect(bag.length).toBe(2);
  });

  test('bagConsume decrements qty and removes at zero', () => {
    const bag: BagEntry[] = [{ itemId: 'POTION', qty: 2 }];
    bagConsume(bag, 'POTION');
    expect(bag[0]!.qty).toBe(1);
    bagConsume(bag, 'POTION');
    expect(bag.length).toBe(0);
  });

  test('bagConsume returns false on missing id', () => {
    const bag: BagEntry[] = [];
    expect(bagConsume(bag, 'POTION')).toBe(false);
  });

  test('bagByPocket groups entries into the five pockets (others empty)', () => {
    const bag: BagEntry[] = [
      { itemId: 'POTION', qty: 3 },
      { itemId: 'SUPER POTION', qty: 1 },
    ];
    const grouped = bagByPocket(bag);
    expect(grouped.medicine.length).toBe(2);
    expect(grouped.items.length).toBe(0);
    expect(grouped.berries.length).toBe(0);
    expect(grouped.keyitems.length).toBe(0);
    expect(grouped.balls.length).toBe(0);
  });
});

describe('Phase 5a GATE — bag UI: pocket reflects inventory + use mutates state', () => {
  test('use POTION on a wounded mon heals it, decrements bag qty, and fires onChange', () => {
    const wounded: SideState = { ...createSide(CH1.GRUBLEAF!), hp: 10 };
    const party: SideState[] = [wounded];
    const bag: BagEntry[] = [{ itemId: 'POTION', qty: 2 }];
    let changes = 0;
    let closes = 0;
    const scene = createBagMenuScene({
      bag,
      party,
      onChange: () => {
        changes += 1;
      },
      onClose: () => {
        closes += 1;
      },
    });
    // Tab defaults to medicine (idx 0). Item cursor on POTION.
    scene.input?.('a'); // → target picker
    scene.input?.('a'); // → useFocusedItem on party[0]
    expect(party[0]!.hp).toBe(30); // 10 + 20
    expect(bag[0]!.qty).toBe(1); // decremented
    expect(changes).toBe(1);
    expect(closes).toBe(0);
  });

  test('using the last of an item removes the bag entry entirely', () => {
    const wounded: SideState = { ...createSide(CH1.GRUBLEAF!), hp: 10 };
    const party: SideState[] = [wounded];
    const bag: BagEntry[] = [{ itemId: 'POTION', qty: 1 }];
    const scene = createBagMenuScene({
      bag,
      party,
      onChange: () => {},
      onClose: () => {},
    });
    scene.input?.('a'); // target picker
    scene.input?.('a'); // use
    expect(bag.length).toBe(0);
  });

  test('using POTION on a full-HP mon is a no-op (toast, qty unchanged, no onChange)', () => {
    const full: SideState = createSide(CH1.GRUBLEAF!);
    const party: SideState[] = [full];
    const bag: BagEntry[] = [{ itemId: 'POTION', qty: 1 }];
    let changes = 0;
    const scene = createBagMenuScene({
      bag,
      party,
      onChange: () => {
        changes += 1;
      },
      onClose: () => {},
    });
    scene.input?.('a'); // target picker
    scene.input?.('a'); // attempt use — no-op toast
    expect(bag[0]!.qty).toBe(1);
    expect(party[0]!.hp).toBe(full.hp);
    expect(changes).toBe(0);
  });

  test('B in list mode closes the bag (back to pause menu)', () => {
    let closes = 0;
    const scene = createBagMenuScene({
      bag: [],
      party: [createSide(CH1.GRUBLEAF!)],
      onChange: () => {},
      onClose: () => {
        closes += 1;
      },
    });
    scene.input?.('b');
    expect(closes).toBe(1);
  });

  test('RIGHT cycles to the next pocket (medicine → items)', () => {
    // Smoke test: the scene accepts pocket navigation without throwing
    // and the render path handles an empty focused pocket cleanly.
    const scene = createBagMenuScene({
      bag: [{ itemId: 'POTION', qty: 1 }],
      party: [createSide(CH1.GRUBLEAF!)],
      onChange: () => {},
      onClose: () => {},
    });
    scene.input?.('right'); // medicine → items (empty)
    scene.draw(stubCtx()); // empty pocket renders '— empty —' (no throw)
    scene.input?.('left'); // back to medicine
    scene.draw(stubCtx());
  });
});

describe('Phase 5a GATE — Pokémon Center heal-party script verb wires through the NURSE NPC', () => {
  test('interacting with the NURSE fires onHealParty after the opening dialog', () => {
    let healCalls = 0;
    const input = mockInput();
    const scene = createOverworldScene({
      map: 'HEARTHWICK_CENTER',
      spawn: 'fromHearthwick',
      inputState: input,
      flags: mockFlags(),
      onWarp: () => {},
      onEncounter: () => {},
      onTrainerBattle: () => {},
      onBossBattle: () => {},
      onHealParty: () => {
        healCalls += 1;
      },
      // Skip the fade-in.
    });

    function walkOne(dir: 'up' | 'down' | 'left' | 'right'): void {
      input.press(dir);
      scene.update?.(0.02);
      input.release(dir);
      for (let i = 0; i < 12; i += 1) scene.update?.(0.02);
    }

    // Spawn fromHearthwick is (4, 6) facing up. NURSE NPC is at (2, 2).
    // The player can stand on (2, 3) facing up and press A to interact.
    walkOne('left'); // (3, 6) facing left
    walkOne('left'); // (2, 6) facing left
    walkOne('up'); // (2, 5) facing up
    walkOne('up'); // (2, 4) facing up
    walkOne('up'); // (2, 3) facing up — right in front of NURSE

    expect(scene.currentPosition()).toEqual({
      map: 'HEARTHWICK_CENTER',
      x: 2,
      y: 3,
      facing: 'up',
    });

    // A → triggers NURSE.interact: dialog (5 lines @ 3-per-page = 2
    // pages) → heal-party → second dialog (5 lines = 2 pages).
    scene.input?.('a');
    expect(healCalls).toBe(0); // first dialog page open, no heal yet.
    // Advance through dialog pages — heal fires after the first dialog
    // closes, before the second dialog opens.
    scene.input?.('a'); // page 2 of first dialog
    scene.input?.('a'); // closes first dialog → runs heal-party + opens 2nd
    expect(healCalls).toBe(1);
  });
});
