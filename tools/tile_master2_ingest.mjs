// Ingest 2 native-16 base masters (rendered as large pixel blocks): offset-
// downscale = center-sample each 16x16 block -> one tile pixel (no averaging),
// quantize to the locked palette. Code-composite a FLAT grass->dirt N-edge from
// the two bases (grass top rows, blade fringe at a fixed row, dirt below), then
// run the proven synthesis (rotate -> cardinals; outer=union/inner=intersect of
// N+W grass over the dirt base; recolour dirt -> water). Seam-test + contact.
import { PNG } from 'pngjs';
import fs from 'fs';
const KEYS = '0123456789abcdefghijklmnopqrstuvwxyz';
const TS = 16;
const pal = JSON.parse(fs.readFileSync('assets/palettes/argent-master.palette.json')).colors.map(c => [parseInt(c.hex.slice(1, 3), 16), parseInt(c.hex.slice(3, 5), 16), parseInt(c.hex.slice(5, 7), 16)]);
const d2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
const nearest = c => { let bi = 0, bd = 1e18; for (let i = 0; i < pal.length; i++) { const d = d2(c, pal[i]); if (d < bd) { bd = d; bi = i; } } return bi; };
const isGrass = pal.map(([r, g, b]) => g >= r && g > b + 4 && g > 70 && !(b > r && b > g));
const isBlue = pal.map(([r, g, b]) => b > r && b > g);

// offset-downscale: sample the CENTRE of each block (no blur), then quantize
function sampleQuant(file) {
  const p = PNG.sync.read(fs.readFileSync(`docs/art-reference/${file}.png`));
  const { width: W, height: H, data: D } = p;
  let maxErr = 0;
  const out = [];
  for (let gy = 0; gy < TS; gy++) {
    const row = [];
    for (let gx = 0; gx < TS; gx++) {
      const sx = Math.floor((gx + 0.5) * W / TS), sy = Math.floor((gy + 0.5) * H / TS);
      const i = (sy * W + sx) * 4; const c = [D[i], D[i + 1], D[i + 2]];
      const k = nearest(c); maxErr = Math.max(maxErr, Math.sqrt(d2(c, pal[k]))); row.push(k);
    }
    out.push(row);
  }
  return { grid: out, maxErr };
}
const g = sampleQuant('master-grass'), d = sampleQuant('master-dirt');
const grass = g.grid, dirt = d.grid;
console.log('quantize max-error vs locked palette: grass=' + g.maxErr.toFixed(1) + ' dirt=' + d.maxErr.toFixed(1) + (Math.max(g.maxErr, d.maxErr) > 40 ? '  (HIGH — consider extending)' : '  (well covered)'));

// composite a FLAT grass->dirt N edge: grass rows 0..BR-1, a blade fringe at
// row BR (grass tufts dip 1px into dirt at fixed columns -> softens the cut but
// stays flat/seamless because the pattern is identical every tile), dirt below.
const BR = 6;
const edge = [];
for (let y = 0; y < TS; y++) {
  const row = [];
  for (let x = 0; x < TS; x++) {
    if (y < BR) row.push(grass[y][x]);
    else if (y === BR) row.push((x % 3 === 1) ? grass[BR - 1][x] : dirt[y][x]); // blade tufts
    else row.push(dirt[y][x]);
  }
  edge.push(row);
}

