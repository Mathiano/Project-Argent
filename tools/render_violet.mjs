// Offline render via the REAL pipeline (getMap/getTileset): layer0 cells +
// layer1 fringe + layer2 Y-sorted props, with an optional player sprite to show
// walk-behind. Usage: npx tsx tools/render_violet.mjs MAP [playerX playerY] [Z]
import { PNG } from 'pngjs'; import fs from 'fs';
import { getMap } from '../src/game/overworld/maps.ts';
import { getTileset } from '../src/game/overworld/tilesetCatalog.ts';
import { ySortOrder } from '../src/game/overworld/ysort.ts';

const NAME = process.argv[2] || 'VIOLET';
const hasPlayer = process.argv[3] !== undefined && process.argv[4] !== undefined;
const PX = Number(process.argv[3]), PY = Number(process.argv[4]);
const Z = Number(process.argv[5] ?? 4);
const map = getMap(NAME);
const ts = getTileset(map.tilesetRef);
const T = ts.tilesize;
const rgb = h => h ? [parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16)] : null;
const img = new PNG({ width: map.width*T*Z, height: map.height*T*Z });
const grass = ts.tiles['grass'].frames[0];
const put = (x,y,c)=>{ for(let zy=0;zy<Z;zy++)for(let zx=0;zx<Z;zx++){ const X=x*Z+zx,Y=y*Z+zy; if(X<0||Y<0||X>=img.width||Y>=img.height)continue; const di=(Y*img.width+X)*4; img.data[di]=c[0];img.data[di+1]=c[1];img.data[di+2]=c[2];img.data[di+3]=255; } };
const tile = (id, tx, ty) => { const t=ts.tiles[id]; if(!t)return; const px=t.frames[0]; for(let y=0;y<T;y++)for(let x=0;x<T;x++){ const c=rgb(px[y*T+x]) ?? null; if(c) put(tx*T+x, ty*T+y, c); } };
// layer 0
for (let y=0;y<map.height;y++) for (let x=0;x<map.width;x++) tile(map.cells[y][x], x, y);
// layer 1 fringe
if (map.fringe) for (let y=0;y<map.height;y++) for (let x=0;x<map.width;x++){ const id=map.fringe[y][x]; if(id) tile(id, x, y); }
// layer 2 — y-sort props (+ player)
const drawPlayer = () => { const fx=PX*T, feet=(PY+1)*T, top=feet-22, cx=fx+2;
  const rect=(x,y,w,h,c)=>{for(let j=0;j<h;j++)for(let i=0;i<w;i++)put(x+i,y+j,c);};
  rect(cx-1,top-1,14,24,[20,20,28]); rect(cx,top,12,8,[240,200,150]); rect(cx,top+8,12,9,[210,50,120]); rect(cx+1,top+17,4,5,[40,40,60]); rect(cx+7,top+17,4,5,[40,40,60]); };
const items = (map.props ?? []).map(p => ({ sortY: p.sortY, render: () => p.cells.forEach(c => tile(c.tile, c.tx, c.ty)) }));
if (hasPlayer) items.push({ sortY: (PY+1)*T, render: drawPlayer });
for (const it of ySortOrder(items)) it.render();
const out = `docs/art-reference/${NAME.toLowerCase()}-rendered.png`;
fs.writeFileSync(out, PNG.sync.write(img));
console.log('rendered', NAME, map.width+'x'+map.height, '->', img.width+'x'+img.height, hasPlayer?`(player @${PX},${PY})`:'', '->', out);
