// Dev-only Vite middleware for Argent Studio: persists authored tile sheets into the
// repo's assets/tilesets/ dir and maintains a manifest CC resolves asset names against.
//
// Active ONLY under `npm run dev` (apply: 'serve' + configureServer) — zero effect on
// build / test / prod. Scoped tightly: it writes ONLY inside assets/tilesets/, rejects
// any name that isn't filesystem-safe, and refuses to clobber an existing file unless
// the request opts in with { overwrite: true }. No new dependency — Node fs + Vite only.
//
// Endpoints:
//   POST /api/save-asset  { name, tileset, description?, cols?, rows?, count?, overwrite? }
//        → writes assets/tilesets/<name>.tileset.json (round-trip format unchanged) and
//          upserts the manifest entry. 409 if the name exists and overwrite isn't set.
//   GET  /api/assets      → the current manifest (so the Studio can show what exists).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { join, resolve, sep } from 'node:path';
import type { Plugin } from 'vite';

const NAME_RE = /^[a-z0-9][a-z0-9_]*$/; // filesystem-safe: lower alnum + underscore, leading alnum/digit

interface ManifestEntry {
  name: string;
  file: string;
  tilesize: number;
  cols: number | null;
  rows: number | null;
  count: number;
  description: string;
}
interface Manifest {
  _note: string;
  assets: ManifestEntry[];
}

const MANIFEST_NOTE =
  'Argent Studio asset registry — saved tile sheets at assets/tilesets/<name>.tileset.json. ' +
  'CC resolves an asset name (e.g. "grass_a") to its file here. Auto-maintained by the Studio "Save to project" button.';

export function argentStudioSavePlugin(repoRoot: string): Plugin {
  const tilesetsDir = resolve(repoRoot, 'assets', 'tilesets');
  const manifestPath = join(tilesetsDir, 'manifest.json');

  const readManifest = (): Manifest => {
    if (!existsSync(manifestPath)) return { _note: MANIFEST_NOTE, assets: [] };
    try {
      const m = JSON.parse(readFileSync(manifestPath, 'utf8')) as Partial<Manifest>;
      return { _note: MANIFEST_NOTE, assets: Array.isArray(m.assets) ? m.assets : [] };
    } catch {
      return { _note: MANIFEST_NOTE, assets: [] };
    }
  };

  const sendJSON = (res: ServerResponse, code: number, obj: unknown): void => {
    res.statusCode = code;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(obj));
  };

  const readBody = (req: IncomingMessage): Promise<string> =>
    new Promise<string>((ok, fail) => {
      let b = '';
      req.on('data', (c: Buffer) => {
        b += c.toString();
        if (b.length > 4_000_000) req.destroy(); // hard cap — a tile sheet is tiny
      });
      req.on('end', () => ok(b));
      req.on('error', fail);
    });

  return {
    name: 'argent-studio-save-asset',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req: IncomingMessage, res: ServerResponse, next: () => void) => {
        const url = req.url ?? '';
        if (url === '/api/assets' && req.method === 'GET') {
          sendJSON(res, 200, readManifest());
          return;
        }
        if (url !== '/api/save-asset' || req.method !== 'POST') {
          next();
          return;
        }
        void (async () => {
          try {
            const body = JSON.parse((await readBody(req)) || '{}') as {
              name?: unknown;
              tileset?: ({ tilesize?: number; tiles?: Record<string, unknown> } & Record<string, unknown>) | null;
              description?: unknown;
              cols?: unknown;
              rows?: unknown;
              count?: unknown;
              overwrite?: unknown;
            };
            const name = typeof body.name === 'string' ? body.name : '';
            if (!NAME_RE.test(name)) {
              sendJSON(res, 400, { ok: false, error: 'invalid name — use a-z 0-9 _ (leading letter/digit)' });
              return;
            }
            const tileset = body.tileset;
            if (!tileset || typeof tileset !== 'object' || !tileset.tiles) {
              sendJSON(res, 400, { ok: false, error: 'missing tileset object' });
              return;
            }
            const rel = 'assets/tilesets/' + name + '.tileset.json';
            const file = join(tilesetsDir, name + '.tileset.json');
            // defence-in-depth: the resolved path must sit directly inside assets/tilesets/
            if (!file.startsWith(tilesetsDir + sep)) {
              sendJSON(res, 403, { ok: false, error: 'path escapes assets/tilesets' });
              return;
            }
            const overwrite = body.overwrite === true;
            const exists = existsSync(file);
            if (exists && !overwrite) {
              sendJSON(res, 409, { ok: false, error: 'exists', exists: true, file: rel });
              return;
            }
            mkdirSync(tilesetsDir, { recursive: true });
            const out = { ...tileset, name }; // the name field is authoritative
            writeFileSync(file, JSON.stringify(out, null, 1));

            const toNum = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
            const tilesize = typeof tileset.tilesize === 'number' ? tileset.tilesize : 16;
            const count = toNum(body.count) ?? Object.keys(tileset.tiles).length;
            const entry: ManifestEntry = {
              name,
              file: rel,
              tilesize,
              cols: toNum(body.cols),
              rows: toNum(body.rows),
              count,
              description: typeof body.description === 'string' ? body.description.slice(0, 300) : '',
            };
            const man = readManifest();
            const i = man.assets.findIndex((a) => a.name === name);
            if (i >= 0) man.assets[i] = entry;
            else man.assets.push(entry);
            man.assets.sort((a, b) => a.name.localeCompare(b.name));
            writeFileSync(manifestPath, JSON.stringify(man, null, 1));

            sendJSON(res, 200, { ok: true, file: rel, manifest: 'assets/tilesets/manifest.json', clobbered: exists });
          } catch (e) {
            sendJSON(res, 500, { ok: false, error: e instanceof Error ? e.message : String(e) });
          }
        })();
      });
    },
  };
}
