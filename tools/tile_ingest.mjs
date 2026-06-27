// Project Argent — TILE ingest pipeline (manifest §0 contract).
// Slices labeled swatches from an AI source sheet, mode-pool downscales each to
// 16x16, quantizes to a frozen palette, validates, emits atlas-keyed tiles.
// Node/pngjs (no Python/native deps). Run: node tools/tile_ingest.mjs
//
// ⚠️ SUPERSEDED (2026-06-27) — this built the OLD violet-batch-01 master, which
// was REPLACED by the Pocket Creature Tamer re-seed (docs/palette-reseed-decision.md).
// Running it would CLOBBER assets/palettes/argent-master.palette.json back to the
// discarded 40-colour violet seed. Kept for provenance only. The forward tools are
// tools/pct_palette_ingest.mjs (master) + tools/pct_tile_ingest.mjs (tiles).
// Guard: refuses to run unless ALLOW_LEGACY_INGEST=1 is set.
import { PNG } from 'pngjs';
import fs from 'fs';
if (process.env.ALLOW_LEGACY_INGEST !== '1') {
  console.error('tile_ingest.mjs is SUPERSEDED — it would clobber the PCT-re-seeded master.\n' +
    'Use tools/pct_palette_ingest.mjs. To override (provenance/debug): ALLOW_LEGACY_INGEST=1 node tools/tile_ingest.mjs');
  process.exit(2);
}

const SRC = 'docs/art-reference/violet-batch-01.png';
const TS = 16;                 // native tile size
const INSET = 6;               // drop the swatch border frame
const PAL_KEYS = '0123456789abcdefghijklmnopqrstuvwxyz'; // tileset format cap = 36

// Labeled swatch regions (from the connected-component detector).
// solid: engine solidity. transparent: prop on sheet bg (bg -> '.').
const REGIONS = [
  { key: 'grass',         label:'GRASS_BASE',        x:11,  y:110, w:113, h:122, solid:false },
  { key: 'grass_flower',  label:'GRASS_VAR_2',       x:423, y:110, w:113, h:122, solid:false },
  { key: 'grass_tuft',    label:'GRASS_VAR_1',       x:240, y:110, w:113, h:122, solid:false },
  { key: 'path',          label:'DIRT_BASE',         x:11,  y:272, w:111, h:120, solid:false },
  { key: 'path_g_n',      label:'DIRT_G_NORTH',      x:238, y:291, w:159, h:101, solid:false },
  { key: 'path_g_e',      label:'DIRT_G_EAST',       x:422, y:291, w:113, h:114, solid:false },
  { key: 'water',         label:'WATER_BASE',        x:11,  y:433, w:111, h:113, solid:true  },
  { key: 'water_g_n',     label:'WATER_G_NORTH',     x:238, y:433, w:159, h:114, solid:true  },
  { key: 'water_g_nw',    label:'WATER_G_NW_CORNER', x:422, y:433, w:112, h:114, solid:true  },
  { key: 'tree',          label:'TREE_COMP',         x:11,  y:598, w:143, h:141, solid:true,  transparent:true },
];

const png = PNG.sync.read(fs.readFileSync(SRC));
const { width:W, data:D } = png;
const at = (x,y)=>{const i=(y*W+x)*4; return [D[i],D[i+1],D[i+2]];};
const isBg = (r,g,b)=>{const mx=Math.max(r,g,b),mn=Math.min(r,g,b); return mx>205 && (mx-mn)<28;};

// --- cell pooling: for a region, return 16x16 of {pixels:[[r,g,b]...], bgFrac}
function poolCells(reg){
  const x0=reg.x+INSET, y0=reg.y+INSET, w=reg.w-2*INSET, h=reg.h-2*INSET;
  const cells=[];
  for(let gy=0;gy<TS;gy++){const row=[];for(let gx=0;gx<TS;gx++){
    const cx0=x0+gx*w/TS, cy0=y0+gy*h/TS, cx1=x0+(gx+1)*w/TS, cy1=y0+(gy+1)*h/TS;
    const px=[]; let bg=0, tot=0;
    for(let sy=Math.floor(cy0); sy<Math.ceil(cy1); sy++)
      for(let sx=Math.floor(cx0); sx<Math.ceil(cx1); sx++){
        const [r,g,b]=at(sx,sy); tot++;
        if(reg.transparent && isBg(r,g,b)) bg++; else px.push([r,g,b]);
      }
    row.push({px, bgFrac: tot? bg/tot : 1});
  } cells.push(row);} return cells;
}

// --- build palette: median-cut over per-cell average colours of all tiles
function avg(px){let r=0,g=0,b=0;for(const p of px){r+=p[0];g+=p[1];b+=p[2];}const n=px.length||1;return [r/n,g/n,b/n];}
const samples=[];
const pooled = REGIONS.map(r=>({reg:r, cells:poolCells(r)}));
for(const {cells} of pooled) for(const row of cells) for(const c of row) if(c.px.length && c.bgFrac<0.5) samples.push(avg(c.px));

