// Phase 4 party menu — pushed from the pause menu's POKEMON row.
//
// Three modes (state-machine in one scene, no extra scene pushes):
//   list      — cursor over party rows; A pops an action sub-menu;
//               B closes back to pause.
//   action    — small popup at the right of the focused row with
//               SUMMARY / MOVE / BACK. A on SUMMARY → summary mode;
//               A on MOVE → reorder mode (kickoff: "select a mon → move
//               it up/down"); A on BACK or B → back to list.
//   summary   — full-screen summary of the focused mon: species,
//               types, HP/ST, moveset (move names + tier), plus a
//               BOND/TRIAL placeholder line (the forward-hook so the
//               bond system can wire in later without rework).
//   reorder   — the focused mon is "lifted"; up/down swap it with its
//               neighbour (mutates the order live); A / B drop it
//               (kickoff: "B confirms placement").
//
// Reorder mutates the array reference passed in opts.party AND fires
// opts.onReorder so main.ts can persist via autosave. The scene reads
// hp/st live off the SideState objects — same writeback the battle
// scene uses, so a damaged mon shows damaged here.

import { TIERS, lookupMove } from '../../engine';
import type { SideState } from '../../engine';
import { bondStageName } from '../catching';
import { stageProgress } from '../bond';
import { LOGICAL_H, LOGICAL_W } from '../canvas';
import { PALETTE } from '../palette';
import type { InputKey, Scene } from '../scene';
import { drawBar, drawPanel, drawText, hpColor } from '../ui';

export interface PartyMenuOpts {
  // Live reference to run.party — the scene reads & MUTATES this on
  // reorder. main.ts's onReorder callback is the autosave nudge.
  readonly party: SideState[];
  // Phase 6a — interim per-mon bond (index-aligned with party). Kept in
  // lockstep on reorder so bond follows its mon. Optional (legacy/test
  // callers omit it).
  readonly bond?: number[];
  // Phase 6b — "ask your mon" (a flavored bond/readiness response) + the
  // summary's evolution readiness line. Optional.
  readonly ask?: (index: number) => string;
  readonly readiness?: (index: number) => string | null;
  readonly onReorder: () => void;
  readonly onClose: () => void;
}

type Mode = 'list' | 'action' | 'summary' | 'reorder' | 'ask';

const LIST_PANEL = { x: 4, y: 4, w: 312, h: 172 } as const;
const ROW_H = 22;

