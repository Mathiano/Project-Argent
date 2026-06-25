// Bond stage-crossing beat (bond-feel-polish Issue 1; ENRICHED for the bond-
// legibility lane, surface ②). Shown right AFTER a battle when a mon crossed
// into a new bond stage (e.g. Wary → Warming) — a relationship milestone
// announced like a reward event, so bond is FELT, not just a number checked
// later. A short panel; A/Start continues. Pushed by main.ts after the battle
// pops (same pattern as the evolution + badge beats), before the evolution
// check.
//
// The ENRICHMENT (Lane A): make the tier-up land as a reward — a warmer burst,
// the new stage named prominently, the bond bar sweeping to full (the stage
// completed), and an explicit acknowledgment of what DEEPENED / what UNLOCKED
// at this tier. It does NOT rebuild the beat or touch bond math — it enriches
// the existing post-fight scene (docs/bond-legibility-design.md).
//
// FORWARD-NOTE: the headline is a single GENERIC line for now. When the
// mon CHARACTER layer wires `personality` (docs/mon-character.md) through to
// the in-game Species, filter this line by temperament (a Bold mon's line
// differs from a Gentle mon's). Cheap to add then — one lookup here.

import { LOGICAL_H, LOGICAL_W } from '../canvas';
import { PALETTE } from '../palette';
import type { InputKey, Scene } from '../scene';
import { drawPanel, drawText } from '../ui';
import { drawBondBar } from '../bondBar';

export interface BondStageSceneOpts {
  readonly species: string;
  readonly fromName: string;
  readonly toName: string;
  // The post-cross bond value (0–100). When provided, the beat sweeps the
  // bond bar to full (the just-completed stage) as the reward flourish. Omitted
  // → the bar is skipped (back-compat for callers that don't thread it).
  readonly toValue?: number;
  // True when THIS crossing newly unlocked the Call economy (the Warming
  // bond moment). Shows a line tying the power to the relationship.
  readonly unlocksCalls?: boolean;
  readonly onContinue: () => void;
}

export function createBondStageScene(opts: BondStageSceneOpts): Scene {
  let tick = 0;
  // The bar sweeps to full over this window (the "stage completed" flourish),
  // then a soft flash marks the milestone landing.
  const FILL_SEC = 0.6;
  return {
    update(dt) {
      tick += dt;
    },
    input(key: InputKey) {
      if (key === 'a' || key === 'start') opts.onContinue();
    },
    draw(ctx) {
      ctx.fillStyle = '#101622';
      ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

      // A warm bloom at the heart of the beat: ★ rays + expanding rings that
      // pulse outward, so the milestone reads as an EVENT, not a toast.
      const cx = LOGICAL_W / 2;
      const cy = 54;
      const pulse = (Math.sin(tick * 4) + 1) / 2;
      ctx.fillStyle = '#2a2440';
      for (let i = 0; i < 12; i += 1) {
        const a = (i / 12) * Math.PI * 2 + tick * 0.5;
        const len = 52 + pulse * 9;
        ctx.fillRect(Math.round(cx + Math.cos(a) * len), Math.round(cy + Math.sin(a) * len), 2, 2);
      }
      // Two expanding bond-tinted rings, phase-offset, fading as they grow.
      ctx.lineWidth = 1;
      for (let r = 0; r < 2; r += 1) {
        const grow = ((tick * 0.8 + r * 0.5) % 1);
        ctx.globalAlpha = Math.max(0, 0.5 * (1 - grow));
        ctx.strokeStyle = PALETTE.bond;
        ctx.beginPath();
        ctx.ellipse(cx, cy, 10 + grow * 40, 8 + grow * 30, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = pulse > 0.5 ? PALETTE.star : '#caa148';
      drawText(ctx, '★', cx - 4, cy - 5, ctx.fillStyle as string);

      drawPanel(ctx, 24, 84, LOGICAL_W - 48, 84);
      // Reward headline — names the EVENT (the relationship deepened), then the
      // mon + the named transition (unambiguous with a party).
      drawText(ctx, 'YOUR BOND DEEPENED', 36, 92, PALETTE.bond);
      drawText(ctx, `${opts.species} feels closer to you!`, 36, 104, PALETTE.paper);
      drawText(ctx, `${opts.species}:  ${opts.fromName}  →  ${opts.toName}`, 36, 116, PALETTE.star);

      // The bond bar sweeping to full — the visible "stage completed" flourish,
      // tinted to flash as it lands. Shown labelled with the NEW stage name so
      // the player reads where the relationship now stands.
      if (opts.toValue !== undefined) {
        const fill = Math.min(1, tick / FILL_SEC);
        drawBondBar(ctx, 36, 130, LOGICAL_W - 96, opts.toValue, { progress: fill });
      }

      // The Warming bond moment GRANTS a power — the relationship empowers the
      // mon (bonds-empower-your-mon). Shown only when it newly unlocked.
      if (opts.unlocksCalls) {
        drawText(ctx, `You can now CALL to ${opts.species} in battle!`, 36, 142, PALETTE.hpOk);
        drawText(ctx, '(Recover Breath unlocked — spend ★)', 36, 154, PALETTE.paperShadow);
      }

      if (Math.floor(tick * 2) % 2 === 0) {
        drawText(ctx, 'A: continue', LOGICAL_W - 90, 168, PALETTE.paper);
      }
    },
  };
}
