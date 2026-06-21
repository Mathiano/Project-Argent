import { PNG } from 'pngjs'; import fs from 'fs';
import { getMap } from '../src/game/overworld/maps.ts';
import { getTileset } from '../src/game/overworld/tilesetCatalog.ts';
const map = getMap('VIOLET');
const ts = getTileset('outdoor_violet');
const T = ts.tilesize, Z = 4;
const grass = ts.tiles['grass'].frames[0];
const rgb = h => h ? [parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16)] : null;
const img = new PNG({ width: map.width*T*Z, height: map.height*T*Z });
for (let cy=0; cy<map.height; cy++) for (let cx=0; cx<map.width; cx++) {
  const id = map.cells[cy][cx];
  const px = (ts.tiles[id] ?? ts.tiles['grass']).frames[0];
  for (let y=0;y<T;y++) for (let x=0;x<T;x++) {
    const c = rgb(px[y*T+x]) ?? rgb(grass[y*T+x]) ?? [0,0,0];
    for (let zy=0;zy<Z;zy++) for (let zx=0;zx<Z;zx++) { const di=(((cy*T+y)*Z+zy)*img.width + ((cx*T+x)*Z+zx))*4; img.data[di]=c[0];img.data[di+1]=c[1];img.data[di+2]=c[2];img.data[di+3]=255; }
  }
}
fs.writeFileSync('docs/art-reference/violet-rendered.png', PNG.sync.write(img));
console.log('rendered VIOLET', map.width+'x'+map.height, 'tiles ->', img.width+'x'+img.height, 'px');
// quick tally of which terrain transition ids got placed
const tally={}; for (const row of map.cells) for (const id of row) if(/_(n|e|s|w|out_|in_)/.test(id)) tally[id]=(tally[id]||0)+1;
console.log('transition cells:', Object.keys(tally).length?JSON.stringify(tally):'(none)');
