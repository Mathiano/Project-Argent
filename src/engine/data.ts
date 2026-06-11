import type { ElementType, Move, Species } from './types';

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
    type: 'Flame',
    hp: 58,
    atk: 100,
    dfn: 86,
    spd: 108,
    moves: ['TACKLE', 'EMBER SNAP', 'FLAME RUSH'],
    spr: 'EMBERCUB',
  },
  SPROUTLE: {
    name: 'SPROUTLE',
    type: 'Sprout',
    hp: 60,
    atk: 96,
    dfn: 100,
    spd: 84,
    moves: ['TACKLE', 'LEAF LASH', 'VINE SLAM'],
    spr: 'SPROUTLE',
  },
  AQUAFIN: {
    name: 'AQUAFIN',
    type: 'Splash',
    hp: 64,
    atk: 92,
    dfn: 108,
    spd: 72,
    moves: ['TACKLE', 'BUBBLE JET', 'TIDE CRASH'],
    spr: 'AQUAFIN',
  },
  FUZZLET: {
    name: 'FUZZLET',
    type: null,
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

const TYPE_CHART: { readonly [att in ElementType]?: { readonly [def in ElementType]?: number } } = {
  Flame: { Sprout: 1.5, Splash: 0.67 },
  Sprout: { Splash: 1.5, Flame: 0.67 },
  Splash: { Flame: 1.5, Sprout: 0.67 },
};

export function typeMult(att: ElementType | null, def: ElementType | null): number {
  if (!att || !def) return 1;
  return TYPE_CHART[att]?.[def] ?? 1;
}
