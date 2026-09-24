// docs/mon-manifest.csv — the LOCKED roster, one row per line stage.
//
// ONE parser for both consumers: the game's placeholder silhouettes
// (src/game/sprites.ts) and the sim's batch validator (src/sim/batchValidate.ts).
// They briefly carried a parser each; the two agreed on every row today only
// because no quoted field in the sheet spans a line, and a line-splitting parser
// would have silently diverged from a char-level one the first time a note did.
// It lives in the engine, beside dexLoader, because that is the one layer both
// the game and the sim are allowed to import.
//
// Pure: takes the CSV text, so callers choose how to load it (Vite `?raw` in the
// game, a file read in Node). No DOM, no file access.

// Field names mirror the sheet's header, so a row reads like the CSV it came from.
export interface ManifestRow {
  readonly line_id: string;
  readonly stage: number;
  // '' for the slots whose identity pass hasn't named them yet.
  readonly name: string;
  readonly stages_total: number;
  readonly bucket: string;
  readonly type1: string;
  readonly type2: string; // '' = single-type
  readonly archetype: string;
  readonly rarity: string;
  readonly evolve_at: number | null;
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

// Header-keyed, so a column reorder in the sheet can't silently shift fields,
// and a missing column fails loudly instead of reading as blanks.
export function parseManifest(text: string): ManifestRow[] {
  const [header, ...body] = parseCsv(text);
  if (!header) return [];
  const col = (name: string): number => {
    const i = header.indexOf(name);
    if (i < 0) throw new Error(`mon-manifest: missing column "${name}"`);
    return i;
  };
  const c = {
    line_id: col('line_id'),
    stage: col('stage'),
    name: col('name'),
    stages_total: col('stages_total'),
    bucket: col('bucket'),
    type1: col('type1'),
    type2: col('type2'),
    archetype: col('archetype'),
    rarity: col('rarity'),
    evolve_at: col('evolve_at'),
  };
  return body
    .filter((r) => r.some((f) => f.trim() !== ''))
    .map((r) => {
      const at = (i: number): string => (r[i] ?? '').trim();
      return {
        line_id: at(c.line_id),
        stage: Number(at(c.stage)),
        name: at(c.name),
        stages_total: Number(at(c.stages_total)),
        bucket: at(c.bucket),
        type1: at(c.type1),
        type2: at(c.type2),
        archetype: at(c.archetype),
        rarity: at(c.rarity),
        evolve_at: at(c.evolve_at) === '' ? null : Number(at(c.evolve_at)),
      };
    });
}
