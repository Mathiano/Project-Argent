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
    // Per-mon stamina = archetype endurance (stat-foundation part 1). Optional so
    // an unauthored row / test fixture stays bit-identical (→ 100 in createSide);
    // every authored CH1 row sets it.
    readonly stamina?: number;
  };
  readonly archetype: string;
  readonly rarity: string;
  readonly statFlavor: string;
  // `level` gates the base moveset (developmental band). `bondTier` is
  // RESERVED for bond-gated moves (a line's signature / coverage move
  // unlocked by bond stage, not level — bond-track-v2.md Track A). Optional
  // + schema-ready ONLY: loadSpeciesAt does NOT yet consult it (the move
  // pipeline + the stage→move wiring are the deferred follow-up), so adding
  // it to a few dex rows now changes no behaviour. 1–7 = the bond stage; an
  // entry with bondTier set should carry a sentinel level (e.g. 99) so the
  // level filter never surfaces it before the bond wiring exists.
  readonly learnset: ReadonlyArray<{
    readonly move: string;
    readonly level: number;
    readonly bondTier?: number;
  }>;
  readonly evoLine?: { readonly evolvesTo?: string; readonly at?: number } | null;
  readonly dexEntry?: string;
  readonly spriteBrief?: string;
  readonly habitatTags?: readonly string[];
  readonly temperament?: string | null;
  readonly marked?: boolean;
  readonly spriteRef?: string;
  readonly facing?: 'left' | 'right';
  readonly trait?: string;
  // ---- RESERVED for the in-battle SCAN (combat-depth-types-status.md
  // Part 7). These are LOAD-BEARING once SCAN ships — reserved now,
  // optional, populated later (per-chapter / with the status system) so
  // ~200 mons aren't retrofitted. SCAN reveals them gated by dex status:
  // CAUGHT → full, SEEN → type only, unseen → nothing.
  //   `description` is NOT re-declared — the existing `dexEntry` above IS
  //   the flavor description field.
  // Combat archetype tag (e.g. 'tanky' | 'striker' | 'disruptor'), tied
  // to the type identities. The FULL-scan headline. Free-form for now.
  readonly role?: string;
  // Statuses this species tends to inflict (e.g. ['Burn']). Derivable
  // later from type identity + movepool; reserved so SCAN reads one place.
  readonly statusTendencies?: readonly string[];
  // Player-facing, DISCOVERY-GATED location string ("where to find it") —
  // shown only for encountered species. Distinct from the generation-side
  // `habitatTags` above (those are authoring tags, not display).
  readonly habitat?: string;
  // ---- RESERVED for mon CHARACTER (docs/mon-character.md, Phase 8+).
  // Forward-compat substrate read later by world-reactions + KAMON
  // (living-world.md), "ask your mon" (evolution-design.md), and
  // catch-origin flavor (catching-2-0.md). Reserved now, optional,
  // populated per-chapter so ~200 mons aren't retrofitted. Type-only —
  // no behavior built yet.
  // Temperament archetype — the lens all reactions/dialogue filter
  // through. Reaction = `personality` × bond stage (the two-axis model;
  // bond is bond-track-v2.md). Enum LOCKED at 8.
  readonly personality?: Personality;
  // Emotional affinities (NOT the spawn-table `habitatTags`) — a mon
  // loves / dislikes these environments. Feeds world-reactions + a
  // possible light bond nudge later.
  readonly preferredEnvironment?: readonly string[];
  readonly dislikedEnvironment?: readonly string[];
  // One small unique behavioral tic — the individual touch beyond the
  // species archetype. Light reservation (a flavor string), authored later.
  readonly quirk?: string;
}

// The locked 8-archetype personality set (docs/mon-character.md Property
// 1). Imperious is the legendary/prestige slot (reacts from superiority,
// never fear). Reserved now; populated per-chapter.
export type Personality =
  | 'Timid'
  | 'Bold'
  | 'Gentle'
  | 'Proud'
  | 'Loyal'
  | 'Wild'
  | 'Serene'
  | 'Imperious';

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
    // exactOptionalPropertyTypes: omit the key when unauthored (→ 100 default).
    ...(entry.stats.stamina !== undefined ? { stamina: entry.stats.stamina } : {}),
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
