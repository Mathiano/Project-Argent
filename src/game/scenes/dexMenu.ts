// Phase 6.5 — the Dex UI. Pushed from the pause menu's DEX row.
//
// Left: a scrolling list of every CH1 species with its status marker.
// Right: a detail panel that always reflects the cursor entry, gated by
// status — CAUGHT shows the full record (sprite, type, evo hint, flavor);
// SEEN shows a partial (name + silhouette + "sighted, not caught"); UNSEEN
// shows "???" / "No data." The header tallies SEEN / CAUGHT.
//
// Status comes from the seen/caught registry (dex.ts) via a callback so
// the scene stays decoupled from run state. Sprites draw through the
// shared species-slot helper (falls back to the type-tinted placeholder
// when no art is registered — gameplay never blocks on art).

import type { ElementType } from '../../engine';
import type { DexStatus } from '../dex';
import { LOGICAL_H, LOGICAL_W } from '../canvas';
import { PALETTE } from '../palette';
import type { InputKey, Scene } from '../scene';
import { drawSpeciesInSlot } from '../sprites';
import { drawPanel, drawText } from '../ui';

export interface DexUiEntry {
  readonly num: number; // dex number (manifest id)
  readonly name: string;
  readonly types: readonly string[];
  readonly flavor: string; // manifest dexEntry, or a placeholder line
  readonly evoHint: string; // bond/evolution hint (one short line)
}

export interface DexMenuOpts {
  // All CH1 species, in dex-number order.
  readonly entries: readonly DexUiEntry[];
  // Per-species status from the registry.
  readonly status: (name: string) => DexStatus;
  readonly onClose: () => void;
}

const LIST_PANEL = { x: 4, y: 4, w: 132, h: 172 } as const;
const DETAIL_PANEL = { x: 140, y: 4, w: 176, h: 172 } as const;
const ROW_H = 11;
const HEADER_OFFSET = 22;
const VISIBLE_ROWS = Math.floor((LIST_PANEL.h - HEADER_OFFSET - 4) / ROW_H);

