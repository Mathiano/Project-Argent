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
import { createMartMenuScene } from './scenes/martMenu';
import { createBadgeAwardScene } from './scenes/badgeAward';
import { createFalknerPrepScene } from './scenes/falknerPrep';
import { createOverworldScene } from './scenes/overworld';
import { createPartyMenuScene } from './scenes/partyMenu';
import { createPauseMenuScene } from './scenes/pauseMenu';
import { createPrepScene } from './scenes/prep';
import { createStarterPickScene } from './scenes/starterPick';
import { createTitleScene } from './scenes/title';
import { freshBattleSide } from './battlePrep';
import { bagAdd, bagByPocket, bagConsume, ITEMS } from './items';
import type { BagEntry } from './items';
import { STARTING_MONEY, awardMoney, buyItem, sellItem } from './economy';
import {
  BOND_START_CAUGHT,
  BOND_START_STARTER,
  CATCH_RARITY,
  bondBonus,
  catchChance,
  rollCatch,
  rollWillingJoin,
  refusalHint,
  willingJoinChance,
} from './catching';
import type { CatchWindow, CatchOrigin } from './catching';
import {
  applyBondXp,
  bondXp,
  hasJumpstart,
  powerIndex,
} from './bond';
import type { FightKind } from './bond';
import { askResponse, evolutionReadiness, evolutionReady } from './evolution';
import { createEvolutionScene } from './scenes/evolution';
import {
  createDex,
  dexStatus,
  fromSavedDex,
  markCaught,
  markSeen,
  markSeenAll,
  toSavedDex,
} from './dex';
import type { DexRecord } from './dex';
import { createBoxMenuScene } from './scenes/boxMenu';
import { createDexMenuScene } from './scenes/dexMenu';
import type { DexUiEntry } from './scenes/dexMenu';
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

// Phase 6.5 — static dex-entry data for every CH1 species (the UI's
// right-hand record). Built once from the manifest, sorted by dex number.
// The seen/caught STATUS is dynamic (run.dex); this is the fixed info.
function evoHintFor(e: DexEntryJson): string {
  if (e.evoLine && e.evoLine.evolvesTo) {
    return `Evolves into ${e.evoLine.evolvesTo} with a deep bond.`;
  }
  if (e.stage > 1) return 'A grown, evolved form.';
  return 'No known evolution.';
}
const DEX_UI_ENTRIES: readonly DexUiEntry[] = (ch1BatchData as DexEntryJson[])
  .slice()
  .sort((a, b) => a.id - b.id)
  .map((e) => ({
    num: e.id,
    name: e.name,
    types: e.types,
    flavor:
      e.dexEntry && e.dexEntry.trim().length > 0
        ? e.dexEntry
        : 'No further field notes recorded yet.',
    evoHint: evoHintFor(e),
  }));
function dexStatusOf(name: string): ReturnType<typeof dexStatus> {
  return dexStatus(run.dex, name);
}

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
// Black-out respawn: the last Pokémon Center the player healed at. A
// wild/trainer loss warps here, healed (classic black-out). Uses the
// Center's `wake` spawn (in front of the counter/nurse), NOT the door
// tile. The demo has one Center; updated in healParty for later ones.
let lastCenterTarget = 'HEARTHWICK_CENTER:wake';

interface RunState {
  // Phase 1: party is a list of rich SideStates — hp/st/momentum
  // persist across battles per canon (KO-stamina memo from CLAUDE.md).
  // Length-1 today (starter); grows via ?party= for testing, future
  // NPC gifts (Phase 3+), and Catching 2.0 (Phase 6).
  party: SideState[];
  // Phase 5a inventory. Mutated by bag UI use / Phase 5b shop buys;
  // persisted via save (additive field — pre-5a saves load as []).
  bag: BagEntry[];
  // Phase 5b wallet. Earned from trainer wins, spent at the Mart;
  // persisted via save (additive — pre-5b saves load as STARTING_MONEY).
  money: number;
  // Demo-complete: earned gym badges (ids). Awarded on a leader win;
  // persisted via save (additive — pre-badge saves load as []).
  badges: string[];
  // Phase 6a — interim per-mon bond, index-aligned with party. Quality-
  // earned (read-wins/boss-clears); persisted. Full system is Phase 8.
  partyBond: number[];
  // Phase 6a — the box (caught mons when the party is full). Minimal.
  box: SideState[];
  // Phase 6.5 — bond for boxed mons, index-aligned with `box`. Travels
  // with the mon on deposit/withdraw (box.ts moves both together).
  boxBond: number[];
  // living-world.md Feature 3 — catch provenance, index-aligned with
  // party / box. Set at catch/grant time, persisted, impossible to
  // backfill. Nothing reads it yet; travels with the mon like bond.
  partyOrigin: CatchOrigin[];
  boxOrigin: CatchOrigin[];
  // Phase 6.5 — the seen/caught registry (distinct from the species DB).
  dex: DexRecord;
  catchBreathUnlocked: boolean;
  rng: RNG;
}

