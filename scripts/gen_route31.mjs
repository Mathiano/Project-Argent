// Authoritative generator for ROUTE31 (route31.violet.json) — the EXPANDED
// first journey (route31-expansion-design.md): ~3x, FOUR distinct sections
// north→south (Hearthwick → Violet):
//   §1 Meadowgate (rows 1-16)      — open sunny meadow; the guided catch; FLITPECK
//   §2 The Wending Wood (17-34)    — tree cover; FLITPECK/GALEHAWK; ROURKE/WREN;
//                                    travelers' camp; GRITHOAX cave-hollow nook
//   §3 The Wayside (35-52)         — shrine + overlook landmark; PIP chain; PAX
//   §4 Pondside & approach (53-72) — pond/MARSHMASH; JAY; fellow-first-timer; exit
//
// Carries forward ALL prior content (trainers, PIP chain, JAY's approachOnEnter,
// every encounter zone, the guided catch) + adds the new beats. The guided catch
// is now ONE zone step-on script over §1's grass (was 35 per-tile triggers).
// Deterministic (seeded scatter); BFS-validated; safe to regenerate. Endpoints
// (fromHearthwick spawn + the Violet exit warp) preserved as wiring; the NORTH
// entrance coords are kept identical to the pre-expansion map.
// Run: node scripts/gen_route31.mjs
import { writeFileSync } from 'node:fs';

