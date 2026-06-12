// Data loaders for docs/ch1-batch.json (and its successors) and
// docs/moves.json. Levels gate movesets only — stats are species-static
// per the Falkner sprint ruling; no level → stat scaling exists yet.

import type { Move, Species, TierName } from './types';

export interface DexEntryJson {
  readonly id: number;
  readonly line_id: string;
  readonly stage: number;
  readonly name: string;
  readonly types: readonly string[];
  readonly stats: {
    readonly hp: number;
    readonly atk: number;
    readonly dfn: number;
    readonly spd: number;
  };
  readonly archetype: string;
  readonly rarity: string;
  readonly statFlavor: string;
  readonly learnset: ReadonlyArray<{ readonly move: string; readonly level: number }>;
  readonly evoLine?: { readonly evolvesTo?: string; readonly at?: number } | null;
  readonly dexEntry?: string;
  readonly spriteBrief?: string;
  readonly habitatTags?: readonly string[];
  readonly temperament?: string | null;
  readonly marked?: boolean;
  readonly spriteRef?: string;
  readonly facing?: 'left' | 'right';
  readonly trait?: string;
}

export interface MoveJson {
  readonly name: string;
  readonly type: string | null;
  readonly tier: TierName;
}

// Filter the learnset by encounter level (≤ level inclusive). Stats are
// taken verbatim — no level scaling. spriteRef from JSON becomes spr.
export function loadSpeciesAt(entry: DexEntryJson, level: number): Species {
  const moves: string[] = [];
  const seen = new Set<string>();
  for (const slot of entry.learnset) {
    if (slot.level > level) continue;
    if (seen.has(slot.move)) continue;
    seen.add(slot.move);
    moves.push(slot.move);
  }
  return {
    name: entry.name,
    types: entry.types,
    hp: entry.stats.hp,
    atk: entry.stats.atk,
    dfn: entry.stats.dfn,
    spd: entry.stats.spd,
    moves,
    spr: entry.name,
  };
}

export function loadDex(
  entries: readonly DexEntryJson[],
  level: number,
): { readonly [name: string]: Species } {
  const out: { [name: string]: Species } = {};
  for (const entry of entries) {
    out[entry.name] = loadSpeciesAt(entry, level);
  }
  return out;
}

export function loadMoves(entries: readonly MoveJson[]): { readonly [name: string]: Move } {
  const out: { [name: string]: Move } = {};
  for (const entry of entries) {
    out[entry.name] = {
      name: entry.name,
      tier: entry.tier,
      type: entry.type,
    };
  }
  return out;
}