export function createPartyMenuScene(opts: PartyMenuOpts): Scene {
  let mode: Mode = 'list';
  let cursor = 0;
  // Action sub-menu cursor (0=SUMMARY, 1=MOVE, 2=ASK, 3=BACK).
  let actionCursor = 0;
  // Index of the mon currently being shown in summary.
  let summaryIdx = 0;
  // The "ask your mon" response lines (mode='ask').
  let askLines: string[] = [];
  // Index of the mon being moved in reorder mode.
  let reorderIdx = 0;

  function clampCursor(): void {
    if (cursor < 0) cursor = 0;
    if (cursor >= opts.party.length) cursor = opts.party.length - 1;
  }

  function moveCursor(dir: 1 | -1): void {
    if (mode === 'list') {
      cursor = (cursor + dir + opts.party.length) % opts.party.length;
    } else if (mode === 'action') {
      actionCursor = (actionCursor + dir + 4) % 4;
    } else if (mode === 'reorder') {
      const next = reorderIdx + dir;
      if (next < 0 || next >= opts.party.length) return;
      // Swap — party AND its index-aligned bond, so bond follows the mon.
      const a = opts.party[reorderIdx]!;
      const b = opts.party[next]!;
      opts.party[reorderIdx] = b;
      opts.party[next] = a;
      if (opts.bond) {
        const ba = opts.bond[reorderIdx]!;
        opts.bond[reorderIdx] = opts.bond[next]!;
        opts.bond[next] = ba;
      }
      reorderIdx = next;
      cursor = next;
    }
  }

  function confirm(): void {
    if (mode === 'list') {
      mode = 'action';
      actionCursor = 0;
      return;
    }
    if (mode === 'action') {
      if (actionCursor === 0) {
        summaryIdx = cursor;
        mode = 'summary';
      } else if (actionCursor === 1) {
        // MOVE only meaningful with >1 mon.
        if (opts.party.length > 1) {
          reorderIdx = cursor;
          mode = 'reorder';
        } else {
          // Solo team — nothing to reorder. Pop back to list.
          mode = 'list';
        }
      } else if (actionCursor === 2) {
        // ASK your mon — a flavored bond/readiness response.
        askLines = wrap(opts.ask ? opts.ask(cursor) : 'It looks at you, quiet.', 40);
        mode = 'ask';
      } else {
        mode = 'list';
      }
      return;
    }
    if (mode === 'ask') {
      mode = 'list';
      return;
    }
    if (mode === 'reorder') {
      // A confirms placement — symmetric with B per kickoff "B confirms".
      opts.onReorder();
      mode = 'list';
    }
    // 'summary' has no A action; B goes back.
  }

  function cancel(): void {
    if (mode === 'list') opts.onClose();
    else if (mode === 'action') mode = 'list';
    else if (mode === 'summary') mode = 'list';
    else if (mode === 'ask') mode = 'list';
    else if (mode === 'reorder') {
      opts.onReorder();
      mode = 'list';
    }
  }

  // Simple word-wrap for the ask response.
  function wrap(text: string, maxChars: number): string[] {
    const words = text.split(' ');
    const lines: string[] = [];
    let cur = '';
    for (const w of words) {
      if ((cur + ' ' + w).trim().length > maxChars) {
        if (cur) lines.push(cur);
        cur = w;
      } else {
        cur = (cur + ' ' + w).trim();
      }
    }
    if (cur) lines.push(cur);
    return lines;
  }

  return {
    input(key: InputKey) {
      clampCursor();
      if (key === 'up') moveCursor(-1);
      else if (key === 'down') moveCursor(1);
      else if (key === 'a' || key === 'start') confirm();
      else if (key === 'b') cancel();
    },
    draw(ctx) {
      ctx.fillStyle = 'rgba(16, 22, 34, 0.92)';
      ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
      if (mode === 'summary') {
        drawSummary(ctx, opts.party[summaryIdx]!, summaryIdx);
        drawText(ctx, 'B: back', LIST_PANEL.x + LIST_PANEL.w - 60, LOGICAL_H - 12, PALETTE.paperDim);
        return;
      }
      if (mode === 'ask') {
        drawPanel(ctx, LIST_PANEL.x, LIST_PANEL.y, LIST_PANEL.w, LIST_PANEL.h);
        drawText(ctx, `You ask ${opts.party[cursor]!.species.name}…`, LIST_PANEL.x + 12, LIST_PANEL.y + 14, PALETTE.paperShadow);
        askLines.forEach((line, i) => {
          drawText(ctx, line, LIST_PANEL.x + 16, LIST_PANEL.y + 40 + i * 13, PALETTE.ink);
        });
        drawText(ctx, 'A / B: back', LIST_PANEL.x + LIST_PANEL.w - 76, LOGICAL_H - 12, PALETTE.paperDim);
        return;
      }
      drawList(ctx);
      if (mode === 'action') drawActionPopup(ctx);
      if (mode === 'reorder') {
        drawText(ctx, 'MOVE: ↑↓ shuffles · A/B drops', 8, LOGICAL_H - 12, PALETTE.paperDim);
      } else if (mode === 'list') {
        drawText(ctx, 'A select · B close', 8, LOGICAL_H - 12, PALETTE.paperDim);
      }
    },
  };

  function drawList(ctx: CanvasRenderingContext2D): void {
    drawPanel(ctx, LIST_PANEL.x, LIST_PANEL.y, LIST_PANEL.w, LIST_PANEL.h);
    drawText(ctx, 'PARTY', LIST_PANEL.x + 8, LIST_PANEL.y + 6, PALETTE.paperShadow);
    for (let i = 0; i < opts.party.length; i += 1) {
      const mon = opts.party[i]!;
      const y = LIST_PANEL.y + 22 + i * ROW_H;
      const isActive = cursor === i;
      const isLifted = mode === 'reorder' && reorderIdx === i;
      const marker = isLifted ? '↕' : isActive ? '>' : ' ';
      const fainted = mon.hp <= 0;
      drawText(
        ctx,
        `${marker} ${mon.species.name}`,
        LIST_PANEL.x + 8,
        y,
        fainted ? PALETTE.paperDim : PALETTE.ink,
      );
      const status = i === 0 ? 'LEAD' : fainted ? 'FNT' : '';
      drawText(ctx, status, LIST_PANEL.x + 110, y, PALETTE.paperShadow);
      // HP bar
      drawText(ctx, 'HP', LIST_PANEL.x + 160, y, PALETTE.paperShadow);
      drawBar(
        ctx,
        LIST_PANEL.x + 178,
        y + 1,
        100,
        mon.hp,
        mon.maxHp,
        hpColor(mon.hp, mon.maxHp),
      );
      drawText(
        ctx,
        `${Math.round(mon.hp)}/${mon.maxHp}`,
        LIST_PANEL.x + 178,
        y + 8,
        PALETTE.paperShadow,
      );
    }
  }

  function drawActionPopup(ctx: CanvasRenderingContext2D): void {
    const y = LIST_PANEL.y + 22 + cursor * ROW_H - 4;
    const popX = LIST_PANEL.x + 230;
    const popY = Math.min(y, LOGICAL_H - 68);
    drawPanel(ctx, popX, popY, 72, 62);
    const items: readonly string[] = ['SUMMARY', 'MOVE', 'ASK', 'BACK'];
    items.forEach((label, i) => {
      const marker = actionCursor === i ? '>' : ' ';
      drawText(ctx, `${marker} ${label}`, popX + 6, popY + 6 + i * 12);
    });
  }

  function drawSummary(ctx: CanvasRenderingContext2D, mon: SideState, index: number): void {
    drawPanel(ctx, LIST_PANEL.x, LIST_PANEL.y, LIST_PANEL.w, LIST_PANEL.h);
    drawText(ctx, 'SUMMARY', LIST_PANEL.x + 8, LIST_PANEL.y + 6, PALETTE.paperShadow);

    drawText(ctx, mon.species.name, LIST_PANEL.x + 12, LIST_PANEL.y + 22);
    drawText(
      ctx,
      `Type: ${mon.species.types.join('/') || 'Neutral'}`,
      LIST_PANEL.x + 12,
      LIST_PANEL.y + 34,
      PALETTE.paperShadow,
    );

    // HP + ST bars (live values from the SideState — match writeback).
    drawText(ctx, 'HP', LIST_PANEL.x + 12, LIST_PANEL.y + 50, PALETTE.paperShadow);
    drawBar(
      ctx,
      LIST_PANEL.x + 32,
      LIST_PANEL.y + 51,
      120,
      mon.hp,
      mon.maxHp,
      hpColor(mon.hp, mon.maxHp),
    );
    drawText(
      ctx,
      `${Math.round(mon.hp)}/${mon.maxHp}`,
      LIST_PANEL.x + 158,
      LIST_PANEL.y + 50,
    );

    drawText(ctx, 'ST', LIST_PANEL.x + 12, LIST_PANEL.y + 62, PALETTE.paperShadow);
    drawBar(
      ctx,
      LIST_PANEL.x + 32,
      LIST_PANEL.y + 63,
      120,
      mon.st,
      100,
      PALETTE.stamina,
    );
    drawText(ctx, `${Math.round(mon.st)}/100`, LIST_PANEL.x + 158, LIST_PANEL.y + 62);

    // Moveset — tier from lookupMove (CH1 dex registered at startup).
    drawText(ctx, 'MOVES', LIST_PANEL.x + 12, LIST_PANEL.y + 80, PALETTE.paperShadow);
    mon.species.moves.forEach((moveName: string, i: number) => {
      let tierTag = '??';
      try {
        tierTag = TIERS[lookupMove(moveName).tier].name.toUpperCase().slice(0, 4);
      } catch {
        // Unknown move — render as ?? so the row stays legible even
        // if a future dex add forgets to register a move.
      }
      drawText(
        ctx,
        `${moveName}`,
        LIST_PANEL.x + 12,
        LIST_PANEL.y + 92 + i * 11,
      );
      drawText(
        ctx,
        tierTag,
        LIST_PANEL.x + 140,
        LIST_PANEL.y + 92 + i * 11,
        PALETTE.paperShadow,
      );
    });

    // Bond stage + evolution readiness (Phase 6b). Reuses the forward-
    // hook BOND slot: the named stage, plus a readiness line when the mon
    // is close to evolving.
    drawText(ctx, 'BOND', LIST_PANEL.x + 200, LIST_PANEL.y + 80, PALETTE.paperShadow);
    const bondVal = opts.bond?.[index] ?? 0;
    drawText(ctx, `★ ${bondStageName(bondVal)}`, LIST_PANEL.x + 200, LIST_PANEL.y + 92, PALETTE.star);
    // Sense of progress WITHIN the stage — five pips filling toward the next
    // named stage (the relationship deepening), NOT a 0–100 grind-bar. At the
    // top stage the pips read full. (bond-track-v2 display model: B4.)
    drawBondPips(ctx, LIST_PANEL.x + 200, LIST_PANEL.y + 102, bondVal);
    const ready = opts.readiness?.(index) ?? null;
    if (ready) {
      drawText(ctx, ready, LIST_PANEL.x + 200, LIST_PANEL.y + 114, PALETTE.hpOk);
    }
  }
}

// Five pips showing progress WITHIN the current bond stage (deepening toward
// the next named stage). Filled pips = star glyphs in the star colour; empty
// = a dim dot. Deliberately coarse (5 steps) so it reads as "growing closer,"
// never as a precise percentage. (B4 — relationship, not a number.)
const BOND_PIPS = 5;
function drawBondPips(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  bondValue: number,
): void {
  const filled = Math.round(stageProgress(bondValue) * BOND_PIPS);
  let glyphs = '';
  for (let i = 0; i < BOND_PIPS; i += 1) glyphs += i < filled ? '★' : '·';
  drawText(ctx, glyphs, x, y, PALETTE.star);
}
