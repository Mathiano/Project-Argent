// Merge the synthesized foundation terrain (argent-master palette) into the LIVE
// outdoor_violet tileset: append only the new colours (≤36-key cap), keep every
// building tile untouched, replace grass/path/water art, add the 24 transition
// tiles. Writes outdoor_violet.tileset.json in place.
import fs from 'fs';
const KEYS = '0123456789abcdefghijklmnopqrstuvwxyz';
const old = JSON.parse(fs.readFileSync('assets/tilesets/outdoor_violet.tileset.json'));
const synth = JSON.parse(fs.readFileSync('assets/tilesets/violet_terrain_v2.tileset.json'));
const hex2rgb = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const dist2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;

// merged palette starts as the old palette (indices stable -> building tiles untouched)
const merged = old.palette.slice();
// Preserve the exact HC grass base green: it's a near-dupe of the placeholder
// #6cad4f (~11 apart) and would otherwise dedupe away, but the grass base must
// land EXACT. Seed it so synth grass maps to it; other tiles keep #6cad4f.
if (!merged.includes('#68b549')) merged.push('#68b549');
const mergedRgb = merged.map(hex2rgb);
const synthRgb = synth.palette.map(hex2rgb);
// map each synth palette index -> merged index (reuse near-dupe, else append)
const THRESH = 22; // colour-merge radius
const synthToMerged = synthRgb.map(c => {
  let bi = -1, bd = THRESH * THRESH;
  for (let i = 0; i < mergedRgb.length; i++) { const d = dist2(c, mergedRgb[i]); if (d < bd) { bd = d; bi = i; } }
  if (bi >= 0) return bi;
  merged.push('#' + c.map(v => v.toString(16).padStart(2, '0')).join('')); mergedRgb.push(c);
  return merged.length - 1;
});
if (merged.length > KEYS.length) throw new Error(`merged palette ${merged.length} > 36 keys`);

// re-key a synth tile's rows from argent keys -> merged keys
const rekey = rows => rows.map(r => [...r].map(ch => ch === '.' ? '.' : KEYS[synthToMerged[KEYS.indexOf(ch)]]).join(''));

const tiles = { ...old.tiles };
// replace the three bases with the synthesized art
for (const base of ['grass', 'path', 'water']) {
  tiles[base] = { ...old.tiles[base], rows: rekey(synth.tiles[base].rows) };
}
// add the 24 transition tiles (solid per synth: water* solid, path* walkable)
for (const [k, t] of Object.entries(synth.tiles)) {
  if (!k.includes('_')) continue; // skip bases (already done)
  tiles[k] = { label: k, solid: !!t.solid, rows: rekey(t.rows) };
}

const out = { ...old, palette: merged, tiles };
fs.writeFileSync('assets/tilesets/outdoor_violet.tileset.json', JSON.stringify(out, null, 1));
console.log(`merged palette: ${old.palette.length} -> ${merged.length} colours (cap 36)`);
console.log(`tiles: ${Object.keys(tiles).length} (added ${Object.keys(tiles).length - Object.keys(old.tiles).length} transitions)`);
console.log('appended colours:', merged.slice(old.palette.length).join(' ') || '(none)');
