// Rotational synthesis test: take the cleanest AI master tiles (N edge + one
// outer + one inner corner), canonicalize each to its base orientation, ROTATE
// to derive the full 12-orientation set, re-quantize to the locked palette, and
// autotile a seam test. Water set = the rotated dirt set RECOLOURED (batch-02's
// water corners weren't a usable family). Proof of "AI-base + CC-rotation".
import { PNG } from 'pngjs';
import fs from 'fs';

const SRC = 'docs/art-reference/violet-batck-02.png';
const TS = 16, INSET = 8, KEYS = '0123456789abcdefghijklmnopqrstuvwxyz';
const pal = JSON.parse(fs.readFileSync('assets/palettes/argent-master.palette.json')).colors.map(c => [parseInt(c.hex.slice(1, 3), 16), parseInt(c.hex.slice(3, 5), 16), parseInt(c.hex.slice(5, 7), 16)]);
const isGrass = pal.map(([r, g, b]) => g >= r && g > b + 4 && g > 70 && !(b > r && b > g));
const isBlue = pal.map(([r, g, b]) => b > r && b > g);
const png = PNG.sync.read(fs.readFileSync(SRC)); const W = png.width, D = png.data;
const at = (x, y) => { const i = (y * W + x) * 4; return [D[i], D[i + 1], D[i + 2]]; };
const nearest = (r, g, b) => { let bi = 0, bd = 1e18; for (let i = 0; i < pal.length; i++) { const [pr, pg, pb] = pal[i]; const d = (pr - r) ** 2 + (pg - g) ** 2 + (pb - b) ** 2; if (d < bd) { bd = d; bi = i; } } return bi; };
function pool(x0, y0, w, h) { const o = []; for (let gy = 0; gy < TS; gy++) { const row = []; for (let gx = 0; gx < TS; gx++) { const cx0 = x0 + gx * w / TS, cy0 = y0 + gy * h / TS, cx1 = x0 + (gx + 1) * w / TS, cy1 = y0 + (gy + 1) * h / TS; const cnt = new Map(); for (let sy = Math.floor(cy0); sy < Math.ceil(cy1); sy++) for (let sx = Math.floor(cx0); sx < Math.ceil(cx1); sx++) { const [r, g, b] = at(sx, sy); const k = nearest(r, g, b); cnt.set(k, (cnt.get(k) || 0) + 1); } let bk = 0, bc = -1; for (const [k, v] of cnt) { if (v > bc) { bc = v; bk = k; } } row.push(bk); } o.push(row); } return o; }
const cg = (t, r0, c0) => { let g = 0, n = 0; for (let y = r0; y < r0 + 4; y++) for (let x = c0; x < c0 + 4; x++) { n++; if (isGrass[t[y][x]]) g++; } return g / n; };
function classify(t) { const nw = cg(t, 0, 0) > .5, ne = cg(t, 0, 12) > .5, sw = cg(t, 12, 0) > .5, se = cg(t, 12, 12) > .5; const n = [nw, ne, sw, se].filter(Boolean).length; if (n === 0) return 'base'; if (n === 4) return 'allgrass'; if (n === 1) return nw ? 'in_nw' : ne ? 'in_ne' : sw ? 'in_sw' : 'in_se'; if (n === 2) { if (nw && ne) return 'n'; if (sw && se) return 's'; if (ne && se) return 'e'; if (nw && sw) return 'w'; return 'diag'; } if (!se) return 'out_nw'; if (!sw) return 'out_ne'; if (!ne) return 'out_sw'; return 'out_se'; }
const rot90 = t => t.map((_, y) => t.map((__, x) => t[TS - 1 - x][y])); // 90deg CW: N->E, NW->NE
function canon(t, target) { let r = t; for (let i = 0; i < 4; i++) { if (classify(r) === target) return r; r = rot90(r); } return t; } // best effort

// rotate a base master into its 4 orientations
const r1 = t => rot90(t), r2 = t => rot90(rot90(t)), r3 = t => rot90(rot90(rot90(t)));
const grass = pool(19 + INSET, 79 + INSET, 106, 104);
const dirt = pool(185 + INSET, 79 + INSET, 106, 104);
const water = pool(353 + INSET, 79 + INSET, 106, 104);

