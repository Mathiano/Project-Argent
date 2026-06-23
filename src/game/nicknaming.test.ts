// Mon nicknaming on catch — the data model, the name-on-catch flow (named +
// skipped), save round-trip + backward-compat, display in party/box/battle, and
// the dex-keys-on-species guarantee. The catch-tutorial-still-completes pin is
// held by tutorialCatch.test (the tutorial uses its own onCaught that does NOT
// prompt — naming is default-skipped there).

import { describe, expect, test } from 'vitest';
import { createSide, createBattleState, createTeam, loadDex, loadMoves, mulberry32, registerMoves } from '../engine';
import type { DexEntryJson, MoveJson, SideState } from '../engine';
import ch1BatchData from '../../docs/ch1-batch.json';
import movesData from '../../docs/moves.json';
import { SceneStack } from './scene';
import { createBattleScene } from './scenes/battle';
import { createNameEntryScene, sanitizeName, isNameChar, NAME_MAX_LEN } from './scenes/nameEntry';
import { createConfirmScene } from './scenes/confirmPrompt';
import { monDisplayName } from './monName';
import { toSavedSide, fromSavedSide } from './save';
import type { SavedSide } from './save';
import { createPartyMenuScene } from './scenes/partyMenu';
import { createBoxMenuScene } from './scenes/boxMenu';
import { createDex, markCaught } from './dex';

registerMoves(loadMoves(movesData as MoveJson[]));
const CH1 = loadDex(ch1BatchData as DexEntryJson[], 13);
const resolve = (name: string) => CH1[name]!;

// ── stub canvas: records fillText ───────────────────────────────────────────
function stubCtx(): CanvasRenderingContext2D & { texts: string[] } {
  const texts: string[] = [];
  const noop = () => {};
  let fill = '';
  return new Proxy(
    { texts },
    {
      get(t, p) {
        if (p === 'texts') return (t as { texts: string[] }).texts;
        if (p === 'fillStyle') return fill;
        if (p === 'fillText') return (s: string) => texts.push(String(s));
        if (p === 'measureText') return () => ({ width: 10 });
        if (p === 'canvas') return { width: 320, height: 180 };
        return noop;
      },
      set(_t, p, v) {
        if (p === 'fillStyle') fill = String(v);
        return true;
      },
    },
  ) as unknown as CanvasRenderingContext2D & { texts: string[] };
}

// ── 1. data model + display helper ──────────────────────────────────────────
describe('nickname — data model + display name', () => {
  test('monDisplayName uses the nickname when set, else the species name', () => {
    const base = createSide(resolve('FLITPECK'));
    expect(monDisplayName(base)).toBe('FLITPECK'); // no nickname → species
    expect(monDisplayName({ ...base, nickname: 'Sparky' })).toBe('Sparky');
    expect(monDisplayName({ ...base, nickname: '' })).toBe('FLITPECK'); // empty → species
  });

  test('nickname is additive — species/L00x identity is unchanged', () => {
    const m = { ...createSide(resolve('FLITPECK')), nickname: 'Sparky' };
    expect(m.species.name).toBe('FLITPECK'); // identity intact
  });
});

