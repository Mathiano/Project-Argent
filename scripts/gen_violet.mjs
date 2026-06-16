// Throwaway generator for VIOLET CITY (violet.json), data-driven on the
// outdoor_violet tileset with the city's PLASTER material identity. Builds
// the cell grid, validates row widths, BFS-checks that the route arrival
// reaches every building door + the exit, then emits JSON.
// Run: node scripts/gen_violet.mjs
import { writeFileSync } from 'node:fs';

const W = 20;
const tileMap = {
  p: 'path',
  T: 'tree',
  B: 'plaster', // Violet's per-city material identity (S9)
  D: 'wall_door',
  g: 'gym_facade_m',
  G: 'gym_door',
};
const SOLID = new Set(['tree', 'plaster', 'gym_facade_m']); // doors + path + grass walkable

// 20x17. NORTH edge = the route entrance (S3: the player walks Route 31
// southward, so they emerge at Violet's TOP and head DOWN into the city —
// shops in the upper-mid, the gym at the south end).
const rows = [
  'TTTTTTTTTpTTTTTTTTTT', //  0  route warp (9,0) north edge -> ROUTE31
  'T........p.........T', //  1  fromRoute spawn (9,1), facing DOWN
  'T........p.........T', //  2
  'T..BBB...p....BBB..T', //  3  Center (3-5) + Mart (14-16)
  'T..BDB...p....BDB..T', //  4  Center door (4,4), Mart door (15,4)
  'T...p....p.....p...T', //  5
  'T...pppppppppppp...T', //  6  connector links doors + spine
  'T........p.........T', //  7
  'T..BBB...p....BBB..T', //  8  flavor plaster houses (closed)
  'T..BBB...p....BBB..T', //  9
  'T........p.........T', // 10
  'T........p.........T', // 11
  'T......ggGgg.......T', // 12  GYM: door (9,12) at the facade top…
  'T......ggggg.......T', // 13  …body below; entered walking DOWN
  'T..................T', // 14
  'T..................T', // 15
  'TTTTTTTTTTTTTTTTTTTT', // 16  south wall (no exit; the route is north)
];
const H = rows.length;
rows.forEach((r, y) => { if (r.length !== W) throw new Error(`row ${y} width ${r.length}: "${r}"`); });

const idAt = (x, y) => { const ch = rows[y][x]; return ch === '.' ? 'grass' : tileMap[ch] ?? null; };
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
      const nx = x + dx, ny = y + dy, k = `${nx},${ny}`;
      if (seen.has(k) || !walkable(nx, ny)) continue;
      seen.add(k); q.push({ x: nx, y: ny });
    }
  }
  return seen;
}
const seen = reachable({ x: 9, y: 1 }); // fromRoute (top entrance)
const mustReach = {
  'route warp (9,0)': [9, 0],
  'center door (4,4)': [4, 4],
  'mart door (15,4)': [15, 4],
  'gym door (9,12)': [9, 12],
};
const fails = [];
for (const [label, [x, y]] of Object.entries(mustReach)) {
  if (!seen.has(`${x},${y}`)) fails.push(`UNREACHABLE: ${label}`);
  if (SOLID.has(idAt(x, y))) fails.push(`NOT WALKABLE: ${label} -> ${idAt(x, y)}`);
}
if (fails.length) { console.error('FAILED:\n' + fails.join('\n')); process.exit(1); }
console.log(`OK — ${seen.size} reachable tiles from the route arrival.`);

const objects = [
  { type: 'warp', x: 9, y: 0, target: 'ROUTE31:fromViolet' },
  { type: 'warp', x: 4, y: 4, target: 'VIOLET_CENTER:fromViolet' },
  { type: 'warp', x: 15, y: 4, target: 'VIOLET_MART:fromViolet' },
  { type: 'warp', x: 9, y: 12, target: 'GYM:fromRoute' },
  { type: 'sign', x: 8, y: 2, lines: ['VIOLET CITY', 'Welcome from the north road.', "FALKNER's gym stands south."] },
  { type: 'sign', x: 5, y: 3, lines: ['POKÉMON CENTER', 'Rest your team —', 'free for trainers.'] },
  { type: 'sign', x: 16, y: 3, lines: ['POKÉ MART', 'Supplies for the climb.'] },
  {
    type: 'npc', x: 11, y: 2, color: '#3a7fbe',
    interact: [{ kind: 'dialog', lines: ['GYM GUIDE: Down the lane is', "FALKNER's gym. Says the wind", 'is the third fighter up there.', 'Beat his trainer first —', 'they hand out a scout report.'] }],
  },
  {
    type: 'npc', x: 6, y: 7, color: '#caa148',
    interact: [{ kind: 'dialog', lines: ['TRAVELLER: Heal before you', 'climb — no Center on the roof.', 'The one here is just west.'] }],
  },
  {
    type: 'npc', x: 13, y: 10, color: '#7c4fa8',
    interact: [{ kind: 'dialog', lines: ['CITIZEN: The plasterwork here', 'is older than the gym.', 'Whole city the colour of', 'morning, my gran used to say.'] }],
  },
  {
    type: 'npc', x: 5, y: 11, color: '#b14e9c',
    interact: [{ kind: 'dialog', lines: ['KID: One day the pond on the', 'route will have a bridge,', 'my dad says. Then we can', 'reach the far bank!'] }],
  },
];
for (const o of objects) {
  if (o.type === 'warp' || o.type === 'sign') {
    // signs are read by facing them, so they may sit on solid tiles; warps must be walkable.
    if (o.type === 'warp' && (SOLID.has(idAt(o.x, o.y)) || !seen.has(`${o.x},${o.y}`)))
      throw new Error(`warp on bad tile (${o.x},${o.y})`);
  }
}

const map = {
  name: 'VIOLET CITY',
  _note: 'Phase 7 Sprint 1 (+firstroad-fixes S3) — data-driven Violet, PLASTER material identity, entered from the NORTH (player walks south down Route 31 into the city). Gym south end, Center + Mart enterable; full population deferred.',
  tilesetRef: 'outdoor_violet',
  width: W,
  height: H,
  tilesize: 16,
  baseTile: 'grass',
  tileMap,
  cells: rows,
  objects,
  spawns: {
    // S3: arrive from the route at the NORTH entrance, facing DOWN into
    // the city (the player was walking south down Route 31).
    fromRoute: { x: 9, y: 1, facing: 'down' },
    fromGym: { x: 9, y: 11, facing: 'up' }, // exit the gym just above its door
    fromCenter: { x: 4, y: 5, facing: 'down' },
    fromMart: { x: 15, y: 5, facing: 'down' },
  },
};
writeFileSync('src/game/maps/violet.json', JSON.stringify(map, null, 2) + '\n');
console.log('Wrote src/game/maps/violet.json');
