import {
  COUNTER_MAP,
  SPECIES,
  activeMon,
  affordableMoves,
  createBattleState,
  createSide,
  createTeam,
  falknerBossAI,
  forcedAction,
  loadDex,
  loadMoves,
  mulberry32,
  registerMoves,
} from '../engine';
import type {
  Action,
  ArenaSchedule,
  BattleState,
  BossCard,
  DexEntryJson,
  MoveJson,
  RNG,
  SideState,
  Species,
  Stance,
  TraitTable,
  TypeChart,
} from '../engine';
import ch1BatchData from '../../docs/ch1-batch.json';
import movesData from '../../docs/moves.json';
import typechartData from '../../docs/typechart.json';
import { rivalAI } from '../sim/archetypes';
import { mountCanvas } from './canvas';
import { createInputDispatcher } from './input';
import { SceneStack } from './scene';
import { createBattleScene } from './scenes/battle';
import { createEndScene } from './scenes/end';
import { createFalknerPrepScene } from './scenes/falknerPrep';
import { createOverworldScene } from './scenes/overworld';
import { createPrepScene } from './scenes/prep';
import { createStarterPickScene } from './scenes/starterPick';
import { createTitleScene } from './scenes/title';

const host = document.getElementById('app');
if (!host) throw new Error('Argent: #app element missing in index.html');

const { ctx } = mountCanvas(host);
const dispatcher = createInputDispatcher((key) => scenes.input(key));

const sessionFlags = new Set<string>();
const flagStore = {
  has: (flag: string): boolean => sessionFlags.has(flag),
  set: (flag: string): void => {
    sessionFlags.add(flag);
  },
  unset: (flag: string): void => {
    sessionFlags.delete(flag);
  },
};

// Load CH1 dex + moves at startup.
registerMoves(loadMoves(movesData as MoveJson[]));
const CH1_LEVEL = 13;
const FALKNER_LEAD_LEVEL = 13;
const FALKNER_ACE_LEVEL = 15;
const CH1_DEX = loadDex(ch1BatchData as DexEntryJson[], CH1_LEVEL);
const FALKNER_LEAD_DEX = loadDex(ch1BatchData as DexEntryJson[], FALKNER_LEAD_LEVEL);
const FALKNER_ACE_DEX = loadDex(ch1BatchData as DexEntryJson[], FALKNER_ACE_LEVEL);
const TYPECHART_CH1 = typechartData as TypeChart;

const STARTERS: readonly Species[] = ['KINDRAKE', 'GRUBLEAF', 'SILTSKIP'].map(
  (n) => CH1_DEX[n]!,
);

const FALKNER_ARENA: ArenaSchedule = {
  rhythmEveryN: 3,
  heavyExtraCost: 8,
  heavyExtraInitWeight: 1.3,
  telegraphAheadBy: 1,
};

// Locked B1 trait table: GUSTBORNE dmgMult 1.4 (gust lever from the
// boss-card sweep). Passed into createBattleState at Falkner setup time;
// the global LEGACY_TRAIT_TABLE stays at 1.3/1.25 untouched.
const FALKNER_TRAITS: TraitTable = {
  GUSTBORNE: { dmgMult: 1.4, initMult: 1.25 },
};

void SPECIES;
void COUNTER_MAP;
const RNG_SEED = 0xa9c0;

const scenes = new SceneStack();

interface RunState {
  // Phase 1: party is a list of rich SideStates — hp/st/momentum
  // persist across battles per canon (KO-stamina memo from CLAUDE.md).
  // Length-1 today (starter); grows via ?party= for testing, future
  // NPC gifts (Phase 3+), and Catching 2.0 (Phase 6).
  party: SideState[];
  catchBreathUnlocked: boolean;
  rng: RNG;
}

const run: RunState = {
  party: [],
  catchBreathUnlocked: false,
  rng: mulberry32(RNG_SEED),
};

function partyTypes(): Set<string> {
  const out = new Set<string>();
  for (const side of run.party) {
    for (const t of side.species.types) out.add(t);
  }
  return out;
}

function partyLead(): Species {
  if (run.party.length === 0) return STARTERS[0]!;
  return run.party[0]!.species;
}

function recomputeSignpostFlags(): void {
  const types = partyTypes();
  const hasSprout = types.has('SPROUT');
  const hasTerra = types.has('TERRA');
  if (hasSprout && !hasTerra) flagStore.set('need_terra_nudge');
  else flagStore.unset('need_terra_nudge');
}

