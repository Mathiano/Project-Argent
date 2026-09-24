// docs/mon-manifest.csv parser — the LOCKED roster (one row per line stage).
// Pure: takes the CSV text, so callers choose how to load it (Vite `?raw` in
// the game, a file read in Node). No DOM, no engine imports.

export interface ManifestRow {
  readonly lineId: string;
  readonly stage: number;
  // '' for the slots whose identity pass hasn't named them yet.
  readonly name: string;
  readonly bucket: string;
  readonly type1: string;
  readonly type2: string;
  readonly archetype: string;
}

// Minimal RFC 4180 split: quoted fields may hold commas, newlines and "" escapes.
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]!;
    if (quoted) {
      if (ch !== '"') field += ch;
      else if (text[i + 1] === '"') { field += '"'; i += 1; }
      else quoted = false;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (ch !== '\r') field += ch;
  }
  if (field !== '' || row.length > 0) { row.push(field); rows.push(row); }
  return rows;
}

// Header-keyed, so a column reorder in the sheet can't silently shift fields.
export function parseManifest(text: string): ManifestRow[] {
  const [header, ...body] = parseCsv(text);
  if (!header) return [];
  const col = (name: string): number => {
    const i = header.indexOf(name);
    if (i < 0) throw new Error(`mon-manifest: missing column "${name}"`);
    return i;
  };
  const c = {
    lineId: col('line_id'), stage: col('stage'), name: col('name'), bucket: col('bucket'),
    type1: col('type1'), type2: col('type2'), archetype: col('archetype'),
  };
  return body
    .filter((r) => r.some((f) => f.trim() !== ''))
    .map((r) => ({
      lineId: (r[c.lineId] ?? '').trim(),
      stage: Number(r[c.stage]),
      name: (r[c.name] ?? '').trim(),
      bucket: (r[c.bucket] ?? '').trim(),
      type1: (r[c.type1] ?? '').trim(),
      type2: (r[c.type2] ?? '').trim(),
      archetype: (r[c.archetype] ?? '').trim(),
    }));
}
