// v0 master palette — extends the demo's panel/ink colors.
// Will grow into the SGB+ 64-color ramp per docs/pilot-exit-decisions.md §1.
// Add colors here, never inline — this is the single source of color truth.

export const PALETTE = {
  // Frame / letterbox
  shellBlack: '#000000',

  // Panels and text
  ink: '#20202c',
  paper: '#f6efda',
  paperShadow: '#5a4a2a',
  paperDim: '#9a8e72',

  // Bars
  barEmpty: '#cfc6a8',
  hpOk: '#3e9a52',
  hpWarn: '#d6a012',
  hpCrit: '#c23a2a',
  stamina: '#4a7fc0',

  // Stance accents
  stanceA: '#c23a2a',
  stanceG: '#2f6fb8',
  stanceF: '#3e9a52',

  // Battle scene
  battleSky: '#e9f0d8',
  battleGround: '#cfe0b0',
  platform: '#c9d6a4',

  // Star / momentum
  star: '#c9a227',
  starOff: '#b8b09a',

  // Bond (Lane A legibility) — a warm rose, distinct from HP/ST/★ so the
  // bond meter reads as the relationship axis, not a combat resource.
  bond: '#c0608a',
  bondDim: '#5d2f44',

  // ── Battle-UI skin (Part 2b-2) — "a warm artifact, silver-inlaid" ───────────
  // The battle scene has its OWN palette, distinct from the overworld terrain.
  // Mood: warm, cozy, ancient, legendary — NOT cold metal, NOT muddy brown.
  // ⚠️ THESE HEXES ARE TUNED LIVE with Mathias — this is the STARTING POINT (CD
  // reference values, biased a touch warmer/brighter). Adjust freely here; the
  // battle draws reference these keys, so tuning is a one-file edit. The SEMANTIC
  // bars above (hp/st/bond/stance) are NOT part of this skin — leave them.

  // Warm structural — the parchment / aged-wood / leather "cabinet" (frames+panels)
  frameParchment: '#f6e7c2', // panel body — warm, bright (brighter than CD #f3e2bd)
  frameParchmentDim: '#ecd6a6', // inset/cell parchment (a shade down)
  frameWood: '#a9713f', // wood/leather mid — the frame band (warmer than CD #8f6244)
  frameWoodDark: '#734b2c', // frame outer edge — dark warm
  frameInk: '#3a2a1c', // warm dark — text + outlines (replaces the cold ink in battle)
  frameInkSoft: '#7c5637', // softer warm — secondary text / labels
  frameInkDim: '#b09068', // dim warm — disabled / hint text

  // Silver — INLAY / TRIM / RIVETS only (never a surface fill). "Jewelry on leather."
  silver: '#eef1f4',
  silverMid: '#c9ced6',
  silverDim: '#8b93a3',

  // Gold — the momentum ★ meters ONLY (legendary treasure).
  momentumGold: '#e8c04a',
  momentumGoldHi: '#f6e6a8',
  momentumGoldDim: '#a8842e',
  momentumOff: '#8f7d55', // unlit ★ — warm dim (not the cold starOff)

  // Velvet / brass — technique cells + selection highlight.
  velvet: '#9e4a3a',
  velvetDark: '#7c3328',
  brass: '#c9772e',

  // Jewel tones — tier badges, the BREAK bar, boss aura.
  jewelTeal: '#3d7a72',
  jewelSapphire: '#35558f',
  jewelPurple: '#6d5aa8',
} as const;

export type PaletteKey = keyof typeof PALETTE;
