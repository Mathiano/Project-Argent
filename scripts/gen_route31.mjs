// Throwaway generator for ROUTE31 (route31.violet.json). Authors the cell
// grid, validates every row width, BFS-checks connectivity from the
// Hearthwick spawn to both warps + every gameplay tile, then emits JSON.
// Run: node scripts/gen_route31.mjs  (writes the map, prints a report)
import { writeFileSync } from 'node:fs';

const W = 20;
// Tile shorthand → tileset id. '.' is the baseTile (grass).
const tileMap = {
  p: 'path',
  G: 'tall_grass',
  T: 'tree',
  F: 'forest_floor',
  W: 'water',
  M: 'cave_rock',
  c: 'cave_mouth',
};
// Solidity by tile id (mirror of the tileset; for the BFS walkability check).
const SOLID = new Set(['tree', 'water', 'cave_rock']);

// The route, north (Hearthwick) → south (Violet). col0/col19 = tree border.
// Base is walkable grass; trees/water/rock are the only blockers, so the
// interior stays open (low soft-lock risk) — the BFS proves it.
const rows = [
  'TTTTTTTTTTTTTTTTTTTT', //  0  north tree wall
  'TTTTpTTTTTTTTTTTTTTT', //  1  Hearthwick warp gap (x4)
  'T...p..............T', //  2  fromHearthwick spawn (x4)
  'T...pppp...........T', //  3
  'T......p...........T', //  4  meadow
  'T..GG..p....GG.....T', //  5  tall grass
  'T..GG..ppp..GG.....T', //  6
  'T........p.........T', //  7
  'T........p.........T', //  8  (trainer 1 stands near here)
  'T..GGGG..p..GGGG...T', //  9
  'T........p.........T', // 10
  'T.TTT....p...MMMM..T', // 11  forest (left, opens right) + cave hollow (right)
  'T.TFF....p...cccM..T', // 12  cave mouth opens left toward the path
  'T.TFF....pp..cccM..T', // 13  forest floor reachable via grass at col5
  'T.TFF....p...MMMM..T', // 14
  'T.TTT.....p........T', // 15
  'T.........p........T', // 16
  'TT...WWWWWWWW......T', // 17  pond (water, impassable) — walk around right
  'TT..WWWW..WWWW.....T', // 18  a grass islet (8,9) marooned in the water…
  'TT..WWWWWWWWWW.pp..T', // 19  …visible but uncrossable (deferred traversal)
  'T....WWWWWWWW..p...T', // 20
  'T.....GG......p....T', // 21  pondside grass (MARSHMASH) + trainer 2
  'T.....GG.....pp....T', // 22
  'T...........pp.....T', // 23  (lost-mon event around here)
  'T..........pp......T', // 24
  'T.........pp.......T', // 25
  'T.........p........T', // 26
  'T.........p........T', // 27
  'T.........p........T', // 28
  'TTTTTTTTTTpTTTTTTTTT', // 29  Violet warp gap (x10)
];
const H = rows.length;

// --- validate widths ---
rows.forEach((r, y) => {
  if (r.length !== W) throw new Error(`row ${y} width ${r.length} != ${W}: "${r}"`);
});

