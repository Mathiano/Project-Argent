// Project Argent — PCT TILE ingest (representative working set).
//
// Brings a representative slice of the Pocket Creature Tamer environment art into
// the tileset registry, indexed against the NEW argent-master (re-seeded by
// tools/pct_palette_ingest.mjs). NOT the whole pack and NOT map authoring — just
// the Route 31 / Hearthwick / Violet basics so Tiled (Phase 8) has real tiles to
// paint with. More sheets ingest later by adding to SHEETS.
//
// Each sheet slices to 16x16 (floor-crop if not a 16-multiple), drops fully-
// transparent cells, quantises every opaque pixel to its nearest master colour
// (key), transparent -> '.'. Per-tile colour budget is asserted <=16 (RSE/GBA
// ceiling). Emits one assets/tilesets/pct_<name>.tileset.json per sheet (full
// 41-colour master embedded, index-aligned to PALETTE_KEYS), registers them in
// the studio manifest, and (for the ?skip=pct-tiles scaffold) writes an indexed
// sample of the 4 vendored sample sheets into src/. Also reports the native->
// indexed quantisation error — the near-lossless proof (the master was built FROM
// these colours, so error stays within the de-jitter radius).
//
// Node/pngjs. Requires the pack at PCT_PACK_ROOT. Run: node tools/pct_tile_ingest.mjs
import { PNG } from 'pngjs';
import fs from 'fs';
import path from 'path';

const PACK_ROOT = process.env.PCT_PACK_ROOT || 'tmp/pct-full/Pocket Creature Tamer';
const TS = 16, CEIL = 16, OPAQUE = 248;
const KEYS = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

const master = JSON.parse(fs.readFileSync('assets/palettes/argent-master.palette.json'));
const PAL = master.colors.map((c) => [parseInt(c.hex.slice(1, 3), 16), parseInt(c.hex.slice(3, 5), 16), parseInt(c.hex.slice(5, 7), 16)]);
const PAL_HEX = master.colors.map((c) => c.hex);
const nearest = (r, g, b) => {
  let bi = 0, bd = 1e18;
  for (let i = 0; i < PAL.length; i++) { const d = (PAL[i][0] - r) ** 2 + (PAL[i][1] - g) ** 2 + (PAL[i][2] - b) ** 2; if (d < bd) { bd = d; bi = i; } }
  return bi;
};

// Representative outdoor working set (Route 31 / Hearthwick / Violet basics).
const SHEETS = [
  { src: 'Tilesets/Grass.png',                       name: 'pct_grass',     desc: 'grass field + variants' },
  { src: 'Tilesets/path_01.png',                     name: 'pct_path',      desc: 'dirt path (9-slice edges)' },
  { src: 'Tilesets/Fences.png',                      name: 'pct_fences',    desc: 'wood fences' },
  { src: 'Tilesets/water_anim.png',                  name: 'pct_water',     desc: 'water (anim frames, ingested static)' },
  { src: 'Enviroment/Vegetation/Trees/trees.png',    name: 'pct_trees',     desc: 'tree parts' },
  { src: 'Enviroment/Vegetation/Bushes/bush.png',    name: 'pct_bush',      desc: 'bush' },
  { src: 'Enviroment/Vegetation/Flowers/flowers.png',name: 'pct_flowers',   desc: 'flowers' },
  { src: 'Enviroment/Buildings/premade_builds.png',  name: 'pct_buildings', desc: 'complete houses (towns)' },
];

if (!fs.existsSync(PACK_ROOT)) { console.error(`PCT pack not found at "${PACK_ROOT}".`); process.exit(2); }

// Slice one sheet -> { tiles:{id:rows[]}, count, blank, maxColors }. Floor-crops.
function sliceSheet(file) {
  const png = PNG.sync.read(fs.readFileSync(file));
  const { width: W, height: H, data: D } = png;
  const tiles = {}; let count = 0, blank = 0, maxColors = 0;
  for (let cy = 0, ry = 0; cy + TS <= H; cy += TS, ry++) {
    for (let cx = 0, rx = 0; cx + TS <= W; cx += TS, rx++) {
      const rows = []; const used = new Set(); let opaque = 0;
      for (let y = 0; y < TS; y++) {
        let s = '';
        for (let x = 0; x < TS; x++) {
          const i = ((cy + y) * W + (cx + x)) * 4;
          if (D[i + 3] < OPAQUE) { s += '.'; continue; }
          const k = nearest(D[i], D[i + 1], D[i + 2]); used.add(k); opaque++; s += KEYS[k];
        }
        rows.push(s);
      }
      if (opaque === 0) { blank++; continue; } // skip fully-transparent cells
      if (used.size > maxColors) maxColors = used.size;
      if (used.size > CEIL) throw new Error(`${file} tile r${ry}c${rx}: ${used.size} colours > ${CEIL}`);
      tiles[`r${ry}c${rx}`] = { label: `r${ry}c${rx}`, solid: false, rows };
      count++;
    }
  }
  return { tiles, count, blank, maxColors };
}

