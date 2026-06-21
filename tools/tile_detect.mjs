import { PNG } from 'pngjs';
import fs from 'fs';
const SRC = process.argv[2] || 'docs/art-reference/violet-batch-01.png';
const png = PNG.sync.read(fs.readFileSync(SRC));
const { width:W, height:H, data:D } = png;
const at = (x,y)=>{const i=(y*W+x)*4; return [D[i],D[i+1],D[i+2]];};
// sample corners + center bg
console.log('corners', at(2,2), at(W-3,2), at(2,H-3), at(W-3,H-3));
// background = light & low-saturation
const isBg = (x,y)=>{const [r,g,b]=at(x,y); const mx=Math.max(r,g,b),mn=Math.min(r,g,b); return mx>205 && (mx-mn)<28;};
// foreground mask
const fg = new Uint8Array(W*H);
for(let y=0;y<H;y++)for(let x=0;x<W;x++) fg[y*W+x] = isBg(x,y)?0:1;
// connected components (4-conn), iterative
const seen = new Uint8Array(W*H);
const comps=[];
const stack=[];
for(let y=0;y<H;y++)for(let x=0;x<W;x++){
  const s=y*W+x; if(!fg[s]||seen[s]) continue;
  let minx=x,maxx=x,miny=y,maxy=y,cnt=0;
  stack.length=0; stack.push(s); seen[s]=1;
  while(stack.length){
    const p=stack.pop(); const px=p%W, py=(p-px)/W; cnt++;
    if(px<minx)minx=px; if(px>maxx)maxx=px; if(py<miny)miny=py; if(py>maxy)maxy=py;
    const nb=[p-1,p+1,p-W,p+W];
    if(px>0&&fg[p-1]&&!seen[p-1]){seen[p-1]=1;stack.push(p-1);}
    if(px<W-1&&fg[p+1]&&!seen[p+1]){seen[p+1]=1;stack.push(p+1);}
    if(py>0&&fg[p-W]&&!seen[p-W]){seen[p-W]=1;stack.push(p-W);}
    if(py<H-1&&fg[p+W]&&!seen[p+W]){seen[p+W]=1;stack.push(p+W);}
  }
  const w=maxx-minx+1,h=maxy-miny+1;
  comps.push({x:minx,y:miny,w,h,cnt});
}
// filter to swatch-sized roughly-square blocks
const sw = comps.filter(c=> c.w>=60 && c.w<=170 && c.h>=60 && c.h<=170 && c.cnt> c.w*c.h*0.35)
  .sort((a,b)=> (a.y-b.y) || (a.x-b.x));
console.log('candidate swatches:', sw.length);
for(const c of sw) console.log(`  x=${c.x} y=${c.y} w=${c.w} h=${c.h}`);
// overlay
const ov = new PNG({width:W,height:H}); D.copy(ov.data);
const line=(x0,y0,x1,y1)=>{for(let x=x0;x<=x1;x++){for(const yy of [y0,y1]){const i=(yy*W+x)*4;ov.data[i]=255;ov.data[i+1]=0;ov.data[i+2]=0;}}for(let y=y0;y<=y1;y++){for(const xx of [x0,x1]){const i=(y*W+xx)*4;ov.data[i]=255;ov.data[i+1]=0;ov.data[i+2]=0;}}};
sw.forEach(c=>line(c.x,c.y,c.x+c.w-1,c.y+c.h-1));
fs.writeFileSync('tmp/detect_overlay.png', PNG.sync.write(ov));
console.log('wrote tmp/detect_overlay.png');
