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
import { createBagMenuScene } from './scenes/bagMenu';
import { createFalknerPrepScene } from './scenes/falknerPrep';
import { createOverworldScene } from './scenes/overworld';
import { createPartyMenuScene } from './scenes/partyMenu';
import { createPauseMenuScene } from './scenes/pauseMenu';
import { createPrepScene } from './scenes/prep';
import { createStarterPickScene } from './scenes/starterPick';
import { createTitleScene } from './scenes/title';
import { bagAdd, ITEMS } from './items';
import type { BagEntry } from './items';
import {
  fromSavedSide,
  hasSave,
  loadFromStorage,
  saveToStorage,
  toSavedSide,
  wipeStorage,
} from './save';
import type { SaveState } from './save';

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

// Reference to the currently-active overworld scene (null when title /
// starter pick / battle-only paths are on top). The autosave hook
// snapshots position from this reference; if null, position isn't
// persisted (no overworld = nothing to remember).
let currentOverworldScene: import('./scenes/overworld').OverworldScene | null = null;
// Stable seed for the current run. Persisted as part of the save.
let currentRngSeed: number = 0;

interface RunState {
  // Phase 1: party is a list of rich SideStates — hp/st/momentum
  // persist across battles per canon (KO-stamina memo from CLAUDE.md).
  // Length-1 today (starter); grows via ?party= for testing, future
  // NPC gifts (Phase 3+), and Catching 2.0 (Phase 6).
  party: SideState[];
  // Phase 5a inventory. Mutated by bag UI use / future shop buys;
  // persisted via save (additive field — pre-5a saves load as []).
  bag: BagEntry[];
  catchBreathUnlocked: boolean;
  rng: RNG;
}