// --- walkability + BFS ---
const idAt = (x, y) => {
  const ch = rows[y][x];
  return ch === '.' ? 'grass' : tileMap[ch] ?? null;
};
const walkable = (x, y) => {
  if (x < 0 || y < 0 || x >= W || y >= H) return false;
  const id = idAt(x, y);
  if (id === null) throw new Error(`unknown char "${rows[y][x]}" at (${x},${y})`);
  return !SOLID.has(id);
};
function reachable(from) {
  const seen = new Set([`${from.x},${from.y}`]);
  const q = [from];
  while (q.length) {
    const { x, y } = q.shift();
    for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
      const nx = x + dx, ny = y + dy;
      const k = `${nx},${ny}`;
      if (seen.has(k)) continue;
      if (!walkable(nx, ny)) continue;
      seen.add(k);
      q.push({ x: nx, y: ny });
    }
  }
  return seen;
}
const spawn = { x: 4, y: 2 }; // fromHearthwick
const seen = reachable(spawn);
const mustReach = {
  'HEARTHWICK warp (4,1)': [4, 1],
  'VIOLET warp (10,29)': [10, 29],
  'cave mouth (14,12)': [14, 12],
  'pondside grass (6,21)': [6, 21],
  'forest floor (3,12)': [3, 12],
  'hidden item: forest (3,13)': [3, 13],
  'hidden item: south of pond (12,24)': [12, 24],
  'trainer1 stand (13,8)': [13, 8],
  'trainer2 stand (13,21)': [13, 21],
  'lost-mon kid stand (11,23)': [11, 23],
  'lost mon stand (16,21)': [16, 21],
};
const fails = [];
for (const [label, [x, y]] of Object.entries(mustReach)) {
  if (!seen.has(`${x},${y}`)) fails.push(`UNREACHABLE: ${label}`);
  if (SOLID.has(idAt(x, y))) fails.push(`NOT WALKABLE (solid tile): ${label} -> ${idAt(x, y)}`);
}
// Negative check: the grass islet (8,18) marooned in the pond must be
// UNREACHABLE (the "area beyond the water you can't yet reach" — the
// deferred-traversal seam). Reachable here would mean the pond leaks.
const bankReachable = seen.has('8,18');

if (fails.length) {
  console.error('FAILED:\n' + fails.join('\n'));
  process.exit(1);
}
console.log(`OK — ${seen.size} walkable tiles reachable from spawn.`);
console.log(`Deferred-traversal islet (8,18) reachable? ${bankReachable} (want false).`);
if (bankReachable) throw new Error('pond leaks: the marooned islet (8,18) is reachable');

