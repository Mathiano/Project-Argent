// The SCOUT-REPORT ECONOMY — "intel is a currency" (P0, docs/project-argent-scope.md
// §Prep Phase: "Leader's roster, ace, known patterns — earned via gym trainers and
// phone contacts").
//
// Before this module the prep screen was a wall of hardcoded strings that showed
// every fact about Falkner whether or not the player had earned any of it, so the
// GYM GUIDE's promise in Violet ("Beat his trainers first — they hand out a scout
// report") was fiction. Here the report is DATA:
//
//   · each line is GATED behind an intel flag (a trainer's win-flag, or any flag a
//     script sets), and renders REDACTED with a source hint until it is earned;
//   · each line's text is DERIVED from the live boss card / species / type chart —
//     never a literal. `docs/ARCHITECTURE-AUDIT.md` §239 called the hardcoded
//     strings brittle and named the exact fields to derive from; that prediction
//     came true (the screen shipped "Break bar 2" long after the card moved to 4).
//
// PURE + HEADLESS: no DOM, no canvas, no engine mutation. The prep SCENE renders
// what `buildScoutReport` returns; this module is unit-tested on its own.

import type { BossCard, Species, TypeChart } from '../engine';

// ── Facts: everything a report line may quote, read off the LIVE card ──────────
export interface ScoutFacts {
  readonly trainerName: string;
  readonly aceName: string;
  readonly aceTypes: readonly string[];
  readonly aceSpd: number;
  readonly playerSpd: number;
  readonly trait: string | null;
  // arenaSchedule.rhythmEveryN — null when the card has no arena rhythm.
  readonly rhythmEveryN: number | null;
  readonly telegraphAheadBy: number | null;
  readonly breakBar: number;
  readonly teamSize: number;
  readonly openingMomentum: number;
  // Types that hit the ace for > 1x, derived from the chart (not authored).
  readonly weakTo: readonly string[];
}

// Types whose attacks land on `defenderTypes` for more than 1x. Multi-type
// defenders multiply, matching the engine's own effectiveness math.
export function weaknessesOf(
  defenderTypes: readonly string[],
  chart: TypeChart,
): readonly string[] {
  const out: string[] = [];
  for (const attacker of Object.keys(chart)) {
    let mult = 1;
    for (const d of defenderTypes) {
      const row = chart[attacker];
      const v = row ? row[d] : undefined;
      if (v !== undefined) mult *= v;
    }
    if (mult > 1) out.push(attacker);
  }
  return out;
}

export function bossScoutFacts(opts: {
  readonly trainerName: string;
  readonly card: BossCard;
  readonly ace: Species;
  readonly playerSpd: number;
  readonly typeChart: TypeChart;
}): ScoutFacts {
  const { card, ace } = opts;
  return {
    trainerName: opts.trainerName,
    aceName: ace.name,
    aceTypes: ace.types,
    aceSpd: ace.spd,
    playerSpd: opts.playerSpd,
    trait: ace.trait ?? null,
    rhythmEveryN: card.arenaSchedule?.rhythmEveryN ?? null,
    telegraphAheadBy: card.arenaSchedule?.telegraphAheadBy ?? null,
    breakBar: card.breakBar ?? 0,
    teamSize: card.teamSize ?? 1,
    openingMomentum: card.openingMomentum ?? 0,
    weakTo: weaknessesOf(ace.types, opts.typeChart),
  };
}

// ── The report definition ─────────────────────────────────────────────────────
export type ScoutTone = 'plain' | 'good' | 'warn' | 'dim';

