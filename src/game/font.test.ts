// What the UI font actually covers.
//
// m3x6 is a pixel font with a SMALL character set. Canvas falls back per-glyph
// and silently: a missing character still draws, just from a system font at the
// wrong weight and advance, inside a pixel-art UI. ui.ts already mitigates the
// known symbol gaps (★ ♥ ▼ ▲ ▶ ► ₽) by redrawing them small — this pins the
// contract underneath that, so swapping or re-subsetting the font cannot
// quietly cost us ordinary text.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Minimal TTF cmap (format 4) reader — enough to answer "is this codepoint mapped".
function fontCoverage(path: string): Set<number> {
  const buf = readFileSync(path);
  const u16 = (o: number): number => buf.readUInt16BE(o);
  const u32 = (o: number): number => buf.readUInt32BE(o);
  let cmap = -1;
  for (let i = 0; i < u16(4); i += 1) {
    const rec = 12 + i * 16;
    if (buf.toString('ascii', rec, rec + 4) === 'cmap') cmap = u32(rec + 8);
  }
  if (cmap < 0) throw new Error('font has no cmap table');
  let sub = -1;
  for (let i = 0; i < u16(cmap + 2); i += 1) {
    const rec = cmap + 4 + i * 8;
    const pid = u16(rec);
    const eid = u16(rec + 2);
    if ((pid === 3 && (eid === 0 || eid === 1)) || pid === 0) sub = cmap + u32(rec + 4);
  }
  if (sub < 0 || u16(sub) !== 4) throw new Error('expected a format-4 cmap subtable');
  const segX2 = u16(sub + 6);
  const endO = sub + 14;
  const startO = endO + segX2 + 2;
  const deltaO = startO + segX2;
  const rangeO = deltaO + segX2;
  const out = new Set<number>();
  for (let s = 0; s < segX2 / 2; s += 1) {
    const end = u16(endO + s * 2);
    const start = u16(startO + s * 2);
    if (start === 0xffff) continue;
    const delta = buf.readInt16BE(deltaO + s * 2);
    const ro = u16(rangeO + s * 2);
    for (let c = start; c <= end && c < 0x2000; c += 1) {
      let g: number;
      if (ro === 0) g = (c + delta) & 0xffff;
      else {
        const gi = rangeO + s * 2 + ro + (c - start) * 2;
        if (gi + 1 >= buf.length) continue;
        g = u16(gi);
        if (g) g = (g + delta) & 0xffff;
      }
      if (g) out.add(c);
    }
  }
  return out;
}

const COVERED = fontCoverage(fileURLToPath(new URL('../assets/fonts/m3x6.ttf', import.meta.url)));
const has = (ch: string): boolean => COVERED.has(ch.codePointAt(0)!);

describe('the UI font (m3x6) covers everything ordinary text needs', () => {
  it('every printable ASCII character is present — dialogue never falls back', () => {
    const missing: string[] = [];
    for (let cp = 0x20; cp <= 0x7e; cp += 1) {
      if (!COVERED.has(cp)) missing.push(String.fromCodePoint(cp));
    }
    expect(missing, `printable ASCII missing from m3x6: ${missing.join(' ')}`).toEqual([]);
  });

  it("the '·' the README claims is present really is", () => {
    expect(has('·')).toBe(true);
  });
});

describe('the ui.ts symbol pass stays justified', () => {
  // If one of these ever ships IN the font, drawing it small from monospace
  // would be strictly worse than drawing it in the real typeface.
  it('every symbol ui.ts redraws is genuinely absent from the font', () => {
    for (const ch of '★♥▼▲▶►₽') {
      expect(has(ch), `${ch} is in m3x6 now — drop it from UI_SYMBOL_RE`).toBe(false);
    }
  });
});

describe('known gaps — NOT covered, and NOT in the symbol pass', () => {
  // Documented so the state is deliberate rather than discovered again later.
  // These draw from a system font: é is visibly off-style (it appears only in
  // Pokémon/Poké naming-debt strings, which the rename pass removes); the em
  // dash is stylistically impure but reads acceptably, and forcing it through
  // the small-symbol pass would make it worse, not better.
  it('é and — are absent from the font', () => {
    expect(has('é')).toBe(false);
    expect(has('—')).toBe(false);
  });
});