const run: RunState = {
  party: [],
  bag: [],
  money: STARTING_MONEY,
  badges: [],
  partyBond: [],
  box: [],
  boxBond: [],
  partyOrigin: [],
  boxOrigin: [],
  dex: createDex(),
  catchBreathUnlocked: false,
  rng: mulberry32(RNG_SEED),
};

// Demo-complete: the one badge the demo ships. Falkner's ZEPHYR BADGE.
// A registry can come later when gyms 2–8 land; one constant suffices now.
const ZEPHYR_BADGE = 'ZEPHYR';

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
  const hasSprout = types.has('NATURE');
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
  // Clone the SideStates so a battle's round-local flags don't bleed into
  // run.party between battles. HP carries through (the persistent resource
  // — healed at Centers/potions); STAMINA resets to full at battle start
  // (firstroad-fixes S1). freshBattleSide owns that contract (tested).
  // Arm the bond jumpstart (B5) per mon: a Familiar-tier mon's first read-
  // win this battle banks a free ★. Read-economy only — the engine applies
  // it; bond never touches stats. Each mon's own bond decides (index-
  // aligned with run.partyBond), so a bonded mon keeps the perk after a
  // switch. freshBattleSide already cleared round-local flags.
  const fresh = run.party.map((mon, i) => {
    const side = freshBattleSide(mon);
    return hasJumpstart(run.partyBond[i] ?? 0)
      ? { ...side, jumpstartArmed: true }
      : side;
  });
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

// ---- Phase 6a — catching helpers (game-side; math lives in catching.ts) --
function ballCount(): number {
  return bagByPocket(run.bag).balls.reduce((n, e) => n + e.qty, 0);
}
function medicineCount(): number {
  return bagByPocket(run.bag).medicine.reduce((n, e) => n + e.qty, 0);
}
function consumeBall(): void {
  const balls = bagByPocket(run.bag).balls;
  if (balls.length > 0) bagConsume(run.bag, balls[0]!.itemId);
}
function consumeMedicine(): void {
  const meds = bagByPocket(run.bag).medicine;
  if (meds.length > 0) bagConsume(run.bag, meds[0]!.itemId);
}
// Per-species catch rarity (Path 1 base rate; lower = harder). The curve
// has teeth at the rare end (CATCH_RARITY tiers in catching.ts). Falkner's
// ace GALEHAWK is the rare exemplar; the cave TERRA line is uncommon;
// route birds are common. Default common.
function catchRarity(species: Species): number {
  if (species.name === 'GALEHAWK') return CATCH_RARITY.rare;
  if (species.name === 'GRITHOAX' || species.name === 'KILNDRAKE') return CATCH_RARITY.uncommon;
  return CATCH_RARITY.common;
}
// Rarity-as-DIFFICULTY for Path 2 (higher = harder to win over).
function monDifficulty(species: Species): number {
  if (species.name === 'GALEHAWK') return 0.7;
  if (species.name === 'GRITHOAX' || species.name === 'KILNDRAKE') return 0.45;
  return 0.3;
}
function ballMult(): number {
  const e = ITEMS.BALL!.effect;
  return e.kind === 'catch-ball' ? e.ballMult : 1;
}
// Add a caught/joined mon to the party (or the box if full). Fresh +
// healthy (the ball/mercy restored it); starts at the caught bond stage.
function addCaughtMon(species: Species, origin: CatchOrigin): void {
  const fresh = createSide(species);
  if (run.party.length < 6) {
    run.party.push(fresh);
    run.partyBond.push(BOND_START_CAUGHT);
    run.partyOrigin.push(origin); // Feature 3 — record HOW it was caught
  } else {
    // Party full → the box (Phase 6.5: bond + origin travel into the box).
    run.box.push(fresh);
    run.boxBond.push(BOND_START_CAUGHT);
    run.boxOrigin.push(origin);
  }
  markCaught(run.dex, species.name); // Phase 6.5 — dex CAUGHT on add
}
// Award bond on a win to the mon(s) that ACTUALLY FOUGHT — challenge-scaled,
// never flat (the anti-grind firewall: a fight that didn't test a mon yields
// ~nothing; a real trainer/near-power fight is meaningful; a boss is the big
// bonus). `foe` is the species (wild) or Team (trainer/boss) faced; its
// toughest member sets the challenge. Each participant is credited relative
// to ITS OWN power (a weak switched-in mon is challenged more) and how hurt
// IT ended (finalState.members — the fight-strain signal). `participants` are
// player party indices, aligned with run.party/run.partyBond. Bond is
// horizontal — this only moves the bond value, never a stat.
function awardBondForFight(
  foe: Species | ReturnType<typeof createTeam>,
  kind: FightKind,
  finalState: BattleState,
  participants: readonly number[],
): void {
  if (run.partyBond.length === 0 || run.party.length === 0) return;
  const foePower = foeChallengePower(foe);
  // Fall back to the lead if the scene reported nobody (defensive).
  const fighters = participants.length > 0 ? participants : [0];
  for (const i of fighters) {
    const mon = run.party[i];
    if (!mon || run.partyBond[i] === undefined) continue;
    const member = finalState.player.members[i];
    const hpFrac = member ? member.hp / Math.max(1, member.maxHp) : 1;
    run.partyBond[i] = applyBondXp(
      run.partyBond[i]!,
      bondXp({ monPower: powerIndex(mon.species), foePower, kind, hpFracRemaining: hpFrac }),
    );
  }
}