const W = 22;
const H = 74;
const tileMap = { p: 'path', G: 'tall_grass', T: 'tree', F: 'forest_floor', W: 'water', M: 'cave_rock', c: 'cave_mouth', x: 'flower' };
const SOLID = new Set(['tree', 'water', 'cave_rock']);
function mulberry32(a){ return function(){ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
const rng = mulberry32(0x5eed);

// --- base grid: all grass, 1-tile tree border ---
const grid = Array.from({ length: H }, (_, y) => Array.from({ length: W }, (_, x) =>
  (x === 0 || x === W - 1 || y === 0 || y === H - 1) ? 'T' : '.'));

// carve the two endpoint gaps in the border (north = Hearthwick, south = Violet)
grid[0][4] = 'p';   // Hearthwick warp gap (kept at col 4 — north entrance unchanged)
grid[H - 1][10] = 'p'; // Violet warp gap (south exit)

// --- a rectangle stamp that never overwrites the border ---
function stamp(ch, x0, y0, w, h) {
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++)
    if (x > 0 && y > 0 && x < W - 1 && y < H - 1) grid[y][x] = ch;
}

// === SECTION FEATURES (stamped first; the path is carved over them after) ======
// §1 Meadowgate — open meadow + two tall-grass patches.
stamp('G', 8, 6, 7, 7);   // east meadow grass (the guided-catch zone + FLITPECK)
stamp('G', 2, 12, 4, 4);  // west meadow grass
// §2 The Wending Wood — WALKABLE forest floor (the canopy is the layer-2 trees +
// the border), grass clearings, and a reachable cave-hollow nook. Solid trees
// only frame; they never enclose a walkable pocket (BFS-checked).
stamp('F', 2, 18, 6, 16);  // west forest floor (walkable) cols2-7 rows18-33
stamp('F', 13, 28, 6, 6);  // east forest floor cols13-18 rows28-33
stamp('G', 10, 19, 4, 4);  // wood clearing grass (FLITPECK/GALEHAWK)
// GRITHOAX cave-hollow nook (east, off-path): stone frame with a mouth opening
// WEST toward the path at col 16, so the nook is reachable.
stamp('M', 17, 22, 4, 6); stamp('c', 17, 24, 2, 3); // cols17-18 rows24-26 = cave mouth (walkable)
// §3 The Wayside — the shrine stone + the overlook gap + a reed pocket for PIP.
stamp('M', 12, 37, 5, 4); stamp('F', 13, 38, 3, 2);  // weathered shrine stone
stamp('G', 6, 44, 4, 4);  // wayside grass
stamp('W', 16, 47, 3, 3); stamp('G', 13, 49, 3, 3);  // reed pocket (PIP lost-mon) + bank grass
// §4 Pondside & approach — the pond (skirted on the east) + pondside grass.
stamp('W', 3, 55, 10, 9); // STILLWATER POND
stamp('G', 5, 65, 4, 3);  // pondside grass (MARSHMASH)

// === THE PATH — winding waypoints, carved as L-segments (4-connected) ==========
const waypoints = [
  [4, 1], [4, 5], [10, 5], [10, 11], [5, 11], [5, 16],          // §1
  [10, 18], [10, 24], [16, 24], [16, 30], [8, 30], [8, 34],     // §2
  [14, 36], [14, 46], [9, 46], [9, 52],                         // §3
  [15, 55], [15, 62], [10, 62], [10, 73],                       // §4
];
function carve(x, y) { if (x > 0 && y > 0 && x < W - 1 && y < H - 1) grid[y][x] = 'p'; }
for (let i = 0; i < waypoints.length - 1; i++) {
  let [x, y] = waypoints[i]; const [tx, ty] = waypoints[i + 1];
  while (x !== tx) { carve(x, y); x += Math.sign(tx - x); }   // horizontal leg
  while (y !== ty) { carve(x, y); y += Math.sign(ty - y); }   // vertical leg
  carve(tx, ty);
}
carve(4, 1); carve(10, 72); // ensure the cells just inside each border gap are path

const rows = grid.map((r) => r.join(''));
rows.forEach((r, y) => { if (r.length !== W) throw new Error(`row ${y} width ${r.length} != ${W}`); });

// === walkability + BFS over CELLS ==============================================
const idAt = (x, y) => { const ch = rows[y][x]; return ch === '.' ? 'grass' : tileMap[ch] ?? null; };
const cellWalk = (x, y) => { if (x < 0 || y < 0 || x >= W || y >= H) return false; const id = idAt(x, y); if (id === null) throw new Error(`unknown char "${rows[y][x]}" at (${x},${y})`); return !SOLID.has(id); };
function bfs(walk, from) { const seen = new Set([`${from.x},${from.y}`]); const q = [from]; while (q.length) { const { x, y } = q.shift(); for (const [dx, dy] of [[0,1],[0,-1],[1,0],[-1,0]]) { const nx=x+dx, ny=y+dy, k=`${nx},${ny}`; if (seen.has(k)||!walk(nx,ny)) continue; seen.add(k); q.push({x:nx,y:ny}); } } return seen; }
const spawn = { x: 4, y: 2 };
const seen = bfs(cellWalk, spawn);

// === OBJECTS (ALL prior content carried forward + the new beats) ===============
// Helper: a tile beside the path that is guaranteed walkable (carved to grass).
function openCell(x, y) { grid[y][x] = grid[y][x] === '.' || grid[y][x] === 'G' ? grid[y][x] : '.'; }

const objects = [
  // --- endpoints (wiring preserved) ---
  { type: 'warp', x: 4, y: 1, target: 'HEARTHWICK:fromRoute' },
  { type: 'warp', x: 10, y: 73, target: 'VIOLET:fromRoute' },

  // ============================ §1 MEADOWGATE ===============================
  { type: 'sign', x: 5, y: 3, lines: ['ROUTE 31 · MEADOWGATE', 'The meadow road south', 'out of Hearthwick.', 'Mind the tall grass.'] },
  // detail: a signpost with hand-added notes (tone anchor)
  { type: 'sign', x: 3, y: 5, lines: ['A weathered signpost.', "Below the carved arrow, in", 'three different hands:', "'good water ½ day on'", "'BERRIES past the woods'", "'say hi to the shrine for me'"] },
  // the fellow first-timer — INTRO (canonical)
  { type: 'npc', x: 6, y: 6, color: '#e0b15a', sprite: 'GRITHOAX', spriteType: 'TERRA',
    interact: [{ kind: 'dialog', lines: ['You started today too? ...Me too.', "I haven't actually battled anyone", "yet — GRITHOAX isn't really a", "fighter. But we're not in a hurry."] }] },
  // thesis-whisper: a wild mon at ease near the trail
  { type: 'npc', x: 12, y: 5, color: '#9aaecf', sprite: 'FLITPECK', spriteType: 'GALE',
    interact: [{ kind: 'dialog', lines: ['A FLITPECK preens in a sunbeam', 'by the path, in no hurry to move.', "It's seen people before.", "They've never given it reason to fear them."] }] },
  { type: 'encounter_zone', x: 8, y: 6, width: 7, height: 7, species: ['FLITPECK'], rate: 0.18 },
  { type: 'encounter_zone', x: 2, y: 12, width: 4, height: 4, species: ['FLITPECK'], rate: 0.18 },

  // ========================== §2 THE WENDING WOOD ===========================
  { type: 'sign', x: 9, y: 17, lines: ['THE WENDING WOOD', 'The path narrows under', 'the trees. Cooler here.', 'Quieter.'] },
  // travelers' camp — cold campfire + a rest-log worn smooth (detail layer)
  { type: 'sign', x: 7, y: 31, lines: ['A cold campfire, ringed', 'with stones. Someone', 'rested here last night,', 'and moved on at dawn.'] },
  { type: 'sign', x: 9, y: 31, lines: ['A fallen log by the ashes,', 'worn smooth on top.', 'How many travelers have', 'sat here, catching their breath?'] },
  // GRITHOAX cave-hollow nook (off-path side-nook)
  { type: 'sign', x: 17, y: 22, lines: ['A dark hollow in the rocks.', 'Heavy things stir in the shade.', 'Worth a look — if you dare it.'] },
  { type: 'encounter_zone', x: 10, y: 19, width: 4, height: 4, species: ['FLITPECK', 'GALEHAWK'], rate: 0.16 },
  { type: 'encounter_zone', x: 17, y: 24, width: 2, height: 3, species: ['GRITHOAX'], rate: 0.45 },
  // a hidden item tucked in the wood (carried forward: route31_item_forest / POTION)
  { type: 'script', x: 7, y: 32, trigger: 'step-on', flag: 'route31_item_forest', once: true,
    commands: [{ kind: 'give-item', itemId: 'POTION', qty: 1 }, { kind: 'dialog', lines: ['Tucked under a fern —', 'you found a POTION!'] }] },
  // warning beat (carried forward flag)
  { type: 'script', x: 10, y: 20, trigger: 'step-on', flag: 'route31_warning', once: true,
    commands: [{ kind: 'dialog', lines: ['Wings rustle in the canopy —', 'and something heavier waits', 'in the hollow to the east.'] }] },

  // ============================= §3 THE WAYSIDE =============================
  // section name in-world (matches §2's WENDING WOOD area sign)
  { type: 'sign', x: 13, y: 44, lines: ['THE WAYSIDE', 'Where the road pauses.', 'Old stone, a long view,', 'a place to rest.'] },
  // the landmark — the Wayside Shrine (canonical plaque) + the Overlook (canonical)
  { type: 'sign', x: 13, y: 41, lines: ['Worn stone, older than the road.', 'The carving shows a small figure', 'and a great winged shape, side by', 'side, beneath a crescent.', 'The words have mostly weathered', "away — only '...the first to be", "trusted...' remains."] },
  { type: 'sign', x: 16, y: 40, lines: ['The land opens, and you see it', 'for the first time — a town in the', 'distance, a tower rising over it.', 'Violet City. Where you\'re going.'] },
  // detail: a tended berry bush
  { type: 'sign', x: 8, y: 44, lines: ['A berry bush by the wayside,', 'pruned and netted against birds.', 'Someone tends it for the road —', 'and leaves the low branches unpicked.'] },
  // thesis-whisper: a traveler sharing food with a wild mon
  { type: 'npc', x: 11, y: 46, color: '#7c9a5a', sprite: 'MARSHMASH', spriteType: 'AQUA',
    interact: [{ kind: 'dialog', lines: ['A traveler sits at the shrine,', 'sharing the last of their lunch', 'with a wild MARSHMASH.', 'Neither owns the other.', 'They just share the shade.'] }] },

  // ===================== §4 PONDSIDE & THE VIOLET APPROACH ===================
  { type: 'sign', x: 13, y: 54, lines: ['STILLWATER POND', 'Too deep to wade.', 'Follow the bank around.'] },
  // detail: tracks at the pond, an off-path nest
  { type: 'sign', x: 13, y: 64, lines: ['Tracks in the mud at the bank —', 'small, webbed, overlapping.', 'A whole family comes to drink here.'] },
  { type: 'sign', x: 8, y: 68, lines: ['A nest tucked in the reeds,', 'just off the path. Three pale eggs.', 'You step around it, quietly.'] },
  { type: 'encounter_zone', x: 5, y: 65, width: 4, height: 3, species: ['MARSHMASH'], rate: 0.3 },
  // a hidden item by the bank (carried forward: route31_item_pond / BALLs)
  { type: 'script', x: 12, y: 64, trigger: 'step-on', flag: 'route31_item_pond', once: true,
    commands: [{ kind: 'give-item', itemId: 'BALL', qty: 2 }, { kind: 'dialog', lines: ['Half-buried by the bank —', 'you found 2 BALLs!'] }] },
  // the fellow first-timer — REAPPEARANCE near Violet (canonical)
  { type: 'npc', x: 11, y: 68, color: '#e0b15a', sprite: 'GRITHOAX', spriteType: 'TERRA',
    interact: [{ kind: 'dialog', lines: ['You made it! I knew you would.', '...I lost my first three battles.', "Doesn't matter. GRITHOAX and I", 'had a good day.'] }] },
  { type: 'sign', x: 11, y: 71, lines: ['VIOLET CITY ahead —', "FALKNER's rooftop gym", 'waits past the gate.'] },

  // ============================ THE PIP LOST-MON CHAIN (§3, enriched) ========
  { type: 'npc', x: 14, y: 50, color: '#9aaecf', sprite: 'FLITPECK', spriteType: 'GALE', blockedUntilFlag: 'route31_lost_mon_found',
    interact: [
      { kind: 'dialog', lines: ['A scruffy little FLITPECK is', 'wedged in the reeds, one wing', 'tucked wrong, peeping the same', 'three notes over and over.'] },
      { kind: 'dialog', lines: ['You crouch, go still, and hum', 'the three notes back at it.', 'It blinks. Peeps once more —', 'and hops onto your boot.'] },
      { kind: 'set-flag', flag: 'route31_lost_mon_found' },
      { kind: 'dialog', lines: ['It shakes out the bad wing,', 'looks up the path, and waits —', 'plainly wanting to be led home.'] } ],
    interactAfterFlag: [{ kind: 'dialog', lines: ['PIP pads after you, peeping', 'its little three-note song,', 'much braver now.'] }] },
  { type: 'npc', x: 8, y: 45, color: '#caa148', blockedUntilFlag: 'route31_lost_mon_found',
    interact: [
      { kind: 'dialog', lines: ["KID: You haven't seen a little", 'FLITPECK, have you? Answers to', "PIP — sings three notes, can't", 'hold a fourth to save itself.'] },
      { kind: 'dialog', lines: ['KID: It chased a leaf into the', 'reeds and just… didn\'t come back.', "I'm not allowed near the water alone.", 'I waited here at the shrine, hoping.'] } ],
    interactAfterFlag: [
      { kind: 'dialog', lines: ['KID: PIP! You — you found PIP!', '(It launches off your shoulder', 'straight into the kid’s arms,', 'peeping its whole song at once.)'] },
      { kind: 'dialog', lines: ['KID: You even hummed it back?', "That's our song. Nobody knows", "that but me. ...You're alright.", "I won't forget this."] } ] },
  { type: 'script', x: 9, y: 45, trigger: 'step-on', requiresFlag: 'route31_lost_mon_found', once: true, flag: 'route31_lost_mon_reunited',
    commands: [{ kind: 'dialog', lines: ['KID: Here — Mum keeps these for', 'the rough days. You gave PIP', 'back one of its. Take it.'] }, { kind: 'give-item', itemId: 'SUPER POTION', qty: 1 }] },

  // ============================== TRAINERS (all carried forward) =============
  // YOUNGSTER MILO (§1) — first, gentlest
  { type: 'npc', x: 8, y: 9, color: '#b14e9c', blockedUntilFlag: 'route31_youngster_beaten',
    interact: [{ kind: 'dialog', lines: ['YOUNGSTER MILO: My FLITPECK', 'and I have been training', 'all summer! Have a go?'] }, { kind: 'start-trainer-battle', foeSpecies: 'FLITPECK', winFlag: 'route31_youngster_beaten', reward: 300 }],
    interactAfterFlag: [{ kind: 'dialog', lines: ['YOUNGSTER MILO: Whoa — you', 'really read the wind!'] }] },
  // ROURKE (§2) — the headlong camper, given character
  { type: 'npc', x: 9, y: 27, color: '#a8703a', blockedUntilFlag: 'route31_camper_beaten',
    interact: [{ kind: 'dialog', lines: ['ROURKE: Twelve days on the road', 'and not one backward step.', 'I only know one direction — at you.', 'Keep up!'] }, { kind: 'start-trainer-battle', foeSpecies: 'MARSHMASH', winFlag: 'route31_camper_beaten', reward: 350 }],
    interactAfterFlag: [{ kind: 'dialog', lines: ["ROURKE: You didn't flinch.", 'Respect. Onward, then — both of us.'] }] },
  // WREN (§2) — the bird-keeper, given character
  { type: 'npc', x: 7, y: 33, color: '#3a7fbe', blockedUntilFlag: 'route31_birdkeeper_beaten',
    interact: [{ kind: 'dialog', lines: ['WREN: Shh — watch the canopy, not me.', 'My FLITPECK never sits still;', 'I learned to read it by going still', 'myself. Now — try and catch it.'] }, { kind: 'start-trainer-battle', foeSpecies: 'FLITPECK', winFlag: 'route31_birdkeeper_beaten', reward: 350 }],
    interactAfterFlag: [{ kind: 'dialog', lines: ['WREN: You read its feints.', 'Sharp eyes. The woods taught you fast.'] }] },
  // PAX (§3) — the honest two-mon trainer, near the wayside
  { type: 'npc', x: 10, y: 48, color: '#b14e9c', blockedUntilFlag: 'route31_youngster2_beaten',
    interact: [{ kind: 'dialog', lines: ["PAX: I've got two now! I sat with", 'them at the shrine a while.', 'No tricks — just a clean, honest', 'battle. Ready?'] }, { kind: 'start-trainer-battle', foeSpecies: ['GRITHOAX', 'MARSHMASH'], winFlag: 'route31_youngster2_beaten', reward: 400 }],
    interactAfterFlag: [{ kind: 'dialog', lines: ['PAX: Two in a row — wow!', 'Good reads. The shrine saw it.'] }] },
  // LASS BRYN (§4) — pondside
  { type: 'npc', x: 13, y: 66, color: '#3a7fbe', blockedUntilFlag: 'route31_lass_beaten',
    interact: [{ kind: 'dialog', lines: ['LASS BRYN: I caught my', 'MARSHMASH right here by', 'the water. Bet it can', 'out-splash you!'] }, { kind: 'start-trainer-battle', foeSpecies: 'MARSHMASH', winFlag: 'route31_lass_beaten', reward: 350 }],
    interactAfterFlag: [{ kind: 'dialog', lines: ['LASS BRYN: Well splashed.', 'The pond respects you.'] }] },
  // JAY — the gentle robber + the OPENING bond hook (approachOnEnter PRESERVED).
  // SEAM: the brief pitched JAY for §4, but approachOnEnter fires on MAP ENTRY —
  // and the player enters at §1 (north, out of Hearthwick). JAY is literally the
  // "forced-entry opening bond hook", so he MUST sit near the entrance or he'd
  // march the whole map on entry. Kept at §1 (the mechanic + his role win over
  // the placement). Canonical gentle-robber tone retained.
  { type: 'npc', x: 8, y: 8, color: '#c2491a', blockedUntilFlag: 'route31_trainer_beaten', approachOnEnter: true,
    interact: [{ kind: 'dialog', lines: ['JAY: Hand over your — ...huh.', "You've barely got anything, have you.", 'Just started. ...Forget it.', 'Battle me anyway. A guy\'s got to', 'win at SOMETHING today.'] }, { kind: 'start-trainer-battle', foeSpecies: 'FLITPECK', winFlag: 'route31_trainer_beaten', reward: 500 }],
    interactAfterFlag: [{ kind: 'dialog', lines: ['JAY: ...It stepped in front', 'of you. Took the hit FOR you.', 'You two watch each other.', '...Keep it. Go on.'] }] },
];

// open the tile under each NPC/sign so it is never stranded on a solid feature
for (const o of objects) if (o.type === 'npc' || o.type === 'sign') openCell(o.x, o.y);
const rows2 = grid.map((r) => r.join(''));
for (let i = 0; i < rows.length; i++) rows[i] = rows2[i];
const seen3 = bfs(cellWalk, spawn);

// === the guided catch — ONE zone step-on over §1's east meadow grass ==========
// (was 35 per-tile scripts; now a single zone-entry check — overworld.ts fires a
// step-on script with width+height anywhere inside the rectangle.) Fires exactly
// once on the first §1 grass tile entered, after the lab lesson (catch_lesson_done).
const CATCH_ZONE = { x: 8, y: 6, width: 7, height: 7 };
objects.push({ type: 'script', x: CATCH_ZONE.x, y: CATCH_ZONE.y, width: CATCH_ZONE.width, height: CATCH_ZONE.height,
  trigger: 'step-on', requiresFlag: 'catch_lesson_done', flag: 'route31_guided_catch_done', once: true,
  commands: [{ kind: 'start-tutorial-catch' }] });

// === validation: every object cell reachable + non-solid; endpoints reachable ==
const mustReach = {
  'HEARTHWICK (4,1)': [4, 1], 'VIOLET (10,73)': [10, 73],
  'meadow grass (10,9)': [10, 9], 'wood clearing (11,20)': [11, 20], 'cave nook (17,25)': [17, 25],
  'shrine (14,40)': [14, 40], 'wayside (9,46)': [9, 46], 'pondside (6,66)': [6, 66],
};
const fails = [];
for (const [label, [x, y]] of Object.entries(mustReach)) { if (!seen3.has(`${x},${y}`)) fails.push('UNREACHABLE ' + label); if (SOLID.has(idAt(x, y))) fails.push('SOLID ' + label); }
for (const o of objects) {
  if (o.type === 'warp' || o.type === 'script' || o.type === 'encounter_zone' || o.type === 'npc' || o.type === 'sign') {
    const cells = (o.width && o.height) ? Array.from({ length: o.width }, (_, dx) => Array.from({ length: o.height }, (_, dy) => [o.x + dx, o.y + dy])).flat() : [[o.x, o.y]];
    for (const [x, y] of cells) {
      if (x < 0 || y < 0 || x >= W || y >= H) { fails.push(`${o.type} OOB (${x},${y})`); continue; }
      if (SOLID.has(idAt(x, y))) fails.push(`${o.type} SOLID (${x},${y})`);
      if (!seen3.has(`${x},${y}`)) fails.push(`${o.type} UNREACHABLE (${x},${y})`);
    }
  }
}
if (seen3.has('7,58')) fails.push('pond leaks: interior (7,58) reachable');
if (fails.length) { console.error('FAILED:\n' + fails.join('\n')); process.exit(1); }

// === props (layer-2 trees) + fringe (layer-1 flowers) — decorative, BFS-safe ===
const protectedCells = new Set();
for (const o of objects) {
  const cells = (o.width && o.height) ? Array.from({ length: o.width }, (_, dx) => Array.from({ length: o.height }, (_, dy) => [o.x + dx, o.y + dy])).flat() : [[o.x, o.y]];
  for (const [x, y] of cells) protectedCells.add(`${x},${y}`);
}
for (const [, [x, y]] of Object.entries(mustReach)) protectedCells.add(`${x},${y}`);
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (rows[y][x] === 'p') protectedCells.add(`${x},${y}`);

const treeAnchors = [[2, 2], [4, 2], [16, 2], [18, 2], [1, 35], [19, 35], [1, 53], [19, 53], [2, 70], [18, 70]];
const props = [];
const trunkCells = new Set();
for (const [x, y] of treeAnchors) {
  const a = `${x},${y}`, b = `${x + 1},${y}`;
  if (x + 1 >= W - 1 || rows[y][x] !== '.' || rows[y][x + 1] !== '.' || protectedCells.has(a) || protectedCells.has(b)) { console.warn(`skip tree (${x},${y}) — blocked/occupied`); continue; }
  props.push({ name: 'tree_big', x, y }); trunkCells.add(a); trunkCells.add(b);
}
const propWalk = (x, y) => cellWalk(x, y) && !trunkCells.has(`${x},${y}`);
const seen4 = bfs(propWalk, spawn);
for (const [label, [x, y]] of Object.entries(mustReach)) if (!seen4.has(`${x},${y}`)) throw new Error(`prop trunk regresses path: ${label} now unreachable`);

const isOpen = (x, y) => x > 0 && y > 0 && x < W - 1 && y < H - 1 && rows[y][x] === '.' && !protectedCells.has(`${x},${y}`) && !trunkCells.has(`${x},${y}`);
const fringeSet = new Set();
let placed = 0;
for (let c = 0; c < 14 && placed < 40; c++) {
  let cx, cy, tries = 0;
  do { cx = 1 + Math.floor(rng() * (W - 2)); cy = 1 + Math.floor(rng() * (H - 2)); tries++; } while (!isOpen(cx, cy) && tries < 80);
  if (!isOpen(cx, cy)) continue;
  const n = 2 + Math.floor(rng() * 4);
  for (let k = 0; k < n; k++) {
    const fx = cx + Math.round((rng() - 0.5) * 5), fy = cy + Math.round((rng() - 0.5) * 5);
    const key = `${fx},${fy}`;
    if (isOpen(fx, fy) && !fringeSet.has(key)) { fringeSet.add(key); placed++; }
  }
}
const fringe = Array.from({ length: H }, (_, y) => Array.from({ length: W }, (_, x) => fringeSet.has(`${x},${y}`) ? 'x' : '.').join(''));

console.log(`Validated ${objects.length} objects, ${props.length} tree props, ${placed} fringe flowers; ${W}x${H}, 4 sections.`);

const map = {
  name: 'ROUTE31',
  _note: 'Phase 7 EXPANSION — four-section Route 31 (route31-expansion-design.md). AUTHORITATIVE generator (scripts/gen_route31.mjs): all carried-forward + new content live here; safe to regenerate. Hearthwick (north) → Meadowgate → Wending Wood → Wayside → Pondside → Violet (south).',
  tilesetRef: 'outdoor_violet', width: W, height: H, tilesize: 16, baseTile: 'grass',
  // Registry→engine bridge (POC, regen-safe): render the open meadow (baseTile
  // `grass`) with the Studio-authored tile so it's visible at scale in playtest.
  // Override is by TILE ID, so it covers all open `grass` on the route; tall_grass
  // (G), forest_floor (F), path, water etc. stay placeholder. Other maps untouched.
  tileRefs: { grass: { tileset: 'heartwick_grass_test', tile: 'heartwick_grass_test_027' } },
  tileMap, cells: rows, fringe, props, objects,
  spawns: { default: { x: 4, y: 3, facing: 'down' }, fromHearthwick: { x: 4, y: 2, facing: 'down' }, fromHouse: { x: 4, y: 2, facing: 'down' }, fromLab: { x: 4, y: 2, facing: 'down' }, fromViolet: { x: 10, y: 72, facing: 'up' } },
};
writeFileSync('src/game/maps/route31.violet.json', JSON.stringify(map, null, 2) + '\n');
console.log('Wrote src/game/maps/route31.violet.json');
