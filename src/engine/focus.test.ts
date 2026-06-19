import { describe, expect, test } from 'vitest';
import {
  SPECIES,
  activeMon,
  createBattleState,
  createSide,
  fixedRng,
  releaseVsStance,
  resolveRound,
  setActiveMember,
} from './index';
import type { Action, BattleState, ReleaseKind, SideState, Stance } from './index';

// ── Combat FOCUS — engine unit tests ────────────────────────────────────────
// R1 focus (generic, cost), R2 hidden release via the rotation triangle (all 9
// release-vs-stance cells), the timing mismatch (F.4), the both-focus flip, and
// the Call escapes. SPROUTLE mirror; fixedRng([0]) pins variance.

function mirror(): BattleState {
  return createBattleState(createSide(SPECIES.SPROUTLE!), createSide(SPECIES.SPROUTLE!));
}
function patchPlayer(s: BattleState, p: Partial<SideState>): BattleState {
  return { ...s, player: setActiveMember(s.player, { ...activeMon(s.player), ...p }) };
}
function patchFoe(s: BattleState, p: Partial<SideState>): BattleState {
  return { ...s, foe: setActiveMember(s.foe, { ...activeMon(s.foe), ...p }) };
}
const pl = (s: BattleState) => activeMon(s.player);
const fo = (s: BattleState) => activeMon(s.foe);
const rng0 = () => fixedRng([0]);
const focusState = (stance: Stance): { stance: Stance; move: string } => ({ stance, move: 'TACKLE' });
const single = (stance: Stance): Action => ({ kind: 'move', move: 'TACKLE', stance });
const commit = (stance: Stance): Action => ({ kind: 'move', move: 'TACKLE', stance, commit: true });
const release = (r: ReleaseKind): Action => ({ kind: 'release', release: r });
const anyAction: Action = { kind: 'move', move: 'TACKLE', stance: 'A' };

const dmgToFoe = (s: BattleState, r: { state: BattleState }) => fo(s).hp - fo(r.state).hp;
const dmgToPlayer = (s: BattleState, r: { state: BattleState }) => pl(s).hp - pl(r.state).hp;

describe('the rotation triangle helper (all 9 cells)', () => {
  const cells: Array<[ReleaseKind, Stance, 'win' | 'lose' | 'neutral']> = [
    ['heavy', 'G', 'win'], ['heavy', 'F', 'lose'], ['heavy', 'A', 'neutral'],
    ['feint', 'A', 'win'], ['feint', 'G', 'lose'], ['feint', 'F', 'neutral'],
    ['hide', 'F', 'win'], ['hide', 'A', 'lose'], ['hide', 'G', 'neutral'],
  ];
  for (const [r, st, want] of cells) {
    test(`${r} vs ${st} → ${want}`, () => expect(releaseVsStance(r, st)).toBe(want));
  }
});

describe('R1 FOCUS — generic wind-up + cost', () => {
  test('initiating a Focus sets `focus`, deals 0, and emits a generic focus event', () => {
    const s = mirror();
    // Player initiates Focus (commit); foe single-steps Aggressive.
    const r = resolveRound(s, commit('A'), single('A'), rng0());
    expect(r.events.some((e) => e.kind === 'focus' && e.side === 'player')).toBe(true);
    // Generic: the focus event carries no release (hidden).
    const fev = r.events.find((e) => e.kind === 'focus') as { release?: unknown };
    expect((fev as { release?: unknown }).release).toBeUndefined();
    expect(pl(r.state).focus).toEqual(focusState('A'));
    // The focuser dealt NO damage this round.
    expect(dmgToFoe(s, r)).toBe(0);
    // It took the focus cost (the foe's strike landed on it).
    expect(dmgToPlayer(s, r)).toBeGreaterThan(0);
  });

  test('R1 focus grants NO ★ to either side (generic — nothing to read)', () => {
    const r = resolveRound(mirror(), commit('A'), single('G'), rng0());
    expect(r.events.some((e) => e.kind === 'momentum')).toBe(false);
  });
});

describe('R2 RELEASE — the hidden release resolves via the rotation triangle', () => {
  // Player is focusing (R2); foe single-steps. The player passes the release.
  function r2(rel: ReleaseKind, foeStance: Stance) {
    const base = patchPlayer(mirror(), { focus: focusState('A') });
    return { base, r: resolveRound(base, release(rel), single(foeStance), rng0()) };
  }

  test('a WIN (HEAVY vs Brace) deals more than a LOSE (HEAVY vs Fluid)', () => {
    const win = r2('heavy', 'G');
    const lose = r2('heavy', 'F');
    expect(win.r.events.some((e) => e.kind === 'release' && e.outcome === 'win')).toBe(true);
    expect(lose.r.events.some((e) => e.kind === 'release' && e.outcome === 'lose')).toBe(true);
    expect(dmgToFoe(win.base, win.r)).toBeGreaterThan(dmgToFoe(lose.base, lose.r));
  });

  test('the release is CHOSEN at R2 (not predetermined): same focus, different release', () => {
    // Same focus stance, but choosing HIDE vs FEINT yields different outcomes
    // vs the same foe stance (Fluid): HIDE wins, FEINT is neutral.
    const hide = r2('hide', 'F');
    const feint = r2('feint', 'F');
    expect(hide.r.events.some((e) => e.kind === 'release' && e.release === 'hide' && e.outcome === 'win')).toBe(true);
    expect(feint.r.events.some((e) => e.kind === 'release' && e.release === 'feint' && e.outcome === 'neutral')).toBe(true);
  });

  test('a release WIN grants the releaser ★; a LOSS grants the opponent ★; neutral → none', () => {
    expect(r2('heavy', 'G').r.events.some((e) => e.kind === 'momentum' && e.side === 'player')).toBe(true);
    expect(r2('heavy', 'F').r.events.some((e) => e.kind === 'momentum' && e.side === 'foe')).toBe(true);
    expect(r2('heavy', 'A').r.events.some((e) => e.kind === 'momentum')).toBe(false);
  });
});

