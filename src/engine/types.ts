export type Side = 'player' | 'foe';

export type Stance = 'A' | 'G' | 'F';

export type TierName = 'light' | 'mid' | 'heavy' | 'nuke';

// Type identifiers are arbitrary strings now (data-driven).
// Legacy fixture content uses 'Flame'|'Sprout'|'Splash' (mixed case);
// CH1+ content from docs/typechart.json uses 'FLAME'|'SPROUT'|... (upper).
// Charts and species data within a single battle must use the same casing.
export type ElementType = string;

export type TypeChart = {
  readonly [attacker: string]: { readonly [defender: string]: number };
};

export interface Tier {
  readonly name: TierName;
  readonly power: number;
  readonly cost: number;
  readonly weight: number;
  readonly delayNext?: boolean;
}

export interface Move {
  readonly name: string;
  readonly tier: TierName;
  readonly type: ElementType | null;
}

export interface Species {
  readonly name: string;
  readonly types: readonly ElementType[];
  readonly hp: number;
  readonly atk: number;
  readonly dfn: number;
  readonly spd: number;
  readonly moves: readonly string[];
  readonly spr?: string;
  // Optional trait id (e.g., 'GUSTBORNE'). Trait effects fire on conditions
  // declared by the BossCard's ArenaSchedule.
  readonly trait?: string;
}

export interface SideState {
  readonly species: Species;
  readonly hp: number;
  readonly maxHp: number;
  readonly st: number;
  readonly exhausted: boolean;
  readonly staggered: boolean;
  readonly momentum: number;
}

export interface TurnHistoryEntry {
  readonly player: Stance | null;
  readonly foe: Stance | null;
}

export interface BattleState {
  readonly player: SideState;
  readonly foe: SideState;
  readonly round: number;
  readonly history: readonly TurnHistoryEntry[];
  readonly typeChart: TypeChart;
  // Trait modifier table for this battle. Defaults to LEGACY_TRAIT_TABLE
  // when caller omits it; bosses can override per-card.
  readonly traits: TraitTable;
  // Boss-side card driving arena rhythm + future hooks. Null/absent for
  // wild and rival fights — neutral state, no modifiers.
  readonly bossCard?: BossCard;
  // Player's progress toward Breaking the boss; resets to 0 on Break.
  readonly breakProgress?: number;
  // Current phase (starts at 1, increments each Break).
  readonly phase?: number;
  // Round number at which the arena rhythm cycle was last anchored
  // (resets to current round on Break so the gust cycle restarts).
  readonly rhythmAnchor?: number;
}

export type Action =
  | { readonly kind: 'move'; readonly move: string; readonly stance: Stance }
  | { readonly kind: 'rest' }
  | { readonly kind: 'catchBreath' };

export interface StatScale {
  readonly hp?: number;
  readonly atk?: number;
  readonly dfn?: number;
  readonly spd?: number;
}

// Per-round arena modifier table. Each Nth round is a "rhythm round"
// (e.g., gust round on Falkner's rooftop). Heavies cost more and weigh
// more on initiative for BOTH sides on rhythm rounds; trait-bearing
// species get their conditional boost.
export interface ArenaSchedule {
  readonly rhythmEveryN: number;
  readonly heavyExtraCost: number;
  readonly heavyExtraInitWeight: number;
  readonly telegraphAheadBy: number;
}

export interface BossCard {
  readonly species: Species;
  readonly statScale?: StatScale;
  readonly breakBar?: number;
  readonly arenaSchedule?: ArenaSchedule;
}

export function isRhythmRound(
  schedule: ArenaSchedule | undefined,
  round: number,
  anchor = 0,
): boolean {
  if (!schedule) return false;
  if (schedule.rhythmEveryN <= 0) return false;
  return (round - anchor) % schedule.rhythmEveryN === 0;
}

// Trait modifier definition: damage + initiative multipliers applied
// to the trait-bearing species on rhythm rounds.
export interface TraitMod {
  readonly dmgMult: number;
  readonly initMult: number;
}

export type TraitTable = { readonly [id: string]: TraitMod };

// Trait lookup is data-driven: the active battle's traits table decides
// the modifiers. traitMods returns the neutral mod for off-rhythm rounds,
// species without a trait, or trait ids not present in the table.
export function traitMods(
  side: SideState,
  rhythmRound: boolean,
  traits: TraitTable,
): TraitMod {
  if (!rhythmRound) return { dmgMult: 1, initMult: 1 };
  const traitId = side.species.trait;
  if (!traitId) return { dmgMult: 1, initMult: 1 };
  return traits[traitId] ?? { dmgMult: 1, initMult: 1 };
}
