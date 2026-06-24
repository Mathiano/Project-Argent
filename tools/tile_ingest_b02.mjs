// Batch-02 ingest: re-quantize to the LOCKED palette, ingest the full dirt+water
// transition set, classify each tile's orientation from its ART (corner grass
// coverage), validate, emit a tileset, and autotile a seam-test scene.
import { PNG } from 'pngjs';
import fs from 'fs';

const SRC = 'docs/art-reference/violet-batck-02.png';
const TS = 16, INSET = 8, KEYS = '0123456789abcdefghijklmnopqrstuvwxyz';
const palJson = JSON.parse(fs.readFileSync('assets/palettes/argent-master.palette.json'));
const pal = palJson.colors.map(c => [parseInt(c.hex.slice(1, 3), 16), parseInt(c.hex.slice(3, 5), 16), parseInt(c.hex.slice(5, 7), 16)]);
// "grass-or-not" is all classification needs (grass = the outside colour).
const isGrass = pal.map(([r, g, b]) => g >= r && g > b + 4 && g > 70 && !(b > r && b > g));

const png = PNG.sync.read(fs.readFileSync(SRC));
const W = png.width, D = png.data;
const at = (x, y) => { const i = (y * W + x) * 4; return [D[i], D[i + 1], D[i + 2]]; };
const nearest = (r, g, b) => { let bi = 0, bd = 1e18; for (let i = 0; i < pal.length; i++) { const [pr, pg, pb] = pal[i]; const d = (pr - r) ** 2 + (pg - g) ** 2 + (pb - b) ** 2; if (d < bd) { bd = d; bi = i; } } return bi; };

function poolTile(x0, y0, w, h) {
  const out = [];
  for (let gy = 0; gy < TS; gy++) {
    const row = [];
    for (let gx = 0; gx < TS; gx++) {
      const cx0 = x0 + gx * w / TS, cy0 = y0 + gy * h / TS, cx1 = x0 + (gx + 1) * w / TS, cy1 = y0 + (gy + 1) * h / TS;
      const cnt = new Map();
      for (let sy = Math.floor(cy0); sy < Math.ceil(cy1); sy++)
        for (let sx = Math.floor(cx0); sx < Math.ceil(cx1); sx++) {
          const [r, g, b] = at(sx, sy); const k = nearest(r, g, b); cnt.set(k, (cnt.get(k) || 0) + 1);
        }
      let bk = 0, bc = -1; for (const [k, v] of cnt) { if (v > bc) { bc = v; bk = k; } } row.push(bk);
    }
    out.push(row);
  }
  return out;
}
const cornerGrass = (t, r0, c0) => { let g = 0, n = 0; for (let y = r0; y < r0 + 4; y++) for (let x = c0; x < c0 + 4; x++) { n++; if (isGrass[t[y][x]]) g++; } return g / n; };
function classify(t) {
  const nw = cornerGrass(t, 0, 0) > 0.5, ne = cornerGrass(t, 0, 12) > 0.5, sw = cornerGrass(t, 12, 0) > 0.5, se = cornerGrass(t, 12, 12) > 0.5;
  const n = [nw, ne, sw, se].filter(Boolean).length;
  if (n === 0) return 'base';
  if (n === 4) return 'allgrass';
  if (n === 1) return nw ? 'in_nw' : ne ? 'in_ne' : sw ? 'in_sw' : 'in_se';
  if (n === 2) { if (nw && ne) return 'n'; if (sw && se) return 's'; if (ne && se) return 'e'; if (nw && sw) return 'w'; return 'diag?'; }
  if (!se) return 'out_nw'; if (!sw) return 'out_ne'; if (!ne) return 'out_sw'; return 'out_se';
}