// The challenge yardstick: the power of the TOUGHEST foe the mon faced (a
// single wild species, or the hardest mon on a trainer/boss team).
function foeChallengePower(foe: Species | ReturnType<typeof createTeam>): number {
  if ('members' in foe) {
    return Math.max(...foe.members.map((m) => powerIndex(m.species)));
  }
  return powerIndex(foe);
}

// ---- Phase 6b — evolution (bond-gated, boss-capped) ----------------------
// Apply an evolution: swap the species, preserve the HP fraction + ST,
// keep the bond (it travels with the mon at the same index).
function applyEvolution(index: number, toSpeciesName: string): void {
  const old = run.party[index];
  if (!old) return;
  const fresh = createSide(resolveSpecies(toSpeciesName));
  const hpRatio = old.hp / Math.max(1, old.maxHp);
  run.party[index] = {
    ...fresh,
    hp: Math.max(1, Math.round(fresh.maxHp * hpRatio)),
    st: old.st,
    momentum: 0,
  };
}

// S1 — the end-of-fight evolution check. Finds the first party mon whose
// bond + badge gates are BOTH met, plays the held beat, applies it, then
// re-checks (a second mon, or a chain). Calls onComplete when none remain.
function maybeEvolve(onComplete: () => void): void {
  for (let i = 0; i < run.party.length; i += 1) {
    const ready = evolutionReady({
      speciesName: run.party[i]!.species.name,
      bondValue: run.partyBond[i] ?? 0,
      badges: run.badges,
    });
    if (ready) {
      const fromName = run.party[i]!.species.name;
      const idx = i;
      scenes.push(
        createEvolutionScene({
          fromName,
          toName: ready.evolvesTo,
          onDone: () => {
            applyEvolution(idx, ready.evolvesTo);
            autosaveNow();
            scenes.pop(); // drop the evolution scene
            maybeEvolve(onComplete); // chain / next mon
          },
        }),
      );
      return;
    }
  }
  onComplete();
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
    money: run.money,
    badges: [...run.badges],
    partyBond: [...run.partyBond],
    box: run.box.map(toSavedSide),
    boxBond: [...run.boxBond],
    dex: toSavedDex(run.dex),
    partyOrigin: [...run.partyOrigin],
    boxOrigin: [...run.boxOrigin],
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
  bagAdd(run.bag, 'BALL', 5); // Phase 6a — starting balls so catching is testable early
  run.money = STARTING_MONEY;
  run.badges = [];
  run.partyBond = [];
  run.box = [];
  run.boxBond = [];
  run.partyOrigin = [];
  run.boxOrigin = [];
  run.dex = createDex();
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
        run.partyBond = [BOND_START_STARTER]; // your starter begins a little warmer
        run.partyOrigin = ['starter']; // Feature 3 — the lab gift
        markCaught(run.dex, species.name); // Phase 6.5 — starter marks CAUGHT
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
      onDex: () => pushDexMenu(),
      onSave: () => autosaveNow(),
      onOptions: () => {},
      onClose: () => scenes.pop(),
      badges: run.badges,
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
      money: run.money,
      onChange: () => autosaveNow(),
      onClose: () => scenes.pop(),
    }),
  );
}

