// Asset validator (art lint) — enforces docs/art-reference/tileset_rules.md
// Rules 1 (<=16 colours/tile — the RSE/GBA ceiling) + 2 (hard-indexed: no AA /
// no near-dup gradients / no partial alpha) on .tileset.json files and .png
// sheets (16x16 cell grid). Rules 3-4 (projection, non-directional) are human
// review. Node twin of validate_assets.py — Python isn't runnable in CC's
// sandbox. Exits non-zero on any violation so it can gate a batch. NOT part of
// `npm test`.
//
// Ceiling move (docs/visual-ceiling-rse-2d.md): the per-tile budget went from
// the authentic-GBC <=4 to Ruby/Sapphire's <=16 — canvas/grid/16x16 unchanged.
// Tiles that pass <=16 but exceed the LEGACY <=4 GBC budget are surfaced as a
// NON-FAILING advisory ("hand-rework candidate"), so the art debt of the
// AI-ingested high-colour transitions stays tracked after the ceiling moved.
//
// Usage: node tools/validate_assets.mjs <path...> [--tile=16]
import { PNG } from 'pngjs';
import fs from 'fs';

// Single-char palette keys. Extended 36 -> 62 (0-9a-zA-Z) so the master palette
// can grow toward the ~64 ceiling additively (docs/visual-ceiling-rse-2d.md).
// The existing 0-9a-z mapping is unchanged (additive — no index renumbering).
const KEYS = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
const COLOR_CEIL = 16; // RSE/GBA per-tile ceiling (was 4 — authentic-GBC)
const LEGACY_CEIL = 4; // old GBC budget; >this but <=COLOR_CEIL → rework advisory
const NEAR_DIST = 14; // colours closer than this read as a gradient/AA ramp
const args = process.argv.slice(2);
const tileArg = args.find((a) => a.startsWith('--tile='));
const TS = tileArg ? Number(tileArg.split('=')[1]) : 16;
const paths = args.filter((a) => !a.startsWith('--'));
if (paths.length === 0) { console.error('usage: node tools/validate_assets.mjs <path...> [--tile=16]'); process.exit(2); }

const hex = ([r, g, b]) => '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
const d2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
const h2 = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

// Evaluate one cell's colour set. The WARNINGS (hard, gate the exit code) are:
// the <=16 colour ceiling + soft AA edges. ADVISORIES never fail the lint:
//   - high-colour rework candidate: passes <=16 but is over the legacy <=4 GBC
//     budget (the AI-ingested transition smell — tracked, not auto-resolved).
//   - missing #000000 outline (per Rule 1's budget).
// `isPng` enables AA checks (partial alpha + very-near-dup ramp); indexed JSON
// tiles can't anti-alias, so only the ceiling applies there.
function evalCell(colorsHex, partialAlpha, isPng) {
  const uniq = [...new Set(colorsHex)];
  const rgb = uniq.map(h2);
  const hard = [];
  const advisories = [];
  const notes = [];
  if (uniq.length > COLOR_CEIL) hard.push(`${uniq.length} colours (>${COLOR_CEIL})`);
  else if (uniq.length > LEGACY_CEIL) advisories.push(`high-colour (${uniq.length}) — passes ≤${COLOR_CEIL} but over the legacy ≤${LEGACY_CEIL} GBC budget; hand-rework candidate`);
  if (isPng) {
    if (partialAlpha > 0) hard.push(`${partialAlpha} partial-alpha px — soft AA edges`);
    let nearPairs = 0;
    for (let i = 0; i < rgb.length; i++) for (let j = i + 1; j < rgb.length; j++) if (d2(rgb[i], rgb[j]) < NEAR_DIST * NEAR_DIST) nearPairs++;
    if (nearPairs > 0) hard.push(`${nearPairs} near-duplicate colour pair(s) — gradient/AA`);
  }
  if (uniq.length > 0 && !uniq.includes('#000000')) notes.push('no #000000 outline');
  return { hard, advisories, notes, n: uniq.length };
}

const chunk = (s, n) => s.match(new RegExp(`.{1,${n}}`, 'g')) ?? [];

function validateTilesetJson(file) {
  const ts = JSON.parse(fs.readFileSync(file));
  const fails = [];
  const advisories = [];
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
    if (r.hard.length) { fails.push({ id, violations: r.hard }); continue; }
    if (r.advisories.length) advisories.push({ id, advisories: r.advisories });
    if (r.notes.length) notes++;
  }
  return { kind: 'tileset', total: Object.keys(ts.tiles).length, fails, advisories, notes };
}

function validatePng(file) {
  const png = PNG.sync.read(fs.readFileSync(file));
  const { width: W, height: H, data: D } = png;
  const fails = [];
  const advisories = [];
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
      const id = `cell(${cx / TS},${cy / TS})`;
      if (r.hard.length) { fails.push({ id, violations: r.hard }); continue; }
      if (r.advisories.length) advisories.push({ id, advisories: r.advisories });
      if (r.notes.length) notes++;
    }
  }
  return { kind: 'png', total, fails, advisories, notes };
}

let anyFail = false;
let totalAdvisories = 0;
for (const p of paths) {
  if (!fs.existsSync(p)) { console.log(`SKIP (missing): ${p}`); continue; }
  const res = p.endsWith('.json') ? validateTilesetJson(p) : validatePng(p);
  const unit = res.kind === 'png' ? 'cells' : 'tiles';
  console.log(`\n=== ${p}  (${res.kind}, ${res.total} ${unit}) ===`);
  totalAdvisories += res.advisories.length;
  // High-colour rework advisories — itemised so the art debt stays visible (NON-failing).
  for (const a of res.advisories) console.log(`  ⚠ ${a.id}: ${a.advisories.join('; ')}`);
  const advStr = res.advisories.length ? `, ${res.advisories.length} ≤${COLOR_CEIL}-but-high-colour advisory` : '';
  const noteStr = res.notes ? `  [${res.notes} clean but no #000000 outline — advisory]` : '';
  if (res.fails.length === 0) { console.log(`  ✓ all pass (Rule 1 ≤${COLOR_CEIL})${advStr ? ' —' + advStr.slice(1) : ''}${noteStr}`); continue; }
  anyFail = true;
  for (const f of res.fails) console.log(`  ✗ ${f.id}: ${f.violations.join('; ')}`);
  console.log(`  → ${res.fails.length}/${res.total} ${unit} VIOLATE Rule 1/2, ${res.total - res.fails.length} pass${advStr}${noteStr}`);
}
const advTail = totalAdvisories ? ` (${totalAdvisories} hand-rework advisory — see tileset_rules.md Rule 1)` : '';
console.log(anyFail ? '\nVALIDATION: violations found (art lint — see tileset_rules.md)' : `\nVALIDATION: all assets pass${advTail}`);
process.exit(anyFail ? 1 : 0);