// ONE clean AI master per material is enough: the N edge. The four edges are
// rotations of it; the corners are DERIVED from it so they're seam-consistent
// with the edges by construction:
//   outer_nw = union(N-grass, W-grass)  — grass wraps the top+left bands
//   inner_nw = intersect(N-grass, W-grass) — grass only in the top-left nub
const mN = canon(pool(18 + INSET, 283 + INSET, 106, 104), 'n'); // dirt N edge
const mW = r3(mN);                                              // dirt W edge (grass left)
const composeU = (A, B, base) => A.map((row, y) => row.map((_, x) => isGrass[A[y][x]] ? A[y][x] : isGrass[B[y][x]] ? B[y][x] : base[y][x]));
const composeI = (A, B, base) => A.map((row, y) => row.map((_, x) => (isGrass[A[y][x]] && isGrass[B[y][x]]) ? A[y][x] : base[y][x]));
const mO = composeU(mN, mW, dirt); // outer NW
const mI = composeI(mN, mW, dirt); // inner NW

const tiles = {};
const put = (k, t) => { tiles[k] = { rows: t.map(r => r.map(i => KEYS[i]).join('')), grid: t }; };
put('grass', grass); put('path', dirt); put('water', water);
put('path_n', mN); put('path_e', r1(mN)); put('path_s', r2(mN)); put('path_w', r3(mN));
put('path_out_nw', mO); put('path_out_ne', r1(mO)); put('path_out_se', r2(mO)); put('path_out_sw', r3(mO));
put('path_in_nw', mI); put('path_in_ne', r1(mI)); put('path_in_se', r2(mI)); put('path_in_sw', r3(mI));

// water set = recolour the dirt set (grass kept; dirt-fill -> water blue by lightness; dark outline kept)
const blues = pal.map((c, i) => i).filter(i => isBlue[i]).sort((a, b) => (pal[a][0] + pal[a][1] + pal[a][2]) - (pal[b][0] + pal[b][1] + pal[b][2]));
const lightnessRank = i => (pal[i][0] + pal[i][1] + pal[i][2]);
function toWaterIdx(i) {
  if (isGrass[i] || isBlue[i]) return i;
  if (lightnessRank(i) < 150) return i; // keep dark outline
  // map dirt-fill -> nearest blue by lightness
  let best = blues[0], bd = 1e9; for (const b of blues) { const d = Math.abs(lightnessRank(b) - lightnessRank(i)); if (d < bd) { bd = d; best = b; } } return best;
}
const recolor = g => g.map(row => row.map(toWaterIdx));
for (const o of ['n', 'e', 's', 'w', 'out_nw', 'out_ne', 'out_se', 'out_sw', 'in_nw', 'in_ne', 'in_se', 'in_sw']) {
  put('water_' + o, recolor(tiles['path_' + o].grid));
}

// validate
let fails = 0;
for (const [k, t] of Object.entries(tiles)) { if (t.rows.length !== TS) { console.log('FAIL rows', k); fails++; } t.rows.forEach(r => { if (r.length !== TS) { console.log('FAIL len', k); fails++; } }); }
console.log('synthesized ' + Object.keys(tiles).length + ' tiles, validation ' + (fails ? 'FAILED ' + fails : 'PASS'));
console.log('master orientations after canon: N=' + classify(mN) + ' OUT=' + classify(mO) + ' IN=' + classify(mI));

