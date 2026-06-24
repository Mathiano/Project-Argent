// Ingest the 3 ChatGPT terrain masters (grass / dirt / grass-dirt N edge),
// downscale each whole image to 16x16, re-quantize to the LOCKED palette
// (extending only where the new art genuinely needs colours, ≤36 cap), then
// synthesize the full 13-tile blob set per material (rotate edge -> cardinals;
// derive outer=union / inner=intersect of N+W grass over the dirt base; recolour
// dirt -> water). Seam-test + contact sheet. Review only (swap is a later step).
import { PNG } from 'pngjs';
import fs from 'fs';
const KEYS = '0123456789abcdefghijklmnopqrstuvwxyz';
const TS = 16;

// ---- locked palette
const palJson = JSON.parse(fs.readFileSync('assets/palettes/argent-master.palette.json'));
let pal = palJson.colors.map(c => [parseInt(c.hex.slice(1, 3), 16), parseInt(c.hex.slice(3, 5), 16), parseInt(c.hex.slice(5, 7), 16)]);
const d2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;

// ---- downscale a whole master to 16x16 cell-averages (flat = no shimmer)
function poolAvg(file) {
  const p = PNG.sync.read(fs.readFileSync(`docs/art-reference/${file}.png`));
  const { width: W, height: H, data: D } = p;
  const out = [];
  for (let gy = 0; gy < TS; gy++) {
    const row = [];
    for (let gx = 0; gx < TS; gx++) {
      let r = 0, g = 0, b = 0, n = 0;
      for (let sy = Math.floor(gy * H / TS); sy < Math.floor((gy + 1) * H / TS); sy++)
        for (let sx = Math.floor(gx * W / TS); sx < Math.floor((gx + 1) * W / TS); sx++) {
          const i = (sy * W + sx) * 4; r += D[i]; g += D[i + 1]; b += D[i + 2]; n++;
        }
      row.push([Math.round(r / n), Math.round(g / n), Math.round(b / n)]);
    }
    out.push(row);
  }
  return out;
}
const grassA = poolAvg('master-grass');
const dirtA = poolAvg('master-dirt');
const edgeA = poolAvg('master-edge-grass-dirt');

// ---- extend palette where the new art is poorly represented
function medianCut(pts, n) {
  let boxes = [pts.slice()];
  while (boxes.length < n) {
    let bi = -1, br = -1;
    boxes.forEach((bx, i) => { if (bx.length < 2) return; let r = 0; for (let c = 0; c < 3; c++) { let mn = 1e9, mx = -1e9; for (const p of bx) { mn = Math.min(mn, p[c]); mx = Math.max(mx, p[c]); } r = Math.max(r, mx - mn); } if (r > br) { br = r; bi = i; } });
    if (bi < 0) break;
    const bx = boxes[bi]; let ch = 0, best = -1; for (let c = 0; c < 3; c++) { let mn = 1e9, mx = -1e9; for (const p of bx) { mn = Math.min(mn, p[c]); mx = Math.max(mx, p[c]); } if (mx - mn > best) { best = mx - mn; ch = c; } }
    bx.sort((a, b) => a[ch] - b[ch]); const m = bx.length >> 1; boxes.splice(bi, 1, bx.slice(0, m), bx.slice(m));
  }
  return boxes.filter(b => b.length).map(bx => { const s = [0, 0, 0]; for (const p of bx) { s[0] += p[0]; s[1] += p[1]; s[2] += p[2]; } return s.map(v => Math.round(v / bx.length)); });
}
const samples = [grassA, dirtA, edgeA].flatMap(t => t.flat());
const FIT = 18; // a candidate within this distance of a palette colour is "covered"
const residual = samples.filter(c => Math.sqrt(Math.min(...pal.map(p => d2(c, p)))) > FIT);
let added = [];
if (residual.length) {
  const room = 36 - pal.length;
  added = medianCut(residual, Math.min(room, 8)); // a few new colours, never over cap
  pal = pal.concat(added);
}
const nearest = (c) => { let bi = 0, bd = 1e18; for (let i = 0; i < pal.length; i++) { const d = d2(c, pal[i]); if (d < bd) { bd = d; bi = i; } } return bi; };
// Final tile = MODE of per-pixel quantized colours per cell (keeps tufts/pebbles
// as subtle variation rather than averaging them to a dead-flat colour).
function poolMode(file) {
  const p = PNG.sync.read(fs.readFileSync(`docs/art-reference/${file}.png`));
  const { width: W, height: H, data: Dt } = p;
  const out = [];
  for (let gy = 0; gy < TS; gy++) {
    const row = [];
    for (let gx = 0; gx < TS; gx++) {
      const cnt = new Map();
      for (let sy = Math.floor(gy * H / TS); sy < Math.floor((gy + 1) * H / TS); sy++)
        for (let sx = Math.floor(gx * W / TS); sx < Math.floor((gx + 1) * W / TS); sx++) {
          const i = (sy * W + sx) * 4; const k = nearest([Dt[i], Dt[i + 1], Dt[i + 2]]); cnt.set(k, (cnt.get(k) || 0) + 1);
        }
      let bk = 0, bc = -1; for (const [k, v] of cnt) { if (v > bc) { bc = v; bk = k; } } row.push(bk);
    }
    out.push(row);
  }
  return out;
}
const grass = poolMode('master-grass'), dirt = poolMode('master-dirt'), edge = poolMode('master-edge-grass-dirt');

