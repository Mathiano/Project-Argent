#!/usr/bin/env python3
"""
sprite_ingest.py — Project Argent sprite production pipeline (Track B).

Takes a generated pseudo-pixel-art image (PNG, flat white background) and
produces a grid-true, palette-locked game sprite in the engine's native
text-grid format, plus a review preview.

Pipeline: background removal -> master-palette quantization -> mode-pool
downscale -> despeckle -> outline repair -> slot fit (56x56, bottom-anchored).

Usage:
  python tools/sprite_ingest.py input.png NAME [--height 56] [--out dir]

Outputs:
  dir/NAME.sprite.json   {name, size, palette, rows}
  dir/NAME.preview.png   5x render + actual-size strip for review
"""
import argparse, collections, json, os
from PIL import Image, ImageDraw

MASTER_PAL = {
    'k': (42, 28, 32),     # outline
    'o': (232, 119, 42),   # orange
    'O': (194, 73, 26),    # orange shade
    'c': (246, 220, 174),  # cream
    'C': (205, 191, 146),  # cream shade
    'g': (62, 143, 78),    # green
    'G': (36, 107, 56),    # green shade
    'l': (143, 208, 106),  # leaf light
    'b': (63, 127, 210),   # blue
    'B': (39, 87, 156),    # blue shade
    'L': (125, 180, 234),  # blue light
    'r': (226, 58, 30),    # flame red
    'y': (247, 179, 43),   # flame yellow
    'w': (255, 255, 255),  # shine/teeth
    's': (168, 162, 150),  # stone light
    'S': (110, 104, 96),   # stone
    'D': (70, 66, 62),     # stone dark
}
SOFT_EDGE = {'r', 'y'}  # fire keeps soft edges, no forced outline

def is_bg(p): return p[0] > 235 and p[1] > 235 and p[2] > 235

def nearest(p, pal):
    best, bd = None, 1e18
    for ch, (r, g, b) in pal.items():
        d = (p[0]-r)**2 + (p[1]-g)**2 + (p[2]-b)**2
        if d < bd: bd, best = d, ch
    return best

def ingest(path, out_h, pal):
    src = Image.open(path).convert('RGB')
    W, H = src.size
    px = src.load()
    xs = [x for x in range(W) for y in range(0, H, 5) if not is_bg(px[x, y])]
    ys = [y for y in range(H) for x in range(0, W, 5) if not is_bg(px[x, y])]
    x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
    cell = (y1 - y0 + 1) / out_h
    out_w = round((x1 - x0 + 1) / cell)
    grid = []
    for gy in range(out_h):
        row = []
        for gx in range(out_w):
            cx0, cy0 = x0 + gx*cell, y0 + gy*cell
            cnt, total, bg = collections.Counter(), 0, 0
            for sy in range(int(cy0), min(int(cy0+cell)+1, H)):
                for sx in range(int(cx0), min(int(cx0+cell)+1, W)):
                    p = px[sx, sy]; total += 1
                    if is_bg(p): bg += 1
                    else: cnt[nearest(p, pal)] += 1
            row.append('.' if (total == 0 or bg/total > 0.55 or not cnt)
                       else cnt.most_common(1)[0][0])
        grid.append(row)
    return grid

def cleanup(g):
    H, W = len(g), len(g[0])
    def neigh(x, y):
        for dx, dy in ((1,0),(-1,0),(0,1),(0,-1)):
            nx, ny = x+dx, y+dy
            yield g[ny][nx] if 0 <= nx < W and 0 <= ny < H else '.'
    for y in range(H):
        for x in range(W):
            if g[y][x] != '.' and all(n == '.' for n in neigh(x, y)):
                g[y][x] = '.'
    for y in range(H):
        for x in range(W):
            ch = g[y][x]
            if ch == '.' or ch in SOFT_EDGE: continue
            if any(n == '.' for n in neigh(x, y)):
                g[y][x] = 'k'
    return g

def fit(g, slot):
    H, W = len(g), len(g[0])
    xs = [x for y in range(H) for x in range(W) if g[y][x] != '.']
    ys = [y for y in range(H) for x in range(W) if g[y][x] != '.']
    x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
    cw, ch = x1-x0+1, y1-y0+1
    if cw > slot or ch > slot: return None  # caller retries at smaller out_h
    crop = [row[x0:x1+1] for row in g[y0:y1+1]]
    final = [['.' for _ in range(slot)] for _ in range(slot)]
    offx, offy = (slot-cw)//2, slot-ch-1
    for y in range(ch):
        for x in range(cw):
            final[y+offy][x+offx] = crop[y][x]
    return final

def preview(final, pal_hex, out_png):
    S = len(final); Z = 5
    img = Image.new('RGB', (30 + S*Z + 30 + S + 30, S*Z + 60), '#1a1d24')
    d = ImageDraw.Draw(img)
    for y in range(S):
        for x in range(S):
            c = final[y][x]
            if c == '.': continue
            d.rectangle([30+x*Z, 30+y*Z, 30+x*Z+Z-1, 30+y*Z+Z-1], fill=pal_hex[c])
            d.rectangle([30+S*Z+30+x, 30+y, 30+S*Z+30+x, 30+y], fill=pal_hex[c])
    img.save(out_png)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('input'); ap.add_argument('name')
    ap.add_argument('--height', type=int, default=56)
    ap.add_argument('--out', default='.')
    a = ap.parse_args()
    h = a.height
    final = None
    while final is None and h >= 40:
        final = fit(cleanup(ingest(a.input, h, MASTER_PAL)), a.height)
        if final is None: h -= 2
    used = sorted({c for row in final for c in row if c != '.'})
    pal_hex = {ch: '#%02x%02x%02x' % MASTER_PAL[ch] for ch in used}
    os.makedirs(a.out, exist_ok=True)
    json.dump({'name': a.name, 'size': a.height, 'palette': pal_hex,
               'rows': [''.join(r) for r in final]},
              open(os.path.join(a.out, f'{a.name}.sprite.json'), 'w'), indent=1)
    preview(final, pal_hex, os.path.join(a.out, f'{a.name}.preview.png'))
    print(f'{a.name}: pooled at {h}px, {len(used)} colors -> {a.out}/{a.name}.sprite.json')

if __name__ == '__main__':
    main()
