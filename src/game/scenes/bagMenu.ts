// Phase 5a bag UI — pushed from the pause menu's BAG row (no longer
// greyed in Phase 5a). Pockets along the top as tabs (LEFT/RIGHT
// cycle); the focused pocket's items list below (UP/DOWN). A on a
// usable item opens the target-picker (party list); A on a target
// applies the effect via applyItemEffect, decrements qty, fires
// onChange so main.ts persists (autosave). Empty pockets show a
// labelled '— empty —' so the player can see future surface area.
//
// In-battle bag access is OUT OF SCOPE for Phase 5a (kickoff:
// "in-battle bag access can wait for 5b or a later pass IF it adds
// engine risk — flag the call"). It needs a new Action kind in the
// engine — flagged in the report.

import {
  POCKETS,
  applyItemEffect,
  bagByPocket,
  bagConsume,
  lookupItem,
} from '../items';
import type { BagEntry, ItemCategory } from '../items';
import type { SideState } from '../../engine';
import { formatMoney } from '../economy';
import { LOGICAL_H, LOGICAL_W } from '../canvas';
import { PALETTE } from '../palette';
import type { InputKey, Scene } from '../scene';
import { drawBar, drawPanel, drawText, hpColor } from '../ui';

export interface BagMenuOpts {
  // Live references — both arrays are mutated when an item is used.
  readonly bag: BagEntry[];
  readonly party: SideState[];
  // Phase 5b — wallet display. Read at construction; the bag is pushed
  // fresh each time it opens, so a snapshot is fine (the bag can't
  // change money — only the Mart does).
  readonly money: number;
  // Fired after a successful use so main.ts can autosave.
  readonly onChange: () => void;
  readonly onClose: () => void;
}

type Mode = 'list' | 'target' | 'toast';

const PANEL = { x: 4, y: 4, w: 312, h: 172 } as const;
const POCKET_TABS_Y = 12;
const POCKET_TAB_W = 56;

const POCKET_LABEL: { readonly [K in ItemCategory]: string } = {
  medicine: 'MEDIC',
  items: 'ITEMS',
  berries: 'BERRY',
  keyitems: 'KEY',
  balls: 'BALLS',
};