// ---- groups for classify / recolour
const isGrass = pal.map(([r, g, b]) => g >= r && g > b + 4 && g > 70 && !(b > r && b > g));
const isBlue = pal.map(([r, g, b]) => b > r && b > g);
const cg = (t, r0, c0) => { let g = 0, n = 0; for (let y = r0; y < r0 + 4; y++) for (let x = c0; x < c0 + 4; x++) { n++; if (isGrass[t[y][x]]) g++; } return g / n; };
function classify(t) { const nw = cg(t, 0, 0) > .5, ne = cg(t, 0, 12) > .5, sw = cg(t, 12, 0) > .5, se = cg(t, 12, 12) > .5; const n = [nw, ne, sw, se].filter(Boolean).length; if (n === 0) return 'base'; if (n === 1) return nw ? 'in_nw' : ne ? 'in_ne' : sw ? 'in_sw' : 'in_se'; if (n === 2) { if (nw && ne) return 'n'; if (sw && se) return 's'; if (ne && se) return 'e'; if (nw && sw) return 'w'; return '?'; } if (n === 4) return 'allgrass'; if (!se) return 'out_nw'; if (!sw) return 'out_ne'; if (!ne) return 'out_sw'; return 'out_se'; }
const rot90 = t => t.map((_, y) => t.map((__, x) => t[TS - 1 - x][y]));
const r1 = rot90, r2 = t => rot90(rot90(t)), r3 = t => rot90(rot90(rot90(t)));
function canon(t, target) { let r = t; for (let i = 0; i < 4; i++) { if (classify(r) === target) return r; r = rot90(r); } return t; }

