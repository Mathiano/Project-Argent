// The scout-report economy: intel is EARNED, and every line is DERIVED from the
// live boss card. The derivation tests exist because the hand-written version of
// this screen shipped a FALSE number for months ("Break bar 2" against a card
// that had moved to 4) — the whole point of the rewrite is that it cannot.

import { describe, expect, it } from 'vitest';
import typeChartData from '../../docs/typechart.json';
import ch1BatchData from '../../docs/ch1-batch.json';
import { loadDex } from '../engine';
import type { BossCard, DexEntryJson, Species, TypeChart } from '../engine';
import {
  bossScoutFacts,
  buildScoutReport,
  FALKNER_REPORT,
  intelFlagsOf,
  weaknessesOf,
} from './scout';

const TYPECHART = typeChartData as TypeChart;

function dex(name: string, level: number): Species {
  const entry = (ch1BatchData as DexEntryJson[]).find((e) => e.name === name)!;
  return loadDex([entry], level)[name]!;
}

const ACE: Species = { ...dex('GALEHAWK', 15), trait: 'GUSTBORNE' };

const CARD: BossCard = {
  species: ACE,
  statScale: { hp: 1.15 },
  arenaSchedule: {
    rhythmEveryN: 3,
    heavyExtraCost: 8,
    heavyExtraInitWeight: 1.3,
    telegraphAheadBy: 1,
  },
  breakBar: 4,
  teamSize: 2,
  openingMomentum: 2,
};

const FACTS = bossScoutFacts({
  trainerName: 'FALKNER',
  card: CARD,
  ace: ACE,
  playerSpd: 40,
  typeChart: TYPECHART,
});

const ALL_KNOWN = () => true;
const NONE_KNOWN = () => false;
const only = (...flags: string[]) => (f: string) => flags.includes(f);

function entry(report: ReturnType<typeof buildScoutReport>, id: string) {
  const e = report.entries.find((x) => x.id === id);
  if (!e) throw new Error(`no scout entry ${id}`);
  return e;
}

describe('weaknessesOf', () => {
  it('reads the chart by ATTACKER row, not the defender row', () => {
    // The chart is chart[attacker][defender]; reading it the other way round
    // would report what GALE beats, which is the opposite advice.
    const weak = weaknessesOf(['GALE'], TYPECHART);
    expect(weak).toContain('TERRA'); // the load-bearing CH1 prep loop
    expect(weak).toContain('SPARK');
    expect(weak).not.toContain('NATURE'); // GALE beats NATURE — never a weakness
  });

  it('multiplies across a dual-type defender', () => {
    const chart: TypeChart = {
      A: { X: 1.3, Y: 0.7 },
      B: { X: 1.3, Y: 1.3 },
    };
    // A: 1.3 * 0.7 = 0.91 → not a weakness. B: 1.3 * 1.3 → is.
    expect(weaknessesOf(['X', 'Y'], chart)).toEqual(['B']);
  });

  it('returns nothing when the chart is all-neutral', () => {
    expect(weaknessesOf(['X'], { A: { X: 1 } })).toEqual([]);
  });
});

describe('bossScoutFacts — derived from the live card, never authored', () => {
  it('quotes the card, so a card change moves the report with it', () => {
    expect(FACTS.breakBar).toBe(4);
    expect(FACTS.rhythmEveryN).toBe(3);
    expect(FACTS.teamSize).toBe(2);
    expect(FACTS.openingMomentum).toBe(2);
    expect(FACTS.trait).toBe('GUSTBORNE');
  });

  it('tracks a re-baselined break bar instead of a literal', () => {
    const moved = bossScoutFacts({
      trainerName: 'FALKNER',
      card: { ...CARD, breakBar: 7 },
      ace: ACE,
      playerSpd: 40,
      typeChart: TYPECHART,
    });
    const report = buildScoutReport(FALKNER_REPORT, moved, ALL_KNOWN);
    expect(entry(report, 'break').text).toBe('7 clean reads crack him.');
  });

  it('degrades gracefully on a card with no arena / break / team', () => {
    const bare = bossScoutFacts({
      trainerName: 'NOBODY',
      card: { species: ACE },
      ace: dex('GALEHAWK', 15), // no trait — the raw dex entry carries none
      playerSpd: 99,
      typeChart: TYPECHART,
    });
    expect(bare.rhythmEveryN).toBeNull();
    expect(bare.breakBar).toBe(0);
    expect(bare.teamSize).toBe(1);
    const report = buildScoutReport(FALKNER_REPORT, bare, ALL_KNOWN);
    expect(entry(report, 'break').text).toBe('he never cracks.');
    expect(entry(report, 'rhythm').text).toBe('none — the air is still.');
    expect(entry(report, 'roster').text).toBe('one bird, alone.');
    expect(entry(report, 'trait').text).toBe('none worth the ink.');
  });

  it('flips the speed line on the comparison, not on a fixed string', () => {
    const faster = bossScoutFacts({ ...{ trainerName: 'FALKNER', card: CARD, ace: ACE, typeChart: TYPECHART }, playerSpd: 999 });
    expect(entry(buildScoutReport(FALKNER_REPORT, faster, ALL_KNOWN), 'speed').text).toContain('you move first');
    expect(entry(buildScoutReport(FALKNER_REPORT, FACTS, ALL_KNOWN), 'speed').text).toContain('he moves first');
  });
});