// detected swatch boxes (B-inner-SE added manually). [material, kind, x, y]
const R = [
  ['grass', 'base', 19, 79], ['path', 'base', 185, 79], ['water', 'base', 353, 79],
  ['path', 't', 18, 283], ['path', 't', 184, 283], ['path', 't', 353, 266], ['path', 't', 518, 266],
  ['path', 't', 9, 444], ['path', 't', 184, 444], ['path', 't', 353, 444], ['path', 't', 518, 444],
  ['path', 't', 18, 617], ['path', 't', 185, 617], ['path', 't', 353, 617], ['path', 't', 518, 617],
  ['water', 't', 709, 283], ['water', 't', 873, 283], ['water', 't', 1038, 266], ['water', 't', 1204, 266],
  ['water', 't', 709, 444], ['water', 't', 874, 444], ['water', 't', 1038, 444], ['water', 't', 1204, 444],
  ['water', 't', 709, 617], ['water', 't', 873, 617], ['water', 't', 1039, 617], ['water', 't', 1204, 617],
];
const tiles = {}; const classified = { path: {}, water: {} }; const rawlog = [];
for (const [mat, kind, x, y] of R) {
  const t = poolTile(x + INSET, y + INSET, 122 - 2 * INSET, 120 - 2 * INSET);
  const rows = t.map(r => r.map(i => KEYS[i]).join(''));
  if (kind === 'base') { tiles[mat] = { rows, solid: mat === 'water' }; continue; }
  const o = classify(t);
  let line = mat + ' @(' + x + ',' + y + ') -> ' + o;
  if (classified[mat][o]) line += '  (DUP!)';
  classified[mat][o] = true;
  rawlog.push(line);
  tiles[mat + '_' + o] = { rows, solid: mat === 'water' };
}

// validate
let fails = 0;
for (const [k, t] of Object.entries(tiles)) {
  if (t.rows.length !== TS) { console.log('FAIL rows', k); fails++; }
  t.rows.forEach(r => { if (r.length !== TS) { console.log('FAIL len', k); fails++; } for (const c of r) if (KEYS.indexOf(c) >= pal.length) { console.log('FAIL char', k); fails++; } });
}

const EXP = ['n', 'e', 's', 'w', 'out_nw', 'out_ne', 'out_sw', 'out_se', 'in_nw', 'in_ne', 'in_sw', 'in_se'];
const miss = { path: EXP.filter(o => !classified.path[o]), water: EXP.filter(o => !classified.water[o]) };
console.log('\n--- classification (orientation read from ART) ---'); rawlog.forEach(l => console.log('  ' + l));
console.log('\n--- completeness ---');
for (const m of ['path', 'water']) console.log('  ' + m + ': ' + EXP.filter(o => classified[m][o]).length + '/12 present' + (miss[m].length ? '  MISSING: ' + miss[m].join(',') : '  COMPLETE'));
console.log('\n--- validation: ' + (fails ? 'FAILED ' + fails : 'PASS') + ' (' + Object.keys(tiles).length + ' tiles)');

// write tileset (review only)
const tsPal = pal.map(([r, g, b]) => '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join(''));
fs.writeFileSync('assets/tilesets/violet_transitions_b02.tileset.json', JSON.stringify({ name: 'violet_transitions_b02', _note: 'INGESTED from violet-batck-02.png, re-quantized to argent-master (LOCKED). Review only — NOT swapped into Violet. Keys: <mat>_<orient>.', tilesize: TS, palette: tsPal, tiles: Object.fromEntries(Object.entries(tiles).map(([k, t]) => [k, { solid: t.solid, rows: t.rows }])) }, null, 1));

// draw helper
const draw = (img, t, cx, cy, Z) => { for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) { const c = pal[KEYS.indexOf(t.rows[y][x])]; for (let zy = 0; zy < Z; zy++) for (let zx = 0; zx < Z; zx++) { const di = ((cy + y * Z + zy) * img.width + (cx + x * Z + zx)) * 4; img.data[di] = c[0]; img.data[di + 1] = c[1]; img.data[di + 2] = c[2]; img.data[di + 3] = 255; } } };

