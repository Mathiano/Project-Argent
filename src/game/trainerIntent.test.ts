// The shared intent/info derivation (profileIntentInfo) used by BOTH the generic
// trainer path (pushTrainerFight) and the bespoke rival path (KAMON's showRivalBattle /
// pushRivalGateFight). Mirrors how pushTrainerFight's intent wiring is derived; pins
// that KAMON now runs on his profile's mapping (not the scene default) and that it's
// behaviorally inert at fight 1.

import { describe, expect, test } from 'vitest';
import { profileIntentInfo } from './trainerIntent';
import { infoLevelToReliability } from './scenes/battle';
import { TRAINER_PROFILES } from '../engine';
import type { TrainerProfile } from '../engine';

describe('profileIntentInfo — KAMON (the rival path now uses his profile)', () => {
  const kamon = TRAINER_PROFILES.kamon!;
  const info = profileIntentInfo(kamon);

  test('derives from KAMON’s profile infoLevel (open), not the scene default', () => {
    expect(kamon.infoLevel).toBe('open');
    expect(info.intentReliability).toBe(infoLevelToReliability('open')); // same derivation as pushTrainerFight
    expect(info.foeFocusInfo.discipline).toBe('open');
    expect(info.foeFocusInfo.salt).toBe('KAMON'); // per-trainer narrowing seed
    expect(info.foeFocusInfo.releases).toEqual(['heavy']); // single-only → no real release set
  });

  test('behaviorally INERT at fight 1: open → honest === the battle-scene default', () => {
    // battle.ts uses `opts.intentReliability ?? 'honest'`, so passing the profile-derived
    // value changes nothing for an 'open' foe. And KAMON is single-only → never Focuses,
    // so foeFocusInfo is never consulted in the CH1 fight.
    expect(info.intentReliability).toBe('honest');
    expect(kamon.twoStep).toBe('single-only');
  });
});

describe('profileIntentInfo — the derivation generalizes (correct wiring for CH2+)', () => {
  const mk = (p: Partial<TrainerProfile>): TrainerProfile => ({ name: 'T', stance: 'aggressor', twoStep: 'single-only', ...p });

  test('infoLevel maps to the right reliability tier', () => {
    expect(profileIntentInfo(mk({ infoLevel: 'open' })).intentReliability).toBe('honest');
    expect(profileIntentInfo(mk({ infoLevel: 'veiled' })).intentReliability).toBe('ambiguous');
    expect(profileIntentInfo(mk({ infoLevel: 'opaque' })).intentReliability).toBe('opaque');
    expect(profileIntentInfo(mk({})).intentReliability).toBe('honest'); // omitted → open
  });

  test('a two-step release model widens the focus-tell release set (incl. feint)', () => {
    const variable = profileIntentInfo(mk({ twoStep: 'occasional', release: { signature: 'heavy', feintRate: 0.3 } }));
    expect(variable.foeFocusInfo.releases).toEqual(expect.arrayContaining(['heavy', 'feint']));
  });

  test('infoOverride (the Bluffer hook) overrides per-axis', () => {
    const bluffer = profileIntentInfo(mk({ infoLevel: 'open', infoOverride: { stance: 'opaque', focus: 'veiled' } }));
    expect(bluffer.intentReliability).toBe('opaque'); // stance axis overridden
    expect(bluffer.foeFocusInfo.discipline).toBe('veiled'); // focus axis overridden
  });
});

describe('profileIntentInfo — the foe ★ meter (Layer 3.5 momentum axis)', () => {
  // The DEFAULT is SHOWN, on purpose: the momentum differential drives the
  // behind-penalty and the foe's phased tier access, so hiding it by default
  // hides load-bearing state (docs/combat-build-status.md — the reversal).
  const mk = (over: Partial<TrainerProfile>): TrainerProfile => ({
    name: 'T', stance: 'balanced', twoStep: 'single-only', ...over,
  } as TrainerProfile);

  test('defaults to shown when no override is set', () => {
    expect(profileIntentInfo(mk({})).foeMomentumInfo).toBe('open');
  });

  test('a veiled/opaque TELL does not hide the ★ meter — the axes are separate', () => {
    expect(profileIntentInfo(mk({ infoLevel: 'veiled' })).foeMomentumInfo).toBe('open');
    expect(profileIntentInfo(mk({ infoLevel: 'opaque' })).foeMomentumInfo).toBe('open');
  });

  test('only an explicit momentum override hides it', () => {
    expect(profileIntentInfo(mk({ infoOverride: { momentum: 'opaque' } })).foeMomentumInfo).toBe('opaque');
  });

  test('every shipped CH1 trainer shows its ★; WARDEN (Elite Four base) hides it', () => {
    for (const key of ['greenhorn', 'bruiser', 'skirmisher', 'jay', 'lass', 'kamon', 'youngster']) {
      const p = TRAINER_PROFILES[key];
      if (!p) continue;
      expect(profileIntentInfo(p).foeMomentumInfo, key).toBe('open');
    }
    expect(profileIntentInfo(TRAINER_PROFILES.warden!).foeMomentumInfo).toBe('opaque');
  });
});
