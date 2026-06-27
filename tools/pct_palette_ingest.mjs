// Project Argent — PCT MASTER PALETTE re-seed (provenance tool).
//
// Re-seeds assets/palettes/argent-master.palette.json FROM the Pocket Creature
// Tamer pack's environment art (the chosen shipping art direction), replacing the
// old 54-colour violet-batch-01 POC seed. See docs/palette-reseed-decision.md.
//
// What it does: censuses every opaque colour across the pack's ENVIRONMENT set
// (Tilesets + Enviroment/{Buildings,Decoration,Interiors,Vegetation}) — NOT
// creatures/characters/UI/items (those are sprites/HUD, outside the tileset
// registry). The raw set is ~84 colours, inflated by alpha-export jitter (±1/ch
// twins). It DE-JITTERS by greedy frequency-first clustering: the canonical count
// is a hard plateau at 41 across merge-thresholds T=4..8 (T=6 used here). 41 < the
// 62-key PALETTE_KEYS cap, so single-char indexing still holds — NO ceiling raise.
//
// Provenance, not a runtime dep: requires the (untracked, bought) pack extracted
// at PACK_ROOT. The pack stays out of git for licensing; the committed master
// JSON is the canonical artifact. Re-run only to regenerate the master.
//
// Node/pngjs, no native deps. Run: node tools/pct_palette_ingest.mjs
import { PNG } from 'pngjs';
import fs from 'fs';
import path from 'path';

const PACK_ROOT = process.env.PCT_PACK_ROOT || 'tmp/pct-full/Pocket Creature Tamer';
const OUT = 'assets/palettes/argent-master.palette.json';
const T = 6;            // de-jitter euclidean merge radius (41 stable across T=4..8)
const OPAQUE = 248;     // alpha floor — matches validate_assets.mjs (no partial alpha)
// 0-9a-zA-Z (62) — must match PALETTE_KEYS (src/game/overworld/tileset.ts) + the
// validators + the studio. 41 canonical colours fit comfortably (single-char keys).
const KEYS = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

// The pack's environment subset (excludes Characters/Creatures/Items/UI).
const ENV_DIRS = [
  'Tilesets',
  'Enviroment/Buildings',
  'Enviroment/Decoration',
  'Enviroment/Interiors',
  'Enviroment/Vegetation/Bushes',
  'Enviroment/Vegetation/Flowers',
  'Enviroment/Vegetation/Trees',
];

function listPngs(dir) {
  const full = path.join(PACK_ROOT, dir);
  if (!fs.existsSync(full)) return [];
  return fs.readdirSync(full)
    .filter((f) => f.toLowerCase().endsWith('.png'))
    .map((f) => path.join(full, f));
}

if (!fs.existsSync(PACK_ROOT)) {
  console.error(`PCT pack not found at "${PACK_ROOT}". Extract the bought pack there (or set PCT_PACK_ROOT).`);
  process.exit(2);
}

// exact opaque colour -> pixel frequency
const freq = new Map();
let files = 0;
for (const dir of ENV_DIRS) {
  for (const file of listPngs(dir)) {
    files++;
    const png = PNG.sync.read(fs.readFileSync(file));
    const { width: W, height: H, data: D } = png;
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4;
        if (D[i + 3] < OPAQUE) continue;
        const key = (D[i] << 16) | (D[i + 1] << 8) | D[i + 2];
        freq.set(key, (freq.get(key) || 0) + 1);
      }
  }
}

const raw = [...freq.entries()]
  .map(([k, n]) => ({ rgb: [(k >> 16) & 255, (k >> 8) & 255, k & 255], n }))
  .sort((a, b) => b.n - a.n);

const d2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;

// Greedy de-jitter, most-frequent-first: each colour folds into the nearest
// existing canonical seed within T, else seeds a new bucket. Representative is the
// SEED (the exact, most-frequent pack hex) — jitter twins collapse onto the design
// colour; no averaging, so the artist's chosen hexes are preserved verbatim.
const reps = [];
for (const c of raw) {
  const hit = reps.find((r) => d2(c.rgb, r.rgb) <= T * T);
  if (hit) hit.n += c.n;
  else reps.push({ rgb: c.rgb.slice(), n: c.n });
}
reps.sort((a, b) => b.n - a.n); // canonical order = design-load-bearing first

if (reps.length > KEYS.length) {
  console.error(`canonical ${reps.length} > ${KEYS.length} key cap — STOP (would break single-char indexing).`);
  process.exit(1);
}

const hex = ([r, g, b]) => '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
const palObj = {
  name: 'argent-master',
  note:
    `Re-seeded FROM the Pocket Creature Tamer pack environment set (the chosen shipping art ` +
    `direction) — supersedes the old 54-colour violet-batch-01 POC seed (docs/palette-reseed-decision.md, ` +
    `2026-06-27). Census of ${files} env sheets = 84 raw opaque colours, inflated by alpha-export jitter; ` +
    `de-jittered (greedy freq-first, euclidean T=${T}; 41 stable across T=4..8) to 41 canonical design ` +
    `colours, ordered by pixel frequency (design-load-bearing first). Reps are exact pack hexes (no ` +
    `averaging). Per-tile budget <=16 (RSE/GBA ceiling, docs/visual-ceiling-rse-2d.md); this master is the ` +
    `CROSS-tileset ceiling. Keys 0-9a-zA-Z (62 cap); 41 fits single-char, NO ceiling raise. UI/HUD palette ` +
    `(src/game/palette.ts) is decoupled and untouched. Regenerate: tools/pct_palette_ingest.mjs.`,
  size: reps.length,
  colors: reps.map((r, i) => ({ key: KEYS[i], hex: hex(r.rgb) })),
};

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(palObj, null, 2) + '\n');

console.log(`files: ${files}  raw: ${raw.length}  canonical(T=${T}): ${reps.length}  cap: ${KEYS.length}`);
console.log(`wrote ${OUT}`);
console.log(palObj.colors.map((c) => `${c.key}:${c.hex}`).join(' '));
