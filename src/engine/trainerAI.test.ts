import { describe, expect, test } from 'vitest';
import {
  SPECIES,
  activeMon,
  createBattleState,
  createSide,
  foeProfileForFlag,
  mulberry32,
  possibleReleases,
  resolveRound,
  setActiveMember,
  signatureRelease,
  trainerPolicy,
  TRAINER_PROFILES,
} from './index';
import type { Action, BattleState, Stance, TrainerProfile } from './index';

// Combat Layer 4 (Stage 1) — the shared profile decision tree. A profiled
// trainer picks a foe action from stance-tendency + two-step-tendency. Pure
// policy (deterministic given the RNG); no engine-math change.

function freshState(): BattleState {
  return createBattleState(createSide(SPECIES.SPROUTLE!), createSide(SPECIES.SPROUTLE!));
}

// Tally the foe's single-step stance distribution over many independent draws.
function stanceDist(profile: TrainerProfile, n = 4000): { A: number; G: number; F: number; focus: number } {
  const pol = trainerPolicy(profile);
  const out = { A: 0, G: 0, F: 0, focus: 0 };
  for (let i = 0; i < n; i += 1) {
    const a = pol(freshState(), 'foe', mulberry32(1000 + i));
    if (a.kind === 'move' && a.commit === true) out.focus += 1;
    else if (a.kind === 'move') out[a.stance] += 1;
  }
  return out;
}

describe('trainer decision tree — stance tendency picks sensibly', () => {
  test('Aggressor leans Aggressive', () => {
    const d = stanceDist({ name: 'A', stance: 'aggressor', twoStep: 'single-only' });
    expect(d.A).toBeGreaterThan(d.G);
    expect(d.A).toBeGreaterThan(d.F);
  });
  test('Bulwark leans Guard', () => {
    const d = stanceDist({ name: 'B', stance: 'bulwark', twoStep: 'single-only' });
    expect(d.G).toBeGreaterThan(d.A);
    expect(d.G).toBeGreaterThan(d.F);
  });
  test('Evader leans Fluid', () => {
    const d = stanceDist({ name: 'E', stance: 'evader', twoStep: 'single-only' });
    expect(d.F).toBeGreaterThan(d.A);
    expect(d.F).toBeGreaterThan(d.G);
  });
  test('Balanced is an even mix (no dominant stance)', () => {
    const d = stanceDist({ name: 'X', stance: 'balanced', twoStep: 'single-only' });
    const max = Math.max(d.A, d.G, d.F);
    const min = Math.min(d.A, d.G, d.F);
    expect((max - min) / 4000).toBeLessThan(0.08);
  });
});

describe('trainer decision tree — two-step tendency', () => {
  test('Single-only NEVER focuses', () => {
    const d = stanceDist({ name: 'S', stance: 'balanced', twoStep: 'single-only' });
    expect(d.focus).toBe(0);
  });
  test('Occasional focuses sometimes — sensibly (~25%, not spam)', () => {
    const d = stanceDist({ name: 'O', stance: 'aggressor', twoStep: 'occasional', release: 'fixed-Heavy' });
    const rate = d.focus / 4000;
    expect(rate).toBeGreaterThan(0.15);
    expect(rate).toBeLessThan(0.35);
  });
  test('Frequent focuses more often than Occasional', () => {
    const occ = stanceDist({ name: 'O', stance: 'balanced', twoStep: 'occasional' }).focus;
    const freq = stanceDist({ name: 'F', stance: 'balanced', twoStep: 'frequent' }).focus;
    expect(freq).toBeGreaterThan(occ);
  });
  test('a Charger Focuses with the Aggressive base tied to its HEAVY release', () => {
    const pol = trainerPolicy({ name: 'C', stance: 'aggressor', twoStep: 'frequent', release: 'fixed-Heavy' });
    // Find a focus action across seeds; its base stance must be 'A' (→ HEAVY).
    let sawFocus = false;
    for (let i = 0; i < 200 && !sawFocus; i += 1) {
      const a = pol(freshState(), 'foe', mulberry32(50 + i));
      if (a.kind === 'move' && a.commit === true) {
        expect(a.stance).toBe('A');
        sawFocus = true;
      }
    }
    expect(sawFocus).toBe(true);
  });
});

