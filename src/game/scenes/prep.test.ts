import { describe, expect, test } from 'vitest';
import {
  SPECIES,
  createBattleState,
  createSide,
  mulberry32,
  resolveRound,
} from '../../engine';
import type { BattleState, Stance } from '../../engine';
import { FOE_HABIT_STANCE, counterStanceFor, prepPlanLines } from './prep';

// ── The SCOUT REPORT teaches the CURRENT triangle — never a stale line ───────
// The prep-scene bug: it taught "FLUID dodges his Aggressive" — a LOSING line
// after the A>F punish flip. The plan now DERIVES the counter from the triangle;
// this test pins the taught counter to the ENGINE's actual resolution, so a future
// triangle change that isn't mirrored in the teaching FAILS here (can't go stale).

const STANCES: readonly Stance[] = ['A', 'G', 'F'];
const READ_WIN_KINDS = new Set(['counter', 'opening', 'punish']); // the player won the exchange
function makeState(): BattleState {
  return createBattleState(createSide(SPECIES.EMBERCUB!), createSide(SPECIES.AQUAFIN!));
}

describe('prep scout report — the taught counter matches the engine triangle', () => {
  test('counterStanceFor(habit) actually BEATS that habit in the engine (all three)', () => {
    for (const habit of STANCES) {
      const counter = counterStanceFor(habit);
      // The player adopts the TAUGHT counter; the foe plays its habit. Full-HP
      // fixtures + a light move so no KO pre-empts the read-win event.
      const r = resolveRound(
        makeState(),
        { kind: 'move', move: 'TACKLE', stance: counter },
        { kind: 'move', move: 'TACKLE', stance: habit },
        mulberry32(42),
      );
      const playerWonRead = r.events.some((e) => 'side' in e && e.side === 'player' && READ_WIN_KINDS.has(e.kind));
      expect(playerWonRead, `taught counter ${counter} must beat habit ${habit} in the engine`).toBe(true);
    }
  });

  test('the counter is the post-flip relation (GUARD beats Aggressive, not FLUID)', () => {
    expect(counterStanceFor('A')).toBe('G'); // GUARD turns Aggression (was the FLUID punish trap)
    expect(counterStanceFor('G')).toBe('F'); // FLUID slips Guard
    expect(counterStanceFor('F')).toBe('A'); // AGGRESSION punishes a dodge
  });

  test('the PLAN text names GUARD vs the ALL-OUT-ATK foe — the FLUID losing line is gone', () => {
    expect(FOE_HABIT_STANCE).toBe('A'); // "ALL-OUT ATK" = Aggressive
    const plan = prepPlanLines(FOE_HABIT_STANCE).join(' ');
    expect(plan).toContain('GUARD');
    expect(plan).toContain('counter and charge ★');
    expect(plan).not.toContain('FLUID'); // the pre-flip, now-losing advice is gone
  });
});
