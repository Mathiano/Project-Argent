// Phase 6.5 — the PC Box UI. Pushed from the Center PC (open-box verb).
//
// Two columns: PARTY (left) and BOX (right). LEFT/RIGHT switches the
// focused column; UP/DOWN moves the cursor; A opens a small action
// popup (SUMMARY + DEPOSIT/WITHDRAW + BACK), mirroring the party-menu
// action popup. B closes. Deposit/withdraw run the pure box.ts ops
// (which carry each mon's bond with it) and fire onChange so main.ts
// autosaves. The last-mon block + full-party block surface as a one-
// line message under the panels.
//
// The scene reads hp/st live off the SideStates (same writeback the
// battle + party menus use) and reuses the party-menu summary layout.

import { TIERS, lookupMove } from '../../engine';
import type { SideState } from '../../engine';
import { bondStageName } from '../catching';
import { canDeposit, canWithdraw, deposit, withdraw } from '../box';
import type { MonStore } from '../box';
import type { CatchOrigin } from '../catching';
import { LOGICAL_H, LOGICAL_W } from '../canvas';
import { PALETTE } from '../palette';
import type { InputKey, Scene } from '../scene';
import { drawBar, drawPanel, drawText, hpColor } from '../ui';

export interface BoxMenuOpts {
  // Live references to run state — the scene MUTATES these via box.ts.
  readonly party: SideState[];
  readonly partyBond: number[];
  readonly partyOrigin: CatchOrigin[];
  readonly box: SideState[];
  readonly boxBond: number[];
  readonly boxOrigin: CatchOrigin[];
  // Autosave nudge after any deposit/withdraw (and on close is fine too).
  readonly onChange: () => void;
  readonly onClose: () => void;
}

type Column = 'party' | 'box';
type Mode = 'browse' | 'action' | 'summary';

const PARTY_PANEL = { x: 4, y: 4, w: 150, h: 150 } as const;
const BOX_PANEL = { x: 160, y: 4, w: 156, h: 150 } as const;
const ROW_H = 14;
const HEADER_OFFSET = 18;
// Visible rows per column before scrolling kicks in.
const VISIBLE_ROWS = Math.floor((PARTY_PANEL.h - HEADER_OFFSET - 6) / ROW_H);

