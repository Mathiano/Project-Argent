// A reusable typed-entry field scene. Keyboard-first (the game's input model):
// printable chars append, Backspace deletes, Enter confirms a non-empty trimmed
// name, Esc cancels (skip). Touch falls back to A=confirm / B=cancel. Used by
// name-on-catch and rename — and any future text field (search, etc.).

import { LOGICAL_H, LOGICAL_W } from '../canvas';
import type { InputKey, Scene } from '../scene';
import { PALETTE } from '../palette';
import { drawPanel, drawText } from '../ui';

export interface NameEntryOpts {
  readonly prompt: string;
  readonly initial?: string;
  readonly maxLen?: number;
  // Called with the validated name (trimmed, non-empty, within the cap).
  readonly onConfirm: (name: string) => void;
  // Called on skip/cancel (Esc, B, or Enter on an empty/whitespace field).
  readonly onCancel: () => void;
}

export const NAME_MAX_LEN = 12;

// Printable, name-friendly characters: letters, digits, space, and a few marks.
// (Control keys like Enter/Backspace are `.length > 1` and handled separately.)
export function isNameChar(key: string): boolean {
  return key.length === 1 && /[A-Za-z0-9 .'-]/.test(key);
}

// Trim + collapse internal whitespace + cap. The single source of name sanitizing.
export function sanitizeName(raw: string, maxLen = NAME_MAX_LEN): string {
  return raw.replace(/\s+/g, ' ').trim().slice(0, maxLen);
}

export function createNameEntryScene(opts: NameEntryOpts): Scene {
  const maxLen = opts.maxLen ?? NAME_MAX_LEN;
  let buf = (opts.initial ?? '').slice(0, maxLen);
  let tick = 0;

  function commit(): void {
    const name = sanitizeName(buf, maxLen);
    if (name.length === 0) opts.onCancel(); // empty/whitespace = skip (keep species)
    else opts.onConfirm(name);
  }

  return {
    textInput(key: string): boolean {
      if (key === 'Enter') { commit(); return true; }
      if (key === 'Escape') { opts.onCancel(); return true; }
      if (key === 'Backspace') { buf = buf.slice(0, -1); return true; }
      if (isNameChar(key)) {
        if (buf.length < maxLen) buf += key;
        return true; // consume even when at the cap (don't leak to button map)
      }
      return false;
    },
    // Touch overlay fallback (no physical keyboard): A/START confirm, B cancels.
    input(key: InputKey): void {
      if (key === 'a' || key === 'start') commit();
      else if (key === 'b') opts.onCancel();
    },
    update(dt: number): void {
      tick += dt;
    },
    draw(ctx: CanvasRenderingContext2D): void {
      // dim the paused scene behind the field
      ctx.fillStyle = 'rgba(20,20,30,0.55)';
      ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
      const w = LOGICAL_W - 40, h = 62, x = 20, y = Math.round((LOGICAL_H - h) / 2);
      drawPanel(ctx, x, y, w, h);
      drawText(ctx, opts.prompt, x + 8, y + 8);
      const caret = Math.floor(tick * 2) % 2 === 0 ? '_' : ' ';
      drawText(ctx, '> ' + buf + caret, x + 8, y + 26, PALETTE.hpOk);
      drawText(ctx, 'TYPE A NAME   ENTER = OK   ESC = SKIP', x + 8, y + h - 13, PALETTE.paperShadow);
    },
  };
}
