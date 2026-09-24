// gym2-plan Step 5 — Falkner's card has ONE source (engine FALKNER_CARD). These
// pin the loaded card to the exact literal main.ts built inline before the move,
// so the game-side fight and the scout report it quotes are unchanged.

import { describe, expect, it } from 'vitest';
import typeChartData from '../../docs/typechart.json';
import ch1BatchData from '../../docs/ch1-batch.json';
import { FALKNER_CARD, FALKNER_OPENING_MOMENTUM, loadBossCard, loadDex } from '../engine';
import type { BossCard, DexEntryJson, Species, TypeChart } from '../engine';
import { bossScoutFacts } from './scout';

const ROWS = ch1BatchData as DexEntryJson[];

// The pre-refactor main.ts construction, verbatim: FALKNER_LEAD_DEX (CH1 @13),
// FALKNER_ACE_DEX (CH1 @15) + GUSTBORNE, and the inline falknerBossCard literal.
const PRIOR_LEAD: Species = loadDex(ROWS, 13).FLITPECK!;
const PRIOR_ACE: Species = { ...loadDex(ROWS, 15).GALEHAWK!, trait: 'GUSTBORNE' };
const PRIOR_CARD: BossCard = {
  species: PRIOR_ACE,
  statScale: { hp: 1.15 },
  arenaSchedule: { rhythmEveryN: 3, heavyExtraCost: 8, heavyExtraInitWeight: 1.3, telegraphAheadBy: 1 },
  breakBar: 4,
  teamSize: 2,
  openingMomentum: FALKNER_OPENING_MOMENTUM,
};

describe('Falkner card — single source, unchanged values', () => {
  const { card, roster } = loadBossCard(FALKNER_CARD, ROWS);

  it('loads the same card and lineup main.ts built inline', () => {
    expect(card).toEqual(PRIOR_CARD);
    expect(roster).toEqual([PRIOR_LEAD, PRIOR_ACE]);
    expect(FALKNER_CARD.traits).toEqual({ GUSTBORNE: { dmgMult: 1.4, initMult: 1.25 } });
  });

  it('derives the same scout facts', () => {
    const facts = (c: BossCard) =>
      bossScoutFacts({
        trainerName: 'FALKNER',
        card: c,
        ace: c.species,
        playerSpd: 40,
        typeChart: typeChartData as TypeChart,
      });
    expect(facts(card)).toEqual(facts(PRIOR_CARD));
  });
});