describe('trainer decision tree — release + forced + anti-daze', () => {
  test('a mid-focus trainer RELEASES its signature release', () => {
    const charger = trainerPolicy({ name: 'C', stance: 'aggressor', twoStep: 'occasional', release: 'fixed-Heavy' });
    let state = freshState();
    // Put the foe mid-focus (winding up an Aggressive base).
    const winding = { ...activeMon(state.foe), focus: { stance: 'A' as Stance, move: 'TACKLE' } };
    state = { ...state, foe: setActiveMember(state.foe, winding) };
    const a = charger(state, 'foe', mulberry32(3));
    expect(a.kind).toBe('release');
    if (a.kind === 'release') expect(a.release).toBe('heavy');
  });

  test('forced action (exhaustion) passes through as rest', () => {
    const pol = trainerPolicy({ name: 'A', stance: 'aggressor', twoStep: 'frequent' });
    let state = freshState();
    const spent = { ...activeMon(state.foe), st: 0, exhausted: true };
    state = { ...state, foe: setActiveMember(state.foe, spent) };
    const a = pol(state, 'foe', mulberry32(9));
    expect(a.kind).toBe('rest');
  });

  test('avoids the thrice-repeat self-daze (no same stance a 3rd round running)', () => {
    // History with the foe having played G, G — a Bulwark would want G again,
    // but the tree must shift to dodge the daze.
    const bulwark = trainerPolicy({ name: 'B', stance: 'bulwark', twoStep: 'single-only' });
    let state = freshState();
    state = { ...state, history: [
      { player: null, foe: 'G' },
      { player: null, foe: 'G' },
    ] };
    for (let i = 0; i < 100; i += 1) {
      const a = bulwark(state, 'foe', mulberry32(200 + i));
      if (a.kind === 'move') expect(a.stance).not.toBe('G');
    }
  });
});

describe('profile-vs-wildAI routing (profiled → new AI; wild/unprofiled → stub)', () => {
  test('the three Route-31 trainer flags resolve to their profiles', () => {
    expect(foeProfileForFlag('route31_youngster_beaten')).toBe(TRAINER_PROFILES.youngster);
    expect(foeProfileForFlag('route31_trainer_beaten')).toBe(TRAINER_PROFILES.jay);
    expect(foeProfileForFlag('route31_lass_beaten')).toBe(TRAINER_PROFILES.lass);
  });
  test('an unprofiled flag (and any wild encounter) resolves to undefined → wildFoeAI fallback', () => {
    expect(foeProfileForFlag('some_unprofiled_trainer')).toBeUndefined();
    expect(foeProfileForFlag('')).toBeUndefined();
  });
});

describe('release variability (kickoff knob) — fixed-Heavy vs variable feint-mix', () => {
  function midFocus(profile: TrainerProfile, seed: number): Action {
    let s = freshState();
    s = { ...s, foe: setActiveMember(s.foe, { ...activeMon(s.foe), focus: { stance: 'A' as Stance, move: 'TACKLE' } }) };
    return trainerPolicy(profile)(s, 'foe', mulberry32(seed));
  }
  test('fixed-Heavy ALWAYS releases HEAVY', () => {
    const p: TrainerProfile = { name: 'F', stance: 'aggressor', twoStep: 'occasional', release: 'fixed-Heavy' };
    for (let i = 0; i < 60; i += 1) {
      const a = midFocus(p, i);
      expect(a.kind === 'release' && a.release).toBe('heavy');
    }
  });
  test('variable MIXES FEINT (beats Aggressive → bounds the masher) into the signature', () => {
    const p: TrainerProfile = { name: 'V', stance: 'aggressor', twoStep: 'signature', release: { feintRate: 0.5, signature: 'heavy' } };
    const seen = new Set<string>();
    for (let i = 0; i < 120; i += 1) {
      const a = midFocus(p, i);
      if (a.kind === 'release') seen.add(a.release);
    }
    expect(seen.has('heavy')).toBe(true);
    expect(seen.has('feint')).toBe(true);
  });
  test('possibleReleases + signatureRelease', () => {
    expect(possibleReleases('fixed-Heavy')).toEqual(['heavy']);
    expect([...possibleReleases({ feintRate: 0.3 })].sort()).toEqual(['feint', 'heavy']);
    expect(possibleReleases({ feintRate: 0 })).toEqual(['heavy']); // feintRate 0 → fixed
    expect(signatureRelease('fixed-Heavy')).toBe('heavy');
    expect(signatureRelease({ feintRate: 0.3, signature: 'hide' })).toBe('hide');
  });
});