// --- objects ---
const objects = [
  { type: 'warp', x: 4, y: 1, target: 'HEARTHWICK:fromRoute' },
  { type: 'warp', x: 10, y: 29, target: 'VIOLET:fromRoute' },
  // Signs
  { type: 'sign', x: 6, y: 3, lines: ['ROUTE 31', 'The long road south', 'to VIOLET CITY.', 'Mind the tall grass.'] },
  { type: 'sign', x: 11, y: 11, lines: ['A dark hollow in the', 'rocks. Heavy things', 'stir in the shade.'] },
  { type: 'sign', x: 10, y: 17, lines: ['STILLWATER POND', 'Too deep to wade.', 'Follow the bank around.'] },
  { type: 'sign', x: 11, y: 28, lines: ['VIOLET CITY ahead —', "FALKNER's rooftop gym", 'waits past the gate.'] },
  // Terrain-varied encounters (S4)
  { type: 'encounter_zone', x: 2, y: 5, width: 2, height: 5, species: ['FLITPECK'], rate: 0.18 },
  { type: 'encounter_zone', x: 12, y: 5, width: 2, height: 1, species: ['FLITPECK'], rate: 0.18 },
  { type: 'encounter_zone', x: 3, y: 9, width: 4, height: 1, species: ['FLITPECK'], rate: 0.18 },
  { type: 'encounter_zone', x: 12, y: 9, width: 4, height: 1, species: ['FLITPECK', 'GALEHAWK'], rate: 0.16 }, // forest edge: rare GALEHAWK
  { type: 'encounter_zone', x: 3, y: 12, width: 2, height: 3, species: ['FLITPECK', 'GALEHAWK'], rate: 0.16 }, // forest floor
  { type: 'encounter_zone', x: 13, y: 12, width: 3, height: 2, species: ['GRITHOAX'], rate: 0.45 }, // cave hollow (TERRA)
  { type: 'encounter_zone', x: 5, y: 21, width: 2, height: 2, species: ['MARSHMASH'], rate: 0.3 }, // pondside (AQUA)
  // Step-on warning (existing flavor, kept)
  {
    type: 'script', x: 9, y: 7, trigger: 'step-on', flag: 'route31_warning', once: true,
    commands: [{ kind: 'dialog', lines: ['Wings rustle in the grass —', 'and something heavier waits', 'in the hollow to the east.'] }],
  },
  // Hidden items off the path (S5) — step-on, once.
  {
    type: 'script', x: 3, y: 13, trigger: 'step-on', flag: 'route31_item_forest', once: true,
    commands: [{ kind: 'give-item', itemId: 'POTION', qty: 1 }, { kind: 'dialog', lines: ['Tucked under a fern —', 'you found a POTION!'] }],
  },
  {
    type: 'script', x: 12, y: 24, trigger: 'step-on', flag: 'route31_item_pond', once: true,
    commands: [{ kind: 'give-item', itemId: 'BALL', qty: 2 }, { kind: 'dialog', lines: ['Half-buried by the bank —', 'you found 2 BALLs!'] }],
  },
  // --- The seed event (S6): the lost mon. S4: PIP renders as a visible
  // FLITPECK sprite (placeholder) in the reeds so the player can SEE it.
  // S5: a little character — PIP is a specific bird with a specific tic.
  // First talk calms PIP + sets lost_mon_found; afterwards it waits.
  {
    type: 'npc', x: 16, y: 21, color: '#9aaecf', sprite: 'FLITPECK', spriteType: 'GALE',
    blockedUntilFlag: 'route31_lost_mon_found',
    interact: [
      { kind: 'dialog', lines: ['A scruffy little FLITPECK is', 'wedged in the reeds, one wing', 'tucked wrong, peeping the same', 'three notes over and over.'] },
      { kind: 'dialog', lines: ['You crouch, go still, and hum', 'the three notes back at it.', 'It blinks. Peeps once more —', 'and hops onto your boot.'] },
      { kind: 'set-flag', flag: 'route31_lost_mon_found' },
      { kind: 'dialog', lines: ['It shakes out the bad wing,', 'looks up the path, and waits —', 'plainly wanting to be led home.'] },
    ],
    interactAfterFlag: [{ kind: 'dialog', lines: ['PIP pads after you, peeping', 'its little three-note song,', 'much braver now.'] }],
  },
  // The worried owner (a kid up the path). Pleads before; thanks after.
  {
    type: 'npc', x: 11, y: 24, color: '#caa148', blockedUntilFlag: 'route31_lost_mon_found',
    interact: [
      { kind: 'dialog', lines: ["KID: You haven't seen a little", 'FLITPECK, have you? Answers to', "PIP — sings three notes, can't", 'hold a fourth to save itself.'] },
      { kind: 'dialog', lines: ['KID: It chased a leaf into the', 'reeds by the pond and just…', "didn't come back. I'm not", 'allowed near the water alone.'] },
    ],
    interactAfterFlag: [
      { kind: 'dialog', lines: ['KID: PIP! You — you found PIP!', '(It launches off your shoulder', 'straight into the kid’s arms,', 'peeping its whole song at once.)'] },
      { kind: 'dialog', lines: ['KID: You even hummed it back?', "That's our song. Nobody knows", "that but me. ...You're alright.", "I won't forget this."] },
    ],
  },
  // The reunion reward: a one-time step-on in front of the kid, gated on
  // having found the mon. Fires exactly once (requiresFlag + once + flag).
  {
    type: 'script', x: 11, y: 25, trigger: 'step-on',
    requiresFlag: 'route31_lost_mon_found', once: true, flag: 'route31_lost_mon_reunited',
    commands: [
      { kind: 'dialog', lines: ['KID: Here — Mum keeps these for', 'the rough days. You gave PIP', 'back one of its. Take it.'] },
      { kind: 'give-item', itemId: 'SUPER POTION', qty: 1 },
    ],
  },
  // Easy trainers (S3) — approachable, beatable, small rewards.
  {
    type: 'npc', x: 13, y: 8, color: '#b14e9c', blockedUntilFlag: 'route31_youngster_beaten',
    interact: [
      { kind: 'dialog', lines: ['YOUNGSTER MILO: My FLITPECK', 'and I have been training', 'all summer! Have a go?'] },
      { kind: 'start-trainer-battle', foeSpecies: 'FLITPECK', winFlag: 'route31_youngster_beaten', reward: 300 },
    ],
    interactAfterFlag: [{ kind: 'dialog', lines: ['YOUNGSTER MILO: Whoa — you', 'really read the wind!'] }],
  },
  {
    type: 'npc', x: 13, y: 21, color: '#3a7fbe', blockedUntilFlag: 'route31_lass_beaten',
    interact: [
      { kind: 'dialog', lines: ['LASS BRYN: I caught my', 'MARSHMASH right here by', 'the water. Bet it can', 'out-splash you!'] },
      { kind: 'start-trainer-battle', foeSpecies: 'MARSHMASH', winFlag: 'route31_lass_beaten', reward: 350 },
    ],
    interactAfterFlag: [{ kind: 'dialog', lines: ['LASS BRYN: Well splashed.', 'The pond respects you.'] }],
  },
  // Flavor NPC (kept from the old route): the JAY "keep it" beat.
  {
    type: 'npc', x: 7, y: 4, color: '#c2491a', blockedUntilFlag: 'route31_trainer_beaten',
    interact: [
      { kind: 'dialog', lines: ["JAY: That's a sharp little", 'partner. Out here, what is', "yours is mine — hand it over,", 'or I TAKE it!'] },
      { kind: 'start-trainer-battle', foeSpecies: 'FLITPECK', winFlag: 'route31_trainer_beaten', reward: 500 },
    ],
    interactAfterFlag: [
      { kind: 'dialog', lines: ['JAY: ...It stepped in front', 'of you. Took the hit FOR you.', 'You two watch each other.', '...Keep it.'] },
    ],
  },
];

