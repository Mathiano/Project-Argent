// Per-NPC look derived from DATA, so the placeholder cast isn't 29 identical
// people. Hair colour: an explicit `hair` on the NPC wins; otherwise a stable
// hash of map + position picks from HAIR_PALETTE — the same NPC always gets the
// same hair, and neighbours differ. Pure; no DOM.

export const HAIR_PALETTE: readonly string[] = [
  '#2a2430', // black
  '#5a3a22', // dark brown
  '#8a5a30', // brown
  '#a04a2a', // auburn
  '#d9b25a', // blonde
  '#c8702a', // ginger
  '#b8b8c0', // grey
  '#2f3c6e', // navy
];

export const PLAYER_HAIR = '#4a2e1a';

// FNV-1a over "map:x:y" → palette index. Deterministic across sessions.
export function npcHairColor(mapName: string, x: number, y: number, override?: string): string {
  if (override) return override;
  let h = 2166136261;
  for (const ch of `${mapName}:${x}:${y}`) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return HAIR_PALETTE[h % HAIR_PALETTE.length]!;
}