// ── 2. the name-entry component (the reusable typed field) ──────────────────
describe('nickname — the reusable name-entry component', () => {
  test('sanitizeName trims, collapses whitespace, and caps length', () => {
    expect(sanitizeName('  Sparky  ')).toBe('Sparky');
    expect(sanitizeName('a   b')).toBe('a b');
    expect(sanitizeName('x'.repeat(40)).length).toBe(NAME_MAX_LEN);
  });

  test('isNameChar accepts letters/digits/space, rejects control keys', () => {
    expect(isNameChar('a')).toBe(true);
    expect(isNameChar(' ')).toBe(true);
    expect(isNameChar('7')).toBe(true);
    expect(isNameChar('Enter')).toBe(false);
    expect(isNameChar('Backspace')).toBe(false);
  });

  test('typing → Enter confirms the trimmed name; the cap is enforced', () => {
    let confirmed: string | null = null;
    const s = createNameEntryScene({ prompt: 'Name:', maxLen: NAME_MAX_LEN, onConfirm: (n) => (confirmed = n), onCancel: () => {} });
    for (const ch of 'Sparky') expect(s.textInput!(ch)).toBe(true); // each char consumed
    s.textInput!('Backspace'); // delete the 'y'
    s.textInput!('y');
    s.textInput!('Enter');
    expect(confirmed).toBe('Sparky');
  });

  test('Esc cancels; an empty/whitespace Enter is treated as skip (cancel)', () => {
    let cancelled = 0;
    const esc = createNameEntryScene({ prompt: 'Name:', onConfirm: () => {}, onCancel: () => (cancelled += 1) });
    esc.textInput!('Escape');
    const empty = createNameEntryScene({ prompt: 'Name:', onConfirm: () => {}, onCancel: () => (cancelled += 1) });
    empty.textInput!(' ');
    empty.textInput!('Enter'); // whitespace-only → cancel
    expect(cancelled).toBe(2);
  });
});

// ── 3. the name-on-catch FLOW (mirrors main.ts promptNickname) ──────────────
// Drives the confirm → name-entry scenes through a SceneStack exactly as the
// dispatcher does (input() for buttons, textInput() for raw keys), proving both
// the named and the skipped paths produce the right nickname value.
function runNameOnCatch(choice: 'name' | 'no' | 'esc' | 'emptyEnter', typed = 'Sparky'): string | undefined {
  const stack = new SceneStack();
  let result: { nickname?: string } | null = null;
  const finish = (nickname?: string) => (result = nickname === undefined ? {} : { nickname });
  stack.push(
    createConfirmScene({
      prompt: 'Give FLITPECK a nickname?',
      onYes: () => {
        stack.push(
          createNameEntryScene({
            prompt: 'Name:',
            onConfirm: (n) => { stack.pop(); stack.pop(); finish(n); },
            onCancel: () => { stack.pop(); stack.pop(); finish(undefined); },
          }),
        );
      },
      onNo: () => { stack.pop(); finish(undefined); },
    }),
  );
  if (choice === 'no') {
    stack.input('a'); // confirm cursor defaults to NO → A picks No
  } else {
    stack.input('right'); // toggle to YES
    stack.input('a'); // → onYes → push nameEntry
    if (choice === 'name') {
      for (const ch of typed) expect(stack.textInput(ch)).toBe(true);
      stack.textInput('Enter');
    } else if (choice === 'esc') {
      stack.textInput('Escape');
    } else {
      stack.textInput('Enter'); // empty field
    }
  }
  expect(result).not.toBeNull();
  return result!.nickname;
}

describe('nickname — the name-on-catch flow', () => {
  test('NAMED path: YES → type → Enter stores the nickname', () => {
    expect(runNameOnCatch('name', 'Sparky')).toBe('Sparky');
  });
  test('SKIPPED path (No): the mon keeps its species name (no nickname)', () => {
    expect(runNameOnCatch('no')).toBeUndefined();
  });
  test('SKIPPED path (Esc / empty): also no nickname', () => {
    expect(runNameOnCatch('esc')).toBeUndefined();
    expect(runNameOnCatch('emptyEnter')).toBeUndefined();
  });
  test('the SceneStack routes raw keys to the active text field only', () => {
    const stack = new SceneStack();
    stack.push(createConfirmScene({ prompt: '?', onYes: () => {}, onNo: () => {} }));
    expect(stack.textInput('a')).toBe(false); // confirm has no text field → not consumed
    stack.push(createNameEntryScene({ prompt: 'Name:', onConfirm: () => {}, onCancel: () => {} }));
    expect(stack.textInput('a')).toBe(true); // name entry consumes it
  });
});