// Validate every object sits on a walkable tile the player can use
// (NPCs may stand on solid-adjacent; they're approached, so their own
// tile can be anything, but warps/scripts/encounters must be walkable).
for (const o of objects) {
  if (o.type === 'warp' || o.type === 'script' || o.type === 'encounter_zone') {
    const cells = o.type === 'encounter_zone'
      ? Array.from({ length: o.width }, (_, dx) => Array.from({ length: o.height }, (_, dy) => [o.x + dx, o.y + dy])).flat()
      : [[o.x, o.y]];
    for (const [x, y] of cells) {
      if (SOLID.has(idAt(x, y))) throw new Error(`${o.type} on solid tile (${x},${y}) -> ${idAt(x, y)}`);
      if (!seen.has(`${x},${y}`)) throw new Error(`${o.type} on unreachable tile (${x},${y})`);
    }
  }
}
console.log(`Validated ${objects.length} objects.`);

const map = {
  name: 'ROUTE31',
  _note: 'Phase 7 Sprint 1 — the real multi-screen Route 31. Generated by scripts/gen_route31.mjs; edit there + regen. Hearthwick (north) → Violet (south).',
  tilesetRef: 'outdoor_violet',
  width: W,
  height: H,
  tilesize: 16,
  baseTile: 'grass',
  tileMap,
  cells: rows,
  objects,
  spawns: {
    default: { x: 4, y: 3, facing: 'down' },
    fromHearthwick: { x: 4, y: 2, facing: 'down' },
    fromHouse: { x: 4, y: 2, facing: 'down' },
    fromLab: { x: 4, y: 2, facing: 'down' },
    fromViolet: { x: 10, y: 28, facing: 'up' },
  },
};
writeFileSync('src/game/maps/route31.violet.json', JSON.stringify(map, null, 2) + '\n');
console.log('Wrote src/game/maps/route31.violet.json');
