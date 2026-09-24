// CHAPTER-DEX REGISTRY — one species resolver, one type-chart rule.
//
// Every chapter's species arrive as a batch file (docs/ch1-batch.json today) in the
// canonical UPPERCASE type vocabulary (docs/typechart.json). The permanent sim
// fixtures (EMBERCUB / SPROUTLE / AQUAFIN, engine `SPECIES`) use the legacy
// Mixed-case chart. Mixing the two silently no-ops every type interaction, so the
// chart a fight uses must follow from ONE rule, not from per-call-site
// `CH1_DEX[name] !== undefined` checks that a second chapter's mons would fail.
//
// The rule: a species registered in any chapter dex fights on the canon chart;
// anything else (the legacy fixtures) keeps the engine default.
//
// Each batch carries its OWN learnset level (Argent has no stat-leveling — level
// only widens the moveset). Only CH1 is registered; no later chapter's dex or level
// is chosen here (that is a design ruling, not plumbing).
//
// Pure: JSON data + the engine's public loader. No DOM.

import ch1BatchData from '../../docs/ch1-batch.json';
import typechartData from '../../docs/typechart.json';
import { SPECIES, loadDex } from '../engine';
import type { DexEntryJson, Species, TypeChart } from '../engine';

// The CH1 learnset band (flat 13 in code; see the plan's D1 ruling for later chapters).
export const CH1_LEVEL = 13;

// The canonical UPPERCASE chart every registered chapter mon fights on.
export const TYPECHART_CANON = typechartData as TypeChart;

export interface ChapterDexSpec {
  readonly id: string;
  readonly entries: readonly DexEntryJson[];
  readonly level: number; // the batch's learnset band
}

// The shipped chapter batches, in resolve order. Adding a chapter = one row here.
export const CHAPTER_DEXES: readonly ChapterDexSpec[] = [
  { id: 'CH1', entries: ch1BatchData as DexEntryJson[], level: CH1_LEVEL },
];

export interface DexRegistry {
  // Every registered chapter name, in registry order (no legacy fixtures).
  readonly names: readonly string[];
  // The loaded dex for one chapter (at that chapter's level). Throws on an unknown id.
  dex(id: string): { readonly [name: string]: Species };
  // Registry-only lookup — undefined for legacy fixtures and unknown names.
  chapterSpecies(name: string): Species | undefined;
  // The raw batch entry + its chapter's level (for a caller that re-bands the learnset).
  chapterEntry(name: string): { readonly entry: DexEntryJson; readonly level: number } | undefined;
  // Registry first, then the legacy fixture `SPECIES`.
  resolveSpecies(name: string): Species | undefined;
  // THE type-chart rule: registered → canon chart.
  usesCanonChart(name: string): boolean;
  // The battle/prep setup fragment for that rule: `{ typeChart }` or `{}` (engine default).
  chartOptsFor(name: string): { readonly typeChart?: TypeChart };
}

export function createDexRegistry(chapters: readonly ChapterDexSpec[]): DexRegistry {
  const loaded = chapters.map((c) => ({ spec: c, dex: loadDex(c.entries, c.level) }));
  const chapterSpecies = (name: string): Species | undefined => {
    for (const c of loaded) {
      if (Object.hasOwn(c.dex, name)) return c.dex[name];
    }
    return undefined;
  };
  const usesCanonChart = (name: string): boolean => chapterSpecies(name) !== undefined;
  return {
    names: chapters.flatMap((c) => c.entries.map((e) => e.name)),
    dex: (id) => {
      const c = loaded.find((l) => l.spec.id === id);
      if (!c) throw new Error(`Argent: unknown chapter dex "${id}"`);
      return c.dex;
    },
    chapterSpecies,
    chapterEntry: (name) => {
      for (const c of chapters) {
        const entry = c.entries.find((e) => e.name === name);
        if (entry) return { entry, level: c.level };
      }
      return undefined;
    },
    resolveSpecies: (name) => chapterSpecies(name) ?? SPECIES[name],
    usesCanonChart,
    chartOptsFor: (name) => (usesCanonChart(name) ? { typeChart: TYPECHART_CANON } : {}),
  };
}

export const DEX_REGISTRY: DexRegistry = createDexRegistry(CHAPTER_DEXES);