export interface ScoutLineDef {
  readonly id: string;
  // The row's LABEL column. A redacted row shows its label and hides only the
  // VALUE, so the sheet reads as "you don't know his RHYTHM yet" rather than a
  // stack of identical '???' rows (one source can sell two facts, and two blank
  // rows pointing at the same trainer told the player nothing). Free header lines
  // omit it and render full-width.
  readonly label?: string;
  // The flag that BUYS this line. Omitted → free: the player can see it for
  // themselves once the fight starts, so redacting it would be a lie of a
  // different kind.
  readonly intelFlag?: string;
  // Shown IN PLACE of the text while unearned — it has to name where the intel
  // is, or the currency has no shop.
  readonly sourceHint: string;
  // Compound intel: ids of lines that must also be known. An unlocked line whose
  // prerequisite is missing stays redacted (it reads as advice about a pattern
  // you have not been told about).
  readonly requires?: readonly string[];
  readonly tone?: ScoutTone;
  readonly render: (f: ScoutFacts) => string;
}

export interface ScoutReportDef {
  readonly id: string;
  readonly title: string;
  readonly lines: readonly ScoutLineDef[];
}

export interface ScoutEntry {
  readonly id: string;
  readonly label: string;
  readonly known: boolean;
  // Layout is DERIVED from the data shape rather than an authored list of ids in
  // the scene: FREE lines head the sheet, GATED lines form the intel list, and a
  // DERIVED (compound) line trails it as advice. Add a line to the def and it
  // lands in the right band with no scene change.
  readonly gated: boolean;
  readonly derived: boolean;
  readonly text: string;
  readonly tone: ScoutTone;
  // Present only while redacted, so the scene never has to re-derive it.
  readonly hint?: string;
}

export interface ScoutReport {
  readonly title: string;
  readonly entries: readonly ScoutEntry[];
  // Progress over the GATED lines only — free lines are not intel.
  readonly known: number;
  readonly total: number;
}

export function buildScoutReport(
  def: ScoutReportDef,
  facts: ScoutFacts,
  hasFlag: (flag: string) => boolean,
): ScoutReport {
  const knownIds = new Set<string>();
  const entries: ScoutEntry[] = [];
  let known = 0;
  let total = 0;

  for (const line of def.lines) {
    const gated = line.intelFlag !== undefined;
    const bought = !gated || hasFlag(line.intelFlag!);
    const prereqMet = (line.requires ?? []).every((r) => knownIds.has(r));
    const isKnown = bought && prereqMet;
    if (gated) {
      total += 1;
      if (isKnown) known += 1;
    }
    if (isKnown) knownIds.add(line.id);
    const derived = (line.requires ?? []).length > 0;
    entries.push(
      isKnown
        ? { id: line.id, label: line.label ?? '', known: true, gated, derived, text: line.render(facts), tone: line.tone ?? 'plain' }
        : { id: line.id, label: line.label ?? '', known: false, gated, derived, text: '???', tone: 'dim', hint: line.sourceHint },
    );
  }

  return { title: def.title, entries, known, total };
}

// Every flag that buys a line in this report — the game layer uses it to fire the
// "SCOUT REPORT UPDATED" beat on the win that earns one.
export function intelFlagsOf(def: ScoutReportDef): readonly string[] {
  return def.lines.flatMap((l) => (l.intelFlag !== undefined ? [l.intelFlag] : []));
}