// write tileset
const tsPal = pal.map(([r, g, b]) => '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join(''));
fs.writeFileSync('assets/tilesets/violet_transitions_synth.tileset.json', JSON.stringify({ name: 'violet_transitions_synth', _note: 'SYNTHESIZED: AI dirt masters (N+outer+inner) rotated to full 12-set; water = recoloured dirt set. Locked palette. Review only.', tilesize: TS, palette: tsPal, tiles: Object.fromEntries(Object.entries(tiles).map(([k, t]) => [k, { solid: k.startsWith('water'), rows: t.rows }])) }, null, 1));

// draw + contact sheet
const draw = (img, t, cx, cy, Z) => { for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) { const c = pal[KEYS.indexOf(t.rows[y][x])]; for (let zy = 0; zy < Z; zy++) for (let zx = 0; zx < Z; zx++) { const di = ((cy + y * Z + zy) * img.width + (cx + x * Z + zx)) * 4; img.data[di] = c[0]; img.data[di + 1] = c[1]; img.data[di + 2] = c[2]; img.data[di + 3] = 255; } } };
const EXP = ['n', 'e', 's', 'w', 'out_nw', 'out_ne', 'out_sw', 'out_se', 'in_nw', 'in_ne', 'in_sw', 'in_se'];
{ const Z = 8, PAD = 6, CELL = TS * Z + PAD, COLS = 13;
  const rows = [['path', ...EXP.map(o => 'path_' + o)], ['water', ...EXP.map(o => 'water_' + o)]];
  const cs = new PNG({ width: COLS * CELL + PAD, height: rows.length * CELL + PAD });
  for (let i = 0; i < cs.data.length; i += 4) { cs.data[i] = 26; cs.data[i + 1] = 29; cs.data[i + 2] = 36; cs.data[i + 3] = 255; }
  rows.forEach((rw, ri) => rw.forEach((k, ci) => { if (tiles[k]) draw(cs, tiles[k], PAD + ci * CELL, PAD + ri * CELL, Z); }));
  fs.writeFileSync('docs/art-reference/violet-synth.ingested.png', PNG.sync.write(cs)); }

// autotile seam test (same plus shapes)
function autokey(mask, x, y, w, h, p) { if (!mask[y][x]) return null; const g = (xx, yy) => !(xx >= 0 && yy >= 0 && xx < w && yy < h && mask[yy][xx]); const gN = g(x, y - 1), gS = g(x, y + 1), gE = g(x + 1, y), gW = g(x - 1, y), gNW = g(x - 1, y - 1), gNE = g(x + 1, y - 1), gSW = g(x - 1, y + 1), gSE = g(x + 1, y + 1); const orth = [gN, gE, gS, gW].filter(Boolean).length; if (orth >= 3) return p; if (orth === 2) { if (gN && gW) return p + '_out_nw'; if (gN && gE) return p + '_out_ne'; if (gS && gW) return p + '_out_sw'; if (gS && gE) return p + '_out_se'; return p; } if (orth === 1) return p + '_' + (gN ? 'n' : gE ? 'e' : gS ? 's' : 'w'); if (gNW) return p + '_in_nw'; if (gNE) return p + '_in_ne'; if (gSW) return p + '_in_sw'; if (gSE) return p + '_in_se'; return p; }
const SW = 30, SH = 18, Z = 6;
const scene = Array.from({ length: SH }, () => Array(SW).fill('grass'));
const plus = (m, cx) => { for (let y = 2; y <= 15; y++) for (let x = cx - 1; x <= cx + 1; x++) m[y][x] = true; for (let y = 7; y <= 9; y++) for (let x = cx - 5; x <= cx + 5; x++) m[y][x] = true; };
const dm = Array.from({ length: SH }, () => Array(SW).fill(false)); plus(dm, 7);
const wm = Array.from({ length: SH }, () => Array(SW).fill(false)); plus(wm, 22);
for (let y = 0; y < SH; y++) for (let x = 0; x < SW; x++) { const dk = autokey(dm, x, y, SW, SH, 'path'); if (dk) scene[y][x] = dk; const wk = autokey(wm, x, y, SW, SH, 'water'); if (wk) scene[y][x] = wk; }
const img = new PNG({ width: SW * TS * Z, height: SH * TS * Z });
let seams = 0;
for (let cy = 0; cy < SH; cy++) for (let cx = 0; cx < SW; cx++) { const k = scene[cy][cx]; let t = tiles[k]; if (!t) { t = tiles[k.startsWith('water') ? 'water' : k.startsWith('path') ? 'path' : 'grass']; if (k !== 'grass') seams++; } for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) { const c = pal[KEYS.indexOf(t.rows[y][x])]; for (let zy = 0; zy < Z; zy++) for (let zx = 0; zx < Z; zx++) { const di = (((cy * TS + y) * Z + zy) * img.width + ((cx * TS + x) * Z + zx)) * 4; img.data[di] = c[0]; img.data[di + 1] = c[1]; img.data[di + 2] = c[2]; img.data[di + 3] = 255; } } }
fs.writeFileSync('docs/art-reference/violet-synth.seamtest.png', PNG.sync.write(img));
console.log('seam-test: ' + seams + ' fallback cells (0 = every autotile slot filled).');
console.log('wrote violet-synth.ingested.png, violet-synth.seamtest.png, violet_transitions_synth.tileset.json');