describe('buildScoutReport — the currency', () => {
  it('redacts every gated line and shows its source when nothing is earned', () => {
    const report = buildScoutReport(FALKNER_REPORT, FACTS, NONE_KNOWN);
    expect(report.known).toBe(0);
    expect(report.total).toBe(6);
    for (const id of ['weakness', 'trait', 'rhythm', 'roster', 'opening', 'break']) {
      const e = entry(report, id);
      expect(e.known).toBe(false);
      expect(e.text).toBe('???');
      expect(e.hint).toBeTruthy();
    }
  });

  it('leaves the free lines readable even with zero intel', () => {
    const report = buildScoutReport(FALKNER_REPORT, FACTS, NONE_KNOWN);
    expect(entry(report, 'ace').known).toBe(true);
    expect(entry(report, 'ace').text).toBe("FALKNER's GALEHAWK — GALE");
    expect(entry(report, 'speed').known).toBe(true);
  });

  it('buys exactly the line its flag pays for', () => {
    const report = buildScoutReport(FALKNER_REPORT, FACTS, only('gym_trainer_beaten'));
    expect(entry(report, 'rhythm').known).toBe(true);
    expect(entry(report, 'rhythm').text).toBe('a gust every 3 rounds.');
    expect(entry(report, 'weakness').known).toBe(false);
    expect(entry(report, 'break').known).toBe(false);
    expect(report.known).toBe(1);
  });

  it('lets ONE source sell two facts (the ACE sells opening + break)', () => {
    const report = buildScoutReport(FALKNER_REPORT, FACTS, only('gym_trainer_4_beaten'));
    expect(entry(report, 'opening').known).toBe(true);
    expect(entry(report, 'break').known).toBe(true);
    expect(report.known).toBe(2);
  });

  it('keeps compound intel redacted until its prerequisite is known', () => {
    const without = buildScoutReport(FALKNER_REPORT, FACTS, NONE_KNOWN);
    expect(entry(without, 'tempo').known).toBe(false);
    const withRhythm = buildScoutReport(FALKNER_REPORT, FACTS, only('gym_trainer_beaten'));
    expect(entry(withRhythm, 'tempo').known).toBe(true);
    expect(entry(withRhythm, 'tempo').text).toContain('Catch Breath on it');
  });

  it('does not count the compound line as purchasable intel', () => {
    // 6 gated lines; `tempo` is derived, so buying all 6 reads 6/6, not 6/7.
    const full = buildScoutReport(FALKNER_REPORT, FACTS, ALL_KNOWN);
    expect(full.known).toBe(6);
    expect(full.total).toBe(6);
    expect(full.entries.every((e) => e.known)).toBe(true);
  });

  it('gates the deepest tell behind a SKIPPABLE source', () => {
    // The gust RHYTHM hangs off the one gym trainer who stands off the sight-lines
    // (gym.json (7,12), no sightRange) — a beeline costs you the tempo read.
    const rhythm = FALKNER_REPORT.lines.find((l) => l.id === 'rhythm')!;
    expect(rhythm.intelFlag).toBe('gym_trainer_beaten');
    const report = buildScoutReport(FALKNER_REPORT, FACTS, only('gym_trainer_2_beaten'));
    expect(entry(report, 'weakness').text).toContain('TERRA');
  });

  it('sources one line from OUTSIDE the gym', () => {
    const trait = FALKNER_REPORT.lines.find((l) => l.id === 'trait')!;
    expect(trait.intelFlag).toBe('route31_birdkeeper_beaten');
  });
});

describe('every gated row is self-describing', () => {
  it('carries a label, so a redacted row still says WHICH fact is missing', () => {
    // One source can sell two facts (the ACE sells OPENING + BREAK). Without a
    // label column those render as two identical '???' rows pointing at the same
    // trainer, which tells the player nothing.
    const report = buildScoutReport(FALKNER_REPORT, FACTS, NONE_KNOWN);
    for (const e of report.entries) {
      if (!e.gated && !e.derived) continue;
      expect(e.label, `entry ${e.id} has no label`).not.toBe('');
    }
    const labels = report.entries.filter((e) => e.gated).map((e) => e.label);
    expect(new Set(labels).size, 'gated labels must be distinct').toBe(labels.length);
  });
});

describe('intelFlagsOf', () => {
  it('lists every flag that buys a line, and nothing else', () => {
    const flags = intelFlagsOf(FALKNER_REPORT);
    expect(new Set(flags)).toEqual(
      new Set([
        'gym_trainer_beaten',
        'gym_trainer_2_beaten',
        'gym_trainer_3_beaten',
        'gym_trainer_4_beaten',
        'route31_birdkeeper_beaten',
      ]),
    );
    expect(flags).not.toContain('falkner_beaten');
  });
});
