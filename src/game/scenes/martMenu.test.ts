// Phase 5b GATE — Poké Mart UI flow. Drives the scene through BUY /
// SELL / qty-select / commit, wiring onBuy/onSell to the real economy
// helpers (same as main.ts) so the test proves the whole transaction:
// money moves, the bag changes, and overspending is impossible.

import { describe, expect, test } from 'vitest';
import { createMartMenuScene } from './martMenu';
import { buyItem, sellItem } from '../economy';
import type { BagEntry } from '../items';
import type { InputKey } from '../scene';

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

const STOCK = ['POTION', 'SUPER POTION', 'FULL HEAL'] as const;

function makeScene(opts: { money: number; bag?: BagEntry[] }) {
  const wallet = { money: opts.money };
  const bag: BagEntry[] = opts.bag ?? [];
  let closes = 0;
  const scene = createMartMenuScene({
    stock: STOCK,
    bag,
    getMoney: () => wallet.money,
    onBuy: (id, qty) => {
      const r = buyItem(wallet.money, bag, id, qty);
      if (r.bought) wallet.money = r.money;
      return r.bought;
    },
    onSell: (id, qty) => {
      const r = sellItem(wallet.money, bag, id, qty);
      if (r.sold) wallet.money = r.money;
      return r.sold;
    },
    onClose: () => {
      closes += 1;
    },
  });
  const send = (...keys: InputKey[]) => keys.forEach((k) => scene.input?.(k));
  return { scene, wallet, bag, send, closes: () => closes };
}

describe('Mart BUY', () => {
  test('buying a POTION decrements money and adds it to the bag', () => {
    const m = makeScene({ money: 1000 });
    m.send('a'); // root → BUY
    m.send('a'); // POTION → qty selector
    m.send('a'); // commit qty 1
    expect(m.wallet.money).toBe(700);
    expect(m.bag).toEqual([{ itemId: 'POTION', qty: 1 }]);
  });

  test('the qty selector buys multiples and charges the total', () => {
    const m = makeScene({ money: 1000 });
    m.send('a'); // BUY
    m.send('a'); // POTION → qty
    m.send('up', 'up'); // qty 1 → 3
    m.send('a'); // commit
    expect(m.wallet.money).toBe(100); // 1000 - 3×300
    expect(m.bag).toEqual([{ itemId: 'POTION', qty: 3 }]);
  });

  test('cannot overspend — a buy the wallet cannot cover is refused', () => {
    const m = makeScene({ money: 100 });
    m.send('a'); // BUY
    m.send('a'); // POTION → qty (clamped to 1, still unaffordable)
    m.send('a'); // commit → refused
    expect(m.wallet.money).toBe(100);
    expect(m.bag).toEqual([]);
  });

  test('B backs out of BUY to the root menu without buying', () => {
    const m = makeScene({ money: 1000 });
    m.send('a'); // BUY
    m.send('b'); // back to root
    m.send('b'); // root B → close
    expect(m.closes()).toBe(1);
    expect(m.wallet.money).toBe(1000);
  });
});

describe('Mart SELL', () => {
  test('selling a POTION credits half price and decrements the bag', () => {
    const m = makeScene({ money: 0, bag: [{ itemId: 'POTION', qty: 2 }] });
    m.send('down'); // root cursor BUY → SELL
    m.send('a'); // open SELL list
    m.send('a'); // POTION → qty selector
    m.send('a'); // commit qty 1
    expect(m.wallet.money).toBe(150);
    expect(m.bag).toEqual([{ itemId: 'POTION', qty: 1 }]);
  });

  test('SELL with an empty bag shows a toast and sells nothing', () => {
    const m = makeScene({ money: 0, bag: [] });
    m.send('down'); // → SELL
    m.send('a'); // empty → toast, stays out of the sell list
    m.send('a'); // dismiss toast back to root
    expect(m.wallet.money).toBe(0);
    expect(m.bag).toEqual([]);
  });
});

describe('Mart EXIT + render', () => {
  test('EXIT closes the shop', () => {
    const m = makeScene({ money: 500 });
    m.send('down', 'down'); // BUY → SELL → EXIT
    m.send('a');
    expect(m.closes()).toBe(1);
  });

  test('every mode renders without throwing', () => {
    const m = makeScene({ money: 1000, bag: [{ itemId: 'POTION', qty: 1 }] });
    const ctx = stubCtx();
    m.scene.draw(ctx); // root
    m.send('a'); // BUY
    m.scene.draw(ctx);
    m.send('a'); // qty
    m.scene.draw(ctx);
    m.send('a'); // toast
    m.scene.draw(ctx);
    m.send('a'); // back to BUY
    m.send('b'); // root
    m.send('down'); // SELL
    m.send('a'); // sell list
    m.scene.draw(ctx);
  });
});