// Phase 6.5 — the PC Box, pushed from the Center PC (open-box verb).
// run.party/partyBond/box/boxBond are passed by reference; the scene's
// deposit/withdraw ops (box.ts) mutate them in place and onChange fires
// autosave so the persisted state stays the single source of truth.
function pushBoxMenu(): void {
  scenes.push(
    createBoxMenuScene({
      party: run.party,
      partyBond: run.partyBond,
      partyOrigin: run.partyOrigin,
      box: run.box,
      boxBond: run.boxBond,
      boxOrigin: run.boxOrigin,
      onChange: () => autosaveNow(),
      onClose: () => scenes.pop(),
    }),
  );
}

// Phase 6.5 — the Dex, pushed from the pause menu's DEX row. Reads the
// seen/caught status off run.dex (live) and the static CH1 entry data.
function pushDexMenu(): void {
  scenes.push(
    createDexMenuScene({
      entries: DEX_UI_ENTRIES,
      status: (name) => dexStatusOf(name),
      onClose: () => scenes.pop(),
    }),
  );
}

// Phase 5b — Poké Mart pushed from the CLERK NPC's open-mart verb. The
// buy/sell math lives in economy.ts (pure, tested); main.ts owns the
// run.money + run.bag mutation + autosave so the persisted state stays
// a single source of truth (same pattern as the bag's item-use).
function pushMartMenu(stock: readonly string[]): void {
  scenes.push(
    createMartMenuScene({
      stock,
      bag: run.bag,
      getMoney: () => run.money,
      onBuy: (itemId, qty) => {
        const { money, bought } = buyItem(run.money, run.bag, itemId, qty);
        if (bought) {
          run.money = money;
          autosaveNow();
        }
        return bought;
      },
      onSell: (itemId, qty) => {
        const { money, sold } = sellItem(run.money, run.bag, itemId, qty);
        if (sold) {
          run.money = money;
          autosaveNow();
        }
        return sold;
      },
      onClose: () => scenes.pop(),
    }),
  );
}

// Fully restore the party (HP/ST/momentum, clear status). Shared by the
// Center heal and the black-out. Does NOT autosave — callers decide.
function healPartyInPlace(): void {
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
}

// Phase 5a — Pokémon Center heal. Wired from the overworld script
// verb `heal-party` on the NURSE NPC. Also records this Center as the
// black-out respawn (the last place you healed — classic).
function healParty(): void {
  healPartyInPlace();
  const here = currentOverworldScene?.currentPosition().map;
  if (here && here.endsWith('_CENTER')) {
    // Black out to the counter (`wake` spawn), not the door tile.
    lastCenterTarget = `${here}:wake`;
  }
  autosaveNow();
}

// BUG 2 — black-out. A wild/trainer loss must NOT leave a fainted party
// in the field (free to stumble into the next fight). Instead: heal the
// whole party and warp to the last Pokémon Center, the classic
// consequence. Pops the battle scene on top, then warps.
function blackout(): void {
  healPartyInPlace();
  scenes.pop(); // remove the battle scene
  const colon = lastCenterTarget.indexOf(':');
  const map = colon >= 0 ? lastCenterTarget.slice(0, colon) : lastCenterTarget;
  const spawn = colon >= 0 ? lastCenterTarget.slice(colon + 1) : 'fromHearthwick';
  showOverworld(map, spawn, true);
  autosaveNow();
}

// Demo-complete — award a badge (idempotent) + autosave. Returns true
// if it was newly earned (so the caller can fire the fanfare only once).
function awardBadge(id: string): boolean {
  if (run.badges.includes(id)) return false;
  run.badges.push(id);
  autosaveNow();
  return true;
}

