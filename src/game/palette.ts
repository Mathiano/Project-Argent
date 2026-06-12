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
} as const;

export type PaletteKey = keyof typeof PALETTE;
