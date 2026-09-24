// A gym LEADER's prep screen — a RENDER of the scout-report economy
// (`src/game/scout.ts`), not a wall of authored text. Which report it renders is
// looked up by boss id in the scout registry (gym2-plan Step 6); it began as
// Falkner's screen, and `createFalknerPrepScene` (falknerPrep.ts) is now a thin
// wrapper over this one.
//
// It used to be ~20 hardcoded strings shown unconditionally. Two things were wrong
// with that: the GYM GUIDE in Violet promises "beat his trainers first — they hand
// out a scout report" and nothing backed it, and the literals drifted from the card
// (it advertised "Break bar 2" long after the card was re-baselined to 4). Now every
// line is derived from the live BossCard and gated behind the intel flag that buys
// it; unearned lines render redacted with the source that sells them.

import type { BossCard, Species, TypeChart } from '../../engine';
import { LOGICAL_H, LOGICAL_W } from '../canvas';
import { PALETTE } from '../palette';
import type { InputKey, Scene } from '../scene';
import { bossScoutFacts, buildScoutReport, scoutReportFor } from '../scout';
import type { ScoutEntry, ScoutTone } from '../scout';
import { drawSpeciesInSlot } from '../sprites';
import { drawPanel, drawText, drawTextRight } from '../ui';

export interface LeaderPrepSceneOpts {
  // The scout-registry key — the same id the gym map's start-boss-battle names.
  readonly bossId: string;
  // Quoted by the report's free header ("FALKNER's GALEHAWK").
  readonly trainerName: string;
  readonly playerSpecies: Species;
  readonly foeSpecies: Species;
  // The LIVE card the fight will actually use — the single source the sheet quotes.
  readonly card: BossCard;
  readonly typeChart: TypeChart;
  readonly hasFlag: (flag: string) => boolean;
  readonly onContinue: () => void;
}

const TEXT_X = 16;
// Two columns: the LABEL says which fact a row is, the VALUE says what it is. A
// redacted row keeps its label, so "you don't know his BREAK yet" reads as itself
// instead of one of several identical '???' rows.
const VALUE_X = 58;
const HEADER_Y = 24;
const ROW_H = 12;
const LIST_Y = 54;
// The ace portrait sits in the panel's bottom-right dead space. The battle art is
// 112px — half the logical screen — so it is drawn at HALF scale: an exact 2:1
// integer downscale of pixel art, crisp with smoothing off. Every value column is
// authored to stop short of PORTRAIT_X.
const ART_SIZE = 112;
const PORTRAIT_SCALE = 0.5;
const PORTRAIT_SIZE = ART_SIZE * PORTRAIT_SCALE;
const PORTRAIT_X = LOGICAL_W - 14 - PORTRAIT_SIZE;
const PORTRAIT_Y = LOGICAL_H - 14 - PORTRAIT_SIZE;

function toneColor(tone: ScoutTone): string {
  switch (tone) {
    case 'good':
      return PALETTE.hpOk;
    case 'warn':
      return PALETTE.hpCrit;
    case 'dim':
      return PALETTE.paperShadow;
    default:
      return PALETTE.ink;
  }
}

// A redacted VALUE has to name its shop, or the currency has nowhere to be spent.
export function valueText(e: ScoutEntry): string {
  return e.known ? e.text : `??? — ${e.hint}`;
}

export function createLeaderPrepScene(opts: LeaderPrepSceneOpts): Scene {
  let tick = 0;
  const facts = bossScoutFacts({
    trainerName: opts.trainerName,
    card: opts.card,
    ace: opts.foeSpecies,
    playerSpd: opts.playerSpecies.spd,
    typeChart: opts.typeChart,
  });
  const report = buildScoutReport(scoutReportFor(opts.bossId), facts, opts.hasFlag);
  const free = report.entries.filter((e) => !e.gated && !e.derived);
  const bought = report.entries.filter((e) => e.gated);
  const derived = report.entries.filter((e) => e.derived);

  return {
    update(dt) {
      tick += dt;
    },

    input(key: InputKey) {
      if (key === 'a' || key === 'start') opts.onContinue();
    },

    draw(ctx) {
      ctx.fillStyle = PALETTE.ink;
      ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

      drawText(ctx, report.title, 10, 4, PALETTE.paper);
      drawTextRight(
        ctx,
        `INTEL ${report.known}/${report.total}`,
        LOGICAL_W - 10,
        4,
        report.known === report.total ? PALETTE.hpOk : PALETTE.paperDim,
      );
      drawPanel(ctx, 8, 13, LOGICAL_W - 16, LOGICAL_H - 20);

      // FREE facts head the sheet, full width — you can see the ace yourself.
      free.forEach((e, i) => {
        drawText(ctx, e.text, TEXT_X, HEADER_Y + i * ROW_H, toneColor(e.tone));
      });

      ctx.fillStyle = PALETTE.barEmpty;
      ctx.fillRect(TEXT_X, LIST_Y - 8, LOGICAL_W - 2 * TEXT_X, 1);

      // The EARNED list — the redacted rows double as a to-do list of who to beat.
      bought.forEach((e, i) => {
        const y = LIST_Y + i * ROW_H;
        drawText(ctx, e.label, TEXT_X, y, PALETTE.paperShadow);
        drawText(ctx, valueText(e), VALUE_X, y, toneColor(e.tone));
      });

      // Compound advice trails the facts it is built on.
      derived.forEach((e, i) => {
        const y = LIST_Y + bought.length * ROW_H + 6 + i * ROW_H;
        drawText(ctx, e.label, TEXT_X, y, PALETTE.paperShadow);
        drawText(ctx, valueText(e), VALUE_X, y, toneColor(e.tone));
      });

      ctx.fillStyle = PALETTE.platform;
      ctx.beginPath();
      ctx.ellipse(PORTRAIT_X + PORTRAIT_SIZE / 2, PORTRAIT_Y + PORTRAIT_SIZE - 2, 22, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.translate(PORTRAIT_X, PORTRAIT_Y);
      ctx.scale(PORTRAIT_SCALE, PORTRAIT_SCALE);
      drawSpeciesInSlot(
        ctx,
        { name: opts.foeSpecies.name, type: opts.foeSpecies.types[0] ?? null },
        0,
        0,
        { slotSize: ART_SIZE },
      );
      ctx.restore();

      if (Math.floor(tick * 2) % 2 === 0) {
        // PALETTE.paper here would be paper-on-parchment — the prompt was
        // invisible on the shipped screen. Everything INSIDE drawPanel must use
        // an ink, not a paper.
        drawText(ctx, 'A: FIGHT', TEXT_X, LOGICAL_H - 20, PALETTE.ink);
      }
    },
  };
}