export function createBoxMenuScene(opts: BoxMenuOpts): Scene {
  const store: MonStore = {
    party: opts.party,
    partyBond: opts.partyBond,
    partyOrigin: opts.partyOrigin,
    box: opts.box,
    boxBond: opts.boxBond,
    boxOrigin: opts.boxOrigin,
  };

  let column: Column = 'party';
  let partyCursor = 0;
  let boxCursor = 0;
  let mode: Mode = 'browse';
  let actionCursor = 0; // 0 = SUMMARY, 1 = DEPOSIT/WITHDRAW, 2 = BACK
  // The mon shown in summary: {column, index} captured on entry.
  let summaryCol: Column = 'party';
  let summaryIdx = 0;
  // Transient message under the panels (blocks / confirmations).
  let message = '';

  function activeList(): SideState[] {
    return column === 'party' ? store.party : store.box;
  }
  function activeCursor(): number {
    return column === 'party' ? partyCursor : boxCursor;
  }
  function setActiveCursor(v: number): void {
    if (column === 'party') partyCursor = v;
    else boxCursor = v;
  }
  function clampCursors(): void {
    partyCursor = Math.max(0, Math.min(partyCursor, Math.max(0, store.party.length - 1)));
    boxCursor = Math.max(0, Math.min(boxCursor, Math.max(0, store.box.length - 1)));
  }

  function moveCursor(dir: 1 | -1): void {
    if (mode === 'action') {
      actionCursor = (actionCursor + dir + 3) % 3;
      return;
    }
    if (mode !== 'browse') return;
    const list = activeList();
    if (list.length === 0) return;
    setActiveCursor((activeCursor() + dir + list.length) % list.length);
  }

  function switchColumn(to: Column): void {
    if (mode !== 'browse') return;
    column = to;
    message = '';
  }

  function confirm(): void {
    if (mode === 'browse') {
      const list = activeList();
      if (list.length === 0) {
        message = column === 'box' ? 'The box is empty.' : 'No mon here.';
        return;
      }
      mode = 'action';
      actionCursor = 0;
      return;
    }
    if (mode === 'action') {
      if (actionCursor === 0) {
        summaryCol = column;
        summaryIdx = activeCursor();
        mode = 'summary';
      } else if (actionCursor === 1) {
        runTransfer();
        mode = 'browse';
      } else {
        mode = 'browse';
      }
      return;
    }
    // summary: A returns to browse (B does too).
    if (mode === 'summary') mode = 'browse';
  }

  function runTransfer(): void {
    const idx = activeCursor();
    const res = column === 'party' ? deposit(store, idx) : withdraw(store, idx);
    if (!res.ok) {
      message = res.reason;
      return;
    }
    message = column === 'party' ? 'Deposited to the box.' : 'Moved to your party.';
    clampCursors();
    opts.onChange();
  }

  function cancel(): void {
    if (mode === 'summary' || mode === 'action') {
      mode = 'browse';
      return;
    }
    opts.onClose();
  }

  return {
    input(key: InputKey) {
      clampCursors();
      if (key === 'up') moveCursor(-1);
      else if (key === 'down') moveCursor(1);
      else if (key === 'left') switchColumn('party');
      else if (key === 'right') switchColumn('box');
      else if (key === 'a' || key === 'start') confirm();
      else if (key === 'b') cancel();
    },
    draw(ctx) {
      ctx.fillStyle = 'rgba(16, 22, 34, 0.92)';
      ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

      if (mode === 'summary') {
        const list = summaryCol === 'party' ? store.party : store.box;
        const bond = summaryCol === 'party' ? store.partyBond : store.boxBond;
        const mon = list[summaryIdx];
        if (mon) drawSummary(ctx, mon, bond[summaryIdx] ?? 0);
        drawText(ctx, 'B: back', LOGICAL_W - 56, LOGICAL_H - 12, PALETTE.paperDim);
        return;
      }

      drawColumn(ctx, PARTY_PANEL, 'PARTY', store.party, store.partyBond, partyCursor, column === 'party');
      drawColumn(ctx, BOX_PANEL, `BOX (${store.box.length})`, store.box, store.boxBond, boxCursor, column === 'box');

      if (mode === 'action') drawActionPopup(ctx);

      // Footer: message line + controls hint.
      if (message) drawText(ctx, message, 6, LOGICAL_H - 22, PALETTE.paper);
      drawText(ctx, '←→ switch · ↑↓ pick · A act · B close', 6, LOGICAL_H - 11, PALETTE.paperDim);
    },
  };

  function drawColumn(
    ctx: CanvasRenderingContext2D,
    panel: { x: number; y: number; w: number; h: number },
    title: string,
    list: SideState[],
    bond: number[],
    cursor: number,
    focused: boolean,
  ): void {
    drawPanel(ctx, panel.x, panel.y, panel.w, panel.h);
    drawText(ctx, title, panel.x + 8, panel.y + 6, focused ? PALETTE.ink : PALETTE.paperShadow);
    if (focused) drawText(ctx, '◄', panel.x + panel.w - 14, panel.y + 6, PALETTE.star);

    if (list.length === 0) {
      drawText(ctx, '— empty —', panel.x + 10, panel.y + HEADER_OFFSET + 4, PALETTE.paperDim);
      return;
    }

    // Scroll window so the cursor stays visible.
    const start = Math.max(0, Math.min(cursor - Math.floor(VISIBLE_ROWS / 2), Math.max(0, list.length - VISIBLE_ROWS)));
    const end = Math.min(list.length, start + VISIBLE_ROWS);
    for (let i = start; i < end; i += 1) {
      const mon = list[i]!;
      const y = panel.y + HEADER_OFFSET + (i - start) * ROW_H;
      const isCursor = focused && cursor === i;
      const fainted = mon.hp <= 0;
      const marker = isCursor ? '>' : ' ';
      const nameColor = fainted ? PALETTE.paperDim : PALETTE.ink;
      drawText(ctx, `${marker}${mon.species.name}`, panel.x + 8, y, nameColor);
      // Bond stage (the ★ indicator) on the next half-row.
      drawText(ctx, `★ ${bondStageName(bond[i] ?? 0)}`, panel.x + 8, y + 7, PALETTE.star);
      // Compact HP bar at the right of the row.
      drawBar(ctx, panel.x + panel.w - 54, y + 2, 46, mon.hp, mon.maxHp, hpColor(mon.hp, mon.maxHp));
    }
    // Scroll affordances.
    if (start > 0) drawText(ctx, '▲', panel.x + panel.w / 2, panel.y + HEADER_OFFSET - 8, PALETTE.paperDim);
    if (end < list.length) drawText(ctx, '▼', panel.x + panel.w / 2, panel.y + panel.h - 9, PALETTE.paperDim);
  }

  function drawActionPopup(ctx: CanvasRenderingContext2D): void {
    const transfer = column === 'party' ? 'DEPOSIT' : 'WITHDRAW';
    const blocked = column === 'party' ? !canDeposit(store) : !canWithdraw(store);
    const popW = 78;
    const popX = column === 'party' ? PARTY_PANEL.x + 60 : BOX_PANEL.x + 50;
    const popY = 60;
    drawPanel(ctx, popX, popY, popW, 50);
    const items: readonly string[] = ['SUMMARY', transfer, 'BACK'];
    items.forEach((label, i) => {
      const marker = actionCursor === i ? '>' : ' ';
      // Grey the transfer row when it's blocked (still selectable so the
      // player gets the reason message on press).
      const color = i === 1 && blocked ? PALETTE.paperDim : PALETTE.ink;
      drawText(ctx, `${marker} ${label}`, popX + 6, popY + 6 + i * 12, color);
    });
  }

  function drawSummary(ctx: CanvasRenderingContext2D, mon: SideState, bondVal: number): void {
    const P = { x: 4, y: 4, w: 312, h: 150 };
    drawPanel(ctx, P.x, P.y, P.w, P.h);
    drawText(ctx, 'SUMMARY', P.x + 8, P.y + 6, PALETTE.paperShadow);
    drawText(ctx, mon.species.name, P.x + 12, P.y + 22);
    drawText(ctx, `Type: ${mon.species.types.join('/') || 'Neutral'}`, P.x + 12, P.y + 34, PALETTE.paperShadow);

    drawText(ctx, 'HP', P.x + 12, P.y + 50, PALETTE.paperShadow);
    drawBar(ctx, P.x + 32, P.y + 51, 120, mon.hp, mon.maxHp, hpColor(mon.hp, mon.maxHp));
    drawText(ctx, `${Math.round(mon.hp)}/${mon.maxHp}`, P.x + 158, P.y + 50);

    drawText(ctx, 'ST', P.x + 12, P.y + 62, PALETTE.paperShadow);
    drawBar(ctx, P.x + 32, P.y + 63, 120, mon.st, 100, PALETTE.stamina);
    drawText(ctx, `${Math.round(mon.st)}/100`, P.x + 158, P.y + 62);

    drawText(ctx, 'MOVES', P.x + 12, P.y + 80, PALETTE.paperShadow);
    mon.species.moves.forEach((moveName: string, i: number) => {
      let tierTag = '??';
      try {
        tierTag = TIERS[lookupMove(moveName).tier].name.toUpperCase().slice(0, 4);
      } catch {
        // Unknown move — leave as ?? (same defensive guard as partyMenu).
      }
      drawText(ctx, moveName, P.x + 12, P.y + 92 + i * 11);
      drawText(ctx, tierTag, P.x + 140, P.y + 92 + i * 11, PALETTE.paperShadow);
    });

    drawText(ctx, 'BOND', P.x + 200, P.y + 80, PALETTE.paperShadow);
    drawText(ctx, `★ ${bondStageName(bondVal)}`, P.x + 200, P.y + 92, PALETTE.star);
  }
}