// contact sheet: row1 dirt(base+12), row2 water(base+12), row3 grass base
{
  const Z = 8, PAD = 6, CELL = TS * Z + PAD, COLS = 13;
  const rows = [['path', ...EXP.map(o => 'path_' + o)], ['water', ...EXP.map(o => 'water_' + o)], ['grass']];
  const cs = new PNG({ width: COLS * CELL + PAD, height: rows.length * CELL + PAD });
  for (let i = 0; i < cs.data.length; i += 4) { cs.data[i] = 26; cs.data[i + 1] = 29; cs.data[i + 2] = 36; cs.data[i + 3] = 255; }
  rows.forEach((rw, ri) => rw.forEach((k, ci) => { const t = tiles[k]; if (t) draw(cs, t, PAD + ci * CELL, PAD + ri * CELL, Z); }));
  fs.writeFileSync('docs/art-reference/violet-batch-02.ingested.png', PNG.sync.write(cs));
}

// autotile seam test: dirt PLUS + water PLUS (each exercises all 13)
function autokey(mask, x, y, w, h, prefix) {
  if (!mask[y][x]) return null;
  const g = (xx, yy) => !(xx >= 0 && yy >= 0 && xx < w && yy < h && mask[yy][xx]);
  const gN = g(x, y - 1), gS = g(x, y + 1), gE = g(x + 1, y), gW = g(x - 1, y), gNW = g(x - 1, y - 1), gNE = g(x + 1, y - 1), gSW = g(x - 1, y + 1), gSE = g(x + 1, y + 1);
  const orth = [gN, gE, gS, gW].filter(Boolean).length;
  if (orth >= 3) return prefix;
  if (orth === 2) { if (gN && gW) return prefix + '_out_nw'; if (gN && gE) return prefix + '_out_ne'; if (gS && gW) return prefix + '_out_sw'; if (gS && gE) return prefix + '_out_se'; return prefix; }
  if (orth === 1) { return prefix + '_' + (gN ? 'n' : gE ? 'e' : gS ? 's' : 'w'); }
  if (gNW) return prefix + '_in_nw'; if (gNE) return prefix + '_in_ne'; if (gSW) return prefix + '_in_sw'; if (gSE) return prefix + '_in_se';
  return prefix;
}
const SW = 30, SH = 18, Z = 6;
const scene = Array.from({ length: SH }, () => Array(SW).fill('grass'));
const plus = (mask, cx) => { for (let y = 2; y <= 15; y++) for (let x = cx - 1; x <= cx + 1; x++) mask[y][x] = true; for (let y = 7; y <= 9; y++) for (let x = cx - 5; x <= cx + 5; x++) mask[y][x] = true; };
const dmask = Array.from({ length: SH }, () => Array(SW).fill(false)); plus(dmask, 7);
const wmask = Array.from({ length: SH }, () => Array(SW).fill(false)); plus(wmask, 22);
for (let y = 0; y < SH; y++) for (let x = 0; x < SW; x++) { const dk = autokey(dmask, x, y, SW, SH, 'path'); if (dk) scene[y][x] = dk; const wk = autokey(wmask, x, y, SW, SH, 'water'); if (wk) scene[y][x] = wk; }
const img = new PNG({ width: SW * TS * Z, height: SH * TS * Z });
let seams = 0;
for (let cy = 0; cy < SH; cy++) for (let cx = 0; cx < SW; cx++) {
  const k = scene[cy][cx]; let t = tiles[k];
  if (!t) { t = tiles[k.startsWith('water') ? 'water' : k.startsWith('path') ? 'path' : 'grass']; if (k !== 'grass') seams++; }
  for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) { const c = pal[KEYS.indexOf(t.rows[y][x])]; for (let zy = 0; zy < Z; zy++) for (let zx = 0; zx < Z; zx++) { const di = (((cy * TS + y) * Z + zy) * img.width + ((cx * TS + x) * Z + zx)) * 4; img.data[di] = c[0]; img.data[di + 1] = c[1]; img.data[di + 2] = c[2]; img.data[di + 3] = 255; } }
}
fs.writeFileSync('docs/art-reference/violet-batch-02.seamtest.png', PNG.sync.write(img));
console.log('\nseam-test: autotiled dirt+water plus shapes, ' + seams + ' cells fell back to base (missing/degenerate).');
console.log('wrote violet-batch-02.ingested.png, violet-batch-02.seamtest.png, violet_transitions_b02.tileset.json');
