import type { ElementType, Move, Species, TypeChart } from './types';

export const MOVES: { readonly [name: string]: Move } = {
  TACKLE: { name: 'TACKLE', tier: 'light', type: null },
  SCRATCH: { name: 'SCRATCH', tier: 'light', type: null },
  'EMBER SNAP': { name: 'EMBER SNAP', tier: 'mid', type: 'Flame' },
  'FLAME RUSH': { name: 'FLAME RUSH', tier: 'heavy', type: 'Flame' },
  'LEAF LASH': { name: 'LEAF LASH', tier: 'mid', type: 'Sprout' },
  'VINE SLAM': { name: 'VINE SLAM', tier: 'heavy', type: 'Sprout' },
  'BUBBLE JET': { name: 'BUBBLE JET', tier: 'mid', type: 'Splash' },
  'TIDE CRASH': { name: 'TIDE CRASH', tier: 'heavy', type: 'Splash' },
};

export const SPECIES: { readonly [name: string]: Species } = {
  EMBERCUB: {
    name: 'EMBERCUB',
    types: ['Flame'],
    hp: 58,
    atk: 100,
    dfn: 86,
    spd: 108,
    moves: ['TACKLE', 'EMBER SNAP', 'FLAME RUSH'],
    spr: 'EMBERCUB',
  },
  SPROUTLE: {
    name: 'SPROUTLE',
    types: ['Sprout'],
    hp: 60,
    atk: 96,
    dfn: 100,
    spd: 84,
    moves: ['TACKLE', 'LEAF LASH', 'VINE SLAM'],
    spr: 'SPROUTLE',
  },
  AQUAFIN: {
    name: 'AQUAFIN',
    types: ['Splash'],
    hp: 64,
    atk: 92,
    dfn: 108,
    spd: 72,
    moves: ['TACKLE', 'BUBBLE JET', 'TIDE CRASH'],
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