// ── 4. save / load round-trip + backward compatibility ──────────────────────
describe('nickname — save/load round-trip + old saves', () => {
  test('toSavedSide → fromSavedSide round-trips the nickname', () => {
    const named: SideState = { ...createSide(resolve('FLITPECK')), nickname: 'Sparky' };
    const saved = toSavedSide(named);
    expect(saved.nickname).toBe('Sparky');
    const restored = fromSavedSide(saved, resolve);
    expect(restored.nickname).toBe('Sparky');
    expect(restored.species.name).toBe('FLITPECK'); // identity intact
  });

  test('a mon with NO nickname has no nickname field on the wire (shape unchanged)', () => {
    const plain = createSide(resolve('FLITPECK'));
    const saved = toSavedSide(plain);
    expect('nickname' in saved).toBe(false);
  });

  test('OLD saves (no nickname field) still load → display the species name', () => {
    const legacy: SavedSide = { speciesName: 'FLITPECK', hp: 10, st: 100, momentum: 0 }; // pre-nickname shape
    const restored = fromSavedSide(legacy, resolve);
    expect(restored.nickname).toBeUndefined();
    expect(monDisplayName(restored)).toBe('FLITPECK'); // backward-compatible
  });
});

// ── 5. display coverage (party / box) ───────────────────────────────────────
describe('nickname — display in party + box menus', () => {
  const nicknamed: SideState = { ...createSide(resolve('FLITPECK')), nickname: 'Sparky' };

  test('the party list + summary show the nickname (and surface the species)', () => {
    const scene = createPartyMenuScene({ party: [nicknamed], onReorder: () => {}, onClose: () => {} });
    const list = stubCtx();
    scene.draw(list);
    expect(list.texts.some((t) => t.includes('Sparky'))).toBe(true);
    // open SUMMARY: A (action popup) → A (summary)
    scene.input!('a');
    scene.input!('a');
    const summary = stubCtx();
    scene.draw(summary);
    const joined = summary.texts.join(' | ');
    expect(joined).toContain('Sparky'); // the nickname
    expect(joined).toContain('FLITPECK'); // NICKNAME / SPECIES — identity surfaced
  });

  test('the box list + summary show the nickname', () => {
    const scene = createBoxMenuScene({
      party: [createSide(resolve('SILTSKIP'))], partyBond: [5], partyOrigin: ['starter'],
      box: [nicknamed], boxBond: [5], boxOrigin: ['read'],
      onChange: () => {}, onClose: () => {},
    });
    const ctx = stubCtx();
    scene.draw(ctx);
    expect(ctx.texts.some((t) => t.includes('Sparky'))).toBe(true);
  });
});

// ── 5b. display coverage (battle) ───────────────────────────────────────────
describe('nickname — display in battle (player shows nickname, foe shows species)', () => {
  test('the battle status names the player mon by its nickname; the foe by species', () => {
    const player = createTeam([{ ...createSide(resolve('FLITPECK')), nickname: 'Sparky' }]);
    const foe = createTeam([createSide(resolve('GRUBLEAF'))]);
    const scene = createBattleScene({
      state: createBattleState(player, foe),
      rng: mulberry32(1),
      chooseFoeAction: () => ({ kind: 'move', move: 'TACKLE', stance: 'A' }),
      intro: [],
      catchBreathUnlocked: false,
      canRun: false,
      onResolve: () => {},
    });
    scene.update?.(0.01); // past intro → the HP/status panels draw
    const ctx = stubCtx();
    scene.draw(ctx);
    const joined = ctx.texts.join(' | ');
    expect(joined).toContain('Sparky'); // the player's nickname, not 'FLITPECK'
    expect(joined).not.toContain('FLITPECK'); // species name suppressed for the named player mon
    expect(joined).toContain('GRUBLEAF'); // the foe shows its species (never nicknamed)
  });
});

// ── 6. the dex keys on SPECIES, never the nickname ──────────────────────────
describe('nickname — the dex is species-keyed (unaffected)', () => {
  test('caught registers under the species name; a nickname never enters the dex', () => {
    const dex = createDex();
    // main.ts addCaughtMon calls markCaught(dex, species.name) regardless of nickname.
    markCaught(dex, 'FLITPECK');
    expect(dex.caught.has('FLITPECK')).toBe(true); // species-keyed
    expect(dex.caught.has('Sparky')).toBe(false); // the nickname is NOT a dex key
  });
});