// Demo-complete — push the badge fanfare beat. onContinue is the
// caller's "where to go after the player dismisses it" (back to the gym
// in the real path; to the title on the ?skip=falkner standalone).
function pushBadgeAward(onContinue: () => void): void {
  scenes.push(
    createBadgeAwardScene({
      badgeName: ZEPHYR_BADGE,
      leaderName: 'FALKNER',
      lines: [
        'Proof of the rooftop wind.',
        'You read the gale and held.',
      ],
      onContinue,
    }),
  );
}

// Phase 4 — party menu pushed from the pause menu's POKEMON row. The
// party array is passed by reference so reorder mutates run.party in
// place; onReorder fires autosave so the new order persists.
function pushPartyMenu(): void {
  scenes.push(
    createPartyMenuScene({
      party: run.party,
      bond: run.partyBond,
      // 6b — "ask your mon" + the summary readiness line read the interim
      // bond value + badges through the evolution module.
      ask: (i) =>
        askResponse({
          speciesName: run.party[i]!.species.name,
          bondValue: run.partyBond[i] ?? 0,
          badges: run.badges,
        }),
      readiness: (i) =>
        evolutionReadiness({
          speciesName: run.party[i]!.species.name,
          bondValue: run.partyBond[i] ?? 0,
          badges: run.badges,
        }),
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
  // Phase 5b: money is additive — a pre-5b save with no money field
  // loads as the starting wallet rather than penniless.
  run.money = saved.money ?? STARTING_MONEY;
  // Demo-complete: badges additive — pre-badge saves load as [].
  run.badges = saved.badges ? [...saved.badges] : [];
  // Phase 6a — bond (interim) + box. Both additive. Bond defaults
  // per-mon for a pre-6a save; box loads via fromSavedSide.
  run.partyBond = run.party.map((_, i) =>
    saved.partyBond && typeof saved.partyBond[i] === 'number'
      ? saved.partyBond[i]!
      : BOND_START_STARTER,
  );
  run.box = saved.box ? saved.box.map((s) => fromSavedSide(s, resolveSpecies)) : [];
  // Phase 6.5 — boxBond + dex, both additive. boxBond defaults per boxed
  // mon for a pre-6.5 save; dex loads empty when absent.
  run.boxBond = run.box.map((_, i) =>
    saved.boxBond && typeof saved.boxBond[i] === 'number' ? saved.boxBond[i]! : BOND_START_CAUGHT,
  );
  // Feature 3 — catch provenance. Pre-Feature-3 saves can't know it (it's
  // impossible to backfill), so the lead defaults to 'starter' and the
  // rest to 'gift' — a best-effort guess for legacy saves only; every new
  // catch records the truth at catch time.
  run.partyOrigin = run.party.map((_, i) =>
    saved.partyOrigin && saved.partyOrigin[i] ? saved.partyOrigin[i]! : i === 0 ? 'starter' : 'gift',
  );
  run.boxOrigin = run.box.map((_, i) =>
    saved.boxOrigin && saved.boxOrigin[i] ? saved.boxOrigin[i]! : 'gift',
  );
  run.dex = fromSavedDex(saved.dex);
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
  // Phase 6.5 — facing the boss's mons registers them as SEEN too.
  markSeenAll(run.dex, [flitpeck.name, galehawk.name]);
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
      // Phase 6.7-A — a gym leader reads AMBIGUOUS: his stance intent can't
      // be blind-countered. Engine still commits the true stance.
      intentReliability: 'ambiguous',
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
        else {
          // ?skip=falkner standalone retry — heal first so the refight
          // isn't with a fainted party (BUG 2, the skip-path mirror of
          // the real instant-retry).
          healPartyInPlace();
          showFalknerFight();
        }
      },
    }),
  );
}

