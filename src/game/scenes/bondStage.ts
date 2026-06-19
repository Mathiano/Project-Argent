// Bond stage-crossing beat (bond-feel-polish Issue 1). Shown right AFTER a
// battle when a mon crossed into a new bond stage (e.g. Wary → Warming) — a
// relationship milestone announced like a level-up, so bond is FELT, not
// just a number checked later in the summary. A short panel; A/Start
// continues. Pushed by main.ts after the battle pops (same pattern as the
// evolution + badge beats), before the evolution check.
//
// FORWARD-NOTE: the headline is a single GENERIC line for now. When the
// mon CHARACTER layer wires `personality` (docs/mon-character.md) through to
// the in-game Species, filter this line by temperament (a Bold mon's line
// differs from a Gentle mon's). Cheap to add then — one lookup here.

import { LOGICAL_H, LOGICAL_W } from '../canvas';
import { PALETTE } from '../palette';
import type { InputKey, Scene } from '../scene';
import { drawPanel, drawText } from '../ui';

export interface BondStageSceneOpts {
  readonly species: string;
  readonly fromName: string;
  readonly toName: string;
  // True when THIS crossing newly unlocked the Call economy (the Warming
  // bond moment). Shows a line tying the power to the relationship.
  readonly unlocksCalls?: boolean;
  readonly onContinue: () => void;
}

export function createBondStageScene(opts: BondStageSceneOpts): Scene {
  let tick = 0;
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

      // A warm pulse of ★ rays behind the heart of the beat.
      const cx = LOGICAL_W / 2;
      const cy = 58;
      const pulse = (Math.sin(tick * 4) + 1) / 2;
      ctx.fillStyle = '#2a2440';
      for (let i = 0; i < 10; i += 1) {
        const a = (i / 10) * Math.PI * 2 + tick * 0.5;
        const len = 54 + pulse * 8;
        ctx.fillRect(Math.round(cx + Math.cos(a) * len), Math.round(cy + Math.sin(a) * len), 2, 2);
      }
      ctx.fillStyle = pulse > 0.5 ? PALETTE.star : '#caa148';
      drawText(ctx, '★', cx - 4, cy - 5, ctx.fillStyle as string);

      drawPanel(ctx, 24, 92, LOGICAL_W - 48, 74);
      drawText(ctx, `${opts.species} feels closer to you!`, 36, 100, PALETTE.paper);
      // Name the mon on the transition line too (unambiguous with a party).
      drawText(ctx, `${opts.species}:  ${opts.fromName}  →  ${opts.toName}`, 36, 116, PALETTE.star);
      // The Warming bond moment GRANTS a power — the relationship empowers
      // the mon (bonds-empower-your-mon). Shown only when it newly unlocked.
      if (opts.unlocksCalls) {
        drawText(ctx, `You can now CALL to ${opts.species} in battle!`, 36, 132, PALETTE.hpOk);
        drawText(ctx, '(Recover Breath unlocked — spend ★)', 36, 144, PALETTE.paperShadow);
      }

      if (Math.floor(tick * 2) % 2 === 0) {
        drawText(ctx, 'A: continue', LOGICAL_W - 90, 168, PALETTE.paper);
      }
    },
  };
}