// ── FALKNER — Violet Gym ──────────────────────────────────────────────────────
// Sources are deliberately MIXED so the report is not a formality: two of the five
// are SKIPPABLE (the gym's first trainer stands off the sight-lines, and WREN is an
// optional Route 31 trainer), so a player who beelines arrives with a thin report
// and an explorer arrives with a full one. That difference IS the currency.
export const FALKNER_REPORT: ScoutReportDef = {
  id: 'falkner',
  title: 'SCOUT REPORT — VIOLET GYM',
  lines: [
    // FREE — you will see both the moment the fight starts, so redacting them
    // would be theatre rather than economy.
    {
      id: 'ace',
      sourceHint: '',
      render: (f) => `${f.trainerName}'s ${f.aceName} — ${f.aceTypes.join('/')}`,
    },
    {
      id: 'speed',
      sourceHint: '',
      render: (f) =>
        f.playerSpd > f.aceSpd
          ? `SPD ${f.aceSpd} — you move first off-gust.`
          : `SPD ${f.aceSpd} — he moves first.`,
    },
    // A bird keeper knows what hurts birds.
    {
      id: 'weakness',
      label: 'WEAK TO',
      intelFlag: 'gym_trainer_2_beaten',
      sourceHint: 'BIRDKEEPER, inside',
      tone: 'warn',
      render: (f) =>
        f.weakTo.length > 0 ? `${f.weakTo.join(' / ')}.` : 'no type edge to find.',
    },
    // Off-site intel — the scope doc's "and phone contacts" half: the world knows
    // things the gym does not hand out. WREN is an optional Route 31 trainer.
    {
      id: 'trait',
      label: 'TRAIT',
      intelFlag: 'route31_birdkeeper_beaten',
      sourceHint: 'WREN, on ROUTE 31',
      render: (f) => (f.trait ? `${f.trait} — the wind lends force.` : 'none worth the ink.'),
    },
    // The RHYTHM is the deepest tell on the sheet ("count to three"), and it hangs
    // off the ONE gym trainer who stands off the sight-lines (gym.json (7,12), no
    // sightRange): beeline past him and you fight the gusts blind.
    {
      id: 'rhythm',
      label: 'RHYTHM',
      intelFlag: 'gym_trainer_beaten',
      sourceHint: 'GYM TRAINER, by the door',
      render: (f) =>
        f.rhythmEveryN
          ? `a gust every ${f.rhythmEveryN} rounds.`
          : 'none — the air is still.',
    },
    {
      id: 'roster',
      label: 'ROSTER',
      intelFlag: 'gym_trainer_3_beaten',
      sourceHint: 'FLEDGLING, inside',
      render: (f) =>
        f.teamSize > 1 ? `${f.teamSize} on the wing.` : 'one bird, alone.',
    },
    {
      id: 'opening',
      label: 'OPENING',
      intelFlag: 'gym_trainer_4_beaten',
      sourceHint: 'ACE, inside',
      render: (f) =>
        f.openingMomentum > 0
          ? `walks in with ${f.openingMomentum}★ banked.`
          : 'walks in with no ★.',
    },
    {
      id: 'break',
      label: 'BREAK',
      intelFlag: 'gym_trainer_4_beaten',
      sourceHint: 'ACE, inside',
      tone: 'good',
      render: (f) =>
        f.breakBar > 0 ? `${f.breakBar} clean reads crack him.` : 'he never cracks.',
    },
    {
      // Compound: tempo advice is noise until you have been told there IS a
      // rhythm, so it stays redacted behind its prerequisite rather than its own
      // source. Intel that unlocks intel.
      id: 'tempo',
      label: 'TEMPO',
      requires: ['rhythm'],
      sourceHint: 'needs his RHYTHM',
      tone: 'dim',
      render: (f) =>
        f.telegraphAheadBy
          ? `warned ${f.telegraphAheadBy} round ahead — Catch Breath on it.`
          : 'Catch Breath the round before a gust.',
    },
  ],
};

// ── The registry — one report per leader, keyed by boss id ────────────────────
// gym2-plan Step 6. The key is the def's own `id`, which is the id the gym map's
// `start-boss-battle` names — so the prep sheet (and the ?skip=scout hook) find a
// leader's report from the same id that launched the fight, and a second gym's
// report is one def plus one row here.
export const SCOUT_REPORTS: Readonly<Record<string, ScoutReportDef>> = {
  [FALKNER_REPORT.id]: FALKNER_REPORT,
};

// Throws on an unregistered id: a leader fight with no report would open a blank
// prep sheet, which is a content bug to fail loudly on, not to render.
export function scoutReportFor(bossId: string): ScoutReportDef {
  if (!Object.hasOwn(SCOUT_REPORTS, bossId)) throw new Error(`Argent: no scout report for boss "${bossId}"`);
  return SCOUT_REPORTS[bossId]!;
}
