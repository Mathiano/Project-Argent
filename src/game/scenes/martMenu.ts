// Phase 5b Poké Mart — pushed from the CLERK NPC's `open-mart` script
// verb. Root menu BUY / SELL / EXIT; BUY lists the shop stock with
// prices, SELL lists the player's bag at half price; both route through
// a quantity selector before committing. Money is shown up top and
// updates live as the player transacts.
//
// The money math lives in economy.ts (pure, tested). This scene owns
// only the UI flow + the affordability gate's player feedback. Buy/sell
// commit through callbacks so main.ts mutates run.money + run.bag and
// autosaves in one place (same single-source-of-truth pattern the bag
// menu uses for item use).

import { formatMoney, maxAffordable, priceOf, sellPriceOf } from '../economy';
import { bagByPocket, lookupItem } from '../items';
import type { BagEntry } from '../items';
import { LOGICAL_H, LOGICAL_W } from '../canvas';
import { PALETTE } from '../palette';
import type { InputKey, Scene } from '../scene';
import { drawPanel, drawText } from '../ui';

export interface MartMenuOpts {
  // Item ids the shop sells, in display order.
  readonly stock: readonly string[];
  // Live bag reference — SELL reads it, a successful BUY/SELL mutates
  // it (in main.ts's onBuy/onSell). Re-read each frame so the lists
  // reflect the latest quantities.
  readonly bag: BagEntry[];
  readonly getMoney: () => number;
  // Commit hooks. Return true on success, false when blocked (e.g. a
  // buy the wallet can't cover — the scene then shows a toast). main.ts
  // does the economy math + autosave.
  readonly onBuy: (itemId: string, qty: number) => boolean;
  readonly onSell: (itemId: string, qty: number) => boolean;
  readonly onClose: () => void;
}

type Mode = 'root' | 'buy' | 'sell' | 'qty' | 'toast';
type Txn = 'buy' | 'sell';

const PANEL = { x: 4, y: 4, w: 312, h: 172 } as const;
const ROOT_ITEMS: readonly { readonly label: string; readonly kind: 'buy' | 'sell' | 'exit' }[] = [
  { label: 'BUY', kind: 'buy' },
  { label: 'SELL', kind: 'sell' },
  { label: 'EXIT', kind: 'exit' },
];

