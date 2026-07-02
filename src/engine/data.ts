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
  // ── Momentum / Call-economy effect moves (Increment 1b Wave A) ────────────
  // The highest-value layer — they manipulate ★ + Calls (the hold-vs-spend
  // core). Same 1a mechanism: debuffs land on a cast-stance read-win (else
  // fizzle), buffs self-cast. Typeless fixtures (canon: THUNDERCLAP→SPARK,
  // DEAD SILENCE/CREEPING DOUBT→UMBRA, FALSE ECHO→PSI, WARCRY→BRAWN,
  // SECOND WIND→STONE, KINDLE→FLAME, SWARM→INSECT) — types attach with species.
  // Debuffs (read-win to land):
  THUNDERCLAP: {
    name: 'THUNDERCLAP',
    tier: 'mid',
    type: null,
    effect: { status: 'sapFocus', polarity: 'debuff', condition: 'readWin' },
  },
  'DEAD SILENCE': {
    name: 'DEAD SILENCE',
    tier: 'heavy',
    type: null,
    effect: { status: 'silence', polarity: 'debuff', condition: 'readWin' },
  },
  'FALSE ECHO': {
    name: 'FALSE ECHO',
    tier: 'mid',
    type: null,
    effect: { status: 'echo', polarity: 'debuff', condition: 'readWin' },
  },
  WARCRY: {
    name: 'WARCRY',
    tier: 'heavy',
    type: null,
    effect: { status: 'callLock', polarity: 'debuff', condition: 'readWin' },
  },
  'CREEPING DOUBT': {
    name: 'CREEPING DOUBT',
    tier: 'mid',
    type: null,
    effect: { status: 'doubt', polarity: 'debuff', condition: 'readWin' },
  },
  // Buffs (self-cast):
  'SECOND WIND': {
    name: 'SECOND WIND',
    tier: 'mid',
    type: null,
    effect: { status: 'secondWind', polarity: 'buff', condition: 'always' },
  },
  KINDLE: {
    name: 'KINDLE',
    tier: 'mid',
    type: null,
    effect: { status: 'attunement', polarity: 'buff', condition: 'always' },
  },
  SWARM: {
    name: 'SWARM',
    tier: 'heavy',
    type: null,
    effect: { status: 'amplify', polarity: 'buff', condition: 'always' },
  },
  // ── Control & resource effect moves (Increment 1b Wave B) ─────────────────
  // Same 1a mechanism (read-win to land debuffs; chip damage). CONTROL moves
  // force/lock the foe's stance (escapable: read-win to apply, bounded
  // durations, diminishing returns on re-apply, foe can Call/rest). Typeless
  // fixtures (canon: FROST BIND/GLASS EDGE→FROST, MIND SNARE→PSI, CHALLENGE/
  // LEECH BITE→BRAWN/INSECT, TOXIC SAP/CORRODE→VENOM).
  // Control debuffs (read-win to land):
  'FROST BIND': {
    name: 'FROST BIND',
    tier: 'heavy',
    type: null,
    effect: { status: 'frozen', polarity: 'debuff', condition: 'readWin' },
  },
  'MIND SNARE': {
    name: 'MIND SNARE',
    tier: 'mid',
    type: null,
    effect: { status: 'inception', polarity: 'debuff', condition: 'readWin' },
  },
  CHALLENGE: {
    name: 'CHALLENGE',
    tier: 'mid',
    type: null,
    effect: { status: 'taunt', polarity: 'debuff', condition: 'readWin' },
  },
  // Resource debuffs (read-win to land):
  'TOXIC SAP': {
    name: 'TOXIC SAP',
    tier: 'mid',
    type: null,
    effect: { status: 'drained', polarity: 'debuff', condition: 'readWin' },
  },
  'LEECH BITE': {
    name: 'LEECH BITE',
    tier: 'mid',
    type: null,
    effect: { status: 'sap', polarity: 'debuff', condition: 'readWin' },
  },
  CORRODE: {
    name: 'CORRODE',
    tier: 'mid',
    type: null,
    effect: { status: 'corrode', polarity: 'debuff', condition: 'readWin' },
  },
  // ── Buffs / heals / cleanse effect moves (Increment 1b Wave C) ────────────
  // The lowest-degeneracy layer: buffs/heals don't disrupt the foe, so the only
  // risk is SELF-value ("free value" — a heal that turtles, an all-upside buff).
  // Heals self-apply (exposure in the cast-stance is the cost); SIPHON's heal is
  // read-win-gated (lifesteal). Typeless fixtures (canon: TIDE MEND/UNDERTOW→
  // AQUA, SIPHON/ENTANGLE→NATURE, WANE/VEIL→SPIRIT, STEADY/FOCUS UP→BASIC,
  // REFORGE→FORGE, SET STANCE→STONE, GLASS EDGE→FROST). KINDLE (FLAME Attunement)
  // already shipped in Wave A. All sim-gated in src/sim/sustainEffects.test.ts.
  // Heals / sustain:
  'TIDE MEND': {
    name: 'TIDE MEND',
    tier: 'mid',
    type: null,
    effect: { status: 'tideMend', polarity: 'buff', condition: 'always' },
  },
  UNDERTOW: {
    name: 'UNDERTOW',
    tier: 'mid',
    type: null,
    effect: { status: 'undertow', polarity: 'buff', condition: 'always' },
  },
  SIPHON: {
    name: 'SIPHON',
    tier: 'mid',
    type: null,
    // Lifesteal — heals ONLY on a cast-stance read-win (the chip lands amplified
    // AND you steal life); lose the read → chip only. The read-win gate is the cost.
    effect: { status: 'drain', polarity: 'buff', condition: 'readWin' },
  },
  ENTANGLE: {
    name: 'ENTANGLE',
    tier: 'mid',
    type: null,
    // NATURE's defensive sustain (vine-guard DR). A buff/heal-lane choice for the
    // 2nd NATURE slot — a root would duplicate Wave B's stance-lock control.
    effect: { status: 'entangle', polarity: 'buff', condition: 'always' },
  },
  // Cleanse:
  WANE: {
    name: 'WANE',
    tier: 'light',
    type: null,
    // Low/no damage (damageFactor below the 0.5 default) — its value is the cleanse.
    effect: { status: 'cleanse', polarity: 'buff', condition: 'always', damageFactor: 0.25 },
  },
  STEADY: {
    name: 'STEADY',
    tier: 'light',
    type: null,
    effect: { status: 'cleanse', polarity: 'buff', condition: 'always', damageFactor: 0.25 },
  },
  REFORGE: {
    name: 'REFORGE',
    tier: 'mid',
    type: null,
    effect: { status: 'reforge', polarity: 'buff', condition: 'always' },
  },
  // Self-buffs:
  VEIL: {
    name: 'VEIL',
    tier: 'mid',
    type: null,
    // Shrouded — hides the bearer's intent tell (GAME-side info effect, like the
    // daze/STATIC HAZE tell). Engine-inert combat-wise; carried as a bounded
    // lingering buff (duration + refresh-not-stack DR + cast exposure bound it).
    effect: { status: 'shrouded', polarity: 'buff', condition: 'always' },
  },
  'SET STANCE': {
    name: 'SET STANCE',
    tier: 'light',
    type: null,
    // Poker — stronger Brace (engine: guard-conditional mitigation), AND casting
    // reveals you might Brace (the tell tradeoff is game-side).
    effect: { status: 'setStance', polarity: 'buff', condition: 'always' },
  },
  'FOCUS UP': {
    name: 'FOCUS UP',
    tier: 'light',
    type: null,
    effect: { status: 'focusUp', polarity: 'buff', condition: 'always' },
  },
  'GLASS EDGE': {
    name: 'GLASS EDGE',
    tier: 'mid',
    type: null,
    // Glass cannon — your attacks deal more BUT you take more (a real, sim-
    // measurable cost), for a short window.
    effect: { status: 'glassEdge', polarity: 'buff', condition: 'always' },
  },
  // ── GALE identity technique (deferred until the Spine-1 tier-gate existed) ──
  UPDRAFT: {
    name: 'UPDRAFT',
    tier: 'mid',
    type: null,
    // Self-buff: while active, ATTACK-TIER ACCESS reads as if +updraftTierBoost ★
    // (punch above your ★-weight). Touches ONLY the phased-unlock gate — no actual
    // ★ gain, no behind-penalty effect (see config.ts updraftTierBoost + state.ts
    // tierMomentumLocked). A generic lingering buff (no special-casing in status.ts
    // — self-applies via applyPendingEffect, expires via tickStatuses).
    effect: { status: 'updraft', polarity: 'buff', condition: 'always' },
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