// Stable RNG seed from the party composition. Same party → same seed
// so test runs are reproducible across the ?party= modifier.
function partySeed(): number {
  let h = RNG_SEED >>> 0;
  for (const side of run.party) {
    for (const ch of side.species.name) {
      h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    }
  }
  return h;
}

// Build the player Team for a battle from the current party. Uses the
// rich SideStates from run.party (preserves hp/st/momentum across
// battles per the KO-stamina canon — but until save/load lands in
// Phase 2 we rebuild fresh each battle via the partyLead fallback).
//
// FLAGGED for design: state writeback after a battle (so a 1-HP
// survivor stays 1-HP next encounter) is not wired yet. Today each
// battle starts at full HP/ST. Phase 2 (save/load) is the natural
// home for the writeback.
function buildPlayerTeam(): ReturnType<typeof createTeam> {
  if (run.party.length === 0) return createTeam([createSide(STARTERS[0]!)]);
  // Re-create sides so a battle's hp/st changes don't bleed into the
  // run state until writeback exists. Same shape, fresh values.
  const fresh = run.party.map((side) => createSide(side.species));
  return createTeam(fresh);
}

function showTitle(): void {
  scenes.replace(createTitleScene({ onStart: showStarterPick }));
}

function showStarterPick(): void {
  scenes.replace(
    createStarterPickScene({
      starters: STARTERS,
      onPick: (species) => {
        run.party = [createSide(species)];
        run.catchBreathUnlocked = false;
        run.rng = mulberry32(partySeed());
        sessionFlags.clear();
        recomputeSignpostFlags();
        showOverworld('LAB', 'default', false);
      },
    }),
  );
}

// Simple wild AI: uniform-random affordable move + 40A/30G/30F stance mix.
function wildFoeAI(state: BattleState, rng: RNG): Action {
  const me = activeMon(state.foe);
  const forced = forcedAction(me);
  if (forced) return forced;
  const aff = affordableMoves(me);
  const move = aff[Math.floor(rng.next() * aff.length)]!;
  const r = rng.next();
  const stance: Stance = r < 0.4 ? 'A' : r < 0.7 ? 'G' : 'F';
  return { kind: 'move', move, stance };
}

function showWildBattle(): void {
  const state = createBattleState(buildPlayerTeam(), createSide(SPECIES.FUZZLET!));
  scenes.replace(
    createBattleScene({
      state,
      rng: run.rng,
      chooseFoeAction: (s, r) => wildFoeAI(s, r),
      intro: ['A wild FUZZLET', 'appeared!', 'TIP: SELECT cycles', 'your STANCE.'],
      catchBreathUnlocked: false,
      canRun: true,
      onResolve: (winner) => {
        if (winner === 'player') {
          run.catchBreathUnlocked = true;
          showPrep();
        } else {
          showWildBattle();
        }
      },
    }),
  );
}

function showPrep(): void {
  const player = partyLead();
  const foe = SPECIES[COUNTER_MAP[player.name]!]!;
  scenes.replace(
    createPrepScene({
      playerSpecies: player,
      foeSpecies: foe,
      foeTrainerName: 'KAMON',
      onContinue: showRivalBattle,
    }),
  );
}

function showRivalBattle(): void {
  const player = partyLead();
  const foe = SPECIES[COUNTER_MAP[player.name]!]!;
  const state = createBattleState(
    buildPlayerTeam(),
    createSide(foe, { atk: 0.85, dfn: 0.85 }),
  );
  scenes.replace(
    createBattleScene({
      state,
      rng: run.rng,
      chooseFoeAction: (s, r) => rivalAI.chooseAction(s, 'foe', r),
      intro: [
        'KAMON sent out',
        `the stolen ${foe.name}!`,
        'It has the type edge',
        '— but it hesitates.',
        'Out-read them.',
      ],
      catchBreathUnlocked: run.catchBreathUnlocked,
      canRun: false,
      onResolve: (winner) => showEnd(winner === 'player'),
    }),
  );
}

