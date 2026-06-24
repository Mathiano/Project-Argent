// Violet Academy — the post-gym teaching hub (docs/violet-academy.md). Pure text
// builders + flag constants so the canonical mentor line and the Academy-promote
// gate are unit-tested without a scene/DOM.
//
// The Academy is Argent's diegetic tutorial: the first gym is faced semi-blind on
// purpose, then FALKNER himself sends the player here on the win. The three
// teaching functions (stance triangle, move-trial teaser, bond/evo context) live
// as NPCs in src/game/maps/violet_academy.json; this module owns the in-gym
// trigger that promotes the Academy as the next prompt.

// Set the first time FALKNER is beaten (the mentor line below fires once); a Violet
// NPC near the Academy door appears on this flag to nudge the player inside.
export const ACADEMY_PROMOTED_FLAG = 'academy_promoted';

// FALKNER's post-win mentor line — the game's thesis, delivered in-gym on the win
// (docs/violet-academy.md §"The core idea"). Canonical text, paged for the box.
export function falknerMentorLines(): string[] {
  return [
    'FALKNER: This time you got lucky,',
    'kid. Or maybe you have got talent.',
    'But talent runs out.',
    'FALKNER: Next time you will need to',
    'understand what you are doing.',
    '',
    'FALKNER: Go see the Academy. The old',
    'hall taught me to read the wind. Let',
    'it teach you.',
  ];
}
