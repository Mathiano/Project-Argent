import { PNG } from 'pngjs'; import fs from 'fs';
import demoTileset from '../assets/tilesets/demo_layers.tileset.json' with { type: 'json' };
import treePrefab from '../assets/prefabs/tree_big.prefab.json' with { type: 'json' };
import proptest from '../src/game/maps/proptest.json' with { type: 'json' };
import { loadMap } from '../src/game/overworld/mapLoader.ts';
import { registerPrefab, registerTileset } from '../src/game/overworld/tilesetCatalog.ts';
import { getTileset } from '../src/game/overworld/tilesetCatalog.ts';
import { ySortOrder } from '../src/game/overworld/ysort.ts';

registerTileset(demoTileset); registerPrefab(treePrefab);
const map = loadMap(proptest);
const ts = getTileset('demo_layers');
const T = 16, Z = 5;
const W = map.width * T, H = map.height * T;
const rgb = h => h ? [parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16)] : null;

function panel(playerX, playerY) {
  const img = new PNG({ width: W * Z, height: H * Z });
  const put = (sx, sy, c) => { for (let zy=0;zy<Z;zy++) for (let zx=0;zx<Z;zx++){ const X=sx*Z+zx, Y=sy*Z+zy; if(X<0||Y<0||X>=img.width||Y>=img.height)continue; const di=(Y*img.width+X)*4; img.data[di]=c[0];img.data[di+1]=c[1];img.data[di+2]=c[2];img.data[di+3]=255; } };
  const tile = (id, tx, ty) => { const t=ts.tiles[id]; if(!t)return; const px=t.frames[0]; for(let y=0;y<T;y++)for(let x=0;x<T;x++){ const c=rgb(px[y*T+x]); if(c) put(tx*T+x, ty*T+y, c); } };
  // layer 0
  for (let y=0;y<map.height;y++) for (let x=0;x<map.width;x++) tile(map.cells[y][x], x, y);
  // layer 1 fringe
  if (map.fringe) for (let y=0;y<map.height;y++) for (let x=0;x<map.width;x++){ const id=map.fringe[y][x]; if(id) tile(id, x, y); }
  // layer 2 — y-sort player + props
  const drawPlayer = () => {
    const fx = playerX*T, feet = (playerY+1)*T, top = feet-22, cx = fx+2;
    const rect=(x,y,w,h,c)=>{for(let j=0;j<h;j++)for(let i=0;i<w;i++)put(x+i,y+j,c);};
    rect(cx-1, top-1, 14, 24, [20,20,28]);      // outline
    rect(cx, top, 12, 8, [240,200,150]);        // head
    rect(cx, top+8, 12, 9, [210,50,120]);       // body (magenta)
    rect(cx+1, top+17, 4, 5, [40,40,60]);       // legs
    rect(cx+7, top+17, 4, 5, [40,40,60]);
  };
  const items = [ { sortY: (playerY+1)*T, render: drawPlayer },
    ...map.props.map(p => ({ sortY: p.sortY, render: () => p.cells.forEach(c => tile(c.tile, c.tx, c.ty)) })) ];
  for (const it of ySortOrder(items)) it.render();
  return img;
}

// compose two panels side by side: BEHIND (player north of tree) | FRONT (south)
const A = panel(6, 4); // north of trunk row 5 -> behind canopy
const B = panel(6, 6); // south of trunk row 5 -> in front
const gap = 16;
const out = new PNG({ width: A.width*2 + gap, height: A.height });
for (let i=0;i<out.data.length;i+=4){ out.data[i]=30;out.data[i+1]=30;out.data[i+2]=36;out.data[i+3]=255; }
const blit = (src, ox) => { for(let y=0;y<src.height;y++)for(let x=0;x<src.width;x++){ const s=(y*src.width+x)*4, d=(y*out.width+(x+ox))*4; out.data[d]=src.data[s];out.data[d+1]=src.data[s+1];out.data[d+2]=src.data[s+2];out.data[d+3]=255; } };
blit(A, 0); blit(B, A.width+gap);
fs.writeFileSync('docs/art-reference/proptest-ysort.png', PNG.sync.write(out));
console.log('wrote docs/art-reference/proptest-ysort.png', out.width+'x'+out.height, '(LEFT: player behind tree | RIGHT: player in front)');