function buildFalknerTeam(): { team: ReturnType<typeof createTeam>; card: BossCard } {
  const flitpeck: Species = FALKNER_LEAD_DEX.FLITPECK!;
  const galehawk: Species = { ...FALKNER_ACE_DEX.GALEHAWK!, trait: 'GUSTBORNE' };
  // The arena schedule + ace-only HP scale ride on the card; the engine
  // applies statScale to whatever mon's data the card carries (its species
  // pointer), but the player-facing team data is what's in the Team.
  // Falkner's 2-mon team uses the ace mult on the GALEHAWK member only.
  const card: BossCard = {
    species: galehawk,
    statScale: { hp: 1.15 },
    arenaSchedule: FALKNER_ARENA,
    breakBar: 2,
    teamSize: 2,
  };
  const team = createTeam([
    createSide(flitpeck),
    createSide(galehawk, card.statScale),
  ]);
  return { team, card };
}

function showFalknerFight(): void {
  const { team, card } = buildFalknerTeam();
  const state = createBattleState(
    buildPlayerTeam(),
    team,
    {
      typeChart: TYPECHART_CH1,
      traits: FALKNER_TRAITS,
      bossCard: card,
    },
  );
  scenes.replace(
    createBattleScene({
      state,
      rng: run.rng,
      chooseFoeAction: (s, r) => falknerBossAI(s, 'foe', r),
      intro: [
        'FALKNER: Welcome to my',
        'rooftop. Read the wind!',
        '— sent out FLITPECK!',
      ],
      catchBreathUnlocked: true,
      canRun: false,
      onResolve: (winner) => {
        if (winner === 'player') showBadgeAwarded();
        else showFalknerFight();
      },
    }),
  );
}

function showBadgeAwarded(): void {
  scenes.replace(
    createEndScene({
      won: true,
      onRestart: showTitle,
    }),
  );
}

function showEnd(won: boolean): void {
  scenes.replace(createEndScene({ won, onRestart: showTitle }));
}

// ?skip=test-battle hook — a standalone wild battle that restarts on
// resolve. Used to playtest combat in isolation without walking through
// the overworld. Separate from pushWildEncounter (which pops back to an
// overworld below it) because here there's nothing below.
function showTestBattle(): void {
  const foe = CH1_DEX.FLITPECK ?? SPECIES.FUZZLET!;
  const state = createBattleState(
    buildPlayerTeam(),
    createSide(foe),
    { typeChart: TYPECHART_CH1 },
  );
  scenes.replace(
    createBattleScene({
      state,
      rng: run.rng,
      chooseFoeAction: (s, r) => wildFoeAI(s, r),
      intro: [`Test battle:`, `wild ${foe.name} appeared!`],
      catchBreathUnlocked: run.catchBreathUnlocked,
      canRun: true,
      onResolve: () => {
        // Loop so Mathias can hammer the input layer repeatedly.
        showTestBattle();
      },
    }),
  );
}

// ?skip=test-battle-2v2 hook — Phase 1 combat-in-isolation that
// exercises switching as a tactical READ, not just a mechanism.
// Lead GRUBLEAF (SPROUT) vs wild KILNDRAKE (FLAME) is the classic
// triangle disadvantage: FLAME→SPROUT = 1.3 punishes the lead;
// SPLASH→FLAME = 1.3 makes SILTSKIP (the bench) the correct answer.
// User ruling: KINDRAKE can't be "the answer" against a FLAME foe
// (FLAME→FLAME=0.7), so we substitute the available CH1 triangle.
function showTestBattle2v2(): void {
  const foe = CH1_DEX.KILNDRAKE ?? CH1_DEX.KINDRAKE ?? SPECIES.FUZZLET!;
  const state = createBattleState(
    buildPlayerTeam(),
    createSide(foe),
    { typeChart: TYPECHART_CH1 },
  );
  scenes.replace(
    createBattleScene({
      state,
      rng: run.rng,
      chooseFoeAction: (s, r) => wildFoeAI(s, r),
      intro: [
        `2v2 test:`,
        `wild ${foe.name} appeared!`,
        `Lead is at a type`,
        `disadvantage — switch?`,
      ],
      catchBreathUnlocked: run.catchBreathUnlocked,
      canRun: true,
      onResolve: () => {
        showTestBattle2v2();
      },
    }),
  );
}