export function createDexMenuScene(opts: DexMenuOpts): Scene {
  let cursor = 0;

  function move(dir: 1 | -1): void {
    const n = opts.entries.length;
    if (n === 0) return;
    cursor = (cursor + dir + n) % n;
  }

  return {
    input(key: InputKey) {
      if (key === 'up') move(-1);
      else if (key === 'down') move(1);
      else if (key === 'b' || key === 'start' || key === 'a') {
        // A or B both close — the detail panel is always live, so there's
        // no separate "open" step to confirm.
        if (key === 'b' || key === 'start') opts.onClose();
      }
    },
    draw(ctx) {
      ctx.fillStyle = 'rgba(16, 22, 34, 0.92)';
      ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
      drawList(ctx);
      drawDetail(ctx);
      drawText(ctx, '↑↓ browse · B close', 6, LOGICAL_H - 11, PALETTE.paperDim);
    },
  };

  function drawList(ctx: CanvasRenderingContext2D): void {
    drawPanel(ctx, LIST_PANEL.x, LIST_PANEL.y, LIST_PANEL.w, LIST_PANEL.h);
    let seen = 0;
    let caught = 0;
    for (const e of opts.entries) {
      const s = opts.status(e.name);
      if (s === 'seen') seen += 1;
      else if (s === 'caught') {
        caught += 1;
        seen += 1; // caught ⇒ seen
      }
    }
    drawText(ctx, 'DEX', LIST_PANEL.x + 8, LIST_PANEL.y + 6, PALETTE.paperShadow);
    drawText(ctx, `S${seen} C${caught}`, LIST_PANEL.x + LIST_PANEL.w - 44, LIST_PANEL.y + 6, PALETTE.star);

    const start = Math.max(
      0,
      Math.min(cursor - Math.floor(VISIBLE_ROWS / 2), Math.max(0, opts.entries.length - VISIBLE_ROWS)),
    );
    const end = Math.min(opts.entries.length, start + VISIBLE_ROWS);
    for (let i = start; i < end; i += 1) {
      const e = opts.entries[i]!;
      const s = opts.status(e.name);
      const y = LIST_PANEL.y + HEADER_OFFSET + (i - start) * ROW_H;
      const isCursor = cursor === i;
      const marker = isCursor ? '>' : ' ';
      const num = String(e.num).padStart(3, '0');
      let label: string;
      let color: string;
      if (s === 'caught') {
        label = `${num} ${e.name}`;
        color = PALETTE.ink;
      } else if (s === 'seen') {
        label = `${num} ${e.name}`;
        color = PALETTE.paperShadow;
      } else {
        label = `${num} -------`;
        color = PALETTE.paperDim;
      }
      drawText(ctx, `${marker}${label}`, LIST_PANEL.x + 6, y, color);
      // Caught dot.
      if (s === 'caught') drawText(ctx, '●', LIST_PANEL.x + LIST_PANEL.w - 12, y, PALETTE.hpOk);
      else if (s === 'seen') drawText(ctx, '○', LIST_PANEL.x + LIST_PANEL.w - 12, y, PALETTE.paperShadow);
    }
    if (start > 0) drawText(ctx, '▲', LIST_PANEL.x + LIST_PANEL.w / 2, LIST_PANEL.y + HEADER_OFFSET - 8, PALETTE.paperDim);
    if (end < opts.entries.length) {
      drawText(ctx, '▼', LIST_PANEL.x + LIST_PANEL.w / 2, LIST_PANEL.y + LIST_PANEL.h - 9, PALETTE.paperDim);
    }
  }

  function drawDetail(ctx: CanvasRenderingContext2D): void {
    const P = DETAIL_PANEL;
    drawPanel(ctx, P.x, P.y, P.w, P.h);
    const e = opts.entries[cursor];
    if (!e) return;
    const s = opts.status(e.name);

    if (s === 'unseen') {
      drawText(ctx, '???', P.x + 12, P.y + 14, PALETTE.paperDim);
      drawText(ctx, 'No data.', P.x + 12, P.y + 30, PALETTE.paperDim);
      drawText(ctx, 'Not yet encountered.', P.x + 12, P.y + 44, PALETTE.paperDim);
      return;
    }

    // Sprite slot (top-left of the detail panel). CAUGHT → real art (or
    // type placeholder); SEEN → the placeholder silhouette only.
    const slotX = P.x + 10;
    const slotY = P.y + 12;
    const type0 = (e.types[0] ?? null) as ElementType | null;
    if (s === 'caught') {
      drawSpeciesInSlot(ctx, { name: e.name, type: type0 }, slotX, slotY, { slotSize: 56 });
    } else {
      // SEEN — draw the unknown-silhouette placeholder (type-tinted "?").
      drawSpeciesInSlot(ctx, { name: '__silhouette__', type: type0 }, slotX, slotY, { slotSize: 56 });
    }

    const num = String(e.num).padStart(3, '0');
    const textX = slotX + 64;
    drawText(ctx, `No.${num}`, textX, P.y + 14, PALETTE.paperShadow);
    drawText(ctx, e.name, textX, P.y + 26);

    if (s === 'seen') {
      drawText(ctx, 'Type: ???', textX, P.y + 40, PALETTE.paperShadow);
      drawText(ctx, 'SEEN', textX, P.y + 54, PALETTE.star);
      drawText(ctx, 'Sighted in the wild —', P.x + 12, P.y + 80, PALETTE.paperShadow);
      drawText(ctx, 'not yet caught.', P.x + 12, P.y + 92, PALETTE.paperShadow);
      return;
    }

    // CAUGHT — the full record.
    drawText(ctx, `Type: ${e.types.join('/') || 'Neutral'}`, textX, P.y + 40, PALETTE.paperShadow);
    drawText(ctx, 'CAUGHT', textX, P.y + 54, PALETTE.hpOk);

    drawText(ctx, e.evoHint, P.x + 12, P.y + 78, PALETTE.paperShadow);

    // Flavor — wrapped to the panel width.
    const lines = wrap(e.flavor, 30).slice(0, 7);
    lines.forEach((line, i) => {
      drawText(ctx, line, P.x + 12, P.y + 94 + i * 10, PALETTE.ink);
    });
  }

  function wrap(text: string, maxChars: number): string[] {
    const words = text.split(' ');
    const out: string[] = [];
    let cur = '';
    for (const w of words) {
      if ((cur + ' ' + w).trim().length > maxChars) {
        if (cur) out.push(cur);
        cur = w;
      } else {
        cur = (cur + ' ' + w).trim();
      }
    }
    if (cur) out.push(cur);
    return out;
  }
}
