// LEADER FIGHTS as DATA — everything the game layer needs to stage a gym leader,
// keyed by the boss id a gym map's `start-boss-battle` names (gym2-plan Step 6).
//
// The fight used to be two hand-written Falkner functions in main.ts (the
// overworld prep → fight → badge path and the ?skip=falkner standalone), each
// restating the intro, the tells, the badge and its lines, so a second gym meant
// copying both. Now main.ts stages ANY leader from one spec: the engine card
// (roster, arena, break bar, traits — bossCards.ts, the one source the sim ladder
// also loads), the BossPolicy, and the presentation below. The scout report is
// found by the same id in the scout registry (scout.ts).
//
// Only FALKNER is registered. No Gym-2 row: its card, policy, levels, info level
// and copy are all open rulings (gym2-plan §2 A1/A2/F1-F6).
//
// Pure data, no DOM (the battle-scene types are type-only imports).

import ch1BatchData from '../../docs/ch1-batch.json';
import { FALKNER_CARD, falknerBossAI } from '../engine';
import type { BossCardData, BossPolicy, DexEntryJson } from '../engine';
import { ZEPHYR_BADGE } from './badges';
import type { FocusIntentInfo, IntentReliability } from './scenes/battle';
import { ACADEMY_PROMOTED_FLAG, falknerMentorLines } from './violetAcademy';

export interface LeaderSpec {
  // The map's start-boss-battle id — also the scout-registry key.
  readonly bossId: string;
  readonly card: BossCardData;
  // The dex rows the card's roster resolves against (loadBossCard).
  readonly dexRows: readonly DexEntryJson[];
  readonly policy: BossPolicy;
  readonly trainerName: string;
  // The leader's opening lines. The send-out line is DERIVED from the card's
  // lead ("— sent out FLITPECK!"), so a roster change cannot leave it stale.
  readonly greeting: readonly string[];
  // How truthfully the FOE INTENT bar reads (a gym leader: AMBIGUOUS).
  readonly intentReliability: IntentReliability;
  // The leader's Focus-tell discipline.
  readonly foeFocusInfo: FocusIntentInfo;
  readonly badge: string;
  readonly badgeLines: readonly string[];
  // Set on every win (the gym's "leader beaten" world flag).
  readonly beatenFlag: string;
  // An optional one-shot beat after the badge → bond → evo beats of an
  // overworld win: sets `flag`, then shows `lines`.
  readonly afterWin?: { readonly flag: string; readonly lines: () => readonly string[] };
}

// FALKNER (Gym 1). Every value is the literal the two main.ts functions carried
// before the move; none changed.
export const FALKNER_LEADER: LeaderSpec = {
  bossId: 'falkner',
  card: FALKNER_CARD,
  dexRows: ch1BatchData as DexEntryJson[],
  policy: falknerBossAI,
  trainerName: 'FALKNER',
  greeting: ['FALKNER: Welcome to my', 'rooftop. Read the wind!'],
  // Phase 6.7-A — a gym leader reads AMBIGUOUS: his stance intent can't be
  // blind-countered. The engine still commits the true stance.
  intentReliability: 'ambiguous',
  // Layer 4 Stage 1 — Falkner's gust-Focus tell is VAGUE (a gym leader hints but
  // doesn't narrow to two): "is focusing intently".
  foeFocusInfo: { discipline: 'veiled', releases: ['heavy'] },
  badge: ZEPHYR_BADGE,
  badgeLines: ['Proof of the rooftop wind.', 'You read the gale and held.'],
  beatenFlag: 'falkner_beaten',
  // FALKNER's mentor line — the game's thesis, delivered in-gym on the win. It
  // promotes the Academy as the next prompt (a Violet NPC appears on the flag).
  afterWin: { flag: ACADEMY_PROMOTED_FLAG, lines: falknerMentorLines },
};

export const LEADERS: Readonly<Record<string, LeaderSpec>> = {
  [FALKNER_LEADER.bossId]: FALKNER_LEADER,
};

// undefined for an unregistered id — the overworld ignores an unknown boss id
// (as it always has) rather than crash mid-walk.
export function leaderFor(bossId: string): LeaderSpec | undefined {
  return Object.hasOwn(LEADERS, bossId) ? LEADERS[bossId] : undefined;
}

// The battle intro: the greeting, then the lead's send-out line.
export function leaderIntro(leader: LeaderSpec, leadName: string): readonly string[] {
  return [...leader.greeting, `— sent out ${leadName}!`];
}
