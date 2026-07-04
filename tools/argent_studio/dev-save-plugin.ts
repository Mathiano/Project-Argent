// Dev-only Vite middleware — the studios' SAVE-TO-REPO endpoint. Persists authored
// assets into the repo in dev. Two contracts on POST /api/save-asset, discriminated
// by body shape:
//
//   GENERAL (Phase-7 Build A) { dir, filename, content, encoding }
//        → writes <dir>/<filename> for dir in an ALLOWLIST (sprites/tilesets/prefabs/
//          anim/palettes), filename ^[A-Za-z0-9._-]+$, ext .json|.png, encoding utf8|
//          base64. Overwrite is allowed (iteration is the point) — the response says
//          { overwrote }. Used by Sprite Studio (sprite.json, ramp) + Argent Studio's
//          PNG/prefab exports + future tools (Sound Board, anim). Does NOT register.
//
//   LEGACY (Argent Studio tilesets) { name, tileset, description?, cols?, rows?, count?, overwrite? }
//        → writes assets/tilesets/<name>.tileset.json AND upserts the manifest CC
//          resolves asset names against. 409 if the name exists and overwrite isn't set.
//
// Active ONLY under `npm run dev` (apply: 'serve' + configureServer) — zero effect on
// build / test / prod. No new dependency — Node fs + Vite only.
//
// Other endpoints:
//   GET  /api/save-asset/ping → 200 {ok} — feature-detect (tools hide save buttons when absent).
//   GET  /api/assets          → the current tileset manifest.
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { join, resolve, sep } from 'node:path';
import type { Plugin } from 'vite';

const NAME_RE = /^[a-z0-9][a-z0-9_]*$/; // filesystem-safe: lower alnum + underscore, leading alnum/digit

// ── General save-asset contract (Phase-7 Build A) — PURE + unit-tested ────────
// The write allowlist: repo-relative dirs the endpoint may write into. Anything
// else is rejected. (Trailing slash normalised away before the check.)
export const SAVE_ALLOWLIST_DIRS: ReadonlySet<string> = new Set([
  'assets/sprites',
  'assets/tilesets',
  'assets/prefabs',
  'assets/anim',
  'assets/palettes',
]);
const FILENAME_RE = /^[A-Za-z0-9._-]+$/; // single path component — no separators, no absolute paths

// Normalise + allowlist-check a repo-relative dir (shared by save + the read-only
// GET /api/list-dir listing). Returns the normalised dir or null if not allowlisted.
export function normalizeAllowlistedDir(dirRaw: unknown): string | null {
  const dir = typeof dirRaw === 'string' ? dirRaw.replace(/\\/g, '/').replace(/\/+$/, '') : '';
  return SAVE_ALLOWLIST_DIRS.has(dir) ? dir : null;
}

export type SaveValidation =
  | { readonly ok: true; readonly dir: string; readonly filename: string; readonly buf: Buffer; readonly rel: string }
  | { readonly ok: false; readonly code: number; readonly error: string };

// Validate + decode a general save request. Rejects: non-allowlisted dir, path
// traversal (`..`) / absolute paths / separators (blocked by FILENAME_RE), a filename
// whose extension isn't .json/.png, a bad encoding, and — defence-in-depth — any
// resolved path that escapes the allowlisted dir. No filesystem writes here (pure).
export function validateSaveRequest(body: unknown, repoRoot: string): SaveValidation {
  const b = (body ?? {}) as { dir?: unknown; filename?: unknown; content?: unknown; encoding?: unknown };
  const dir = normalizeAllowlistedDir(b.dir);
  if (dir === null) {
    return { ok: false, code: 400, error: `dir "${String(b.dir)}" not in the allowlist (${[...SAVE_ALLOWLIST_DIRS].join(', ')})` };
  }
  const filename = typeof b.filename === 'string' ? b.filename : '';
  if (!FILENAME_RE.test(filename)) {
    return { ok: false, code: 400, error: 'invalid filename — must match ^[A-Za-z0-9._-]+$ (no path separators, no "..")' };
  }
  const dot = filename.lastIndexOf('.');
  const ext = dot >= 0 ? filename.slice(dot).toLowerCase() : '';
  if (ext !== '.json' && ext !== '.png') {
    return { ok: false, code: 400, error: 'extension must be .json or .png' };
  }
  const encoding = b.encoding === 'base64' ? 'base64' : b.encoding === 'utf8' ? 'utf8' : null;
  if (encoding === null) {
    return { ok: false, code: 400, error: 'encoding must be "utf8" or "base64"' };
  }
  if (typeof b.content !== 'string') {
    return { ok: false, code: 400, error: 'content must be a string' };
  }
  let buf: Buffer;
  try {
    buf = Buffer.from(b.content, encoding);
  } catch {
    return { ok: false, code: 400, error: 'content failed to decode' };
  }
  // defence-in-depth: the resolved target must sit directly inside the allowlisted dir.
  const dirAbs = resolve(repoRoot, dir);
  const fileAbs = resolve(dirAbs, filename);
  if (!fileAbs.startsWith(dirAbs + sep)) {
    return { ok: false, code: 400, error: 'resolved path escapes the target directory' };
  }
  return { ok: true, dir, filename, buf, rel: `${dir}/${filename}` };
}

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
        // Feature-detect: tools GET this on load; a 200 means save-to-repo is available.
        if (url === '/api/save-asset/ping' && req.method === 'GET') {
          sendJSON(res, 200, { ok: true, dirs: [...SAVE_ALLOWLIST_DIRS] });
          return;
        }
        if (url === '/api/assets' && req.method === 'GET') {
          sendJSON(res, 200, readManifest());
          return;
        }
        // READ-ONLY directory listing (Dex Forge): GET /api/list-dir?dir=<allowlisted>
        // → { ok, dir, files } (files only, sorted). Non-existent dir → empty list.
        if (url.startsWith('/api/list-dir') && req.method === 'GET') {
          const q = new URL(url, 'http://localhost').searchParams.get('dir');
          const dir = normalizeAllowlistedDir(q);
          if (dir === null) {
            sendJSON(res, 400, { ok: false, error: `dir "${String(q)}" not in the allowlist (${[...SAVE_ALLOWLIST_DIRS].join(', ')})` });
            return;
          }
          const abs = resolve(repoRoot, dir);
          let files: string[] = [];
          try {
            if (existsSync(abs)) files = readdirSync(abs, { withFileTypes: true }).filter((d) => d.isFile()).map((d) => d.name).sort();
          } catch {
            files = [];
          }
          sendJSON(res, 200, { ok: true, dir, files });
          return;
        }
        if (url !== '/api/save-asset' || req.method !== 'POST') {
          next();
          return;
        }
        void (async () => {
          try {
            const raw = JSON.parse((await readBody(req)) || '{}') as Record<string, unknown>;
            // GENERAL contract (Build A): { dir, filename, content, encoding }. Any of
            // these fields present → route to the allowlisted file write (not the legacy
            // tileset+manifest path). Overwrite is allowed; the response reports it.
            if ('dir' in raw || 'filename' in raw || 'content' in raw) {
              const v = validateSaveRequest(raw, repoRoot);
              if (!v.ok) {
                sendJSON(res, v.code, { ok: false, error: v.error });
                return;
              }
              const dirAbs = resolve(repoRoot, v.dir);
              const fileAbs = join(dirAbs, v.filename);
              const overwrote = existsSync(fileAbs);
              mkdirSync(dirAbs, { recursive: true });
              writeFileSync(fileAbs, v.buf);
              sendJSON(res, 200, { ok: true, path: v.rel, overwrote });
              return;
            }
            const body = raw as {
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