const manifest = JSON.parse(fs.readFileSync('assets/tilesets/manifest.json'));
const byName = new Map(manifest.assets.map((a) => [a.name, a]));
let totalTiles = 0, worst = 0;

for (const sheet of SHEETS) {
  const file = path.join(PACK_ROOT, sheet.src);
  const { tiles, count, blank, maxColors } = sliceSheet(file);
  worst = Math.max(worst, maxColors); totalTiles += count;
  const out = {
    name: sheet.name,
    _note: `INGESTED from PCT "${sheet.src}" — ${sheet.desc}. 16x16, indexed to argent-master (PCT re-seed). solid=false (set per-placement at map/prefab layer). Regenerate: tools/pct_tile_ingest.mjs.`,
    tilesize: TS,
    palette: PAL_HEX,
    tiles,
  };
  const outPath = `assets/tilesets/${sheet.name}.tileset.json`;
  fs.writeFileSync(outPath, JSON.stringify(out, null, 1) + '\n');
  const entry = { name: sheet.name, file: outPath, tilesize: TS, count, description: sheet.desc };
  if (byName.has(sheet.name)) Object.assign(byName.get(sheet.name), entry);
  else { manifest.assets.push(entry); byName.set(sheet.name, entry); }
  console.log(`${sheet.name.padEnd(14)} ${String(count).padStart(4)} tiles (${blank} blank skipped)  max/tile=${maxColors}`);
}

fs.writeFileSync('assets/tilesets/manifest.json', JSON.stringify(manifest, null, 1) + '\n');

// --- indexed sample for the ?skip=pct-tiles scaffold (the 4 vendored sheets,
// indexed so the scene can render via the real decode path beside the native draw)
const SAMPLES = ['grass', 'path', 'water', 'trees'];
const sample = { tilesize: TS, palette: PAL_HEX, _note: 'Indexed (argent-master) versions of src/assets/pct-sample/*.png for the ?skip=pct-tiles native-vs-indexed match check. Regenerate: tools/pct_tile_ingest.mjs.', sheets: {} };
for (const s of SAMPLES) {
  const { tiles } = sliceSheet(`src/assets/pct-sample/${s}.png`);
  sample.sheets[s] = tiles; // keyed r{y}c{x}
}
fs.writeFileSync('src/assets/pct-sample/pct_sample_indexed.json', JSON.stringify(sample) + '\n');

// --- quantisation error: native -> nearest master, over all opaque sample px.
let n = 0, sumD = 0, maxD = 0;
for (const s of SAMPLES) {
  const png = PNG.sync.read(fs.readFileSync(`src/assets/pct-sample/${s}.png`));
  const D = png.data;
  for (let i = 0; i < D.length; i += 4) {
    if (D[i + 3] < OPAQUE) continue;
    const k = nearest(D[i], D[i + 1], D[i + 2]);
    const d = Math.sqrt((PAL[k][0] - D[i]) ** 2 + (PAL[k][1] - D[i + 1]) ** 2 + (PAL[k][2] - D[i + 2]) ** 2);
    n++; sumD += d; maxD = Math.max(maxD, d);
  }
}
console.log(`\ningested ${SHEETS.length} sheets, ${totalTiles} tiles, worst tile=${worst} colours (<=${CEIL})`);
console.log(`quantisation error (native->master, ${n} px): mean=${(sumD / n).toFixed(2)}  max=${maxD.toFixed(2)} (euclidean RGB; ~0 = near-lossless, master built from these colours)`);
console.log('wrote assets/tilesets/pct_*.tileset.json, manifest.json, src/assets/pct-sample/pct_sample_indexed.json');