describe('F.4 timing mismatch — release vs a FOCUSING opponent', () => {
  // Player releases (R2) while the foe initiates a Focus this round (R1).
  function mismatch(rel: ReleaseKind) {
    const base = patchPlayer(mirror(), { focus: focusState('A') });
    return { base, r: resolveRound(base, release(rel), commit('G'), rng0()) };
  }
  test('HEAVY devastates the gatherer (win); FEINT whiffs (lose); HIDE ~neutral', () => {
    const heavy = mismatch('heavy');
    const feint = mismatch('feint');
    expect(heavy.r.events.some((e) => e.kind === 'release' && e.vsFocus === true && e.outcome === 'win')).toBe(true);
    expect(feint.r.events.some((e) => e.kind === 'release' && e.vsFocus === true && e.outcome === 'lose')).toBe(true);
    // HEAVY lands harder on the gatherer than FEINT does.
    expect(dmgToFoe(heavy.base, heavy.r)).toBeGreaterThan(dmgToFoe(feint.base, feint.r));
    // The focusing foe carries its focus into next round (still gathering).
    expect(fo(heavy.r.state).focus).toEqual(focusState('G'));
  });
});

describe('both FOCUS → the FLIPPED triangle (HIDE>HEAVY>FEINT>HIDE)', () => {
  const cases: Array<[ReleaseKind, ReleaseKind, 'player' | 'foe' | null]> = [
    ['hide', 'heavy', 'player'],
    ['heavy', 'feint', 'player'],
    ['feint', 'hide', 'player'],
    ['heavy', 'hide', 'foe'],
    ['heavy', 'heavy', null],
  ];
  for (const [plRel, foeRel, winner] of cases) {
    test(`${plRel} vs ${foeRel} → flip winner ${winner ?? 'none'} (+★)`, () => {
      let s = patchPlayer(mirror(), { focus: focusState('A') });
      s = patchFoe(s, { focus: focusState('A') });
      const r = resolveRound(s, release(plRel), release(foeRel), rng0());
      expect(r.events.some((e) => e.kind === 'flipResolve' && e.winner === winner)).toBe(true);
      expect(r.events.some((e) => e.kind === 'momentum' && e.side === 'player')).toBe(winner === 'player');
      expect(r.events.some((e) => e.kind === 'momentum' && e.side === 'foe')).toBe(winner === 'foe');
    });
  }
});

describe('Call escapes (F.5) from a committed release', () => {
  test('GET AWAY = guaranteed no-hit vs an enemy release; spends 1 ★', () => {
    let s = patchFoe(mirror(), { focus: focusState('A') }); // foe will release
    s = patchPlayer(s, { momentum: 2 });
    const r = resolveRound(s, { kind: 'call', call: 'getAway' }, release('heavy'), rng0());
    expect(r.events.some((e) => e.kind === 'call' && e.side === 'player' && e.call === 'getAway')).toBe(true);
    expect(dmgToPlayer(s, r)).toBe(0);
    expect(pl(r.state).momentum).toBe(1);
  });

  test('HANG IN THERE = cannot drop below 1 hp vs an enemy release', () => {
    let s = patchFoe(mirror(), { focus: focusState('A') });
    s = patchPlayer(s, { momentum: 1, hp: 5 });
    const r = resolveRound(s, { kind: 'call', call: 'hangInThere' }, release('heavy'), rng0());
    expect(pl(r.state).hp).toBe(1);
    expect(r.events.some((e) => e.kind === 'ko')).toBe(false);
  });
});

describe('a releasing mon is locked — its release fires even if another action is passed', () => {
  test('passing a non-release action while focusing still releases (engine default)', () => {
    const base = patchPlayer(mirror(), { focus: focusState('F') }); // F → default HIDE
    const r = resolveRound(base, anyAction, single('F'), rng0());
    // F default release is HIDE; HIDE vs F (Fluid) is a WIN.
    expect(r.events.some((e) => e.kind === 'release' && e.side === 'player' && e.release === 'hide')).toBe(true);
    expect(pl(r.state).focus).toBeUndefined(); // focus cleared after release
  });
});