describe('stamina-aware focusing (kickoff) — bank to fuel the signature', () => {
  // st 20 = winded (heavy locked) but a light is still affordable, so the side
  // is NOT force-rested — the stamina-aware branch can act.
  function windedFoe(momentum: number): BattleState {
    const s = freshState();
    return { ...s, foe: setActiveMember(s.foe, { ...activeMon(s.foe), st: 20, momentum }) };
  }
  const charger: TrainerProfile = { name: 'C', stance: 'aggressor', twoStep: 'occasional', release: 'fixed-Heavy' };
  test('a winded two-stepper WITH ★ banks stamina (Catch Breath)', () => {
    expect(trainerPolicy(charger)(windedFoe(1), 'foe', mulberry32(1)).kind).toBe('catchBreath');
  });
  test('WITHOUT ★ it cannot Catch Breath → does not bank', () => {
    expect(trainerPolicy(charger)(windedFoe(0), 'foe', mulberry32(1)).kind).not.toBe('catchBreath');
  });
  test('a single-only trainer never banks (not a focuser)', () => {
    const turtle: TrainerProfile = { name: 'S', stance: 'bulwark', twoStep: 'single-only' };
    expect(trainerPolicy(turtle)(windedFoe(2), 'foe', mulberry32(1)).kind).not.toBe('catchBreath');
  });
});

describe('the engine resolves a TRAINER focus/release the same as the player', () => {
  test('a trainer Focuses (R1 deals 0) then releases (R2 emits a release event)', () => {
    const charger = trainerPolicy({ name: 'C', stance: 'aggressor', twoStep: 'frequent', release: 'fixed-Heavy' });
    let state = freshState();
    // R1: drive the foe until it chooses a focus (commit), player single-steps.
    let foeAct: Action = { kind: 'rest' };
    for (let seed = 0; seed < 200; seed += 1) {
      const a = charger(state, 'foe', mulberry32(seed));
      if (a.kind === 'move' && a.commit === true) { foeAct = a; break; }
    }
    expect(foeAct.kind).toBe('move');
    const r1 = resolveRound(state, { kind: 'move', move: 'TACKLE', stance: 'G' }, foeAct, mulberry32(1));
    expect(r1.events.some((e) => e.kind === 'focus' && e.side === 'foe')).toBe(true);
    state = r1.state;
    // R2: the foe is mid-focus → policy releases; engine emits a release event.
    const rel = charger(state, 'foe', mulberry32(2));
    expect(rel.kind).toBe('release');
    const r2 = resolveRound(state, { kind: 'move', move: 'TACKLE', stance: 'A' }, rel, mulberry32(2));
    expect(r2.events.some((e) => e.kind === 'release' && e.side === 'foe')).toBe(true);
  });

  test('BOTH-focus → the flipped triangle resolves vs a trainer (flipResolve emitted)', () => {
    let state = freshState();
    // R1: both sides Focus (player Aggressive→HEAVY, foe Aggressive→HEAVY).
    const r1 = resolveRound(
      state,
      { kind: 'move', move: 'TACKLE', stance: 'A', commit: true },
      { kind: 'move', move: 'TACKLE', stance: 'A', commit: true },
      mulberry32(1),
    );
    state = r1.state;
    // R2: both release → the flip (HIDE>HEAVY>FEINT>HIDE).
    const r2 = resolveRound(
      state,
      { kind: 'release', release: 'feint' },
      { kind: 'release', release: 'heavy' },
      mulberry32(1),
    );
    expect(r2.events.some((e) => e.kind === 'flipResolve')).toBe(true);
  });
});