function medianCut(pts, n){
  let boxes=[pts.slice()];
  while(boxes.length<n){
    let bi=-1, brange=-1;
    boxes.forEach((bx,i)=>{ if(bx.length<2)return; let r=0; for(let ch=0;ch<3;ch++){let mn=1e9,mx=-1e9;for(const p of bx){mn=Math.min(mn,p[ch]);mx=Math.max(mx,p[ch]);}r=Math.max(r,mx-mn);} if(r>brange){brange=r;bi=i;} });
    if(bi<0) break;
    const bx=boxes[bi]; let ch=0,best=-1; for(let c=0;c<3;c++){let mn=1e9,mx=-1e9;for(const p of bx){mn=Math.min(mn,p[c]);mx=Math.max(mx,p[c]);}if(mx-mn>best){best=mx-mn;ch=c;}}
    bx.sort((a,b)=>a[ch]-b[ch]); const mid=bx.length>>1;
    boxes.splice(bi,1,bx.slice(0,mid),bx.slice(mid));
  }
  return boxes.filter(b=>b.length).map(avg).map(c=>c.map(Math.round));
}
function merge(cols, T){const out=[];for(const c of cols){let dup=out.find(o=>(o[0]-c[0])**2+(o[1]-c[1])**2+(o[2]-c[2])**2 < T*T);if(!dup)out.push(c);}return out;}

let palette = merge(medianCut(samples, 40), 16).slice(0, PAL_KEYS.length);
const nearest = (r,g,b)=>{let bi=0,bd=1e18;for(let i=0;i<palette.length;i++){const[pr,pg,pb]=palette[i];const d=(pr-r)**2+(pg-g)**2+(pb-b)**2;if(d<bd){bd=d;bi=i;}}return bi;};

// --- emit each tile: mode-of-quantized per cell; bg -> '.'
const tiles={};
for(const {reg,cells} of pooled){
  const rows=[];
  for(const row of cells){let s='';for(const c of row){
    if(reg.transparent && c.bgFrac>0.5){ s+='.'; continue; }
    const cnt=new Map(); for(const [r,g,b] of c.px){const k=nearest(r,g,b);cnt.set(k,(cnt.get(k)||0)+1);}
    let bk=0,bc=-1; for(const [k,v] of cnt){if(v>bc){bc=v;bk=k;}}
    s+=PAL_KEYS[bk];
  } rows.push(s);}
  tiles[reg.key]={label:reg.label, solid:reg.solid, rows};
}

// --- validate
let fails=0;
for(const [k,t] of Object.entries(tiles)){
  if(t.rows.length!==TS){console.log('FAIL',k,'rows',t.rows.length);fails++;}
  t.rows.forEach((r,i)=>{ if(r.length!==TS){console.log('FAIL',k,'row',i,'len',r.length);fails++;}
    for(const ch of r){ if(ch!=='.' && PAL_KEYS.indexOf(ch)>=palette.length){console.log('FAIL',k,'bad char',ch);fails++;} } });
}

// --- write palette + tileset
const hex=c=>'#'+c.map(v=>v.toString(16).padStart(2,'0')).join('');
const palObj={ name:'argent-master', note:'Canonical palette seeded from violet-batch-01 (foundation). Tileset rows encode <=36 single-char keys (0-9a-z); 64 is the project ceiling across tilesets.', size:palette.length, colors:palette.map((c,i)=>({key:PAL_KEYS[i], hex:hex(c)})) };
fs.mkdirSync('assets/palettes',{recursive:true});
fs.writeFileSync('assets/palettes/argent-master.palette.json', JSON.stringify(palObj,null,2));
const tsPal=palette.map(hex);
const tilesetObj={ name:'violet_foundation_b01', _note:'INGESTED from violet-batch-01.png (review only — NOT swapped into Violet). 16x16, palette=argent-master subset.', tilesize:TS, palette:tsPal, tiles:Object.fromEntries(Object.entries(tiles).map(([k,t])=>[k,{label:t.label,solid:t.solid,rows:t.rows}])) };
fs.writeFileSync('assets/tilesets/violet_foundation_b01.tileset.json', JSON.stringify(tilesetObj,null,1));

console.log(`palette: ${palette.length} colors  | tiles: ${Object.keys(tiles).length}  | validation ${fails?('FAILED '+fails):'PASS'}`);

// --- contact sheet (ingested tiles @10x, in source order, gaps)
const Z=10, COLS=5, PAD=6, CELL=TS*Z+PAD;
const list=Object.entries(tiles); const ROWS=Math.ceil(list.length/COLS);
const cs=new PNG({width:COLS*CELL+PAD, height:ROWS*CELL+PAD});
for(let i=0;i<cs.data.length;i+=4){cs.data[i]=26;cs.data[i+1]=29;cs.data[i+2]=36;cs.data[i+3]=255;}
list.forEach(([k,t],idx)=>{const cx=PAD+(idx%COLS)*CELL, cy=PAD+Math.floor(idx/COLS)*CELL;
  for(let y=0;y<TS;y++)for(let x=0;x<TS;x++){const ch=t.rows[y][x]; if(ch==='.')continue; const c=palette[PAL_KEYS.indexOf(ch)];
    for(let zy=0;zy<Z;zy++)for(let zx=0;zx<Z;zx++){const px=cx+x*Z+zx, py=cy+y*Z+zy, di=(py*cs.width+px)*4; cs.data[di]=c[0];cs.data[di+1]=c[1];cs.data[di+2]=c[2];cs.data[di+3]=255;}}});
fs.writeFileSync('tmp/ingest_contact.png', PNG.sync.write(cs));
console.log('contact order:', list.map(([k])=>k).join(', '));
console.log('wrote tmp/ingest_contact.png, assets/palettes/argent-master.palette.json, assets/tilesets/violet_foundation_b01.tileset.json');
