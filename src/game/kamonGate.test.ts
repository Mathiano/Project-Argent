import { describe, expect, test } from 'vitest';
import {
  createBattleState,
  createSide,
  createTeam,
  loadDex,
  loadMoves,
  mulberry32,
  registerMoves,
} from '../engine';
import type { DexEntryJson, MoveJson, TypeChart } from '../engine';
import ch1BatchData from '../../docs/ch1-batch.json';
import movesData from '../../docs/moves.json';
import typechartData from '../../docs/typechart.json';
import { createBattleScene } from './scenes/battle';
import { DEFAULT_DEFS } from './overworld/tiledWiring';

registerMoves(loadMoves(movesData as MoveJson[]));
const CH1 = loadDex(ch1BatchData as DexEntryJson[], 13);
const TYPECHART = typechartData as TypeChart;

// ── The KAMON gate as a WIRING def (map-independent placement) ───────────────
describe('npc_kamon_gate — the gate behind the standard wiring contract', () => {
  const def = DEFAULT_DEFS.npc.npc_kamon_gate;

  test('is registered, blocks the road, and steps aside on the gate flag', () => {
    expect(def).toBeTruthy();
    expect(def!.blockedUntilFlag).toBe('kamon_gate_beaten'); // KAMON despawns once beaten
    expect(def!.approachOnEnter).toBe(true); // he walks up + blocks
  });

  test('its interact runs the pre-fight dialogue, then the bespoke gate step', () => {
    const steps = def!.interact ?? [];
    expect(steps[0]!.kind).toBe('dialog');
    expect(steps[steps.length - 1]!.kind).toBe('start-rival-gate'); // → main.ts showKamonGate
  });
});

// ── The hesitation TELL — the two presentation beats fire at the right moments ─
// A lopsided fight so the foe's first mon falls and the SECOND is sent in: beat
// (a) fires on that send-in (toIndex 1), beat (b) fires as a foe drops to low HP.
describe('the hesitation tell — presentation beats (0.85 made visible)', () => {
  test('onFoeSwitchIn(ace) + onFoeActiveLowHp both fire across a 2-mon foe fight', () => {
    const switchIns: Array<[number, string]> = [];
    const lowHps: string[] = [];
    let winner: 'player' | 'foe' | null = null;
    const scene = createBattleScene({
      state: createBattleState(
        createTeam([createSide(CH1.KINDRAKE!)]),
        createTeam([ // KAMON-shaped 2-mon foe, made trivially fragile so the drive reliably KOs both
          { ...createSide(CH1.VINESNAP!), hp: 5 },
          { ...createSide(CH1.VINESNAP!), hp: 5 },
        ]),
        { typeChart: TYPECHART },
      ),
      rng: mulberry32(1),
      chooseFoeAction: () => ({ kind: 'move', move: 'TACKLE', stance: 'G' }), // passive foe
      intro: [],
      catchBreathUnlocked: false,
      canRun: false,
      onFoeSwitchIn: (toIndex, species) => { switchIns.push([toIndex, species]); return ['it hesitates']; },
      onFoeActiveLowHp: (species) => { lowHps.push(species); return 'it falters'; },
      onResolve: (w) => { winner = w; },
    });
    // Drive: attack every round until the fight resolves (or a generous cap).
    for (let i = 0; i < 40 && winner === null; i += 1) {
      scene.input?.('a'); // FIGHT
      scene.input?.('a'); // commit the first move
      for (let k = 0; k < 80; k += 1) scene.update?.(0.2); // drain the resolve
    }
    expect(winner).toBe('player'); // the setup must actually reach the foe's 2nd mon
    // Beat (a) — the ace (KAMON's 2nd mon, team index 1) was sent in.
    expect(switchIns.some(([idx]) => idx === 1)).toBe(true);
    // Beat (b) — a foe mon crossed low HP and the falter hook fired (once).
    expect(lowHps.length).toBeGreaterThanOrEqual(1);
  });

  test('with NO tell hooks a battle is unaffected (the hooks are opt-in)', () => {
    const scene = createBattleScene({
      state: createBattleState(
        createTeam([createSide(CH1.KINDRAKE!)]),
        createTeam([createSide(CH1.FLITPECK!)]),
        { typeChart: TYPECHART },
      ),
      rng: mulberry32(1),
      chooseFoeAction: () => ({ kind: 'move', move: 'TACKLE', stance: 'G' }),
      intro: [],
      catchBreathUnlocked: false,
      canRun: false,
      onResolve: () => {},
    });
    // No hooks passed → update()/switch handlers no-op the tell path; nothing throws.
    expect(() => { scene.input?.('a'); scene.input?.('a'); for (let k = 0; k < 80; k += 1) scene.update?.(0.2); }).not.toThrow();
  });
});