export function createBagMenuScene(opts: BagMenuOpts): Scene {
  let mode: Mode = 'list';
  // Which pocket tab is focused (index into POCKETS).
  let tab = 0;
  // Within the current pocket, which item row is focused.
  let itemCursor = 0;
  // Target party member when mode='target'.
  let targetCursor = 0;
  // Most recently used item's display text — shown as a toast for a
  // beat after use, then auto-dismissed by next input.
  let toastLines: string[] = [];

  function currentPocket(): readonly BagEntry[] {
    return bagByPocket(opts.bag)[POCKETS[tab]!];
  }

  function clampItemCursor(): void {
    const list = currentPocket();
    if (itemCursor >= list.length) itemCursor = Math.max(0, list.length - 1);
    if (itemCursor < 0) itemCursor = 0;
  }

  function clampTargetCursor(): void {
    if (targetCursor >= opts.party.length) targetCursor = opts.party.length - 1;
    if (targetCursor < 0) targetCursor = 0;
  }

  function useFocusedItem(): void {
    const list = currentPocket();
    const entry = list[itemCursor];
    if (!entry) return;
    const item = lookupItem(entry.itemId);
    const target = opts.party[targetCursor];
    if (!target) return;
    const { result, delta, noop } = applyItemEffect(target, item);
    if (noop) {
      toastLines = [`${item.name}: no effect.`, '(Already full or fainted.)'];
      mode = 'toast';
      return;
    }
    // Mutate the party array in place so main.ts's autosave sees it.
    opts.party[targetCursor] = result;
    bagConsume(opts.bag, entry.itemId);
    opts.onChange();
    const targetName = target.species.name;
    toastLines = delta.hp > 0
      ? [`Used ${item.name} on`, `${targetName}.`, `Restored ${delta.hp} HP.`]
      : [`Used ${item.name} on`, `${targetName}.`, 'Status cleared.'];
    mode = 'toast';
    clampItemCursor();
  }

  return {
    input(key: InputKey) {
      if (mode === 'toast') {
        // Any input dismisses the toast back to the list.
        if (key === 'a' || key === 'b' || key === 'start') mode = 'list';
        return;
      }
      if (mode === 'target') {
        if (key === 'up') {
          targetCursor = (targetCursor - 1 + opts.party.length) % opts.party.length;
        } else if (key === 'down') {
          targetCursor = (targetCursor + 1) % opts.party.length;
        } else if (key === 'a' || key === 'start') {
          useFocusedItem();
        } else if (key === 'b') {
          mode = 'list';
        }
        return;
      }
      // mode === 'list'
      if (key === 'left') {
        tab = (tab - 1 + POCKETS.length) % POCKETS.length;
        itemCursor = 0;
      } else if (key === 'right') {
        tab = (tab + 1) % POCKETS.length;
        itemCursor = 0;
      } else if (key === 'up') {
        const list = currentPocket();
        if (list.length > 0) {
          itemCursor = (itemCursor - 1 + list.length) % list.length;
        }
      } else if (key === 'down') {
        const list = currentPocket();
        if (list.length > 0) {
          itemCursor = (itemCursor + 1) % list.length;
        }
      } else if (key === 'a' || key === 'start') {
        const list = currentPocket();
        const entry = list[itemCursor];
        if (!entry) return;
        const item = lookupItem(entry.itemId);
        if (!item.targetsParty) {
          // Non-targeted items (e.g., future key items) aren't usable
          // from the bag without engine plumbing — flagged.
          toastLines = [`${item.name}: can't use here yet.`];
          mode = 'toast';
          return;
        }
        if (opts.party.length === 0) {
          toastLines = ['No party member to use', 'this on yet.'];
          mode = 'toast';
          return;
        }
        targetCursor = 0;
        clampTargetCursor();
        mode = 'target';
      } else if (key === 'b') {
        opts.onClose();
      }
    },
    draw(ctx) {
      // Light wash matching the pause menu (Phase 4 sign-off).
      ctx.fillStyle = 'rgba(16, 22, 34, 0.38)';
      ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

      drawPanel(ctx, PANEL.x, PANEL.y, PANEL.w, PANEL.h);
      drawText(ctx, 'BAG', PANEL.x + 8, PANEL.y + 4, PALETTE.paperShadow);
      // Money, top-right (Phase 5b).
      drawText(
        ctx,
        `MONEY ${formatMoney(opts.money)}`,
        PANEL.x + PANEL.w - 110,
        PANEL.y + 4,
        PALETTE.ink,
      );

      // Pocket tabs
      POCKETS.forEach((p, i) => {
        const x = PANEL.x + 12 + i * POCKET_TAB_W;
        const focused = i === tab;
        if (focused) {
          ctx.fillStyle = PALETTE.paper;
          ctx.fillRect(x - 2, POCKET_TABS_Y - 2, POCKET_TAB_W - 4, 12);
        }
        drawText(
          ctx,
          POCKET_LABEL[p],
          x,
          POCKET_TABS_Y,
          focused ? PALETTE.ink : PALETTE.paperDim,
        );
      });

      // Items in current pocket
      const list = currentPocket();
      const itemsY = POCKET_TABS_Y + 22;
      if (list.length === 0) {
        drawText(ctx, '— empty —', PANEL.x + 14, itemsY, PALETTE.paperDim);
      } else {
        list.forEach((entry, i) => {
          const item = lookupItem(entry.itemId);
          const marker = (mode === 'list' || mode === 'target') && i === itemCursor ? '>' : ' ';
          drawText(
            ctx,
            `${marker} ${item.name}`,
            PANEL.x + 12,
            itemsY + i * 12,
          );
          drawText(
            ctx,
            `x${entry.qty}`,
            PANEL.x + 140,
            itemsY + i * 12,
            PALETTE.paperShadow,
          );
        });
        // Description of focused item (bottom of the panel).
        const focusedEntry = list[itemCursor];
        if (focusedEntry) {
          const desc = lookupItem(focusedEntry.itemId).description;
          drawText(
            ctx,
            desc,
            PANEL.x + 12,
            PANEL.y + PANEL.h - 36,
            PALETTE.paperShadow,
          );
        }
      }

      // Target picker overlay
      if (mode === 'target') {
        const targetPanelX = PANEL.x + 170;
        const targetPanelY = itemsY - 6;
        const targetPanelH = 8 + opts.party.length * 24 + 6;
        drawPanel(ctx, targetPanelX, targetPanelY, 130, Math.max(40, targetPanelH));
        drawText(
          ctx,
          'USE ON?',
          targetPanelX + 6,
          targetPanelY + 4,
          PALETTE.paperShadow,
        );
        opts.party.forEach((m, i) => {
          const focused = i === targetCursor;
          const marker = focused ? '>' : ' ';
          const fainted = m.hp <= 0;
          const y = targetPanelY + 14 + i * 24;
          drawText(
            ctx,
            `${marker} ${m.species.name}`,
            targetPanelX + 6,
            y,
            fainted ? PALETTE.paperDim : PALETTE.ink,
          );
          drawBar(
            ctx,
            targetPanelX + 6,
            y + 10,
            108,
            m.hp,
            m.maxHp,
            hpColor(m.hp, m.maxHp),
          );
          drawText(
            ctx,
            `${Math.round(m.hp)}/${m.maxHp}`,
            targetPanelX + 6,
            y + 16,
            PALETTE.paperShadow,
          );
        });
      }

      // Toast overlay
      if (mode === 'toast') {
        const w = 220;
        const h = 12 + toastLines.length * 12;
        const x = (LOGICAL_W - w) / 2;
        const y = LOGICAL_H - h - 16;
        drawPanel(ctx, x, y, w, h);
        toastLines.forEach((line, i) => {
          drawText(ctx, line, x + 8, y + 6 + i * 12);
        });
      }

      // Help line
      const help = mode === 'list'
        ? '← → pockets · A use · B close'
        : mode === 'target'
          ? 'A confirm · B back'
          : 'A / B to dismiss';
      drawText(ctx, help, PANEL.x + 12, LOGICAL_H - 10, PALETTE.paperDim);
    },
  };
}
