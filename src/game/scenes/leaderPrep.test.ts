// gym2-plan Step 6 — the prep sheet is the generic leader scene; the report comes
// from the scout registry by boss id. Falkner's wrapper must draw exactly what the
// generic scene draws for his id and name.

import { describe, expect, it } from 'vitest';
import ch1BatchData from '../../../docs/ch1-batch.json';
import { loadBossCard, loadDex } from '../../engine';
import type { BossCard, DexEntryJson, Species } from '../../engine';
import { TYPECHART_CANON } from '../dexRegistry';
import { FALKNER_LEADER } from '../leaders';
import type { Scene } from '../scene';
import { createFalknerPrepScene } from './falknerPrep';
import { createLeaderPrepScene } from './leaderPrep';

function drawnTexts(scene: Scene): readonly string[] {
  const out: string[] = [];
  const noop = () => {};
  const ctx = new Proxy(
    {},
    {
      get(_t, prop) {
        if (prop === 'fillText') return (text: string) => out.push(String(text));
        if (prop === 'measureText') return (t: string) => ({ width: String(t).length * 4 });
        return noop;
      },
      set: () => true,
    },
  ) as unknown as CanvasRenderingContext2D;
  scene.update?.(0);
  scene.draw(ctx);
  return out;
}

const { card } = loadBossCard(FALKNER_LEADER.card, FALKNER_LEADER.dexRows);
const PLAYER: Species = loadDex(ch1BatchData as DexEntryJson[], 13).GRUBLEAF!;
const base = (c: BossCard, hasFlag: (f: string) => boolean) => ({
  playerSpecies: PLAYER,
  foeSpecies: c.species,
  card: c,
  typeChart: TYPECHART_CANON,
  hasFlag,
  onContinue: () => {},
});

describe('leader prep scene', () => {
  it.each([false, true])('Falkner wrapper draws what the generic scene draws (intel=%s)', (intel) => {
    const wrapped = drawnTexts(createFalknerPrepScene(base(card, () => intel)));
    const generic = drawnTexts(
      createLeaderPrepScene({ ...base(card, () => intel), bossId: 'falkner', trainerName: 'FALKNER' }),
    );
    expect(wrapped).toEqual(generic);
  });

  it('quotes the trainer name it is given', () => {
    const texts = drawnTexts(
      createLeaderPrepScene({ ...base(card, () => false), bossId: 'falkner', trainerName: 'TESTER' }),
    ).join(' | ');
    expect(texts).toContain("TESTER's GALEHAWK");
  });

  it('throws on a boss id with no registered report', () => {
    expect(() =>
      createLeaderPrepScene({ ...base(card, () => false), bossId: 'bugsy', trainerName: 'BUGSY' }),
    ).toThrow(/no scout report/);
  });
});