const run: RunState = {
  party: [],
  bag: [],
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
// battles per the KO-stamina canon — Phase 2 writeback wires this).
function buildPlayerTeam(): ReturnType<typeof createTeam> {
  if (run.party.length === 0) return createTeam([createSide(STARTERS[0]!)]);
  // Clone the SideStates so a battle's exhausted/staggered flags
  // (round-local) don't bleed into run.party between battles.
  // hp/st/momentum carry through — that's the writeback.
  const fresh = run.party.map((side) => ({ ...side, exhausted: false, staggered: false }));
  return createTeam(fresh);
}

// Resolve a species name across the CH1 dex + LEGACY fixture (skip-
// flag paths use legacy species). Throws if a saved name is unknown.
function resolveSpecies(name: string): Species {
  const sp = CH1_DEX[name] ?? SPECIES[name];
  if (!sp) throw new Error(`Argent: unknown species "${name}" — dex drift?`);
  return sp;
}

// The Phase 2 writeback. Called from every battle's onResolve with the
// final BattleState — extracts the post-battle Team's members back
// into run.party so hp/st/momentum carry forward. Uses toSavedSide /
// fromSavedSide so the writeback shape MATCHES the save/load shape
// exactly (single source of truth — the two consumers can't drift).
function writebackParty(finalState: BattleState): void {
  run.party = finalState.player.members.map((m) =>
    fromSavedSide(toSavedSide(m), resolveSpecies),
  );
}

// Silent autosave to localStorage. Fires on every overworld scene-
// transition (warp completion, battle resolve) AND on browser
// beforeunload so a tab-close preserves the in-overworld position.
// Skipped when no overworld is active (title/starter pick — nothing
// meaningful to remember yet).
function autosaveNow(): void {
  if (currentOverworldScene === null) return;
  if (run.party.length === 0) return;
  const pos = currentOverworldScene.currentPosition();
  const state: SaveState = {
    version: 1,
    party: run.party.map(toSavedSide),
    position: pos,
    flags: Array.from(sessionFlags),
    catchBreathUnlocked: run.catchBreathUnlocked,
    rngSeed: currentRngSeed,
    bag: run.bag.map((e) => ({ itemId: e.itemId, qty: e.qty })),
  };
  saveToStorage(state);
}

function showTitle(): void {
  currentOverworldScene = null;
  // Continue is offered only when a save exists; selecting it restores
  // the run from localStorage. Phase 2 save/load. exactOptionalProps
  // wants us to omit the field rather than pass undefined.
  scenes.replace(
    createTitleScene(
      hasSave()
        ? { onStart: startNewGame, onContinue: continueFromSave }
        : { onStart: startNewGame },
    ),
  );
}

// Phase 3 — New Game starts in the bedroom with an EMPTY party. The
// starter pick now happens in the lab via the LARCH NPC's
// `show-starter-pick` script verb. Wipes any prior save (the player
// chose fresh) and seeds the run with a fresh RNG.
//
// Phase 5a — also seeds the starting bag (3 POTIONs) so the survival
// loop is testable from the first wild encounter, before shops exist.
function startNewGame(): void {
  currentOverworldScene = null;
  wipeStorage();
  run.party = [];
  run.bag = [];
  bagAdd(run.bag, 'POTION', 3);
  run.catchBreathUnlocked = false;
  currentRngSeed = 0xa9c0;
  run.rng = mulberry32(currentRngSeed);
  sessionFlags.clear();
  recomputeSignpostFlags();
  showOverworld('BEDROOM', 'default', false);
}

// Phase 3 — wired into the overworld's `show-starter-pick` script
// verb. Pushes the existing starter pick scene; on pick, seeds
// run.party, sets the gating flags, and pops back to the overworld
// (LARCH NPC). The KAMON theft step-on then fires when the player
// walks toward the door.
function pushStarterPick(): void {
  scenes.push(
    createStarterPickScene({
      starters: STARTERS,
      onPick: (species) => {
        run.party = [createSide(species)];
        currentRngSeed = partySeed();
        run.rng = mulberry32(currentRngSeed);
        sessionFlags.add('player_has_starter');
        sessionFlags.add(`starter_${species.name.toLowerCase()}`);
        recomputeSignpostFlags();
        autosaveNow();
        scenes.pop();
      },
    }),
  );
}

// Phase 4 — pause menu (START in overworld). Sits on top of the
// overworld; POKEMON pushes the party menu, SAVE invokes the manual
// autosave, OPTIONS is a stub, EXIT closes back to the overworld.
// Phase 5a — BAG row now wired to pushBagMenu.
function pushPauseMenu(): void {
  scenes.push(
    createPauseMenuScene({
      onPokemon: () => pushPartyMenu(),
      onBag: () => pushBagMenu(),
      onSave: () => autosaveNow(),
      onOptions: () => {},
      onClose: () => scenes.pop(),
    }),
  );
}

// Phase 5a — bag menu pushed from the pause menu's BAG row. Both
// run.bag and run.party are passed by reference — using an item
// mutates them in place; onChange fires autosave.
function pushBagMenu(): void {
  scenes.push(
    createBagMenuScene({
      bag: run.bag,
      party: run.party,
      onChange: () => autosaveNow(),
      onClose: () => scenes.pop(),
    }),
  );
}

// Phase 5a — Pokémon Center heal. Wired from the overworld script
// verb `heal-party` on the NURSE NPC.
function healParty(): void {
  for (let i = 0; i < run.party.length; i += 1) {
    const s = run.party[i]!;
    run.party[i] = {
      ...s,
      hp: s.maxHp,
      st: 100,
      momentum: 0,
      exhausted: false,
      staggered: false,
    };
  }
  autosaveNow();
}

// Phase 4 — party menu pushed from the pause menu's POKEMON row. The
// party array is passed by reference so reorder mutates run.party in
// place; onReorder fires autosave so the new order persists.
function pushPartyMenu(): void {
  scenes.push(
    createPartyMenuScene({
      party: run.party,
      onReorder: () => autosaveNow(),
      onClose: () => scenes.pop(),
    }),
  );
}

// Phase 2 — restore the run from a SaveState and spawn the player at
// the exact saved position. Called from the title's Continue option.
function applySave(saved: SaveState): void {
  run.party = saved.party.map((s) => fromSavedSide(s, resolveSpecies));
  // Phase 5a: bag is additive — pre-Phase-5a saves don't carry the
  // field; treat missing as []. Skip unknown item ids loudly.
  run.bag = [];
  if (saved.bag) {
    for (const e of saved.bag) {
      if (ITEMS[e.itemId]) {
        run.bag.push({ itemId: e.itemId, qty: e.qty });
      } else {
        console.warn(`Argent save: unknown item "${e.itemId}" in saved bag — dropped`);
      }
    }
  }
  run.catchBreathUnlocked = saved.catchBreathUnlocked;
  currentRngSeed = saved.rngSeed;
  run.rng = mulberry32(currentRngSeed);
  sessionFlags.clear();
  for (const f of saved.flags) sessionFlags.add(f);
  recomputeSignpostFlags();
  showOverworld(saved.position.map, 'default', true, {
    x: saved.position.x,
    y: saved.position.y,
    facing: saved.position.facing,
  });
}

function continueFromSave(): void {
  const saved = loadFromStorage();
  if (!saved) {
    // Save vanished between title render and click — fall back to
    // the new-game flow.
    startNewGame();
    return;
  }
  applySave(saved);
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
      onResolve: (winner, finalState) => {
        writebackParty(finalState);
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
      onResolve: (winner, finalState) => {
        writebackParty(finalState);
        showEnd(winner === 'player');
      },
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
      onResolve: (winner, finalState) => {
        writebackParty(finalState);
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
      onResolve: (_winner, finalState) => {
        // Loop so Mathias can hammer the input layer repeatedly.
        // Writeback still fires so the next iteration reflects
        // injuries — same writeback shape as the real game.
        writebackParty(finalState);
        showTestBattle();
      },
    }),
  );
}