export function createMartMenuScene(opts: MartMenuOpts): Scene {
  let mode: Mode = 'root';
  let rootCursor = 0;
  // Cursor into the stock list (buy) or the sellable bag list (sell).
  let listCursor = 0;
  // Quantity-selector state.
  let qtyTxn: Txn = 'buy';
  let qtyItemId = '';
  let qty = 1;
  let qtyMax = 1;
  // After committing, dismiss the toast back to this mode.
  let toastReturn: Mode = 'root';
  let toastLines: string[] = [];

  // Sellable bag = every entry (all shippable items carry a price).
  // Read fresh each call so a sale that empties an entry drops it.
  function sellable(): readonly BagEntry[] {
    // Flatten the pockets back to a stable list (medicine first, etc.).
    const grouped = bagByPocket(opts.bag);
    return [
      ...grouped.medicine,
      ...grouped.items,
      ...grouped.berries,
      ...grouped.keyitems,
      ...grouped.balls,
    ];
  }

  function clampListCursor(len: number): void {
    if (listCursor >= len) listCursor = Math.max(0, len - 1);
    if (listCursor < 0) listCursor = 0;
  }

  function enterQty(txn: Txn, itemId: string): void {
    qtyTxn = txn;
    qtyItemId = itemId;
    qty = 1;
    if (txn === 'buy') {
      // Cap to what the wallet can afford; allow 1 even when broke so
      // the player sees the price, then the commit gate blocks + toasts.
      qtyMax = Math.max(1, Math.min(99, maxAffordable(opts.getMoney(), itemId)));
    } else {
      const entry = opts.bag.find((e) => e.itemId === itemId);
      qtyMax = Math.max(1, entry?.qty ?? 1);
    }
    mode = 'qty';
  }

  function commitQty(): void {
    if (qtyTxn === 'buy') {
      const ok = opts.onBuy(qtyItemId, qty);
      toastLines = ok
        ? [`Bought ${qty} ${qtyItemId}.`, `Money: ${formatMoney(opts.getMoney())}`]
        : ['Not enough money.'];
      toastReturn = 'buy';
    } else {
      const gain = sellPriceOf(qtyItemId) * qty;
      const ok = opts.onSell(qtyItemId, qty);
      toastLines = ok
        ? [`Sold ${qty} ${qtyItemId}.`, `Got ${formatMoney(gain)}.`]
        : ["You can't sell that."];
      // If the bag is now empty, returning to the sell list would show
      // nothing — bounce to root instead.
      toastReturn = sellable().length > 0 ? 'sell' : 'root';
    }
    mode = 'toast';
  }

  return {
    input(key: InputKey) {
      if (mode === 'toast') {
        if (key === 'a' || key === 'b' || key === 'start') {
          mode = toastReturn;
          listCursor = 0;
        }
        return;
      }

      if (mode === 'root') {
        if (key === 'up') rootCursor = (rootCursor - 1 + ROOT_ITEMS.length) % ROOT_ITEMS.length;
        else if (key === 'down') rootCursor = (rootCursor + 1) % ROOT_ITEMS.length;
        else if (key === 'a' || key === 'start') {
          const sel = ROOT_ITEMS[rootCursor]!;
          if (sel.kind === 'exit') opts.onClose();
          else if (sel.kind === 'buy') {
            listCursor = 0;
            mode = 'buy';
          } else {
            listCursor = 0;
            if (sellable().length === 0) {
              toastLines = ['Your bag is empty —', 'nothing to sell.'];
              toastReturn = 'root';
              mode = 'toast';
            } else {
              mode = 'sell';
            }
          }
        } else if (key === 'b') opts.onClose();
        return;
      }

      if (mode === 'buy') {
        const len = opts.stock.length;
        if (key === 'up' && len > 0) listCursor = (listCursor - 1 + len) % len;
        else if (key === 'down' && len > 0) listCursor = (listCursor + 1) % len;
        else if (key === 'a' || key === 'start') {
          const id = opts.stock[listCursor];
          if (id) enterQty('buy', id);
        } else if (key === 'b') mode = 'root';
        return;
      }

      if (mode === 'sell') {
        const list = sellable();
        clampListCursor(list.length);
        if (key === 'up' && list.length > 0) {
          listCursor = (listCursor - 1 + list.length) % list.length;
        } else if (key === 'down' && list.length > 0) {
          listCursor = (listCursor + 1) % list.length;
        } else if (key === 'a' || key === 'start') {
          const entry = list[listCursor];
          if (entry) enterQty('sell', entry.itemId);
        } else if (key === 'b') mode = 'root';
        return;
      }

      // mode === 'qty'
      if (key === 'up') qty = Math.min(qtyMax, qty + 1);
      else if (key === 'down') qty = Math.max(1, qty - 1);
      else if (key === 'right') qty = Math.min(qtyMax, qty + 10);
      else if (key === 'left') qty = Math.max(1, qty - 10);
      else if (key === 'a' || key === 'start') commitQty();
      else if (key === 'b') mode = qtyTxn === 'buy' ? 'buy' : 'sell';
    },

    draw(ctx) {
      ctx.fillStyle = 'rgba(16, 22, 34, 0.38)';
      ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

      drawPanel(ctx, PANEL.x, PANEL.y, PANEL.w, PANEL.h);
      drawText(ctx, 'POKÉ MART', PANEL.x + 8, PANEL.y + 4, PALETTE.paperShadow);
      // Money, top-right.
      drawText(
        ctx,
        `MONEY ${formatMoney(opts.getMoney())}`,
        PANEL.x + PANEL.w - 110,
        PANEL.y + 4,
        PALETTE.ink,
      );

      const bodyY = PANEL.y + 22;

      if (mode === 'root') {
        ROOT_ITEMS.forEach((r, i) => {
          const marker = i === rootCursor ? '>' : ' ';
          drawText(ctx, `${marker} ${r.label}`, PANEL.x + 14, bodyY + i * 14);
        });
        drawText(ctx, 'Welcome! How can I help?', PANEL.x + 14, bodyY + 60, PALETTE.paperShadow);
      } else if (mode === 'buy' || (mode === 'qty' && qtyTxn === 'buy')) {
        drawText(ctx, 'BUY', PANEL.x + 14, bodyY - 4, PALETTE.paperShadow);
        opts.stock.forEach((id, i) => {
          const item = lookupItem(id);
          const marker = i === listCursor ? '>' : ' ';
          drawText(ctx, `${marker} ${item.name}`, PANEL.x + 14, bodyY + 10 + i * 12);
          drawText(
            ctx,
            formatMoney(priceOf(id)),
            PANEL.x + 150,
            bodyY + 10 + i * 12,
            PALETTE.paperShadow,
          );
        });
        const focused = opts.stock[listCursor];
        if (focused) {
          drawText(
            ctx,
            lookupItem(focused).description,
            PANEL.x + 14,
            PANEL.y + PANEL.h - 36,
            PALETTE.paperShadow,
          );
        }
      } else if (mode === 'sell' || (mode === 'qty' && qtyTxn === 'sell')) {
        drawText(ctx, 'SELL', PANEL.x + 14, bodyY - 4, PALETTE.paperShadow);
        const list = sellable();
        list.forEach((entry, i) => {
          const item = lookupItem(entry.itemId);
          const marker = i === listCursor ? '>' : ' ';
          drawText(ctx, `${marker} ${item.name}`, PANEL.x + 14, bodyY + 10 + i * 12);
          drawText(ctx, `x${entry.qty}`, PANEL.x + 130, bodyY + 10 + i * 12, PALETTE.paperShadow);
          drawText(
            ctx,
            formatMoney(sellPriceOf(entry.itemId)),
            PANEL.x + 170,
            bodyY + 10 + i * 12,
            PALETTE.paperShadow,
          );
        });
      }

      // Quantity selector overlay.
      if (mode === 'qty') {
        const unit = qtyTxn === 'buy' ? priceOf(qtyItemId) : sellPriceOf(qtyItemId);
        const total = unit * qty;
        const w = 180;
        const h = 54;
        const x = (LOGICAL_W - w) / 2;
        const y = (LOGICAL_H - h) / 2;
        drawPanel(ctx, x, y, w, h);
        drawText(ctx, `${qtyTxn === 'buy' ? 'BUY' : 'SELL'} ${qtyItemId}`, x + 8, y + 6);
        drawText(ctx, `Qty:  ${qty}  / ${qtyMax}`, x + 8, y + 20, PALETTE.paperShadow);
        drawText(ctx, `Total: ${formatMoney(total)}`, x + 8, y + 32, PALETTE.ink);
      }

      if (mode === 'toast') {
        const w = 220;
        const h = 12 + toastLines.length * 12;
        const x = (LOGICAL_W - w) / 2;
        const y = LOGICAL_H - h - 16;
        drawPanel(ctx, x, y, w, h);
        toastLines.forEach((line, i) => drawText(ctx, line, x + 8, y + 6 + i * 12));
      }

      // Help line.
      const help =
        mode === 'root'
          ? 'A select · B leave'
          : mode === 'buy' || mode === 'sell'
            ? 'A choose · B back'
            : mode === 'qty'
              ? '↑↓ qty · ←→ ±10 · A ok · B back'
              : 'A / B to dismiss';
      drawText(ctx, help, PANEL.x + 14, LOGICAL_H - 10, PALETTE.paperDim);
    },
  };
}
