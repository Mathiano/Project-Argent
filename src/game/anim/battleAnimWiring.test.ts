// The shipped battle choreography, driven exactly as battle.ts drives it:
// anim.trigger(event.kind, event.side). These assert WHICH SPRITE moves, which
// is the part that silently drifted — hit-landed carries the ATTACKER's side,
// so a flash with no explicit side lit the wrong mon.
import { describe, expect, it } from 'vitest';
import { createBattleAnimRuntime } from './battleAnim';

type Side = 'player' | 'foe';

function harness() {
  const rt = createBattleAnimRuntime();
  const flash: Record<Side, number> = { player: 0, foe: 0 };
  const offX: Record<Side, number> = { player: 0, foe: 0 };
  rt.register('sprite.flashAlpha', { set: (v, s) => { flash[(s ?? 'foe') as Side] = v; } });
  rt.register('sprite.offsetX', { set: (v, s) => { offX[(s ?? 'foe') as Side] = v; } });
  // Mirrors battle.ts: positive = toward the opponent, sign flipped for the foe.
  rt.register('sprite.lungeToward', {
    set: (v, s) => { const side = (s ?? 'player') as Side; offX[side] = side === 'player' ? v : -v; },
  });
  for (const ch of ['stage.shakeX', 'bar.hpProgress', 'star.scale', 'star.flashAlpha', 'panel.offsetY', 'panel.alpha', 'wipe.alpha', 'wipe.offsetX']) {
    rt.register(ch, { set: () => {} });
  }
  return { rt, flash, offX };
}

describe('hit-landed flashes the mon that was STRUCK', () => {
  for (const [attacker, struck] of [['player', 'foe'], ['foe', 'player']] as const) {
    it(`${attacker} strikes → ${struck} flashes, ${attacker} does not`, () => {
      const { rt, flash } = harness();
      rt.trigger('hit-landed', attacker); // battle.ts emits ev.side = the striker
      rt.update(4 / 60);
      expect(flash[struck]).toBeGreaterThan(0.5);
      expect(flash[attacker]).toBe(0);
    });
  }
});

// One impact beat: the struck mon flashes, its HP drains, and the ATTACKER
// lunges. All three ride hit-landed, whose subject is the striker.
describe('hit-landed lunges the ATTACKER toward its opponent', () => {
  it('the player lunges right (toward the foe at top-right)', () => {
    const { rt, offX } = harness();
    rt.trigger('hit-landed', 'player');
    rt.update(5 / 60);
    expect(offX.player).toBeGreaterThan(0);
    expect(offX.foe).toBe(0); // the defender does not move
  });

  it('the foe lunges left (toward the player at bottom-left) — the mirrored sign', () => {
    const { rt, offX } = harness();
    rt.trigger('hit-landed', 'foe');
    rt.update(5 / 60);
    expect(offX.foe).toBeLessThan(0);
    expect(offX.player).toBe(0);
  });

  it('returns to rest by the end of the animation', () => {
    const { rt, offX } = harness();
    rt.trigger('hit-landed', 'player');
    rt.update(30 / 60);
    expect(Math.abs(offX.player)).toBeLessThan(0.001);
  });
});