// ---- synthesize
const mN = canon(edge, 'n');
const mW = r3(mN);
const composeU = (A, B, base) => A.map((row, y) => row.map((_, x) => isGrass[A[y][x]] ? A[y][x] : isGrass[B[y][x]] ? B[y][x] : base[y][x]));
const composeI = (A, B, base) => A.map((row, y) => row.map((_, x) => (isGrass[A[y][x]] && isGrass[B[y][x]]) ? A[y][x] : base[y][x]));
const mO = composeU(mN, mW, dirt), mI = composeI(mN, mW, dirt);
const tiles = {};
const put = (k, t, solid) => { tiles[k] = { rows: t.map(r => r.map(i => KEYS[i]).join('')), grid: t, solid }; };
put('grass', grass, false); put('path', dirt, false); put('water', /*placeholder*/ dirt, true);
put('path_n', mN, false); put('path_e', r1(mN), false); put('path_s', r2(mN), false); put('path_w', r3(mN), false);
put('path_out_nw', mO, false); put('path_out_ne', r1(mO), false); put('path_out_se', r2(mO), false); put('path_out_sw', r3(mO), false);
put('path_in_nw', mI, false); put('path_in_ne', r1(mI), false); put('path_in_se', r2(mI), false); put('path_in_sw', r3(mI), false);
// water = recolour the dirt set (grass kept; dirt-fill -> blue by lightness; dark kept)
const blues = pal.map((c, i) => i).filter(i => isBlue[i]).sort((a, b) => (pal[a][0] + pal[a][1] + pal[a][2]) - (pal[b][0] + pal[b][1] + pal[b][2]));
const L = i => pal[i][0] + pal[i][1] + pal[i][2];
const toWater = i => { if (isGrass[i] || isBlue[i]) return i; if (L(i) < 150) return i; let best = blues[0], bd = 1e9; for (const b of blues) { const d = Math.abs(L(b) - L(i)); if (d < bd) { bd = d; best = b; } } return best; };
const recolor = g => g.map(row => row.map(toWater));
put('water', recolor(dirt), true);
for (const o of ['n', 'e', 's', 'w', 'out_nw', 'out_ne', 'out_se', 'out_sw', 'in_nw', 'in_ne', 'in_se', 'in_sw']) put('water_' + o, recolor(tiles['path_' + o].grid), true);

// ---- validate + flat-edge check (each column of path_n should be grass-top/dirt-bottom at a consistent boundary row)
let fails = 0;
for (const [k, t] of Object.entries(tiles)) { if (t.rows.length !== TS) { fails++; console.log('FAIL', k); } t.rows.forEach(r => { if (r.length !== TS) { fails++; console.log('FAIL len', k); } }); }
const nGrid = tiles['path_n'].grid;
const boundaryRow = x => { for (let y = 0; y < TS; y++) if (!isGrass[nGrid[y][x]]) return y; return TS; };
const brs = Array.from({ length: TS }, (_, x) => boundaryRow(x));
const flatSpread = Math.max(...brs) - Math.min(...brs);
console.log('palette: ' + (palJson.colors.length) + ' -> ' + pal.length + (added.length ? ' (+' + added.length + ' for the new art)' : ' (no extension needed)'));
console.log('master orientations: N=' + classify(mN) + ' OUT=' + classify(mO) + ' IN=' + classify(mI));
console.log('flat-edge check: path_n grass/dirt boundary row per column = [' + brs.join(',') + '] spread=' + flatSpread + (flatSpread <= 1 ? ' FLAT' : ' WAVY'));
console.log('validation: ' + (fails ? 'FAILED ' + fails : 'PASS') + ' (' + Object.keys(tiles).length + ' tiles)');

// ---- write synth tileset (carries the extended palette). The canonical
// argent-master.palette.json stays FROZEN at its committed colours so this
// script is deterministic on re-run (always extends from the frozen base);
// promoting the extension to canonical is a deliberate later step.
const tsPal = pal.map(c => '#' + c.map(v => v.toString(16).padStart(2, '0')).join(''));
fs.writeFileSync('assets/tilesets/violet_terrain_v2.tileset.json', JSON.stringify({ name: 'violet_terrain_v2', _note: 'SYNTHESIZED from the 3 ChatGPT masters (grass/dirt/N-edge), locked palette. Review only.', tilesize: TS, palette: tsPal, tiles: Object.fromEntries(Object.entries(tiles).map(([k, t]) => [k, { solid: t.solid, rows: t.rows }])) }, null, 1));

