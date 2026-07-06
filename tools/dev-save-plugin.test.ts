// Unit tests for the general save-asset validator (Phase-7 Build A). Pure — no fs
// writes, no server. Covers the allowlist + every rejection the endpoint must make.

import { describe, expect, test } from 'vitest';
import { validateSaveRequest, normalizeAllowlistedDir, SAVE_ALLOWLIST_DIRS } from './dev-save-plugin';

const ROOT = process.platform === 'win32' ? 'C:\\repo' : '/repo';
const good = (over: Record<string, unknown> = {}) => ({
  dir: 'assets/sprites',
  filename: 'NEWMON.sprite.json',
  content: '{"name":"NEWMON"}',
  encoding: 'utf8',
  ...over,
});

describe('validateSaveRequest — accepts a well-formed request', () => {
  test('a JSON sprite into assets/sprites/ validates + decodes', () => {
    const v = validateSaveRequest(good(), ROOT);
    expect(v.ok).toBe(true);
    if (v.ok) {
      expect(v.rel).toBe('assets/sprites/NEWMON.sprite.json');
      expect(v.buf.toString('utf8')).toBe('{"name":"NEWMON"}');
    }
  });

  test('a base64 PNG into assets/tilesets/ decodes to bytes', () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47]).toString('base64');
    const v = validateSaveRequest(good({ dir: 'assets/tilesets', filename: 'sheet.png', content: png, encoding: 'base64' }), ROOT);
    expect(v.ok).toBe(true);
    if (v.ok) expect([...v.buf.subarray(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
  });

  test('a trailing slash on dir is tolerated', () => {
    expect(validateSaveRequest(good({ dir: 'assets/palettes/' }), ROOT).ok).toBe(true);
  });

  test('every allowlisted dir is accepted', () => {
    for (const dir of SAVE_ALLOWLIST_DIRS) {
      expect(validateSaveRequest(good({ dir }), ROOT).ok).toBe(true);
    }
  });

  test('assets/cries (Cry Forge) is allowlisted; a <NAME>.cry.json save is accepted', () => {
    expect(SAVE_ALLOWLIST_DIRS.has('assets/cries')).toBe(true);
    const v = validateSaveRequest(good({ dir: 'assets/cries', filename: 'GRITHOAX.cry.json', content: '{"gain":0.6,"voices":[]}' }), ROOT);
    expect(v.ok).toBe(true);
    if (v.ok) expect(v.rel).toBe('assets/cries/GRITHOAX.cry.json'); // .cry.json ends in .json → passes the ext gate
  });

  test('assets/cries still rejects traversal + a bad filename (allowlisting one dir did not weaken the guards)', () => {
    expect(validateSaveRequest(good({ dir: 'assets/cries/../../etc', filename: 'x.cry.json' }), ROOT).ok).toBe(false);
    expect(validateSaveRequest(good({ dir: 'assets/cries', filename: '../ESCAPE.cry.json' }), ROOT).ok).toBe(false);
    expect(validateSaveRequest(good({ dir: 'assets/cries', filename: 'evil.exe' }), ROOT).ok).toBe(false);
  });
});

describe('validateSaveRequest — rejections (each a distinct 4xx)', () => {
  const rejects = (over: Record<string, unknown>, needle: string) => {
    const v = validateSaveRequest(good(over), ROOT);
    expect(v.ok).toBe(false);
    if (!v.ok) {
      expect(v.code).toBeGreaterThanOrEqual(400);
      expect(v.code).toBeLessThan(500);
      expect(v.error.toLowerCase()).toContain(needle);
    }
  };

  test('a non-allowlisted dir is rejected', () => rejects({ dir: 'src/game' }, 'allowlist'));
  test('a dir traversal is rejected', () => rejects({ dir: 'assets/sprites/../../etc' }, 'allowlist'));
  test('an absolute filename is rejected (separator not in the charset)', () => rejects({ filename: '/etc/passwd' }, 'invalid filename'));
  test('a filename with a path separator is rejected', () => rejects({ filename: 'sub/dir.json' }, 'invalid filename'));
  test('a ".." filename is rejected (no extension → also caught)', () => rejects({ filename: '..' }, 'extension'));
  test('a bad extension is rejected', () => rejects({ filename: 'evil.exe' }, 'extension'));
  test('a bad encoding is rejected', () => rejects({ encoding: 'hex' }, 'encoding'));
  test('non-string content is rejected', () => rejects({ content: 123 }, 'content'));
});

describe('normalizeAllowlistedDir — the shared read/list dir gate', () => {
  test('accepts every allowlisted dir (trailing slash + backslashes tolerated)', () => {
    for (const dir of SAVE_ALLOWLIST_DIRS) {
      expect(normalizeAllowlistedDir(dir)).toBe(dir);
      expect(normalizeAllowlistedDir(dir + '/')).toBe(dir);
    }
    expect(normalizeAllowlistedDir('assets\\sprites')).toBe('assets/sprites');
  });
  test('rejects non-allowlisted dirs + traversal + non-strings', () => {
    expect(normalizeAllowlistedDir('src/game')).toBeNull();
    expect(normalizeAllowlistedDir('assets/../etc')).toBeNull();
    expect(normalizeAllowlistedDir('assets')).toBeNull();
    expect(normalizeAllowlistedDir(42)).toBeNull();
    expect(normalizeAllowlistedDir(undefined)).toBeNull();
  });
});