function showBadgeAwarded(): void {
  // ?skip=falkner standalone: award the badge, show the same fanfare
  // beat the real gym path uses, then fall through to the demo-end
  // screen → title.
  awardBadge(ZEPHYR_BADGE);
  flagStore.set('falkner_beaten');
  scenes.replace(
    createBadgeAwardScene({
      badgeName: ZEPHYR_BADGE,
      leaderName: 'FALKNER',
      lines: [
        'Proof of the rooftop wind.',
        'You read the gale and held.',
      ],
      onContinue: () => scenes.replace(createEndScene({ won: true, onRestart: showTitle })),
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
//   - Player party: GRUBLEAF (NATURE) lead at FLAME-punished
//     disadvantage; SILTSKIP (AQUA) on bench is the answer.
//   - Foe team: KILNDRAKE (FLAME) lead → FLITPECK (GALE) as the
//     forced-switch successor. Once the player swaps to SILTSKIP and
//     KOs KILNDRAKE, foe-side forced-switch fires and FLITPECK takes
//     the field — putting the player back at a switching decision
//     (GALE→NATURE 1.3 punishes the GRUBLEAF bench).
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
// Phase 5b — ?money=N seeds the wallet for shop testing. Applied by the
// skip hooks below (after any party/bag seeding). Clamped to ≥0.
const moneyParam = url.get('money');

if (wipeParam) wipeStorage();

function applyMoneyFromUrl(): void {
  if (moneyParam === null) return;
  const n = Number.parseInt(moneyParam, 10);
  if (Number.isFinite(n) && n >= 0) {
    run.money = n;
  } else {
    console.warn(`Argent ?money=${moneyParam}: not a non-negative integer; ignored`);
  }
}

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
    run.partyBond = sides.map(() => BOND_START_STARTER);
    run.partyOrigin = sides.map((_, i) => (i === 0 ? 'starter' : 'gift')); // dev hook
    return;
  }
  run.party = [createSide(pickStarter())];
  run.partyBond = [BOND_START_STARTER];
  run.partyOrigin = ['starter'];
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
else if (skip === 'catch') {
  // Phase 6a hook — drop onto Route 31 and immediately push a catchable
  // wild encounter, with balls + medicine + a few badges so BOTH paths
  // are testable fast (Path 1 throw; Path 2 faint → spare). ?party= /
  // ?bag= / ?money= work; the encounter pops back to the route, where
  // the tall grass re-rolls more.
  applyPartyFromUrl();
  run.partyBond = run.party.map(() => BOND_START_STARTER);
  bagAdd(run.bag, 'BALL', 10);
  bagAdd(run.bag, 'POTION', 5);
  applyBagFromUrl();
  applyMoneyFromUrl();
  // Seed 3 badges so the Path-2 willing-join is a real (not near-zero) gamble.
  run.badges = ['ZEPHYR', 'B2', 'B3'];
  sessionFlags.add('player_has_starter');
  recomputeSignpostFlags();
  showOverworld('ROUTE31', 'default', false);
  pushWildEncounter('FLITPECK');
}
else if (skip === 'evolve') {
  // Phase 6b hook — a bond-ready FLITPECK + the ZEPHYR badge (BOTH evo
  // gates already met). Win the wild fight to see it evolve at the end-
  // of-fight beat. Open the party menu (START) → ASK / SUMMARY to see
  // the readiness line + the "ask your mon" response.
  run.party = [createSide(CH1_DEX.FLITPECK!)];
  run.partyBond = [40]; // bond stage 3 (Companions) — bond gate met
  run.partyOrigin = ['starter']; // dev hook
  run.badges = ['ZEPHYR']; // badge gate met → both met → evolves on the next win
  run.bag = [];
  bagAdd(run.bag, 'POTION', 3);
  bagAdd(run.bag, 'BALL', 5);
  applyBagFromUrl();
  run.catchBreathUnlocked = true;
  sessionFlags.add('player_has_starter');
  recomputeSignpostFlags();
  showOverworld('ROUTE31', 'default', false);
  pushWildEncounter('FLITPECK');
}
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
  applyMoneyFromUrl();
  recomputeSignpostFlags();
  showOverworld('HEARTHWICK_CENTER', 'fromHearthwick', false);
} else if (skip === 'mart') {
  // Phase 5b hook — drop into the Hearthwick Poké Mart with a wallet
  // (default a generous ₽5000 for shop testing; ?money= overrides) and
  // a couple of potions so SELL has stock. Talk to the CLERK to shop.
  applyPartyFromUrl();
  if (run.bag.length === 0) bagAdd(run.bag, 'POTION', 2);
  applyBagFromUrl();
  run.money = 5000;
  applyMoneyFromUrl();
  sessionFlags.add('player_has_starter');
  recomputeSignpostFlags();
  showOverworld('HEARTHWICK_MART', 'fromHearthwick', false);
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
  applyMoneyFromUrl();
  sessionFlags.add('player_has_starter');
  recomputeSignpostFlags();
  showOverworld('ROUTE31', 'default', false);
}
else if (skip === 'bedroom') showOverworld('BEDROOM', 'default', false);
else if (skip === 'hearthwick') {
  applyPartyFromUrl();
  applyBagFromUrl();
  applyMoneyFromUrl();
  recomputeSignpostFlags();
  showOverworld('HEARTHWICK', 'fromHouse', false);
}
else if (skip === 'violet') {
  // Demo-complete hook — drop into Violet City (the gym hub) with a
  // party so the gym → Falkner slice is testable from one click.
  applyPartyFromUrl();
  applyBagFromUrl();
  applyMoneyFromUrl();
  sessionFlags.add('player_has_starter');
  recomputeSignpostFlags();
  showOverworld('VIOLET', 'fromRoute', false);
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
    onTrainerBattle(foeSpecies: string | readonly string[], winFlag: string, reward?: number) {
      pushTrainerFight(foeSpecies, winFlag, reward);
    },
    onBossBattle(bossId: string) {
      if (bossId === 'falkner') showFalknerFightFromOverworld();
    },
    onOpenMart(stock: readonly string[]) {
      pushMartMenu(stock);
    },
    onOpenBox() {
      pushBoxMenu();
    },
    // Encounter rolls use the run's SEEDED rng (risks/gaps #2) so encounter
    // sequences are deterministic + reproducible, consistent with combat.
    random: () => run.rng.next(),
    onGiveItem(itemId: string, qty: number) {
      // Phase 7 — hidden items + event rewards. Skip unknown ids loudly
      // (a map typo shouldn't crash); otherwise add to the bag + autosave.
      if (!ITEMS[itemId]) {
        console.warn(`Argent give-item: unknown item "${itemId}" — ignored`);
        return;
      }
      bagAdd(run.bag, itemId, qty);
      autosaveNow();
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
  markSeen(run.dex, foe.name); // Phase 6.5 — a wild encounter marks SEEN
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
      // Phase 6a — Catching 2.0 (wild only). The math lives game-side.
      canCatch: true,
      ballCount,
      medicineCount,
      // Path 1 — throw a ball: consume one, roll the catch for the
      // detected window. Out-of-window → chance 0 (auto-fail).
      onThrowBall: (window: CatchWindow, hpFrac: number) => {
        consumeBall();
        const chance = catchChance({
          rarity: catchRarity(foe),
          window,
          ballMult: ballMult(),
          hpFrac,
        });
        return { caught: rollCatch(chance, run.rng) };
      },
      // Path 2 — spare a fainted mon with medicine: consume one, roll the
      // willing join (badges primary, bond bonus, rarity difficulty).
      onWillingJoin: () => {
        consumeMedicine();
        const lead = run.partyBond[0] ?? 0;
        const bonus = bondBonus(lead);
        const chance = willingJoinChance({
          badges: run.badges.length,
          monRarity: monDifficulty(foe),
          bondBonus: bonus,
        });
        return {
          joined: rollWillingJoin(chance, run.rng),
          hint: refusalHint({ badges: run.badges.length, bondBonus: bonus }, run.rng),
        };
      },
      // Caught (Path 1) or joined (Path 2) → add the wild mon, pop back.
      onCaught: (finalState, origin) => {
        writebackParty(finalState);
        addCaughtMon(foe, origin); // 'read' (Path 1) | 'mercy' (Path 2)
        recomputeSignpostFlags();
        scenes.pop();
        currentOverworldScene?.armPostBattleGrace();
        autosaveNow();
      },
      // RUN bug fix — fleeing returns to the SAME tile, no heal, no
      // warp (NOT a black-out, which is loss-only). Writeback preserves
      // any chip damage taken before fleeing; grace stops an instant
      // re-roll on the tile you land back on. The wild mon escaping
      // (Wariness flee) lands here too — same overworld result.
      onFlee: (finalState) => {
        writebackParty(finalState);
        scenes.pop();
        currentOverworldScene?.armPostBattleGrace();
        autosaveNow();
      },
      onFoeGone: (finalState) => {
        writebackParty(finalState);
        scenes.pop();
        currentOverworldScene?.armPostBattleGrace();
        autosaveNow();
      },
      onResolve: (winner, finalState, participants) => {
        writebackParty(finalState);
        // BUG 2 — a wild loss blacks out (heal + warp to the Center)
        // rather than leaving a fainted party in the grass.
        if (winner !== 'player') {
          blackout();
          return;
        }
        awardBondForFight(foe, 'wild', finalState, participants); // challenge-scaled (firewall: trivial→~0)
        recomputeSignpostFlags();
        // Demo-complete S4 (design intent, build in Phase 8 with the
        // bond system): the first Trainer Call should unlock from an
        // EARNED BOND MOMENT — the mon reacts to the player / senses
        // the stakes / shows trust — NOT this win counter, and NOT
        // gated to the badge. For the demo it stays simply unlocked
        // (here, on the first wild win) so the bond system doesn't
        // block the demo. See docs/falkner-boss-card.md + memory.
        run.catchBreathUnlocked = true;
        scenes.pop();
        // Classic post-battle grace — the very next step on tall
        // grass won't roll another encounter, so the player can
        // never get trapped in an immediate chain.
        currentOverworldScene?.armPostBattleGrace();
        autosaveNow();
        maybeEvolve(() => {}); // 6b — a bond bump may cross an evo gate
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
  // Phase 6.5 — seeing a trainer's mon registers it as SEEN, same as a
  // wild encounter (matches real Pokémon; dex isn't wild-only).
  markSeenAll(run.dex, sides.map((s) => s.species.name));
  return createTeam(sides);
}

function pushTrainerFight(
  foeSpec: string | readonly string[],
  winFlag: string,
  reward?: number,
): void {
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
      // Demo-complete S5 (log): named trainers currently run the generic
      // wildFoeAI (uniform-random move + stance) — fine for the demo,
      // but post-demo they should get distinct AI so they fight like
      // people, not wild mons (a per-trainer policy, like the boss cards).
      chooseFoeAction: (s, r) => wildFoeAI(s, r),
      intro: ['Gym trainer sent out', `${leadName}!`, 'Show your read!'],
      catchBreathUnlocked: run.catchBreathUnlocked,
      canRun: false,
      onResolve: (winner, finalState, participants) => {
        writebackParty(finalState);
        // BUG 2 — losing a trainer fight must NOT leave the player
        // fainted in place (free to walk into the next fight, e.g.
        // Falkner). Black out: heal + warp to the last Center. The win
        // flag is NOT set, so progress does not advance.
        if (winner !== 'player') {
          blackout();
          return;
        }
        flagStore.set(winFlag);
        awardBondForFight(foeTeam, 'trainer', finalState, participants); // trainers weighted above wilds
        // Phase 5b — trainer payout (game-layer; engine untouched).
        // Wild wins never reach here (trainers-only, anti-grind).
        if (reward && reward > 0) run.money = awardMoney(run.money, reward);
        scenes.pop();
        // Trainer fights aren't grass-rolled, but the grace also
        // protects against the player stepping onto adjacent grass
        // immediately after a trainer victory and getting chained.
        currentOverworldScene?.armPostBattleGrace();
        autosaveNow();
        maybeEvolve(() => {}); // 6b — a bond bump may cross an evo gate
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
      // Phase 6.7-A — gym leader reads AMBIGUOUS (the ?skip=falkner path).
      intentReliability: 'ambiguous',
      intro: [
        'FALKNER: Welcome to my',
        'rooftop. Read the wind!',
        '— sent out FLITPECK!',
      ],
      catchBreathUnlocked: true,
      canRun: false,
      onResolve: (winner, finalState, participants) => {
        writebackParty(finalState);
        scenes.pop(); // drop the battle scene first
        if (winner === 'player') {
          flagStore.set('falkner_beaten');
          run.catchBreathUnlocked = true;
          awardBondForFight(team, 'boss', finalState, participants); // boss clear = the big bonus
          // Demo-complete S1: award the ZEPHYR badge + a real payoff
          // beat, then return to the gym. awardBadge autosaves; the
          // pop after the fanfare lands the player back on the rooftop.
          awardBadge(ZEPHYR_BADGE);
          pushBadgeAward(() => {
            scenes.pop(); // drop the badge scene → back to the gym
            autosaveNow();
            // 6b — earning ZEPHYR may complete a bonded mon's badge gate.
            maybeEvolve(() => {});
          });
        } else {
          // BUG 2 — a boss loss heals + offers INSTANT RETRY (the
          // "instant boss retry" pillar), not a fainted party stuck on
          // the rooftop and not a long walk back from a Center. Re-open
          // the prep → fight in place with a fresh party.
          healPartyInPlace();
          autosaveNow();
          showFalknerFightFromOverworld();
        }
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
