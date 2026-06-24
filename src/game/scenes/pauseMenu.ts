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
import { emitGameEvent } from '../gameEvents';

export interface PauseMenuOpts {
  readonly onPokemon: () => void;
  readonly onBag: () => void;
  // Phase 6.5 — the seen/caught registry (DEX row).
  readonly onDex: () => void;
  readonly onSave: () => void;
  // OPTIONS — toggles the one live setting (audio mute) when confirmed.
  readonly onOptions: () => void;
  // Current sound state, read for the OPTIONS flash readout. Omitted → assume on.
  readonly audioOn?: () => boolean;
  readonly onClose: () => void;
  // Demo-complete: earned badge ids, shown as a trainer-card stand-in
  // footer ("BADGES ★×N"). Defaults to none when omitted.
  readonly badges?: readonly string[];
}

type RowKind = 'pokemon' | 'bag' | 'dex' | 'save' | 'options' | 'box' | 'exit';
interface Row {
  readonly kind: RowKind;
  readonly label: string;
  readonly enabled: boolean;
}

const PANEL = { x: 200, y: 12, w: 110, h: 164 } as const;

export function createPauseMenuScene(opts: PauseMenuOpts): Scene {
  const rows: Row[] = [
    { kind: 'pokemon', label: 'POKEMON', enabled: true },
    { kind: 'bag', label: 'BAG', enabled: true },
    // Phase 6.5 — DEX (seen/caught registry) is reachable from anywhere.
    { kind: 'dex', label: 'DEX', enabled: true },
    { kind: 'save', label: 'SAVE', enabled: true },
    { kind: 'options', label: 'OPTIONS', enabled: true },
    // BOX (PC storage) lives at a Pokémon Center this phase — the row is
    // a signpost so the player learns where storage is (access-flexibility
    // is a forward note per the 6.5 kickoff).
    { kind: 'box', label: 'BOX — at a PC', enabled: false },
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
    else if (row.kind === 'bag') opts.onBag();
    else if (row.kind === 'dex') opts.onDex();
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
      if (key === 'up') { cursor = stepCursor(cursor, -1); emitGameEvent({ kind: 'menu-move' }); }
      else if (key === 'down') { cursor = stepCursor(cursor, 1); emitGameEvent({ kind: 'menu-move' }); }
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

      // Trainer-card stand-in: badge count footer (demo-complete).
      const badgeCount = opts.badges?.length ?? 0;
      const footerY = PANEL.y + 22 + rows.length * 14 + 4;
      ctx.fillStyle = PALETTE.barEmpty;
      ctx.fillRect(PANEL.x + 8, footerY - 2, PANEL.w - 16, 1);
      drawText(
        ctx,
        badgeCount > 0 ? `BADGES ${'★'.repeat(badgeCount)}` : 'BADGES —',
        PANEL.x + 8,
        footerY + 2,
        badgeCount > 0 ? PALETTE.star : PALETTE.paperDim,
      );

      if (savedFlashSec > 0) {
        drawPanel(ctx, 80, 80, 160, 28);
        drawText(ctx, 'Saved.', 88, 90, PALETTE.paper);
        drawText(ctx, '(Autosave is on too.)', 88, 100, PALETTE.paperShadow);
      } else if (optionsFlash) {
        const on = opts.audioOn ? opts.audioOn() : true;
        drawPanel(ctx, 60, 70, 200, 50);
        drawText(ctx, 'OPTIONS', 68, 78, PALETTE.paper);
        drawText(ctx, `SOUND: ${on ? 'ON' : 'OFF'}`, 68, 92, on ? PALETTE.hpOk : PALETTE.paperDim);
        drawText(ctx, 'OPTIONS again to toggle.', 68, 102, PALETTE.paperShadow);
        drawText(ctx, 'A / B to dismiss.', 68, 112, PALETTE.paperDim);
      }
    },
  };
}
