import type { Species, Stance } from '../../engine';
import { LOGICAL_H, LOGICAL_W } from '../canvas';
import { PALETTE } from '../palette';
import type { InputKey, Scene } from '../scene';
import { drawSpeciesInSlot } from '../sprites';
import { drawPanel, drawText } from '../ui';

export interface PrepSceneOpts {
  readonly playerSpecies: Species;
  readonly foeSpecies: Species;
  readonly foeTrainerName: string;
  readonly onContinue: () => void;
}

// The foe's scouted HABIT — its dominant stance. Fixed for now (KAMON-class
// aggressors, "ALL-OUT ATK"); when trainer profiles feed prep this comes from the
// profile's stance tendency.
export const FOE_HABIT_STANCE: Stance = 'A';

// The stance the PLAYER should adopt to beat a habitual stance — the CURRENT
// triangle counter (AGGRESSIVE > FLUID > GUARD > AGGRESSIVE: GUARD turns Aggression,
// FLUID slips Guard, AGGRESSION punishes a dodge). DERIVED from the triangle, never
// hardcoded to a matchup, so the teaching tracks the engine — a test pins this to
// the engine's actual resolution so it can never teach a stale (losing) line again.
export function counterStanceFor(habit: Stance): Stance {
  return habit === 'A' ? 'G' : habit === 'G' ? 'F' : 'A';
}

// The PLAN lines, keyed by the player's counter stance (names the stance + its
// win-edge). Two lines, sized to the panel.
const PLAN_BY_COUNTER: { readonly [k in Stance]: readonly [string, string] } = {
  G: ['GUARD turns his attacks', '— counter and charge ★.'],
  F: ['FLUID slips his guard', '— take the opening, ★.'],
  A: ['AGGRESSIVE catches his', 'dodge — punish, charge ★.'],
};
export function prepPlanLines(habit: Stance): readonly [string, string] {
  return PLAN_BY_COUNTER[counterStanceFor(habit)];
}

export function createPrepScene(opts: PrepSceneOpts): Scene {
  const faster = opts.playerSpecies.spd > opts.foeSpecies.spd;
  let tick = 0;

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

      // Title bar
      drawText(ctx, 'SCOUT REPORT', 122, 4, PALETTE.paper);

      drawPanel(ctx, 8, 14, LOGICAL_W - 16, LOGICAL_H - 22);

      // Foe sprite slot
      const slotX = LOGICAL_W - 76;
      const slotY = 26;
      ctx.fillStyle = PALETTE.platform;
      ctx.beginPath();
      ctx.ellipse(slotX + 28, slotY + 56, 28, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      drawSpeciesInSlot(
        ctx,
        { name: opts.foeSpecies.name, type: opts.foeSpecies.types[0] ?? null },
        slotX,
        slotY,
      );

      // Trainer + species
      drawText(ctx, `${opts.foeTrainerName}'s ${opts.foeSpecies.name}`, 18, 28);
      drawText(ctx, 'TYPE: edge vs you', 18, 42, PALETTE.hpCrit);
      drawText(
        ctx,
        `SPD ${opts.foeSpecies.spd} (${faster ? 'SLOWER' : 'FASTER'})`,
        18,
        56,
      );
      drawText(ctx, 'HABIT: ALL-OUT ATK', 18, 70);

      // Divider
      ctx.fillStyle = PALETTE.barEmpty;
      ctx.fillRect(18, 84, LOGICAL_W - 36, 1);

      drawText(ctx, 'PLAN:', 18, 92, PALETTE.paperShadow);

      // The counter is DERIVED from the foe's habit + the current triangle — not the
      // speed. (Speed decides initiative, not the win-edge: post-flip, dodging an
      // Aggressive foe with FLUID is a PUNISH, so GUARD is the read regardless.)
      const plan = prepPlanLines(FOE_HABIT_STANCE);
      drawText(ctx, plan[0], 18, 106);
      drawText(ctx, plan[1], 18, 118);
      drawText(ctx, faster ? 'You strike first.' : 'He outspeeds you.', 18, 134, PALETTE.paperShadow);

      drawText(ctx, '★ CALL: catch breath', 18, 156, PALETTE.paperShadow);

      if (Math.floor(tick * 2) % 2 === 0) {
        drawText(ctx, 'A: BATTLE', LOGICAL_W - 76, 156, PALETTE.ink);
      }
    },
  };
}
