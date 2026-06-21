import { PNG } from 'pngjs';
import fs from 'fs';
const ts = JSON.parse(fs.readFileSync('assets/tilesets/violet_foundation_b01.tileset.json'));
const KEYS='0123456789abcdefghijklmnopqrstuvwxyz';
const pal = ts.palette.map(h=>[parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16)]);
const T = ts.tiles;
const px = (tileId,x,y)=>{const t=T[tileId]; const ch=t.rows[y][x]; if(ch==='.')return null; return pal[KEYS.indexOf(ch)];};

const W=20,H=14,TS=16,Z=6;
// scene grid of tile-ids ('.'=grass base), built to STRESS seams.
const g=Array.from({length:H},()=>Array(W).fill('grass'));
// grass variety
g[8][2]='grass_flower'; g[3][9]='grass_tuft'; g[11][14]='grass_flower';
// --- POND rows2..6 cols11..17 (N edge + NW corner provided; rest base => seam) ---
for(let y=2;y<=6;y++)for(let x=11;x<=17;x++) g[y][x]='water';
for(let x=12;x<=16;x++) g[2][x]='water_g_n';   // north edge (provided)
g[2][11]='water_g_nw';                          // NW corner (provided)
// (NE corner 2,17 / W col11 / E col17 / S row6 / SE,SW corners => left as base water = MISSING)
// --- DIRT PATH cols4..6 rows2..12 (N edge + E edge provided; rest base => seam) ---
for(let y=2;y<=12;y++)for(let x=4;x<=6;x++) g[y][x]='path';
for(let x=4;x<=6;x++) g[2][x]='path_g_n';       // north end (provided)
for(let y=3;y<=12;y++) g[6][y> -1?6:6]='path';  // noop guard
for(let y=3;y<=12;y++) g[y][6]='path_g_e';      // east edge (provided)
// (west col4 / south row12 / corners => base dirt = MISSING)
// --- a tree + render ---
g[9][15]='tree';

const img=new PNG({width:W*TS*Z,height:H*TS*Z});
// base fill = grass for transparent (tree) pixels show grass behind
for(let cy=0;cy<H;cy++)for(let cx=0;cx<W;cx++){
  const id=g[cy][cx];
  for(let y=0;y<TS;y++)for(let x=0;x<TS;x++){
    let c=px(id,x,y);
    if(c===null) c=px('grass',x,y);      // composite tree over grass
    for(let zy=0;zy<Z;zy++)for(let zx=0;zx<Z;zx++){
      const ix=(cx*TS+x)*Z+zx, iy=(cy*TS+y)*Z+zy, di=(iy*img.width+ix)*4;
      img.data[di]=c[0];img.data[di+1]=c[1];img.data[di+2]=c[2];img.data[di+3]=255;
    }
  }
}
fs.writeFileSync('docs/art-reference/violet-batch-01.seamtest.png', PNG.sync.write(img));
fs.copyFileSync('tmp/ingest_contact.png','docs/art-reference/violet-batch-01.ingested.png');
console.log('wrote docs/art-reference/violet-batch-01.seamtest.png', img.width+'x'+img.height);
console.log('wrote docs/art-reference/violet-batch-01.ingested.png');
