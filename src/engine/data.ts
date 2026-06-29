import type { ElementType, Move, Species, TraitTable, TypeChart } from './types';

// LEGACY fixture moves (for the permanent EMBERCUB/SPROUTLE/AQUAFIN trio only).
// Their type vocabulary is Mixed-case (Flame/Sprout/Splash) for `LEGACY_TYPE_CHART`.
// The typed mids/heavies are NAMESPACED with an `FX ` prefix so they can NEVER
// collide with CH1's same-flavoured moves (EMBER SNAP/FLAME RUSH/… in
// docs/moves.json, UPPERCASE FLAME/NATURE/AQUA) — the collision silently no-op'd
// CH1 type effectiveness because `lookupMove` resolves this table first. Pure
// key rename: identical tier/type/power → the fixture ladders stay bit-identical.
// `registerMoves` now THROWS if a CH1 move re-introduces a shadow (never-mix).
// TACKLE/SCRATCH are shared, null-typed, identical both sides — safe.
export const MOVES: { readonly [name: string]: Move } = {
  TACKLE: { name: 'TACKLE', tier: 'light', type: null },
  SCRATCH: { name: 'SCRATCH', tier: 'light', type: null },
  'FX EMBER SNAP': { name: 'FX EMBER SNAP', tier: 'mid', type: 'Flame' },
  'FX FLAME RUSH': { name: 'FX FLAME RUSH', tier: 'heavy', type: 'Flame' },
  'FX LEAF LASH': { name: 'FX LEAF LASH', tier: 'mid', type: 'Sprout' },
  'FX VINE SLAM': { name: 'FX VINE SLAM', tier: 'heavy', type: 'Sprout' },
  'FX BUBBLE JET': { name: 'FX BUBBLE JET', tier: 'mid', type: 'Splash' },
  'FX TIDE CRASH': { name: 'FX TIDE CRASH', tier: 'heavy', type: 'Splash' },
  // ── Effect-move SAMPLE (Increment 1a — the first 3 techniques) ────────────
  // Techniques carry a `Move.effect`: they deal REDUCED chip damage and apply
  // a status. DEBUFFS land only on a cast-stance read-win (else fizzle); BUFFS
  // self-apply regardless of the read (exposure in the cast-stance is the cost).
  // TYPELESS here on purpose — the canonical roster assigns SEAR→FLAME,
  // STATIC HAZE→SPARK, BULWARK→FORGE, but type is orthogonal to the EFFECT this
  // increment tests; their type is set when they attach to real species (1b).
  SEAR: {
    name: 'SEAR',
    tier: 'light',
    type: null,
    effect: { status: 'burn', polarity: 'debuff', condition: 'readWin' },
  },
  'STATIC HAZE': {
    name: 'STATIC HAZE',
    tier: 'light',
    type: null,
    effect: { status: 'daze', polarity: 'debuff', condition: 'readWin' },
  },
  BULWARK: {
    name: 'BULWARK',
    tier: 'mid',
    type: null,
    effect: { status: 'bulwark', polarity: 'buff', condition: 'always' },
  },
};

export const SPECIES: { readonly [name: string]: Species } = {
  EMBERCUB: {
    name: 'EMBERCUB',
    types: ['Flame'],
    hp: 58,
    atk: 100,
    dfn: 86,
    spd: 108,
    moves: ['TACKLE', 'FX EMBER SNAP', 'FX FLAME RUSH'],
    spr: 'EMBERCUB',
  },
  SPROUTLE: {
    name: 'SPROUTLE',
    types: ['Sprout'],
    hp: 60,
    atk: 96,
    dfn: 100,
    spd: 84,
    moves: ['TACKLE', 'FX LEAF LASH', 'FX VINE SLAM'],
    spr: 'SPROUTLE',
  },
  AQUAFIN: {
    name: 'AQUAFIN',
    types: ['Splash'],
    hp: 64,
    atk: 92,
    dfn: 108,
    spd: 72,
    moves: ['TACKLE', 'FX BUBBLE JET', 'FX TIDE CRASH'],
    spr: 'AQUAFIN',
  },
  FUZZLET: {
    name: 'FUZZLET',
    types: [],
    hp: 46,
    atk: 78,
    dfn: 78,
    spd: 70,
    moves: ['TACKLE', 'SCRATCH'],
    spr: 'FUZZLET',
  },
};

export const COUNTER_MAP: { readonly [name: string]: string } = {
  EMBERCUB: 'AQUAFIN',
  SPROUTLE: 'EMBERCUB',
  AQUAFIN: 'SPROUTLE',
};

// LEGACY chart: pinned 1.5/0.67 multipliers for the fixture trio. The
// rival-fight regression ladder depends on this being bit-identical
// forever. All new content (CH1+) uses docs/typechart.json (1.3/0.7).
export const LEGACY_TYPE_CHART: TypeChart = {
  Flame: { Sprout: 1.5, Splash: 0.67 },
  Sprout: { Splash: 1.5, Flame: 0.67 },
  Splash: { Flame: 1.5, Sprout: 0.67 },
};

// Default trait registry — what unspecified battles see. Bosses override
// the table at battle setup; the engine never mutates this constant.
// GUSTBORNE is the only trait that ships with v0.3.4 (Falkner card).
export const LEGACY_TRAIT_TABLE: TraitTable = {
  GUSTBORNE: { dmgMult: 1.3, initMult: 1.25 },
};

// Defender dual-type multipliers compose multiplicatively per type-chart.md
// rule 8 (1.3 × 0.7 = 0.91). Empty defTypes / null attType = neutral.
export function typeMult(
  chart: TypeChart,
  attType: ElementType | null,
  defTypes: readonly ElementType[],
): number {
  if (!attType || defTypes.length === 0) return 1;
  let m = 1;
  for (const dt of defTypes) {
    m *= chart[attType]?.[dt] ?? 1;
  }
  return m;
}