// Dev: skip ahead with ?skip=<scene> — the contract lives in
// docs/playtest-hooks.md (read first, edit in lockstep). Hooks are
// PERMANENT playtest infrastructure: every scene gets one the sprint
// it lands, maintained across refactors.
//   ?starter=<name>            picks the starter for any 1-mon skip
//                              (default GRUBLEAF).
//   ?party=<A,B,...>           builds a multi-mon test party for any
//                              skip; overrides ?starter when present.
const url = new URLSearchParams(window.location.search);
const skip = url.get('skip');
const starterName = url.get('starter');
const partyParam = url.get('party');

function pickStarter(): Species {
  if (starterName) {
    const s = STARTERS.find((sp) => sp.name === starterName);
    if (s) return s;
    console.warn(`Argent ?starter=${starterName}: not in STARTERS; defaulting to GRUBLEAF`);
  }
  return STARTERS.find((sp) => sp.name === 'GRUBLEAF') ?? STARTERS[1]!;
}

// Build the initial run.party from URL modifiers. ?party= wins; else
// ?starter= picks a single mon; else GRUBLEAF.
function applyPartyFromUrl(): void {
  if (partyParam) {
    const names = partyParam.split(',').map((n) => n.trim()).filter(Boolean);
    const sides: SideState[] = [];
    for (const name of names) {
      const sp = STARTERS.find((s) => s.name === name) ?? CH1_DEX[name];
      if (!sp) {
        console.warn(`Argent ?party=${name}: not in dex; skipped`);
        continue;
      }
      sides.push(createSide(sp));
    }
    if (sides.length === 0) sides.push(createSide(pickStarter()));
    run.party = sides;
    return;
  }
  run.party = [createSide(pickStarter())];
}

if (skip === 'starter') showStarterPick();
else if (skip === 'wild') {
  run.party = [createSide(SPECIES.EMBERCUB!)];
  showWildBattle();
} else if (skip === 'test-battle') {
  // Canonical Phase 0 hook: cold-start CH1 starter + a wild FLITPECK
  // encounter. Lets Mathias playtest combat in isolation in one click.
  applyPartyFromUrl();
  recomputeSignpostFlags();
  showTestBattle();
} else if (skip === 'test-battle-2v2') {
  // Phase 1 hook: two-mon player party vs a wild foe positioned so
  // switching is the right read. Default party is [GRUBLEAF, SILTSKIP]
  // (the CH1 triangle answer to a FLAME foe); ?party= overrides.
  if (!partyParam) {
    const grubleaf = STARTERS.find((s) => s.name === 'GRUBLEAF');
    const siltskip = STARTERS.find((s) => s.name === 'SILTSKIP');
    run.party = [createSide(grubleaf!), createSide(siltskip!)];
  } else {
    applyPartyFromUrl();
  }
  recomputeSignpostFlags();
  showTestBattle2v2();
} else if (skip === 'prep') {
  run.party = [createSide(SPECIES.EMBERCUB!)];
  run.catchBreathUnlocked = true;
  showPrep();
} else if (skip === 'rival') {
  run.party = [createSide(SPECIES.EMBERCUB!)];
  run.catchBreathUnlocked = true;
  showRivalBattle();
} else if (skip === 'end') showEnd(true);
else if (skip === 'overworld') showOverworld('ROUTE31', 'default', false);
else if (skip === 'lab') showOverworld('LAB', 'default', false);
else if (skip === 'house') showOverworld('HOUSE', 'fromRoute', false);
else if (skip === 'falkner') {
  applyPartyFromUrl();
  recomputeSignpostFlags();
  showFalknerFight();
} else if (skip === 'gym') {
  applyPartyFromUrl();
  recomputeSignpostFlags();
  showOverworld('GYM', 'fromRoute', false);
} else showTitle();

function showOverworld(map: string, spawn: string, faded: boolean): void {
  recomputeSignpostFlags();
  const opts = {
    map,
    spawn,
    inputState: dispatcher.state,
    flags: flagStore,
    onWarp(target: string) {
      const colon = target.indexOf(':');
      const nextMap = colon >= 0 ? target.slice(0, colon) : target;
      const nextSpawn = colon >= 0 ? target.slice(colon + 1) : 'default';
      showOverworld(nextMap, nextSpawn, true);
    },
    onEncounter(foeSpecies: string) {
      pushWildEncounter(foeSpecies);
    },
    onTrainerBattle(foeSpecies: string | readonly string[], winFlag: string) {
      pushTrainerFight(foeSpecies, winFlag);
    },
    onBossBattle(bossId: string) {
      if (bossId === 'falkner') showFalknerFightFromOverworld();
    },
  };
  const sceneOpts = faded ? { ...opts, startFaded: true as const } : opts;
  scenes.replace(createOverworldScene(sceneOpts));
}

