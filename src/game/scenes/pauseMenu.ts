// Phase 4 pause menu — pushed onto the overworld when the player
// presses START. POKEMON / SAVE / OPTIONS / EXIT live now; BAG / BOX
// are visible but greyed (cursor skips), labeled "(Phase 5)" so the
// player knows there's something coming and the menu's eventual
// shape is legible from the start.
//
// No engine deps — pure UI scene reading callbacks for the actions.

import { LOGICAL_H, LOGICAL_W } from '../canvas';
import { PALETTE } from '../palette';
import type { InputKey, Scene } from '../scene';
import { drawPanel, drawText } from '../ui';

export interface PauseMenuOpts {
  readonly onPokemon: () => void;
  readonly onSave: () => void;
  readonly onOptions: () => void;
  readonly onClose: () => void;
}

type RowKind = 'pokemon' | 'save' | 'options' | 'bag' | 'box' | 'exit';
interface Row {
  readonly kind: RowKind;
  readonly label: string;
  readonly enabled: boolean;
}

const PANEL = { x: 200, y: 12, w: 110, h: 150 } as const;

export function createPauseMenuScene(opts: PauseMenuOpts): Scene {
  const rows: Row[] = [
    { kind: 'pokemon', label: 'POKEMON', enabled: true },
    { kind: 'save', label: 'SAVE', enabled: true },
    { kind: 'options', label: 'OPTIONS', enabled: true },
    { kind: 'bag', label: 'BAG (Phase 5)', enabled: false },
    { kind: 'box', label: 'BOX (Phase 5)', enabled: false },
    { kind: 'exit', label: 'EXIT', enabled: true },
  ];
  let cursor = 0;
  // SAVE flash — when the player triggers a manual save we show
  // "Saved." over the menu for a beat (no scene push needed).
  let savedFlashSec = 0;
  // OPTIONS stub — "text speed coming soon" over the menu, dismissed
  // on next input.
  let optionsFlash = false;

  function stepCursor(start: number, dir: 1 | -1): number {
    let i = start;
    for (let n = 0; n < rows.length; n += 1) {
      i = (i + dir + rows.length) % rows.length;
      if (rows[i]!.enabled) return i;
    }
    return start;
  }

  function confirm(): void {
    const row = rows[cursor];
    if (!row || !row.enabled) return;
    if (row.kind === 'pokemon') opts.onPokemon();
    else if (row.kind === 'save') {
      opts.onSave();
      savedFlashSec = 1.0;
    } else if (row.kind === 'options') {
      opts.onOptions();
      optionsFlash = true;
    } else if (row.kind === 'exit') opts.onClose();
  }

  return {
    update(dt) {
      if (savedFlashSec > 0) savedFlashSec = Math.max(0, savedFlashSec - dt);
    },
    input(key: InputKey) {
      if (optionsFlash) {
        // Any key dismisses the OPTIONS stub back to the menu.
        if (key === 'a' || key === 'b' || key === 'start') optionsFlash = false;
        return;
      }
      if (key === 'up') cursor = stepCursor(cursor, -1);
      else if (key === 'down') cursor = stepCursor(cursor, 1);
      else if (key === 'a') confirm();
      else if (key === 'b' || key === 'start') opts.onClose();
    },
    draw(ctx) {
      // Light wash over the overworld behind — just enough to push
      // the panel forward without blacking the world out (per Phase 4
      // sign-off: dim slightly, world stays visible).
      ctx.fillStyle = 'rgba(16, 22, 34, 0.38)';
      ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

      drawPanel(ctx, PANEL.x, PANEL.y, PANEL.w, PANEL.h);
      drawText(ctx, 'MENU', PANEL.x + 10, PANEL.y + 6, PALETTE.paperShadow);
      rows.forEach((r, i) => {
        const color = r.enabled
          ? cursor === i
            ? PALETTE.ink
            : PALETTE.ink
          : PALETTE.paperDim;
        const marker = cursor === i && r.enabled ? '>' : ' ';
        drawText(ctx, `${marker} ${r.label}`, PANEL.x + 8, PANEL.y + 22 + i * 14, color);
      });

      if (savedFlashSec > 0) {
        drawPanel(ctx, 80, 80, 160, 28);
        drawText(ctx, 'Saved.', 88, 90, PALETTE.paper);
        drawText(ctx, '(Autosave is on too.)', 88, 100, PALETTE.paperShadow);
      } else if (optionsFlash) {
        drawPanel(ctx, 60, 70, 200, 50);
        drawText(ctx, 'OPTIONS', 68, 78, PALETTE.paper);
        drawText(ctx, 'Text speed, audio, controls', 68, 92, PALETTE.paperShadow);
        drawText(ctx, '— coming in a later sprint.', 68, 102, PALETTE.paperShadow);
        drawText(ctx, 'A / B to dismiss.', 68, 112, PALETTE.paperDim);
      }
    },
  };
}
