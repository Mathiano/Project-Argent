// Authoritative generator for ROUTE31 (route31.violet.json). Authors the cell
// grid + the 3-layer schema (cells / layer1 fringe / layer2 props), back-ports
// ALL hand-maintained content (trainers, the PIP lost-mon chain, JAY's forced-
// entry hook), validates row widths + BFS connectivity (cells AND prop trunks),
// then emits JSON. Deterministic (seeded scatter) — safe to regenerate.
// Run: node scripts/gen_route31.mjs
import { writeFileSync } from 'node:fs';

const W = 20;
const tileMap = { p: 'path', G: 'tall_grass', T: 'tree', F: 'forest_floor', W: 'water', M: 'cave_rock', c: 'cave_mouth', x: 'flower' };
const SOLID = new Set(['tree', 'water', 'cave_rock']);
// deterministic RNG so the scatter/forest is stable across regens (no Math.random).
function mulberry32(a){ return function(){ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
const rng = mulberry32(0x5eed);

// north (Hearthwick) → south (Violet). col0/col19 = tree border (the 1-tile wall).
const baseRows = [
  'TTTTTTTTTTTTTTTTTTTT', //  0
  'TTTTpTTTTTTTTTTTTTTT', //  1  Hearthwick warp gap (x4)
  'T...p..............T', //  2
  'T...pppp...........T', //  3
  'T......p...........T', //  4
  'T..GG..p....GG.....T', //  5  tall grass
  'T..GG..ppp..GG.....T', //  6
  'T........p.........T', //  7
  'T........p.........T', //  8
  'T..GGGG..p..GGGG...T', //  9
  'T........p.........T', // 10
  'T.TTT....p...MMMM..T', // 11  forest (left) + cave hollow (right)
  'T.TFF....p...cccM..T', // 12
  'T.TFF....pp..cccM..T', // 13
  'T.TFF....p...MMMM..T', // 14
  'T.TTT.....p........T', // 15
  'T.........p........T', // 16
  'TT...WWWWWWWW......T', // 17  pond
  'TT..WWWW..WWWW.....T', // 18  marooned islet (8,18) — must stay unreachable
  'TT..WWWWWWWWWW.pp..T', // 19
  'T....WWWWWWWW..p...T', // 20
  'T.....GG......p....T', // 21  pondside grass (MARSHMASH)
  'T.....GG.....pp....T', // 22
  'T...........pp.....T', // 23
  'T..........pp......T', // 24
  'T.........pp.......T', // 25
  'T.........p........T', // 26
  'T.........p........T', // 27
  'T.........p........T', // 28
  'TTTTTTTTTTpTTTTTTTTT', // 29  Violet warp gap (x10)
];
const H = baseRows.length;
const grid = baseRows.map((r) => r.split(''));

// --- task 2: dense tall-grass patches off the main path (visual depth + encounters)
const tallPatches = [ { x: 14, y: 23, w: 3, h: 3 }, { x: 2, y: 24, w: 3, h: 2 } ];
for (const p of tallPatches) for (let dy = 0; dy < p.h; dy++) for (let dx = 0; dx < p.w; dx++) {
  if (grid[p.y + dy][p.x + dx] === '.') grid[p.y + dy][p.x + dx] = 'G';
}
const rows = grid.map((r) => r.join(''));

// --- validate widths ---
rows.forEach((r, y) => { if (r.length !== W) throw new Error(`row ${y} width ${r.length} != ${W}`); });

// --- walkability + BFS over CELLS ---
const idAt = (x, y) => { const ch = rows[y][x]; return ch === '.' ? 'grass' : tileMap[ch] ?? null; };
const cellWalk = (x, y) => { if (x < 0 || y < 0 || x >= W || y >= H) return false; const id = idAt(x, y); if (id === null) throw new Error(`unknown char "${rows[y][x]}" at (${x},${y})`); return !SOLID.has(id); };
function bfs(walk, from) { const seen = new Set([`${from.x},${from.y}`]); const q = [from]; while (q.length) { const { x, y } = q.shift(); for (const [dx, dy] of [[0,1],[0,-1],[1,0],[-1,0]]) { const nx=x+dx, ny=y+dy, k=`${nx},${ny}`; if (seen.has(k)||!walk(nx,ny)) continue; seen.add(k); q.push({x:nx,y:ny}); } } return seen; }
const spawn = { x: 4, y: 2 };
const seen = bfs(cellWalk, spawn);
const mustReach = { 'HEARTHWICK (4,1)':[4,1],'VIOLET (10,29)':[10,29],'cave (14,12)':[14,12],'pondside (6,21)':[6,21],'forest (3,12)':[3,12],'item forest (3,13)':[3,13],'item pond (12,24)':[12,24],'trainer1 (13,8)':[13,8],'trainer2 (13,21)':[13,21],'kid (11,23)':[11,23],'lost mon (16,21)':[16,21] };
const fails = [];
for (const [label,[x,y]] of Object.entries(mustReach)) { if (!seen.has(`${x},${y}`)) fails.push('UNREACHABLE '+label); if (SOLID.has(idAt(x,y))) fails.push('SOLID '+label); }
if (seen.has('8,18')) fails.push('pond leaks: islet (8,18) reachable');
if (fails.length) { console.error('FAILED:\n'+fails.join('\n')); process.exit(1); }

// --- objects (back-ported in full: signs, encounters, scripts, PIP chain, ALL
//     trainers, and JAY's approachOnEnter) ---
const objects = [
  { type: 'warp', x: 4, y: 1, target: 'HEARTHWICK:fromRoute' },
  { type: 'warp', x: 10, y: 29, target: 'VIOLET:fromRoute' },
  { type: 'sign', x: 6, y: 3, lines: ['ROUTE 31', 'The long road south', 'to VIOLET CITY.', 'Mind the tall grass.'] },
  { type: 'sign', x: 11, y: 11, lines: ['A dark hollow in the', 'rocks. Heavy things', 'stir in the shade.'] },
  { type: 'sign', x: 10, y: 17, lines: ['STILLWATER POND', 'Too deep to wade.', 'Follow the bank around.'] },
  { type: 'sign', x: 11, y: 28, lines: ['VIOLET CITY ahead —', "FALKNER's rooftop gym", 'waits past the gate.'] },
  { type: 'encounter_zone', x: 2, y: 5, width: 2, height: 5, species: ['FLITPECK'], rate: 0.18 },
  { type: 'encounter_zone', x: 12, y: 5, width: 2, height: 1, species: ['FLITPECK'], rate: 0.18 },
  { type: 'encounter_zone', x: 3, y: 9, width: 4, height: 1, species: ['FLITPECK'], rate: 0.18 },
  { type: 'encounter_zone', x: 12, y: 9, width: 4, height: 1, species: ['FLITPECK', 'GALEHAWK'], rate: 0.16 },
  { type: 'encounter_zone', x: 3, y: 12, width: 2, height: 3, species: ['FLITPECK', 'GALEHAWK'], rate: 0.16 },
  { type: 'encounter_zone', x: 13, y: 12, width: 3, height: 2, species: ['GRITHOAX'], rate: 0.45 },
  { type: 'encounter_zone', x: 5, y: 21, width: 2, height: 2, species: ['MARSHMASH'], rate: 0.3 },
  // task 2: encounter blocks over the new tall-grass patches
  { type: 'encounter_zone', x: 14, y: 23, width: 3, height: 3, species: ['FLITPECK'], rate: 0.16 },
  { type: 'encounter_zone', x: 2, y: 24, width: 3, height: 2, species: ['FLITPECK'], rate: 0.16 },
  { type: 'script', x: 9, y: 7, trigger: 'step-on', flag: 'route31_warning', once: true,
    commands: [{ kind: 'dialog', lines: ['Wings rustle in the grass —', 'and something heavier waits', 'in the hollow to the east.'] }] },
  { type: 'script', x: 3, y: 13, trigger: 'step-on', flag: 'route31_item_forest', once: true,
    commands: [{ kind: 'give-item', itemId: 'POTION', qty: 1 }, { kind: 'dialog', lines: ['Tucked under a fern —', 'you found a POTION!'] }] },
  { type: 'script', x: 12, y: 24, trigger: 'step-on', flag: 'route31_item_pond', once: true,
    commands: [{ kind: 'give-item', itemId: 'BALL', qty: 2 }, { kind: 'dialog', lines: ['Half-buried by the bank —', 'you found 2 BALLs!'] }] },
  { type: 'npc', x: 16, y: 21, color: '#9aaecf', sprite: 'FLITPECK', spriteType: 'GALE', blockedUntilFlag: 'route31_lost_mon_found',
    interact: [
      { kind: 'dialog', lines: ['A scruffy little FLITPECK is', 'wedged in the reeds, one wing', 'tucked wrong, peeping the same', 'three notes over and over.'] },
      { kind: 'dialog', lines: ['You crouch, go still, and hum', 'the three notes back at it.', 'It blinks. Peeps once more —', 'and hops onto your boot.'] },
      { kind: 'set-flag', flag: 'route31_lost_mon_found' },
      { kind: 'dialog', lines: ['It shakes out the bad wing,', 'looks up the path, and waits —', 'plainly wanting to be led home.'] } ],
    interactAfterFlag: [{ kind: 'dialog', lines: ['PIP pads after you, peeping', 'its little three-note song,', 'much braver now.'] }] },
  { type: 'npc', x: 11, y: 24, color: '#caa148', blockedUntilFlag: 'route31_lost_mon_found',
    interact: [
      { kind: 'dialog', lines: ["KID: You haven't seen a little", 'FLITPECK, have you? Answers to', "PIP — sings three notes, can't", 'hold a fourth to save itself.'] },
      { kind: 'dialog', lines: ['KID: It chased a leaf into the', 'reeds by the pond and just…', "didn't come back. I'm not", 'allowed near the water alone.'] } ],
    interactAfterFlag: [
      { kind: 'dialog', lines: ['KID: PIP! You — you found PIP!', '(It launches off your shoulder', 'straight into the kid’s arms,', 'peeping its whole song at once.)'] },
      { kind: 'dialog', lines: ['KID: You even hummed it back?', "That's our song. Nobody knows", "that but me. ...You're alright.", "I won't forget this."] } ] },
  { type: 'script', x: 11, y: 25, trigger: 'step-on', requiresFlag: 'route31_lost_mon_found', once: true, flag: 'route31_lost_mon_reunited',
    commands: [{ kind: 'dialog', lines: ['KID: Here — Mum keeps these for', 'the rough days. You gave PIP', 'back one of its. Take it.'] }, { kind: 'give-item', itemId: 'SUPER POTION', qty: 1 }] },
  // Trainers
  { type: 'npc', x: 13, y: 8, color: '#b14e9c', blockedUntilFlag: 'route31_youngster_beaten',
    interact: [{ kind: 'dialog', lines: ['YOUNGSTER MILO: My FLITPECK', 'and I have been training', 'all summer! Have a go?'] }, { kind: 'start-trainer-battle', foeSpecies: 'FLITPECK', winFlag: 'route31_youngster_beaten', reward: 300 }],
    interactAfterFlag: [{ kind: 'dialog', lines: ['YOUNGSTER MILO: Whoa — you', 'really read the wind!'] }] },
  { type: 'npc', x: 13, y: 21, color: '#3a7fbe', blockedUntilFlag: 'route31_lass_beaten',
    interact: [{ kind: 'dialog', lines: ['LASS BRYN: I caught my', 'MARSHMASH right here by', 'the water. Bet it can', 'out-splash you!'] }, { kind: 'start-trainer-battle', foeSpecies: 'MARSHMASH', winFlag: 'route31_lass_beaten', reward: 350 }],
    interactAfterFlag: [{ kind: 'dialog', lines: ['LASS BRYN: Well splashed.', 'The pond respects you.'] }] },
  // JAY — the forced-entry opening bond hook (approachOnEnter)
  { type: 'npc', x: 7, y: 4, color: '#c2491a', blockedUntilFlag: 'route31_trainer_beaten', approachOnEnter: true,
    interact: [{ kind: 'dialog', lines: ["JAY: That's a sharp little", 'partner. Out here, what is', "yours is mine — hand it over,", 'or I TAKE it!'] }, { kind: 'start-trainer-battle', foeSpecies: 'FLITPECK', winFlag: 'route31_trainer_beaten', reward: 500 }],
    interactAfterFlag: [{ kind: 'dialog', lines: ['JAY: ...It stepped in front', 'of you. Took the hit FOR you.', 'You two watch each other.', '...Keep it.'] }] },
  { type: 'npc', x: 5, y: 3, color: '#c2491a', blockedUntilFlag: 'route31_camper_beaten',
    interact: [{ kind: 'dialog', lines: ['ROURKE: No backing up out', 'here — I come straight at', 'you. Keep up!'] }, { kind: 'start-trainer-battle', foeSpecies: 'MARSHMASH', winFlag: 'route31_camper_beaten', reward: 350 }],
    interactAfterFlag: [{ kind: 'dialog', lines: ["ROURKE: You didn't flinch.", 'Respect.'] }] },
  { type: 'npc', x: 15, y: 7, color: '#3a7fbe', blockedUntilFlag: 'route31_birdkeeper_beaten',
    interact: [{ kind: 'dialog', lines: ['WREN: My FLITPECK never sits', 'still — too quick to pin.', 'Try and catch it!'] }, { kind: 'start-trainer-battle', foeSpecies: 'FLITPECK', winFlag: 'route31_birdkeeper_beaten', reward: 350 }],
    interactAfterFlag: [{ kind: 'dialog', lines: ['WREN: You read its feints.', 'Sharp eyes.'] }] },
  { type: 'npc', x: 11, y: 8, color: '#b14e9c', blockedUntilFlag: 'route31_youngster2_beaten',
    interact: [{ kind: 'dialog', lines: ["PAX: I've got two now! No", 'tricks — just a clean,', 'honest battle. Ready?'] }, { kind: 'start-trainer-battle', foeSpecies: ['GRITHOAX', 'MARSHMASH'], winFlag: 'route31_youngster2_beaten', reward: 400 }],
    interactAfterFlag: [{ kind: 'dialog', lines: ['PAX: Two in a row — wow!', 'Good reads.'] }] },
];

// --- Catching 2.0 lesson, DO step: the one-time guided FLITPECK catch.
// Fires on the FIRST tall-grass tile the player steps on after the lab lesson
// (requiresFlag catch_lesson_done), exactly once (a shared flag, so whichever
// grass tile is stepped first wins and the rest no-op). The overworld now
// hands a SPENT one-time trigger back to the encounter roll, so normal wild
// encounters resume on these very tiles afterwards. Placed on EVERY reachable
// tall_grass cell because the path threads BETWEEN the grass — the player
// chooses when to step in, so any grass tile may be their first.
const scriptCells = new Set(objects.filter((o) => o.type === 'script').map((o) => `${o.x},${o.y}`));
let guidedCount = 0;
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  if (rows[y][x] !== 'G') continue;
  const k = `${x},${y}`;
  if (scriptCells.has(k) || !seen.has(k)) continue; // skip occupied / unreachable
  objects.push({ type: 'script', x, y, trigger: 'step-on', requiresFlag: 'catch_lesson_done', flag: 'route31_guided_catch_done', once: true, commands: [{ kind: 'start-tutorial-catch' }] });
  guidedCount += 1;
}

for (const o of objects) {
  if (o.type === 'warp' || o.type === 'script' || o.type === 'encounter_zone') {
    const cells = o.type === 'encounter_zone' ? Array.from({ length: o.width }, (_, dx) => Array.from({ length: o.height }, (_, dy) => [o.x+dx, o.y+dy])).flat() : [[o.x, o.y]];
    for (const [x, y] of cells) { if (SOLID.has(idAt(x, y))) throw new Error(`${o.type} solid (${x},${y})`); if (!seen.has(`${x},${y}`)) throw new Error(`${o.type} unreachable (${x},${y})`); }
  }
}

// protected cells (objects, spawns, must-reach, path) — a prop TRUNK may never land here.
const protectedCells = new Set();
for (const o of objects) protectedCells.add(`${o.x},${o.y}`);
for (const [, [x, y]] of Object.entries(mustReach)) protectedCells.add(`${x},${y}`);
for (const [x, y] of [[4,2],[4,3],[10,28]]) protectedCells.add(`${x},${y}`);
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (rows[y][x] === 'p') protectedCells.add(`${x},${y}`);

// --- task 3b: layer-2 props — tree_big grouped into overlapping perimeter walls.
// Each entry is the LEFT trunk cell; the tree spans (x,y)+(x+1,y) trunk and the
// 2x2 canopy above. Tight spacing → continuous canopy. Only kept if both trunk
// cells are open grass and unprotected (else skipped + warned), so paths/objects
// are never blocked.
const treeAnchors = [
  // north forest wall (overlapping canopies across the top border)
  [9,2],[11,2],[13,2],[15,2],[17,2],
  // east edge stretch
  [17,10],[17,13],[17,16],
  // south-west + south-east corner stands
  [1,27],[3,27],[15,27],[17,27],
];
const props = [];
const trunkCells = new Set();
for (const [x, y] of treeAnchors) {
  const a = `${x},${y}`, b = `${x+1},${y}`;
  if (x+1 >= W-0 || rows[y][x] !== '.' || rows[y][x+1] !== '.' || protectedCells.has(a) || protectedCells.has(b)) { console.warn(`skip tree (${x},${y}) — blocked/occupied`); continue; }
  props.push({ name: 'tree_big', x, y });
  trunkCells.add(a); trunkCells.add(b);
}
// SAFETY: re-run BFS treating prop trunks as solid — every must-reach must hold.
const propWalk = (x, y) => cellWalk(x, y) && !trunkCells.has(`${x},${y}`);
const seen2 = bfs(propWalk, spawn);
for (const [label, [x, y]] of Object.entries(mustReach)) if (!seen2.has(`${x},${y}`)) throw new Error(`prop trunk regresses path: ${label} now unreachable`);
if (seen2.has('8,18')) throw new Error('prop change leaked the pond islet');

// --- task 2: layer-1 fringe — flower decals in natural asymmetric clusters on
// open grass (never a grid). Avoids objects, trunks, tall-grass, non-grass.
const isOpen = (x, y) => x > 0 && y > 0 && x < W-1 && y < H-1 && rows[y][x] === '.' && !protectedCells.has(`${x},${y}`) && !trunkCells.has(`${x},${y}`);
const fringeSet = new Set();
let placed = 0;
for (let c = 0; c < 9 && placed < 26; c++) {
  let cx, cy, tries = 0;
  do { cx = 1 + Math.floor(rng() * (W-2)); cy = 1 + Math.floor(rng() * (H-2)); tries++; } while (!isOpen(cx, cy) && tries < 60);
  if (!isOpen(cx, cy)) continue;
  const n = 2 + Math.floor(rng() * 4); // 2–5 per cluster
  for (let k = 0; k < n; k++) {
    const fx = cx + Math.round((rng() - 0.5) * 5), fy = cy + Math.round((rng() - 0.5) * 5);
    const key = `${fx},${fy}`;
    if (isOpen(fx, fy) && !fringeSet.has(key)) { fringeSet.add(key); placed++; }
  }
}
const fringe = Array.from({ length: H }, (_, y) => Array.from({ length: W }, (_, x) => fringeSet.has(`${x},${y}`) ? 'x' : '.').join(''));

console.log(`Validated ${objects.length} objects, ${props.length} tree props, ${placed} fringe flowers, ${guidedCount} guided-catch triggers.`);

const map = {
  name: 'ROUTE31',
  _note: 'Phase 7 — multi-screen Route 31. AUTHORITATIVE generator (scripts/gen_route31.mjs): all hand-content + the 3-layer schema live here; safe to regenerate. Hearthwick (north) → Violet (south).',
  tilesetRef: 'outdoor_violet', width: W, height: H, tilesize: 16, baseTile: 'grass',
  tileMap, cells: rows, fringe, props, objects,
  spawns: { default: { x: 4, y: 3, facing: 'down' }, fromHearthwick: { x: 4, y: 2, facing: 'down' }, fromHouse: { x: 4, y: 2, facing: 'down' }, fromLab: { x: 4, y: 2, facing: 'down' }, fromViolet: { x: 10, y: 28, facing: 'up' } },
};
writeFileSync('src/game/maps/route31.violet.json', JSON.stringify(map, null, 2) + '\n');
console.log('Wrote src/game/maps/route31.violet.json');