// ---- contact sheet + seam test
const draw = (img, t, cx, cy, Z) => { for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) { const c = pal[KEYS.indexOf(t.rows[y][x])]; for (let zy = 0; zy < Z; zy++) for (let zx = 0; zx < Z; zx++) { const di = ((cy + y * Z + zy) * img.width + (cx + x * Z + zx)) * 4; img.data[di] = c[0]; img.data[di + 1] = c[1]; img.data[di + 2] = c[2]; img.data[di + 3] = 255; } } };
const EXP = ['n', 'e', 's', 'w', 'out_nw', 'out_ne', 'out_sw', 'out_se', 'in_nw', 'in_ne', 'in_sw', 'in_se'];
{ const Z = 8, PAD = 6, CELL = TS * Z + PAD, COLS = 13;
  const rows = [['path', ...EXP.map(o => 'path_' + o)], ['water', ...EXP.map(o => 'water_' + o)]];
  const cs = new PNG({ width: COLS * CELL + PAD, height: rows.length * CELL + PAD });
  for (let i = 0; i < cs.data.length; i += 4) { cs.data[i] = 26; cs.data[i + 1] = 29; cs.data[i + 2] = 36; cs.data[i + 3] = 255; }
  rows.forEach((rw, ri) => rw.forEach((k, ci) => { if (tiles[k]) draw(cs, tiles[k], PAD + ci * CELL, PAD + ri * CELL, Z); }));
  fs.writeFileSync('docs/art-reference/violet-master.ingested.png', PNG.sync.write(cs)); }

function autokey(mask, x, y, w, h, p) { if (!mask[y][x]) return null; const g = (xx, yy) => !(xx >= 0 && yy >= 0 && xx < w && yy < h && mask[yy][xx]); const gN = g(x, y - 1), gS = g(x, y + 1), gE = g(x + 1, y), gW = g(x - 1, y); const orth = [gN, gE, gS, gW].filter(Boolean).length; if (orth >= 3) return p; if (orth === 2) { if (gN && gW) return p + '_out_nw'; if (gN && gE) return p + '_out_ne'; if (gS && gW) return p + '_out_sw'; if (gS && gE) return p + '_out_se'; return p; } if (orth === 1) return p + '_' + (gN ? 'n' : gE ? 'e' : gS ? 's' : 'w'); if (g(x - 1, y - 1)) return p + '_in_nw'; if (g(x + 1, y - 1)) return p + '_in_ne'; if (g(x - 1, y + 1)) return p + '_in_sw'; if (g(x + 1, y + 1)) return p + '_in_se'; return p; }
const SW = 30, SH = 18, Z = 3;
const scene = Array.from({ length: SH }, () => Array(SW).fill('grass'));
const plus = (m, cx) => { for (let y = 2; y <= 15; y++) for (let x = cx - 1; x <= cx + 1; x++) m[y][x] = true; for (let y = 7; y <= 9; y++) for (let x = cx - 5; x <= cx + 5; x++) m[y][x] = true; };
// also a wide rectangle to show long FLAT straight runs (the shimmer test)
const rect = (m, x0, y0, x1, y1) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) m[y][x] = true; };
const dm = Array.from({ length: SH }, () => Array(SW).fill(false)); plus(dm, 6); rect(dm, 11, 12, 27, 15);
const wm = Array.from({ length: SH }, () => Array(SW).fill(false)); plus(wm, 22); rect(wm, 1, 12, 7, 15);
for (let y = 0; y < SH; y++) for (let x = 0; x < SW; x++) { const dk = autokey(dm, x, y, SW, SH, 'path'); if (dk) scene[y][x] = dk; const wk = autokey(wm, x, y, SW, SH, 'water'); if (wk) scene[y][x] = wk; }
const img = new PNG({ width: SW * TS * Z, height: SH * TS * Z });
let seams = 0;
for (let cy = 0; cy < SH; cy++) for (let cx = 0; cx < SW; cx++) { const k = scene[cy][cx]; let t = tiles[k]; if (!t) { t = tiles[k.startsWith('water') ? 'water' : k.startsWith('path') ? 'path' : 'grass']; if (k !== 'grass') seams++; } for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) { const c = pal[KEYS.indexOf(t.rows[y][x])]; for (let zy = 0; zy < Z; zy++) for (let zx = 0; zx < Z; zx++) { const di = (((cy * TS + y) * Z + zy) * img.width + ((cx * TS + x) * Z + zx)) * 4; img.data[di] = c[0]; img.data[di + 1] = c[1]; img.data[di + 2] = c[2]; img.data[di + 3] = 255; } } }
fs.writeFileSync('docs/art-reference/violet-master.seamtest.png', PNG.sync.write(img));
console.log('seam-test: ' + seams + ' fallback cells. wrote violet-master.{ingested,seamtest}.png + violet_terrain_v2.tileset.json');
