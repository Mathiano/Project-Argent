import type { Species, Stance, StanceTendency, TrainerProfile, TypeChart } from '../../engine';
import { LOGICAL_H, LOGICAL_W } from '../canvas';
import { PALETTE } from '../palette';
import type { InputKey, Scene } from '../scene';
import { drawSpeciesInSlot } from '../sprites';
import { drawPanel, drawText } from '../ui';

export interface PrepSceneOpts {
  readonly playerSpecies: Species;
  readonly foeSpecies: Species;
  readonly foeTrainerName: string;
  // The foe's Combat-Layer-4 profile. The HABIT line and the PLAN are derived from
  // its stance tendency; omitted → the KAMON-class aggressor default (below).
  readonly profile?: TrainerProfile;
  // Derives the TYPE line. Omitted → the line is left off rather than guessed.
  readonly typeChart?: TypeChart;
  readonly onContinue: () => void;
}

// The default scouted HABIT for a foe with no profile. It is 'A' because the only
// unprofiled prep foe is KAMON-class. It is a FALLBACK, not a fact: a profiled foe
// derives its habit below. (Prep once hardcoded this for every foe, and the sibling
// Falkner sheet hardcoded its numbers the same way and shipped a false break bar for
// months — hence the derivation.)
export const FOE_HABIT_STANCE: Stance = 'A';

// stance tendency → the single stance a scout would write down. A 'balanced'
// trainer has no habit to report, which is itself the intel.
export function habitStanceFor(tendency: StanceTendency): Stance | null {
  return tendency === 'aggressor' ? 'A' : tendency === 'bulwark' ? 'G' : tendency === 'evader' ? 'F' : null;
}

export const HABIT_LABEL: { readonly [k in StanceTendency]: string } = {
  aggressor: 'ALL-OUT ATK',
  bulwark: 'DIGS IN',
  evader: 'SLIPS AWAY',
  balanced: 'MIXES IT UP',
};

// The strongest multiplier `attacker`'s types can land on `defender`'s.
function bestMult(attacker: readonly string[], defender: readonly string[], chart: TypeChart): number {
  let best = 0;
  for (const a of attacker) {
    let mult = 1;
    for (const d of defender) {
      const v = chart[a]?.[d];
      if (v !== undefined) mult *= v;
    }
    best = Math.max(best, mult);
  }
  return best === 0 ? 1 : best;
}

// The TYPE line, DERIVED. It used to read 'TYPE: edge vs you' unconditionally —
// true of KAMON (he takes the starter that beats yours) and a guess everywhere else.
export function typeEdgeLine(
  player: Species,
  foe: Species,
  chart: TypeChart,
): { readonly text: string; readonly favors: 'foe' | 'player' | 'both' | 'neither' } {
  const foeOnYou = bestMult(foe.types, player.types, chart);
  const youOnFoe = bestMult(player.types, foe.types, chart);
  if (foeOnYou > 1 && youOnFoe > 1) return { text: 'TYPE: you both bite', favors: 'both' };
  if (foeOnYou > 1) return { text: 'TYPE: edge vs you', favors: 'foe' };
  if (youOnFoe > 1) return { text: 'TYPE: the edge is yours', favors: 'player' };
  return { text: 'TYPE: no edge either way', favors: 'neither' };
}

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
  const tendency: StanceTendency = opts.profile?.stance ?? 'aggressor';
  const habit = opts.profile ? habitStanceFor(tendency) : FOE_HABIT_STANCE;
  const typeLine = opts.typeChart
    ? typeEdgeLine(opts.playerSpecies, opts.foeSpecies, opts.typeChart)
    : null;
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
      if (typeLine) {
        drawText(
          ctx,
          typeLine.text,
          18,
          42,
          typeLine.favors === 'player' ? PALETTE.hpOk : typeLine.favors === 'neither' ? PALETTE.paperShadow : PALETTE.hpCrit,
        );
      }
      drawText(
        ctx,
        `SPD ${opts.foeSpecies.spd} (${faster ? 'SLOWER' : 'FASTER'})`,
        18,
        56,
      );
      drawText(ctx, `HABIT: ${HABIT_LABEL[tendency]}`, 18, 70);

      // Divider
      ctx.fillStyle = PALETTE.barEmpty;
      ctx.fillRect(18, 84, LOGICAL_W - 36, 1);

      drawText(ctx, 'PLAN:', 18, 92, PALETTE.paperShadow);

      // The counter is DERIVED from the foe's habit + the current triangle — not the
      // speed. (Speed decides initiative, not the win-edge: post-flip, dodging an
      // Aggressive foe with FLUID is a PUNISH, so GUARD is the read regardless.)
      if (habit === null) {
        // No habit to counter — say so rather than teaching a line that loses to
        // two thirds of what this foe actually plays.
        drawText(ctx, 'No single habit — he mixes.', 18, 106);
        drawText(ctx, 'Read him round by round.', 18, 118);
      } else {
        const plan = prepPlanLines(habit);
        drawText(ctx, plan[0], 18, 106);
        drawText(ctx, plan[1], 18, 118);
      }
      drawText(ctx, faster ? 'You strike first.' : 'He outspeeds you.', 18, 134, PALETTE.paperShadow);

      drawText(ctx, '★ CALL: catch breath', 18, 156, PALETTE.paperShadow);

      if (Math.floor(tick * 2) % 2 === 0) {
        drawText(ctx, 'A: BATTLE', LOGICAL_W - 76, 156, PALETTE.ink);
      }
    },
  };
}
