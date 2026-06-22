#!/usr/bin/env python3
"""
validate_assets.py — Project Argent asset validator (art lint).

Enforces docs/art-reference/tileset_rules.md Rules 1-2 on tileset/PNG art:
  Rule 1  <= 4 unique colours per 16x16 tile (transparent excluded)
  Rule 2  hard-indexed pixels: no partial alpha, no near-duplicate gradient/AA

Accepts:
  *.tileset.json  — checks each tile's `rows`/`pixels` vs the palette (Rule 1)
  *.png           — scans a 16x16 cell grid (Rule 1 + Rule 2: alpha-AA, near-dup)

Hard warnings (colour ceiling + soft AA edges) set a non-zero exit so a batch can
be gated. A missing #000000 outline is reported as an ADVISORY note only (per the
Rule 1 budget) and does not fail the lint. Rules 3-4 (3/4 projection, non-
directional ground) are human review — see tileset_rules.md.

NOTE: this is the design-machine version. CC's sandbox has no Python, so the
runnable twin is tools/validate_assets.mjs (identical rules).

Usage:  python tools/validate_assets.py <path ...> [--tile 16]
"""
import argparse, json, sys
from pathlib import Path

KEYS = '0123456789abcdefghijklmnopqrstuvwxyz'
COLOR_CEIL = 4
NEAR_DIST2 = 14 * 14  # squared distance under which two colours read as a ramp


def h2(hexstr):
    h = hexstr.lstrip('#')
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16))


def d2(a, b):
    return (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2


def eval_cell(colors, partial_alpha, is_png):
    """colors: list of '#rrggbb'. -> (hard_warnings, advisory_notes)."""
    uniq = sorted(set(colors))
    rgb = [h2(c) for c in uniq]
    hard, notes = [], []
    if len(uniq) > COLOR_CEIL:
        hard.append(f'{len(uniq)} colours (>{COLOR_CEIL})')
    if is_png:
        if partial_alpha > 0:
            hard.append(f'{partial_alpha} partial-alpha px - soft AA edges')
        near = sum(
            1
            for i in range(len(rgb))
            for j in range(i + 1, len(rgb))
            if d2(rgb[i], rgb[j]) < NEAR_DIST2
        )
        if near > 0:
            hard.append(f'{near} near-duplicate colour pair(s) - gradient/AA')
    if uniq and '#000000' not in uniq:
        notes.append('no #000000 outline')
    return hard, notes


def chunk(s, n):
    return [s[i:i + n] for i in range(0, len(s), n)]


def validate_tileset(path):
    ts = json.loads(Path(path).read_text())
    pal = [c.lower() for c in ts['palette']]
    size = ts.get('tilesize', 16)
    fails, notes = [], 0
    for tid, t in ts['tiles'].items():
        rows = t.get('rows') or (chunk(t['pixels'], size) if t.get('pixels') else [])
        colors = []
        for row in rows:
            for ch in row:
                if ch in '. ':
                    continue
                idx = KEYS.find(ch)
                if 0 <= idx < len(pal):
                    colors.append(pal[idx])
        hard, note = eval_cell(colors, 0, False)
        if hard:
            fails.append((tid, hard))
        elif note:
            notes += 1
    return 'tileset', len(ts['tiles']), fails, notes


def validate_png(path, tile):
    from PIL import Image
    im = Image.open(path).convert('RGBA')
    W, H = im.size
    px = im.load()
    fails, notes, total = [], 0, 0
    for cy in range(0, H - tile + 1, tile):
        for cx in range(0, W - tile + 1, tile):
            total += 1
            colors, partial = [], 0
            for y in range(tile):
                for x in range(tile):
                    r, g, b, a = px[cx + x, cy + y]
                    if a < 8:
                        continue
                    if a < 248:
                        partial += 1
                        continue
                    colors.append('#%02x%02x%02x' % (r, g, b))
            hard, note = eval_cell(colors, partial, True)
            if hard:
                fails.append((f'cell({cx // tile},{cy // tile})', hard))
            elif note:
                notes += 1
    return 'png', total, fails, notes


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('paths', nargs='+')
    ap.add_argument('--tile', type=int, default=16)
    a = ap.parse_args()
    any_fail = False
    for p in a.paths:
        if not Path(p).exists():
            print(f'SKIP (missing): {p}')
            continue
        kind, total, fails, notes = (
            validate_tileset(p) if p.endswith('.json') else validate_png(p, a.tile)
        )
        unit = 'cells' if kind == 'png' else 'tiles'
        print(f'\n=== {p}  ({kind}, {total} {unit}) ===')
        note_str = f'  [{notes} clean but no #000000 outline - advisory]' if notes else ''
        if not fails:
            print('  OK all pass' + note_str)
            continue
        any_fail = True
        for tid, hard in fails:
            print(f'  X {tid}: {"; ".join(hard)}')
        print(f'  -> {len(fails)}/{total} {unit} VIOLATE Rule 1/2, {total - len(fails)} clean{note_str}')
    print('\nVALIDATION: ' + ('violations found (art lint - see tileset_rules.md)' if any_fail else 'all assets pass'))
    sys.exit(1 if any_fail else 0)


if __name__ == '__main__':
    main()
