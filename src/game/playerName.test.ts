// Player character naming — the [player] token source captured at new-game via
// the reusable nameEntry primitive. Covers: the resolve rule (real name vs the
// graceful null drop), the new-game prompt contract (confirm stores + proceeds,
// skip stores null + proceeds), and the [player] wiring through KAMON's CH1
// ending line. Save persistence + backward-compat live in save.test.ts.

import { describe, expect, test } from 'vitest';
import { resolvePlayerName } from './playerName';
import { createNameEntryScene, NAME_MAX_LEN, sanitizeName } from './scenes/nameEntry';
import { kamonGateLines } from './ch1Ending';

const join = (lines: readonly string[]) => lines.join(' ');

describe('player name — resolvePlayerName (the [player] resolve rule)', () => {
  test('a real name is preferred + sanitized (trim / collapse / cap)', () => {
    expect(resolvePlayerName('Red')).toBe('Red');
    expect(resolvePlayerName('  Red  ')).toBe('Red');
    expect(resolvePlayerName('a  b')).toBe('a b');
    expect(resolvePlayerName('x'.repeat(40))!.length).toBe(NAME_MAX_LEN);
  });

  test('blank / whitespace / absent → null (the graceful drop)', () => {
    expect(resolvePlayerName('')).toBeNull();
    expect(resolvePlayerName('   ')).toBeNull();
    expect(resolvePlayerName(null)).toBeNull();
    expect(resolvePlayerName(undefined)).toBeNull();
  });
});

// Mirror main.ts's promptPlayerName contract exactly, driving the REAL nameEntry
// scene: confirm → store sanitized name + proceed; skip/blank → store null + proceed.
function runNamePrompt(keys: string[]): { stored: string | null; proceeded: boolean } {
  let stored: string | null = null;
  let proceeded = false;
  const scene = createNameEntryScene({
    prompt: "What's your name?",
    maxLen: NAME_MAX_LEN,
    onConfirm: (name) => { stored = sanitizeName(name); proceeded = true; },
    onCancel: () => { stored = null; proceeded = true; },
  });
  for (const k of keys) scene.textInput!(k);
  return { stored, proceeded };
}

describe('player name — the new-game prompt (reuses nameEntry)', () => {
  test('typing a name + Enter stores it and proceeds into the opening', () => {
    const r = runNamePrompt(['A', 'S', 'H', 'Enter']);
    expect(r.stored).toBe('ASH');
    expect(r.proceeded).toBe(true);
  });

  test('Esc (skip) stores null and still proceeds — the opening is never blocked', () => {
    const r = runNamePrompt(['Escape']);
    expect(r.stored).toBeNull();
    expect(r.proceeded).toBe(true);
  });

  test('Enter on an empty field skips (null) and proceeds — a blank name never sticks', () => {
    const r = runNamePrompt(['Enter']);
    expect(r.stored).toBeNull();
    expect(r.proceeded).toBe(true);
  });
});

describe('player name — flows through the [player] token (KAMON ending line)', () => {
  test('a stored name fills KAMON\'s sign-off', () => {
    const t = join(kamonGateLines(true, resolvePlayerName('ASH')));
    expect(t).toContain('See you out there, ASH.');
    expect(t).not.toMatch(/\[player\]/);
  });

  test('a blank name drops the address cleanly (no dangling token)', () => {
    const t = join(kamonGateLines(true, resolvePlayerName('   ')));
    expect(t).toContain('See you out there.');
    expect(t).not.toContain('See you out there,');
    expect(t).not.toMatch(/\[player\]/);
  });
});
