// gym2-plan Step 6 — a leader fight is staged from DATA. These pin FALKNER's spec to
// the literals the two hand-written main.ts functions carried before the move, and
// check the registry's joins (card ↔ dex rows, boss id ↔ scout report).

import { describe, expect, it } from 'vitest';
import ch1BatchData from '../../docs/ch1-batch.json';
import { FALKNER_CARD, falknerBossAI, loadBossCard } from '../engine';
import type { DexEntryJson } from '../engine';
import { ZEPHYR_BADGE } from './badges';
import { FALKNER_LEADER, LEADERS, leaderFor, leaderIntro } from './leaders';
import { scoutReportFor } from './scout';
import { ACADEMY_PROMOTED_FLAG, falknerMentorLines } from './violetAcademy';

describe('FALKNER_LEADER — the pre-refactor literals, unchanged', () => {
  it('stages the engine card with his policy on the CH1 rows', () => {
    expect(FALKNER_LEADER.bossId).toBe('falkner');
    expect(FALKNER_LEADER.card).toBe(FALKNER_CARD);
    expect(FALKNER_LEADER.policy).toBe(falknerBossAI);
    expect(FALKNER_LEADER.dexRows).toBe(ch1BatchData as DexEntryJson[]);
  });

  it('keeps the intro, derived send-out line included', () => {
    const { roster } = loadBossCard(FALKNER_LEADER.card, FALKNER_LEADER.dexRows);
    expect(leaderIntro(FALKNER_LEADER, roster[0]!.name)).toEqual([
      'FALKNER: Welcome to my',
      'rooftop. Read the wind!',
      '— sent out FLITPECK!',
    ]);
  });

  it('keeps the tells, the badge beat and the after-win beat', () => {
    expect(FALKNER_LEADER.trainerName).toBe('FALKNER');
    expect(FALKNER_LEADER.intentReliability).toBe('ambiguous');
    expect(FALKNER_LEADER.foeFocusInfo).toEqual({ discipline: 'veiled', releases: ['heavy'] });
    expect(FALKNER_LEADER.badge).toBe(ZEPHYR_BADGE);
    expect(FALKNER_LEADER.badgeLines).toEqual(['Proof of the rooftop wind.', 'You read the gale and held.']);
    expect(FALKNER_LEADER.beatenFlag).toBe('falkner_beaten');
    expect(FALKNER_LEADER.afterWin?.flag).toBe(ACADEMY_PROMOTED_FLAG);
    expect(FALKNER_LEADER.afterWin?.lines()).toEqual(falknerMentorLines());
  });
});

describe('the leader registry', () => {
  it('holds FALKNER only (no Gym-2 row until its card is ruled)', () => {
    expect(Object.keys(LEADERS)).toEqual(['falkner']);
  });

  it('looks up by boss id; an unknown id (or a prototype key) is undefined', () => {
    expect(leaderFor('falkner')).toBe(FALKNER_LEADER);
    expect(leaderFor('bugsy')).toBeUndefined();
    expect(leaderFor('toString')).toBeUndefined();
  });

  it.each(Object.values(LEADERS))('$bossId: keyed by its own id, roster resolves, report registered', (leader) => {
    expect(LEADERS[leader.bossId]).toBe(leader);
    const { roster } = loadBossCard(leader.card, leader.dexRows);
    expect(roster.length).toBe(leader.card.roster.length);
    expect(() => scoutReportFor(leader.bossId)).not.toThrow();
  });
});
