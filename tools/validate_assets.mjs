// Asset validator (art lint) — enforces docs/art-reference/tileset_rules.md
// Rules 1 (<=4 colours/tile) + 2 (hard-indexed: no AA / no near-dup gradients /
// no partial alpha) on .tileset.json files and .png sheets (16x16 cell grid).
// Rules 3-4 (projection, non-directional) are human review. Node twin of
// validate_assets.py — Python isn't runnable in CC's sandbox. Exits non-zero on
// any violation so it can gate a batch. NOT part of `npm test`.
//
// Usage: node tools/validate_assets.mjs <path...> [--tile=16]
import { PNG } from 'pngjs';
import fs from 'fs';

const KEYS = '0123456789abcdefghijklmnopqrstuvwxyz';
const COLOR_CEIL = 4;
const NEAR_DIST = 14; // colours closer than this read as a gradient/AA ramp
const args = process.argv.slice(2);
const tileArg = args.find((a) => a.startsWith('--tile='));
const TS = tileArg ? Number(tileArg.split('=')[1]) : 16;
const paths = args.filter((a) => !a.startsWith('--'));
if (paths.length === 0) { console.error('usage: node tools/validate_assets.mjs <path...> [--tile=16]'); process.exit(2); }

const hex = ([r, g, b]) => '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
const d2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
const h2 = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

// Evaluate one cell's colour set. The user-specced WARNINGS (hard, gate the exit
// code) are exactly: colour ceiling + soft AA edges. Missing #000000 outline is
// surfaced as an advisory note (per Rule 1's budget) but doesn't fail the lint.
// `isPng` enables AA checks (partial alpha + very-near-dup ramp); indexed JSON
// tiles can't anti-alias, so only the ceiling applies there.
function evalCell(colorsHex, partialAlpha, isPng) {
  const uniq = [...new Set(colorsHex)];
  const rgb = uniq.map(h2);
  const hard = [];
  const notes = [];
  if (uniq.length > COLOR_CEIL) hard.push(`${uniq.length} colours (>${COLOR_CEIL})`);
  if (isPng) {
    if (partialAlpha > 0) hard.push(`${partialAlpha} partial-alpha px — soft AA edges`);
    let nearPairs = 0;
    for (let i = 0; i < rgb.length; i++) for (let j = i + 1; j < rgb.length; j++) if (d2(rgb[i], rgb[j]) < NEAR_DIST * NEAR_DIST) nearPairs++;
    if (nearPairs > 0) hard.push(`${nearPairs} near-duplicate colour pair(s) — gradient/AA`);
  }
  if (uniq.length > 0 && !uniq.includes('#000000')) notes.push('no #000000 outline');
  return { hard, notes, n: uniq.length };
}

const chunk = (s, n) => s.match(new RegExp(`.{1,${n}}`, 'g')) ?? [];

function validateTilesetJson(file) {
  const ts = JSON.parse(fs.readFileSync(file));
  const fails = [];
  let notes = 0;
  for (const [id, t] of Object.entries(ts.tiles)) {
    const rows = t.rows ?? (t.pixels ? chunk(t.pixels, ts.tilesize) : []);
    const colors = [];
    for (const row of rows) for (const ch of row) {
      if (ch === '.' || ch === ' ') continue;
      const idx = KEYS.indexOf(ch);
      if (idx < 0 || idx >= ts.palette.length) continue;
      colors.push(ts.palette[idx].toLowerCase());
    }
    const r = evalCell(colors, 0, false);
    if (r.hard.length) fails.push({ id, violations: r.hard });
    else if (r.notes.length) notes++;
  }
  return { kind: 'tileset', total: Object.keys(ts.tiles).length, fails, notes };
}

function validatePng(file) {
  const png = PNG.sync.read(fs.readFileSync(file));
  const { width: W, height: H, data: D } = png;
  const fails = [];
  let notes = 0;
  let total = 0;
  for (let cy = 0; cy + TS <= H; cy += TS) {
    for (let cx = 0; cx + TS <= W; cx += TS) {
      total++;
      const colors = [];
      let partial = 0;
      for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) {
        const i = ((cy + y) * W + (cx + x)) * 4;
        const a = D[i + 3];
        if (a < 8) continue; // transparent
        if (a < 248) { partial++; continue; }
        colors.push(hex([D[i], D[i + 1], D[i + 2]]));
      }
      const r = evalCell(colors, partial, true);
      if (r.hard.length) fails.push({ id: `cell(${cx / TS},${cy / TS})`, violations: r.hard });
      else if (r.notes.length) notes++;
    }
  }
  return { kind: 'png', total, fails, notes };
}

let anyFail = false;
for (const p of paths) {
  if (!fs.existsSync(p)) { console.log(`SKIP (missing): ${p}`); continue; }
  const res = p.endsWith('.json') ? validateTilesetJson(p) : validatePng(p);
  const unit = res.kind === 'png' ? 'cells' : 'tiles';
  console.log(`\n=== ${p}  (${res.kind}, ${res.total} ${unit}) ===`);
  const noteStr = res.notes ? `  [${res.notes} clean but no #000000 outline — advisory]` : '';
  if (res.fails.length === 0) { console.log('  ✓ all pass' + noteStr); continue; }
  anyFail = true;
  for (const f of res.fails) console.log(`  ✗ ${f.id}: ${f.violations.join('; ')}`);
  console.log(`  → ${res.fails.length}/${res.total} ${unit} VIOLATE Rule 1/2, ${res.total - res.fails.length} clean${noteStr}`);
}
console.log(anyFail ? '\nVALIDATION: violations found (art lint — see tileset_rules.md)' : '\nVALIDATION: all assets pass');
process.exit(anyFail ? 1 : 0);