// ---- synthesis (proven)
const rot90 = t => t.map((_, y) => t.map((__, x) => t[TS - 1 - x][y]));
const r1 = rot90, r2 = t => rot90(rot90(t)), r3 = t => rot90(rot90(rot90(t)));
const cg = (t, r0, c0) => { let gr = 0, n = 0; for (let y = r0; y < r0 + 4; y++) for (let x = c0; x < c0 + 4; x++) { n++; if (isGrass[t[y][x]]) gr++; } return gr / n; };
function classify(t) { const nw = cg(t, 0, 0) > .5, ne = cg(t, 0, 12) > .5, sw = cg(t, 12, 0) > .5, se = cg(t, 12, 12) > .5; const n = [nw, ne, sw, se].filter(Boolean).length; if (n === 0) return 'base'; if (n === 1) return nw ? 'in_nw' : ne ? 'in_ne' : sw ? 'in_sw' : 'in_se'; if (n === 2) { if (nw && ne) return 'n'; if (sw && se) return 's'; if (ne && se) return 'e'; if (nw && sw) return 'w'; return '?'; } if (n === 4) return 'allgrass'; if (!se) return 'out_nw'; if (!sw) return 'out_ne'; if (!ne) return 'out_sw'; return 'out_se'; }
const composeU = (A, B, base) => A.map((row, y) => row.map((_, x) => isGrass[A[y][x]] ? A[y][x] : isGrass[B[y][x]] ? B[y][x] : base[y][x]));
const composeI = (A, B, base) => A.map((row, y) => row.map((_, x) => (isGrass[A[y][x]] && isGrass[B[y][x]]) ? A[y][x] : base[y][x]));
const mN = edge, mW = r3(edge), mO = composeU(mN, mW, dirt), mI = composeI(mN, mW, dirt);
const tiles = {};
const put = (k, t, solid) => { tiles[k] = { rows: t.map(r => r.map(i => KEYS[i]).join('')), grid: t, solid }; };
put('grass', grass, false); put('path', dirt, false);
put('path_n', mN, false); put('path_e', r1(mN), false); put('path_s', r2(mN), false); put('path_w', r3(mN), false);
put('path_out_nw', mO, false); put('path_out_ne', r1(mO), false); put('path_out_se', r2(mO), false); put('path_out_sw', r3(mO), false);
put('path_in_nw', mI, false); put('path_in_ne', r1(mI), false); put('path_in_se', r2(mI), false); put('path_in_sw', r3(mI), false);
const blues = pal.map((c, i) => i).filter(i => isBlue[i]).sort((a, b) => (pal[a][0] + pal[a][1] + pal[a][2]) - (pal[b][0] + pal[b][1] + pal[b][2]));
const L = i => pal[i][0] + pal[i][1] + pal[i][2];
const toWater = i => { if (isGrass[i] || isBlue[i]) return i; if (L(i) < 150) return i; let best = blues[0], bd = 1e9; for (const b of blues) { const dd = Math.abs(L(b) - L(i)); if (dd < bd) { bd = dd; best = b; } } return best; };
const recolor = gr => gr.map(row => row.map(toWater));
put('water', recolor(dirt), true);
for (const o of ['n', 'e', 's', 'w', 'out_nw', 'out_ne', 'out_se', 'out_sw', 'in_nw', 'in_ne', 'in_se', 'in_sw']) put('water_' + o, recolor(tiles['path_' + o].grid), true);

// validate + flat check
let fails = 0;
for (const [k, t] of Object.entries(tiles)) { if (t.rows.length !== TS) { fails++; } t.rows.forEach(r => { if (r.length !== TS) fails++; }); }
const brs = Array.from({ length: TS }, (_, x) => { for (let y = 0; y < TS; y++) if (!isGrass[mN[y][x]]) return y; return TS; });
console.log('master orientations: N=' + classify(mN) + ' OUT=' + classify(mO) + ' IN=' + classify(mI));
console.log('flat-edge boundary rows: [' + brs.join(',') + '] spread=' + (Math.max(...brs) - Math.min(...brs)));
console.log('validation: ' + (fails ? 'FAILED ' + fails : 'PASS') + ' (' + Object.keys(tiles).length + ' tiles)');

// write synth set (the swap script reads violet_terrain_v2)
const tsPal = pal.map(c => '#' + c.map(v => v.toString(16).padStart(2, '0')).join(''));
fs.writeFileSync('assets/tilesets/violet_terrain_v2.tileset.json', JSON.stringify({ name: 'violet_terrain_v2', _note: 'SYNTHESIZED from 2 native-16 masters (grass/dirt) + code-composited flat N-edge, locked palette. Review only.', tilesize: TS, palette: tsPal, tiles: Object.fromEntries(Object.entries(tiles).map(([k, t]) => [k, { solid: t.solid, rows: t.rows }])) }, null, 1));

