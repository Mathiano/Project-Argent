// Boss cards as DATA — one entry per gym leader, the single source the game
// (main.ts) and the sim (sim/bossLadder.ts) both build a BossCard from. Before
// this the arena, levels and break bar were restated in both places and had
// already drifted once (docs/ARCHITECTURE-AUDIT.md §4 "Suggested consolidation";
// gym2-plan Step 5). Pure data + a loader (headless — the caller hands in its dex
// rows, like rivalCard.ts); the leader's AI stays a BossPolicy in bossAI.ts.

import { FALKNER_OPENING_MOMENTUM } from './bossAI';
import type { DexEntryJson } from './dexLoader';
import { loadSpeciesAt } from './dexLoader';
import type { ArenaSchedule, BossCard, Species, StatScale, TraitTable } from './types';

// One mon in the leader's lineup, resolved from the caller's dex at `level`.
export interface BossRosterSlot {
  readonly species: string;
  readonly level: number;
  readonly trait?: string;
}

export interface BossCardData {
  readonly id: string;
  // Lead first, ACE LAST — the ace is the card's species (it carries statScale).
  readonly roster: readonly BossRosterSlot[];
  readonly statScale?: StatScale;
  readonly arenaSchedule?: ArenaSchedule;
  readonly breakBar?: number;
  readonly openingMomentum?: number;
  // The fight's trait table (passed to createBattleState; the engine default
  // LEGACY_TRAIT_TABLE stays untouched).
  readonly traits: TraitTable;
}

// FALKNER (Gym 1) — the shipped boss card. Every number is the live, sim-gated
// value (src/sim/falknerLadder.test.ts); moved here verbatim, none changed.
export const FALKNER_CARD: BossCardData = {
  id: 'FALKNER',
  roster: [
    { species: 'FLITPECK', level: 13 },
    { species: 'GALEHAWK', level: 15, trait: 'GUSTBORNE' },
  ],
  // Ace-only HP scale (the B1 locked lever).
  statScale: { hp: 1.15 },
  arenaSchedule: {
    rhythmEveryN: 3,
    heavyExtraCost: 8,
    heavyExtraInitWeight: 1.3,
    telegraphAheadBy: 1,
  },
  // Spine-1 re-baseline 2→4: under phased-unlock a perfect reader Break-spammed
  // Falkner every ~2 rounds, and each Break resets rhythmAnchor → his gust
  // cadence (and DIVE BOMB) was starved (never fired vs naive/stamina). At 4 the
  // break is earned over more reads, the gust holds, and DIVE BOMB fires in
  // every matchup — turning a 100% pushover into the fair, gentle gym.
  breakBar: 4,
  openingMomentum: FALKNER_OPENING_MOMENTUM,
  // Locked B1 trait table: GUSTBORNE dmgMult 1.4 (gust lever from the
  // boss-card sweep).
  traits: { GUSTBORNE: { dmgMult: 1.4, initMult: 1.25 } },
};

export interface LoadedBossCard {
  readonly card: BossCard;
  // Every lineup mon in roster order (the ace is the last, === card.species).
  readonly roster: readonly Species[];
}

// Resolve a card's lineup against the caller's dex rows and build the BossCard.
// teamSize is the roster length. Throws on a roster species the rows lack.
export function loadBossCard(
  data: BossCardData,
  entries: readonly DexEntryJson[],
): LoadedBossCard {
  if (data.roster.length === 0) throw new Error(`loadBossCard: ${data.id} has an empty roster`);
  const roster = data.roster.map((slot): Species => {
    const entry = entries.find((e) => e.name === slot.species);
    if (!entry) throw new Error(`loadBossCard: ${data.id} — missing dex entry ${slot.species}`);
    const species = loadSpeciesAt(entry, slot.level);
    return slot.trait !== undefined ? { ...species, trait: slot.trait } : species;
  });
  const card: BossCard = {
    species: roster[roster.length - 1]!,
    ...(data.statScale !== undefined ? { statScale: data.statScale } : {}),
    ...(data.arenaSchedule !== undefined ? { arenaSchedule: data.arenaSchedule } : {}),
    ...(data.breakBar !== undefined ? { breakBar: data.breakBar } : {}),
    teamSize: roster.length,
    ...(data.openingMomentum !== undefined ? { openingMomentum: data.openingMomentum } : {}),
  };
  return { card, roster };
}