// ?skip=test-battle-2v2 hook — Phase 1 combat-in-isolation that
// exercises switching as a tactical READ on BOTH sides:
//   - Player party: GRUBLEAF (SPROUT) lead at FLAME-punished
//     disadvantage; SILTSKIP (SPLASH) on bench is the answer.
//   - Foe team: KILNDRAKE (FLAME) lead → FLITPECK (GALE) as the
//     forced-switch successor. Once the player swaps to SILTSKIP and
//     KOs KILNDRAKE, foe-side forced-switch fires and FLITPECK takes
//     the field — putting the player back at a switching decision
//     (GALE→SPROUT 1.3 punishes the GRUBLEAF bench).
// Both sides' switch flow is testable from this one hook.
function showTestBattle2v2(): void {
  const foeLead = CH1_DEX.KILNDRAKE ?? CH1_DEX.KINDRAKE ?? SPECIES.FUZZLET!;
  const foeSecond = CH1_DEX.FLITPECK ?? SPECIES.FUZZLET!;
  const foeTeam = createTeam([createSide(foeLead), createSide(foeSecond)]);
  const state = createBattleState(
    buildPlayerTeam(),
    foeTeam,
    { typeChart: TYPECHART_CH1 },
  );
  scenes.replace(
    createBattleScene({
      state,
      rng: run.rng,
      chooseFoeAction: (s, r) => wildFoeAI(s, r),
      intro: [
        `2v2 test:`,
        `wild ${foeLead.name} appeared!`,
        `Lead is at a type`,
        `disadvantage — switch?`,
      ],
      catchBreathUnlocked: run.catchBreathUnlocked,
      canRun: true,
      onResolve: (_winner, finalState) => {
        writebackParty(finalState);
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
//   ?wipe                      clears the localStorage save before any
//                              handling runs (Phase 2 — QA the New
//                              Game path repeatedly without leaving
//                              the browser).
const url = new URLSearchParams(window.location.search);
const skip = url.get('skip');
const starterName = url.get('starter');
const partyParam = url.get('party');
const wipeParam = url.has('wipe');
// Phase 5a — ?bag=POTION:3,SUPER POTION:1 seeds a test bag for any
// hook that needs items. Item ids match the ITEMS registry (case-
// sensitive, spaces ok). Unknown ids warn-and-skip.
const bagParam = url.get('bag');

if (wipeParam) wipeStorage();

function applyBagFromUrl(): void {
  if (!bagParam) return;
  for (const entry of bagParam.split(',').map((s) => s.trim()).filter(Boolean)) {
    const [id, qtyStr] = entry.includes(':') ? entry.split(':') : [entry, '1'];
    const qty = Number.parseInt(qtyStr ?? '1', 10);
    if (!id || !ITEMS[id]) {
      console.warn(`Argent ?bag=${entry}: unknown item id; skipped`);
      continue;
    }
    bagAdd(run.bag, id, Number.isFinite(qty) ? qty : 1);
  }
}

// Autosave on tab close / refresh. The browser fires beforeunload
// synchronously; localStorage.setItem returns before the unload
// completes, so the snapshot is durable.
window.addEventListener('beforeunload', () => {
  autosaveNow();
});

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

if (skip === 'starter') {
  // Phase 3 — the starter pick is now an in-lab ceremony, not a top-
  // level scene. ?skip=starter is back-compat: it jumps to the lab so
  // a tester can drive the LARCH NPC interaction directly.
  startNewGame();
} else if (skip === 'intro') {
  // Phase 3 canonical hook — start fresh at the bedroom. Same as
  // pressing New Game on the title with no save, just one click.
  startNewGame();
} else if (skip === 'wild') {
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
else if (skip === 'center') {
  // Phase 5a hook — drop into the Hearthwick Pokémon Center with a
  // damaged party + a few potions, for fast heal testing.
  applyPartyFromUrl();
  if (run.bag.length === 0) bagAdd(run.bag, 'POTION', 3);
  applyBagFromUrl();
  // Pre-damage the party so the heal is visible.
  for (let i = 0; i < run.party.length; i += 1) {
    const s = run.party[i]!;
    run.party[i] = { ...s, hp: Math.max(1, Math.floor(s.maxHp * 0.4)), st: 35 };
  }
  recomputeSignpostFlags();
  showOverworld('HEARTHWICK_CENTER', 'fromHearthwick', false);
} else if (skip === 'overworld-party') {
  // Phase 4 hook — drop into ROUTE31 with a multi-mon party so the
  // pause/party menus exercise reorder + summary out of the box.
  // Phase 5a: also seeds 3 POTIONs so the bag UI is testable from
  // the same hook. ?bag= adds on top.
  if (!partyParam) {
    const g = STARTERS.find((s) => s.name === 'GRUBLEAF');
    const k = STARTERS.find((s) => s.name === 'KINDRAKE');
    const s = STARTERS.find((s) => s.name === 'SILTSKIP');
    run.party = [createSide(g!), createSide(k!), createSide(s!)];
  } else {
    applyPartyFromUrl();
  }
  bagAdd(run.bag, 'POTION', 3);
  applyBagFromUrl();
  sessionFlags.add('player_has_starter');
  recomputeSignpostFlags();
  showOverworld('ROUTE31', 'default', false);
}
else if (skip === 'bedroom') showOverworld('BEDROOM', 'default', false);
else if (skip === 'hearthwick') {
  applyPartyFromUrl();
  recomputeSignpostFlags();
  showOverworld('HEARTHWICK', 'fromHouse', false);
}
else if (skip === 'lab') showOverworld('LAB', 'default', false);
else if (skip === 'house') showOverworld('HOUSE', 'fromBedroom', false);
else if (skip === 'falkner') {
  applyPartyFromUrl();
  recomputeSignpostFlags();
  showFalknerFight();
} else if (skip === 'gym') {
  applyPartyFromUrl();
  recomputeSignpostFlags();
  showOverworld('GYM', 'fromRoute', false);
} else showTitle();

function showOverworld(
  map: string,
  spawn: string,
  faded: boolean,
  spawnAt?: { readonly x: number; readonly y: number; readonly facing: import('./overworld/types').Facing },
): void {
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
    onStarterPick() {
      pushStarterPick();
    },
    onPauseMenu() {
      pushPauseMenu();
    },
    onHealParty() {
      healParty();
    },
  };
  const sceneOpts = {
    ...opts,
    ...(faded ? { startFaded: true as const } : {}),
    ...(spawnAt ? { spawnAt } : {}),
  };
  const scene = createOverworldScene(sceneOpts);
  currentOverworldScene = scene;
  scenes.replace(scene);
  // Autosave on the new map landing — the player just transitioned;
  // the snapshot captures their fresh position (or the restored spawn
  // when applySave called us).
  autosaveNow();
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
      onResolve: (winner, finalState) => {
        writebackParty(finalState);
        if (winner === 'player') {
          recomputeSignpostFlags();
          run.catchBreathUnlocked = true;
        }
        scenes.pop();
        autosaveNow();
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
      onResolve: (winner, finalState) => {
        writebackParty(finalState);
        if (winner === 'player') flagStore.set(winFlag);
        scenes.pop();
        autosaveNow();
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
      onResolve: (winner, finalState) => {
        writebackParty(finalState);
        if (winner === 'player') {
          flagStore.set('falkner_beaten');
          run.catchBreathUnlocked = true;
        }
        scenes.pop();
        autosaveNow();
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