// contact + seam test
const draw = (img, t, cx, cy, Z) => { for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) { const c = pal[KEYS.indexOf(t.rows[y][x])]; for (let zy = 0; zy < Z; zy++) for (let zx = 0; zx < Z; zx++) { const di = ((cy + y * Z + zy) * img.width + (cx + x * Z + zx)) * 4; img.data[di] = c[0]; img.data[di + 1] = c[1]; img.data[di + 2] = c[2]; img.data[di + 3] = 255; } } };
const EXP = ['n', 'e', 's', 'w', 'out_nw', 'out_ne', 'out_sw', 'out_se', 'in_nw', 'in_ne', 'in_sw', 'in_se'];
{ const Z = 8, PAD = 6, CELL = TS * Z + PAD, COLS = 13;
  const rows = [['path', ...EXP.map(o => 'path_' + o)], ['water', ...EXP.map(o => 'water_' + o)]];
  const cs = new PNG({ width: COLS * CELL + PAD, height: rows.length * CELL + PAD });
  for (let i = 0; i < cs.data.length; i += 4) { cs.data[i] = 26; cs.data[i + 1] = 29; cs.data[i + 2] = 36; cs.data[i + 3] = 255; }
  rows.forEach((rw, ri) => rw.forEach((k, ci) => { if (tiles[k]) draw(cs, tiles[k], PAD + ci * CELL, PAD + ri * CELL, Z); }));
  fs.writeFileSync('docs/art-reference/violet-master2.ingested.png', PNG.sync.write(cs)); }
function autokey(mask, x, y, w, h, p) { if (!mask[y][x]) return null; const gg = (xx, yy) => !(xx >= 0 && yy >= 0 && xx < w && yy < h && mask[yy][xx]); const gN = gg(x, y - 1), gS = gg(x, y + 1), gE = gg(x + 1, y), gW = gg(x - 1, y); const orth = [gN, gE, gS, gW].filter(Boolean).length; if (orth >= 3) return p; if (orth === 2) { if (gN && gW) return p + '_out_nw'; if (gN && gE) return p + '_out_ne'; if (gS && gW) return p + '_out_sw'; if (gS && gE) return p + '_out_se'; return p; } if (orth === 1) return p + '_' + (gN ? 'n' : gE ? 'e' : gS ? 's' : 'w'); if (gg(x - 1, y - 1)) return p + '_in_nw'; if (gg(x + 1, y - 1)) return p + '_in_ne'; if (gg(x - 1, y + 1)) return p + '_in_sw'; if (gg(x + 1, y + 1)) return p + '_in_se'; return p; }
const SW = 30, SH = 18, Z = 3;
const scene = Array.from({ length: SH }, () => Array(SW).fill('grass'));
const plus = (m, cx) => { for (let y = 2; y <= 15; y++) for (let x = cx - 1; x <= cx + 1; x++) m[y][x] = true; for (let y = 7; y <= 9; y++) for (let x = cx - 5; x <= cx + 5; x++) m[y][x] = true; };
const rect = (m, x0, y0, x1, y1) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) m[y][x] = true; };
const dm = Array.from({ length: SH }, () => Array(SW).fill(false)); plus(dm, 6); rect(dm, 11, 12, 27, 15);
const wm = Array.from({ length: SH }, () => Array(SW).fill(false)); plus(wm, 22); rect(wm, 1, 12, 7, 15);
for (let y = 0; y < SH; y++) for (let x = 0; x < SW; x++) { const dk = autokey(dm, x, y, SW, SH, 'path'); if (dk) scene[y][x] = dk; const wk = autokey(wm, x, y, SW, SH, 'water'); if (wk) scene[y][x] = wk; }
const img = new PNG({ width: SW * TS * Z, height: SH * TS * Z });
let seams = 0;
for (let cy = 0; cy < SH; cy++) for (let cx = 0; cx < SW; cx++) { const k = scene[cy][cx]; let t = tiles[k]; if (!t) { t = tiles[k.startsWith('water') ? 'water' : k.startsWith('path') ? 'path' : 'grass']; if (k !== 'grass') seams++; } for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) { const c = pal[KEYS.indexOf(t.rows[y][x])]; for (let zy = 0; zy < Z; zy++) for (let zx = 0; zx < Z; zx++) { const di = (((cy * TS + y) * Z + zy) * img.width + ((cx * TS + x) * Z + zx)) * 4; img.data[di] = c[0]; img.data[di + 1] = c[1]; img.data[di + 2] = c[2]; img.data[di + 3] = 255; } } }
fs.writeFileSync('docs/art-reference/violet-master2.seamtest.png', PNG.sync.write(img));
console.log('seam-test: ' + seams + ' fallback cells. wrote violet-master2.{ingested,seamtest}.png + violet_terrain_v2.tileset.json');