function pushWildEncounter(foeSpeciesName: string): void {
  const foe = CH1_DEX[foeSpeciesName] ?? SPECIES[foeSpeciesName];
  if (!foe) {
    console.warn(`Argent: encounter species not found: ${foeSpeciesName}`);
    return;
  }
  const state = createBattleState(buildPlayerTeam(), createSide(foe), {
    typeChart: TYPECHART_CH1,
  });
  scenes.push(
    createBattleScene({
      state,
      rng: run.rng,
      chooseFoeAction: (s, r) => wildFoeAI(s, r),
      intro: [`A wild ${foe.name}`, 'appeared!'],
      catchBreathUnlocked: run.catchBreathUnlocked,
      canRun: true,
      onResolve: (winner) => {
        if (winner === 'player') {
          // Demo-grade signpost only — the type-add-on-defeat shortcut
          // was removed with run.partyTypes; real catching is Phase 6.
          recomputeSignpostFlags();
          run.catchBreathUnlocked = true;
        }
        scenes.pop();
      },
    }),
  );
}

// Build a foe Team from a roster spec (string OR string[]). Single-
// string back-compat preserved so legacy map scripts keep working
// while S6 lets gym trainers carry multi-mon rosters.
function buildTrainerTeam(spec: string | readonly string[]): ReturnType<typeof createTeam> | null {
  const names = typeof spec === 'string' ? [spec] : spec;
  const sides: SideState[] = [];
  for (const n of names) {
    const sp = CH1_DEX[n] ?? SPECIES[n];
    if (!sp) {
      console.warn(`Argent: trainer roster species not found: ${n}`);
      continue;
    }
    sides.push(createSide(sp));
  }
  if (sides.length === 0) return null;
  return createTeam(sides);
}

function pushTrainerFight(foeSpec: string | readonly string[], winFlag: string): void {
  const foeTeam = buildTrainerTeam(foeSpec);
  if (!foeTeam) return;
  const leadName = activeMon(foeTeam).species.name;
  const state = createBattleState(buildPlayerTeam(), foeTeam, {
    typeChart: TYPECHART_CH1,
  });
  scenes.push(
    createBattleScene({
      state,
      rng: run.rng,
      chooseFoeAction: (s, r) => wildFoeAI(s, r),
      intro: ['Gym trainer sent out', `${leadName}!`, 'Show your read!'],
      catchBreathUnlocked: run.catchBreathUnlocked,
      canRun: false,
      onResolve: (winner) => {
        if (winner === 'player') flagStore.set(winFlag);
        scenes.pop();
      },
    }),
  );
}

function showFalknerFightFromOverworld(): void {
  // Push prep, then on continue push Falkner fight. On resolve, pop both
  // back to the gym overworld + (on win) set the badge flag.
  scenes.push(
    createFalknerPrepScene({
      playerSpecies: partyLead(),
      foeSpecies: FALKNER_ACE_DEX.GALEHAWK!,
      onContinue: () => {
        scenes.pop();
        pushFalknerBattle();
      },
    }),
  );
}

function pushFalknerBattle(): void {
  const { team, card } = buildFalknerTeam();
  const state = createBattleState(
    buildPlayerTeam(),
    team,
    {
      typeChart: TYPECHART_CH1,
      traits: FALKNER_TRAITS,
      bossCard: card,
    },
  );
  scenes.push(
    createBattleScene({
      state,
      rng: run.rng,
      chooseFoeAction: (s, r) => falknerBossAI(s, 'foe', r),
      intro: [
        'FALKNER: Welcome to my',
        'rooftop. Read the wind!',
        '— sent out FLITPECK!',
      ],
      catchBreathUnlocked: true,
      canRun: false,
      onResolve: (winner) => {
        if (winner === 'player') {
          flagStore.set('falkner_beaten');
          run.catchBreathUnlocked = true;
        }
        scenes.pop();
      },
    }),
  );
}

let lastTime = performance.now();
function frame(now: number): void {
  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;
  scenes.update(dt);
  scenes.draw(ctx);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
