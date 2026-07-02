import {
  COUNTER_MAP,
  SPECIES,
  activeMon,
  affordableMoves,
  createBattleState,
  createSide,
  createTeam,
  FALKNER_OPENING_MOMENTUM,
  falknerBossAI,
  forcedAction,
  loadDex,
  loadSpeciesAt,
  loadMoves,
  mulberry32,
  registerMoves,
  trainerPolicy,
  TRAINER_PROFILES,
  foeProfileForFlag,
  buildKamonTeam,
  kamonStolenStarter,
  KAMON_CHAFF_SPECIES,
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
import { LOGICAL_H, LOGICAL_W, mountCanvas } from './canvas';
import { loadUiFont } from './font';
import { createPctTileTestScene } from './scenes/pctTileTest';
import { createInputDispatcher } from './input';
import { SceneStack } from './scene';
import { createBattleScene, infoLevelToReliability } from './scenes/battle';
import { profileIntentInfo } from './trainerIntent';
import { createEndScene } from './scenes/end';
import { createBagMenuScene } from './scenes/bagMenu';
import { createMartMenuScene } from './scenes/martMenu';
import { createBadgeAwardScene } from './scenes/badgeAward';
import { createFalknerPrepScene } from './scenes/falknerPrep';
import { createOverworldScene } from './scenes/overworld';
import { CALLS_UNLOCK_ON_WIN } from './overworld/tiledWiring';
import { createPartyMenuScene } from './scenes/partyMenu';
import { createPauseMenuScene } from './scenes/pauseMenu';
import { createPrepScene } from './scenes/prep';
import { createStarterPickScene } from './scenes/starterPick';
import { createTitleScene } from './scenes/title';
import { createNameEntryScene, NAME_MAX_LEN, sanitizeName } from './scenes/nameEntry';
import { resolvePlayerName } from './playerName';
import { buildDevPlan, AT_TARGETS, PRESETS, type DevPlan, type DevPartyMember } from './devNav';
import { createDevMenuScene, type DevMenuItem } from './scenes/devMenu';
import { createAudioEngine, loadMutedPref, saveMutedPref } from './audio/synth';
import { installAudio } from './audio/audioSubscriber';
import { createConfirmScene } from './scenes/confirmPrompt';
import { createMessageScene } from './scenes/messageScene';
import { createChapterCardScene } from './scenes/chapterCard';
import { monDisplayName } from './monName';
import { kamonGateLines, quietResolveLines, CHAPTER_CARD, CH1_CLOSED_FLAG, shouldFireChapterEnd } from './ch1Ending';
import { ACADEMY_PROMOTED_FLAG, falknerMentorLines } from './violetAcademy';
import { freshBattleSide } from './battlePrep';
import { bagAdd, bagByPocket, bagConsume, ITEMS, seedStartingBag } from './items';
import type { BagEntry } from './items';
import { STARTING_MONEY, awardMoney, buyItem, sellItem } from './economy';
import {
  BOND_START_CAUGHT,
  BOND_START_STARTER,
  CATCH_RARITY,
  bondBonus,
  bondStageName,
  catchChance,
  rollCatch,
  rollWillingJoin,
  refusalHint,
  willingJoinChance,
} from './catching';
import type { CatchWindow, CatchOrigin } from './catching';
import { TUTORIAL_CATCH_SPECIES, TUTORIAL_INTRO, tutorialFoeAI, shouldFireGuidedCatch, GUIDED_CATCH_DONE_FLAG } from './tutorialCatch';
import { emitGameEvent } from './gameEvents';
import { createBondStageScene } from './scenes/bondStage';
import {
  applyBondXp,
  bondStageCrossing,
  bondUnlocksCalls,
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

const canvasHost = mountCanvas(host);
const { ctx } = canvasHost;

// Dev gate. Vite sets import.meta.env.DEV true under `npm run dev`, false in a
// production build. Read defensively so the strict tsconfig needs no vite/client
// types and a non-Vite host simply reads false → the entire dev layer is inert.
const DEV_BUILD = (import.meta as { env?: { DEV?: boolean } }).env?.DEV === true;

const dispatcher = createInputDispatcher(
  (key) => scenes.input(key),
  (raw) => {
    // Dev-only: backtick toggles the debug menu (consumes the key). Inert in prod.
    if (DEV_BUILD && raw === '`') { toggleDevMenu(); return true; }
    return scenes.textInput(raw); // raw typed keys → the active text field (nameEntry)
  },
);

// First audio (docs/sfx-build-decisions.md): a synth engine + a subscriber on the
// gameEvents bus. Pure presentation — reads events, plays sounds, writes nothing
// back. The Web Audio context builds lazily inside the first sound-emitting keypress
// (autoplay policy). Mute is a persisted device preference; default ON (unmuted).
const audioEngine = createAudioEngine({ muted: loadMutedPref() });
installAudio(audioEngine);

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
  // Player character name — set at new-game via the nameEntry prompt; the
  // [player] token source. null = no name → the address drops gracefully
  // (resolvePlayerName / kamonGateLines). Persisted (additive save field).
  playerName: string | null;
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
  playerName: null,
};

// Dev playtest session marker — set when a dev-nav plan or the debug menu seeds
// state. While set, autosave is SUPPRESSED so a skip-state never overwrites the
// real save slot (dev sessions are ephemeral; ?wipe still clears for a clean run).
let devSession = false;

// Lane B — dev/playtest override (?calls=all): unlock every BUILT Call now,
// bypassing the bond-tier gate, so the new Call effects can be tested. Set in
// the URL-param section below; threaded into every battle scene via
// bondSceneProps. The SHIPPING default is bond-gated (false) — never ship on.
let devUnlockAllCalls = false;

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
  // The canonical "ZEPHYR badge earned" flag — derived from run.badges so it's
  // always consistent (and recomputed on load). Gates the Violet→Route 32
  // obstacle (gone once earned) and KAMON's spawn (present once earned).
  if (run.badges.includes(ZEPHYR_BADGE)) flagStore.set('zephyr_earned');
  else flagStore.unset('zephyr_earned');
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
  // Arm the bond jumpstart (B5) per mon: a stage-5 ("Partners in Kind") mon's
  // first read-win this battle banks a free ★. Read-economy only — the engine applies
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
// final BattleState — extracts the post-battle Team's members back into
// run.party so HP/momentum carry forward. Uses toSavedSide / fromSavedSide
// so the writeback shape MATCHES the save/load shape exactly.
//
// STAMINA recovers between fights (Bug 2): ST is a per-battle resource —
// every battle already STARTS full (freshBattleSide), so a mon never carries
// drained ST into the next fight. We reset it here too so the OVERWORLD
// (party screen) shows it recovered rather than stuck at its end-of-fight
// value. HP persists (the real overworld resource, healed at Centers).
function writebackParty(finalState: BattleState): void {
  run.party = finalState.player.members.map((m) => ({
    ...fromSavedSide(toSavedSide(m), resolveSpecies),
    st: m.maxSt, // full stamina between fights (the mon's OWN max — per-mon now)
    momentum: 0, // ★ is per-battle — never banked into the overworld
  }));
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
function addCaughtMon(species: Species, origin: CatchOrigin, nickname?: string): void {
  const base = createSide(species);
  const fresh = nickname ? { ...base, nickname } : base;
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

// Name-on-catch: prompt "Give SPECIES a nickname?" YES/NO; YES opens the typed
// field. `done(nickname?)` runs exactly once after the player names or skips
// (skip → undefined → the mon keeps its species name). The prompt overlays the
// overworld (the battle was already popped); both scenes pop themselves on exit.
function promptNickname(speciesName: string, done: (nickname?: string) => void): void {
  scenes.push(
    createConfirmScene({
      prompt: `Give ${speciesName} a nickname?`,
      onYes: () => {
        scenes.push(
          createNameEntryScene({
            prompt: `Name your ${speciesName}:`,
            maxLen: NAME_MAX_LEN,
            onConfirm: (name) => { scenes.pop(); scenes.pop(); done(name); },
            onCancel: () => { scenes.pop(); scenes.pop(); done(undefined); }, // skip
          }),
        );
      },
      onNo: () => { scenes.pop(); done(undefined); },
    }),
  );
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
// Calls unlock as a BOND moment — bond stage ≥ 2, "Warming" (the first felt step)
// — OR via the legacy run flag (kept so existing unlock paths still fire). This
// fixes "Calls never usable": the flag was set only by specific fight wins, so a
// path that missed them left Calls locked forever even with ★ banked. Bond now
// unlocks them robustly (bond-track-v2: the Call economy is a bond reward). Read
// off the lead's bond (the active mon in the common 1-mon case). NOTE: this stays
// at stage 2 even though the ★-JUMPSTART moved to stage 5 (Card 1) — the two were
// decoupled (bondUnlocksCalls vs hasJumpstart).
function callsUnlocked(): boolean {
  return run.catchBreathUnlocked || bondUnlocksCalls(run.partyBond[0] ?? 0);
}

// A bond stage-crossing to announce after the battle (Issue 1).
interface BondCross {
  readonly species: string;
  readonly fromName: string;
  readonly toName: string;
  // The post-cross bond value — lets the tier-up beat sweep its bond bar to
  // full (Lane A surface ②). The named stage already comes via toName.
  readonly toValue: number;
  // This crossing NEWLY unlocked the Call economy (crossed into the Warming
  // bond moment, and Calls weren't already unlocked by the run flag).
  readonly unlocksCalls: boolean;
}

function awardBondForFight(
  foe: Species | ReturnType<typeof createTeam>,
  kind: FightKind,
  finalState: BattleState,
  participants: readonly number[],
): BondCross[] {
  const crossings: BondCross[] = [];
  if (run.partyBond.length === 0 || run.party.length === 0) return crossings;
  const foePower = foeChallengePower(foe);
  // Fall back to the lead if the scene reported nobody (defensive).
  const fighters = participants.length > 0 ? participants : [0];
  for (const i of fighters) {
    const mon = run.party[i];
    if (!mon || run.partyBond[i] === undefined) continue;
    const member = finalState.player.members[i];
    const hpFrac = member ? member.hp / Math.max(1, member.maxHp) : 1;
    const before = run.partyBond[i]!;
    const after = applyBondXp(
      before,
      bondXp({ monPower: powerIndex(mon.species), foePower, kind, hpFracRemaining: hpFrac }),
    );
    run.partyBond[i] = after;
    // Stage-crossing milestone: record it for the post-battle beat + emit
    // on the event bus (the natural reactive seam — audio chimes it later).
    const cross = bondStageCrossing(before, after);
    if (cross) {
      // Calls newly unlock when this crossing reaches the Warming bond moment
      // (stage 2, bondUnlocksCalls) and the run flag hadn't already unlocked them.
      const unlocksCalls = !bondUnlocksCalls(before) && bondUnlocksCalls(after) && !run.catchBreathUnlocked;
      crossings.push({
        species: mon.species.name,
        fromName: bondStageName(before),
        toName: bondStageName(after),
        toValue: after,
        unlocksCalls,
      });
      emitGameEvent({
        kind: 'bond-stage-cross',
        species: mon.species.name,
        fromStage: cross.fromStage,
        toStage: cross.toStage,
      });
    }
  }
  return crossings;
}

// Announce each bond stage-crossing as a prompted beat (like a level-up),
// then run `onComplete`. Chains scene-by-scene (same pattern as maybeEvolve)
// so multiple crossings show in sequence. Empty list → straight to onComplete.
function showBondBeats(crossings: readonly BondCross[], onComplete: () => void): void {
  if (crossings.length === 0) {
    onComplete();
    return;
  }
  const [head, ...rest] = crossings;
  scenes.push(
    createBondStageScene({
      species: head!.species,
      fromName: head!.fromName,
      toName: head!.toName,
      toValue: head!.toValue,
      unlocksCalls: head!.unlocksCalls,
      onContinue: () => {
        scenes.pop();
        showBondBeats(rest, onComplete);
      },
    }),
  );
}

// The challenge yardstick: the power of the TOUGHEST foe the mon faced (a
// single wild species, or the hardest mon on a trainer/boss team).
function foeChallengePower(foe: Species | ReturnType<typeof createTeam>): number {
  if ('members' in foe) {
    return Math.max(...foe.members.map((m) => powerIndex(m.species)));
  }
  return powerIndex(foe);
}

// Lane A (bond legibility) — the bond props threaded into a battle scene: the
// live per-member bond values (the static in-combat meter) plus, for a fight
// that AWARDS bond on a win, the challenge context so the meter can animate its
// post-win advance via the SAME pure pipeline awardBondForFight uses (the
// displayed target then matches run.partyBond after the award). Display-only —
// it never moves bond. Omit (foe, kind) for non-awarding fights (intro / test /
// ?skip) → the static meter shows, with no advance.
// Also carries Lane B's Call-unlock gating (`callBondValue` = the lead mon's
// bond, gating Recover/Dodge/Full Power per their tiers; `devUnlockAllCalls` =
// the ?calls=all override). Folded in here because both are per-battle props
// derived from run state at scene creation; the gating is read-only (it never
// moves bond). callBondValue is lead-based (matching the run-level
// catchBreathUnlocked gate) — a mid-battle switch doesn't re-gate.
function bondSceneProps(
  foe?: Species | ReturnType<typeof createTeam>,
  kind?: FightKind,
): {
  playerBond: readonly number[];
  bondContext?: { readonly kind: FightKind; readonly foePower: number };
  callBondValue: number;
  devUnlockAllCalls: boolean;
} {
  const base = {
    playerBond: run.partyBond,
    callBondValue: run.partyBond[0] ?? 0,
    devUnlockAllCalls,
  };
  if (foe && kind) {
    return { ...base, bondContext: { kind, foePower: foeChallengePower(foe) } };
  }
  return base;
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
  if (devSession) return; // dev playtest session — never touch the real save slot
  const pos = currentOverworldScene.currentPosition();
  const state: SaveState = {
    version: 1,
    party: run.party.map(toSavedSide),
    position: pos,
    flags: Array.from(sessionFlags),
    catchBreathUnlocked: run.catchBreathUnlocked, // persist the real run flag; bond-unlock is derived
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
    // Only emit when set, so a no-name run's wire shape is unchanged.
    ...(run.playerName ? { playerName: run.playerName } : {}),
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
  // Normal playthrough: 3 POTIONs, NO balls — the player's first Bands are
  // LARCH's lab grant (the Catching 2.0 lesson). The ?skip=wild dev hook
  // seeds its own balls to keep combat playtests handy.
  seedStartingBag(run.bag);
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
  run.playerName = null;
  sessionFlags.clear();
  recomputeSignpostFlags();
  // Pokémon-standard: name the character first, then drop into the opening.
  // Skipping is allowed (→ null → graceful [player] drop); either way we
  // proceed to the bedroom, so the opening beats are never blocked.
  promptPlayerName(() => showOverworld('BEDROOM', 'default', false));
}

// Reuse the nameEntry primitive (same typed-entry / cap / validation as mon
// nicknaming) to capture the player's name at new-game start. Confirm stores the
// sanitized name; skip/blank stores null (graceful drop). `then` always fires so
// the opening continues regardless. The prompt sits over the title (dimmed).
function promptPlayerName(then: () => void): void {
  scenes.push(
    createNameEntryScene({
      prompt: "What's your name?",
      maxLen: NAME_MAX_LEN,
      onConfirm: (name) => { run.playerName = sanitizeName(name); scenes.pop(); then(); },
      onCancel: () => { run.playerName = null; scenes.pop(); then(); },
    }),
  );
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
      // OPTIONS → the audio mute toggle (the only live setting this slice). Persists
      // the device preference; the menu flash shows the new SOUND state.
      onOptions: () => {
        audioEngine.setMuted(!audioEngine.isMuted());
        saveMutedPref(audioEngine.isMuted());
      },
      audioOn: () => !audioEngine.isMuted(),
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
      st: s.maxSt, // heal to the mon's OWN full stamina (per-mon now)
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
  // Player name: additive — pre-naming saves omit it → resolves to null (the
  // [player] address drops gracefully). A real saved name is restored as-is.
  run.playerName = resolvePlayerName(saved.playerName);
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
      ...bondSceneProps(), // Lane A — static bond meter (demo wild; no bond award)
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

// KAMON v2 — the stolen starter is the COUNTER-type to the player's pick (CH1
// triangle), else the fixture counter map (the ?skip demo path / EMBERCUB).
function kamonStolenSpecies(player: Species): Species {
  const stolenName = kamonStolenStarter(player.name) ?? COUNTER_MAP[player.name];
  return resolveSpecies(stolenName!);
}

// KAMON's leading CHAFF (the 2-mon card) — only for a CH1 lead. The fixture/demo
// path (EMBERCUB / ?skip, no CH1 dex entry) has no chaff → KAMON fights solo.
function kamonChaffFor(player: Species): Species | undefined {
  return CH1_DEX[player.name] !== undefined ? CH1_DEX[KAMON_CHAFF_SPECIES] : undefined;
}

function showPrep(): void {
  const player = partyLead();
  scenes.replace(
    createPrepScene({
      playerSpecies: player,
      foeSpecies: kamonStolenSpecies(player),
      foeTrainerName: 'KAMON',
      onContinue: showRivalBattle,
    }),
  );
}

function showRivalBattle(): void {
  const player = partyLead();
  const stolen = kamonStolenSpecies(player);
  // KAMON's 2-mon card: a leading CHAFF (CH1 only) + the stolen starter ACE at
  // bond-factor 0.85. CH1 leads use the CH1 type chart; the fixture demo path
  // keeps the legacy chart and fights solo (no CH1 chaff).
  const chaff = kamonChaffFor(player);
  const foeTeam = buildKamonTeam(stolen, chaff);
  const isCh1 = CH1_DEX[player.name] !== undefined;
  const state = createBattleState(
    buildPlayerTeam(),
    foeTeam,
    isCh1 ? { typeChart: TYPECHART_CH1 } : {},
  );
  scenes.replace(
    createBattleScene({
      state,
      rng: run.rng,
      ...bondSceneProps(), // Lane A — static bond meter (intro rival; no bond award)
      // KAMON's AI = the RIVAL profile's earliest rung (Aggressor/Single-only/
      // Fixed/no-Calls). He leans Aggressive and CAN'T Get Away — commit freely.
      chooseFoeAction: (s, r) => trainerPolicy(TRAINER_PROFILES.kamon!)(s, 'foe', r),
      // Intent/info from KAMON's profile (open), same derivation as pushTrainerFight —
      // not the scene default. Inert at CH1 (single-only → never Focuses); correct for
      // when his profile climbs to two-step/Reactive in CH2+.
      ...profileIntentInfo(TRAINER_PROFILES.kamon!),
      intro: chaff
        ? [
            'KAMON leads with a',
            `crudely-caught ${chaff.name}.`,
            'Behind it waits',
            `the stolen ${stolen.name}.`,
            'Out-read them both.',
          ]
        : [
            'KAMON sent out',
            `the stolen ${stolen.name}!`,
            'It has the type edge',
            '— but it hesitates.',
            'Out-read them.',
          ],
      catchBreathUnlocked: callsUnlocked(),
      canRun: false,
      onResolve: (winner, finalState) => {
        writebackParty(finalState);
        showEnd(winner === 'player');
      },
    }),
  );
}

// Phase 7 — the KAMON first-fight as the Violet→Route 32 GATE (post-Falkner).
// The overworld-launched twin of showRivalBattle: the same bespoke v2 card
// (counter-type stolen starter SOLO, kamon profile, bit-identical combat spec)
// but PUSHED over the Violet scene and POPPED back on resolve instead of
// ending the demo. Both win and loss advance — KAMON leaves (kamon_beaten) and
// the exit opens, no soft-lock (a loss heals first so the party isn't stranded
// fainted). The pre-fight line is a placeholder (warm-foil voice is a separate
// narrative-lane task). Sim-gated for the post-Falkner team: src/sim/rivalCard.
// The [player] token source is run.playerName, captured at new-game start by the
// nameEntry prompt (promptPlayerName) and persisted. resolvePlayerName turns a
// blank/absent value into null so KAMON's sign-off drops the address gracefully;
// a real name is preferred. (Sweep: KAMON's CH1 ending line is the only consumer.)

// The [starter] token: the player's mon by nickname-aware display name —
// prefer the lab starter (origin 'starter'), then the lead, then a graceful
// fallback. Handles a boxed starter (search the box) and a fainted one (still
// named) without special-casing.
function starterDisplayName(): string {
  const pIdx = run.partyOrigin.findIndex((o) => o === 'starter');
  if (pIdx >= 0 && run.party[pIdx]) return monDisplayName(run.party[pIdx]!);
  const bIdx = run.boxOrigin.findIndex((o) => o === 'starter');
  if (bIdx >= 0 && run.box[bIdx]) return monDisplayName(run.box[bIdx]!);
  if (run.party[0]) return monDisplayName(run.party[0]);
  return 'your partner';
}

// Push a paged narrated message (cutscene textbox) that pops itself when
// dismissed, then runs `onDone`. Used by the CH1 ending beats.
function pushMessage(lines: readonly string[], onDone: () => void = () => {}): void {
  scenes.push(
    createMessageScene({
      lines,
      onDone: () => {
        scenes.pop();
        onDone();
      },
    }),
  );
}

// CH1 ending — the Route 32 beat: the quiet-resolve message, then the chapter
// card (which replaces the old boundary placard). Fired on entering Route 32.
function pushChapterEndBeat(): void {
  pushMessage(quietResolveLines(starterDisplayName()), () => {
    scenes.push(createChapterCardScene({ ...CHAPTER_CARD, onDone: () => scenes.pop() }));
  });
}

function pushRivalGateFight(): void {
  const player = partyLead();
  const stolen = kamonStolenSpecies(player);
  // The 2-mon card: KAMON leads with a crudely-caught chaff, the stolen starter
  // ace finishes (CH1 only; the fixture path stays solo). Sim-gated stage-1:
  // src/sim/rivalCard. The starter's evo gates on HIVE (badge 2), so the lead is
  // still stage-1 here even though this is post-ZEPHYR.
  const chaff = kamonChaffFor(player);
  const foeTeam = buildKamonTeam(stolen, chaff);
  const isCh1 = CH1_DEX[player.name] !== undefined;
  const state = createBattleState(
    buildPlayerTeam(),
    foeTeam,
    isCh1 ? { typeChart: TYPECHART_CH1 } : {},
  );
  scenes.push(
    createBattleScene({
      state,
      rng: run.rng,
      ...bondSceneProps(foeTeam, 'trainer'), // Lane A — bond meter + post-win advance
      chooseFoeAction: (s, r) => trainerPolicy(TRAINER_PROFILES.kamon!)(s, 'foe', r),
      // Intent/info from KAMON's profile (open), same derivation as pushTrainerFight —
      // not the scene default. Inert at CH1 (single-only → never Focuses); correct for
      // when his profile climbs to two-step/Reactive in CH2+.
      ...profileIntentInfo(TRAINER_PROFILES.kamon!),
      intro: chaff
        ? [
            'KAMON blocks the road south.',
            'KAMON: So you earned the badge.',
            `Then prove it — ${chaff.name}, soften them up!`,
          ]
        : [
            'KAMON blocks the road south.',
            'KAMON: So you earned the badge.',
            `Then prove it — ${stolen.name}, go!`,
          ],
      catchBreathUnlocked: callsUnlocked(),
      canRun: false,
      onResolve: (winner, finalState, participants) => {
        writebackParty(finalState);
        // Both branches advance: KAMON leaves + the exit opens (no soft-lock).
        flagStore.set('kamon_beaten');
        const playerWon = winner === 'player';
        let bondCrossings: BondCross[] = [];
        if (playerWon) {
          bondCrossings = awardBondForFight(foeTeam, 'trainer', finalState, participants);
        } else {
          // A loss still advances — heal so the party isn't stranded fainted
          // back in town (BUG 2 contract), then KAMON leaves all the same.
          flagStore.set('kamon_won'); // KAMON won (player lost) — persisted branch flag
          healPartyInPlace();
        }
        recomputeSignpostFlags();
        scenes.pop(); // back to Violet — KAMON is gone, the exit is open
        autosaveNow();
        // BOND BEAT FIRST, THEN the gate dialogue (Fix 1). This path used to
        // pushMessage the gate line immediately, SWALLOWING the bond tier-up
        // beat when the fight crossed a stage. The celebratory payoff must
        // always fire on a crossing; KAMON's line follows it. (No crossing /
        // a loss → showBondBeats short-circuits straight to the dialogue.)
        // CH1 ending — the gate exchange: branch-aware opener (off the resolve's
        // own `winner`) → converged deflection + Concord stinger. KAMON's
        // despawn (kamon_beaten) IS his "leaving north."
        showBondBeats(bondCrossings, () =>
          pushMessage(kamonGateLines(playerWon, resolvePlayerName(run.playerName))),
        );
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
    // Spine-1 re-baseline 2→4: phased-unlock let good readers Break-spam Falkner,
    // resetting his gust cadence and starving DIVE BOMB. 4 holds the cadence so his
    // signature fires (see src/sim/falknerLadder.ts).
    breakBar: 4,
    teamSize: 2,
    openingMomentum: FALKNER_OPENING_MOMENTUM,
  };
  const team = createTeam([
    // The boss "comes prepared" — both of Falkner's mons bank the opening ★ so
    // their signature heavy (DIVE BOMB = 2★ under phased-unlock) reaches the field.
    createSide(flitpeck, undefined, { openingMomentum: FALKNER_OPENING_MOMENTUM }),
    createSide(galehawk, card.statScale, { openingMomentum: FALKNER_OPENING_MOMENTUM }),
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
      ...bondSceneProps(), // Lane A — static bond meter (?skip path awards no bond)
      chooseFoeAction: (s, r) => falknerBossAI(s, 'foe', r),
      // Phase 6.7-A — a gym leader reads AMBIGUOUS: his stance intent can't
      // be blind-countered. Engine still commits the true stance.
      intentReliability: 'ambiguous',
      // Layer 4 Stage 1 — Falkner's gust-Focus tell is VAGUE (a gym leader
      // hints but doesn't narrow to two): "is focusing intently".
      foeFocusInfo: { discipline: 'veiled', releases: ['heavy'] },
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
      ...bondSceneProps(), // Lane A — static bond meter (?skip test battle)
      chooseFoeAction: (s, r) => wildFoeAI(s, r),
      intro: [`Test battle:`, `wild ${foe.name} appeared!`],
      catchBreathUnlocked: callsUnlocked(),
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
      ...bondSceneProps(), // Lane A — static bond meter (?skip 2v2 test battle)
      chooseFoeAction: (s, r) => wildFoeAI(s, r),
      intro: [
        `2v2 test:`,
        `wild ${foeLead.name} appeared!`,
        `Lead is at a type`,
        `disadvantage — switch?`,
      ],
      catchBreathUnlocked: callsUnlocked(),
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
//   ?calls=all                 (Lane B) unlocks every BUILT Call now,
//                              bypassing the bond-tier gate, to playtest
//                              the Call effects. Shipping default is gated.
//   ?log=1                     DEV TOOL — opens the dev combat-log overlay
//                              (narrates raw BattleEvents: strikes, ★ economy,
//                              statuses, techniques, Calls). Toggle at runtime
//                              with the `~`/backtick key. Read in battle.ts so
//                              it works at every battle entry point. Off by
//                              default; display-only (no combat-logic change).
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

// Lane B — apply the ?calls=all dev override (default stays bond-gated).
devUnlockAllCalls = url.get('calls') === 'all';

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

// --- dev playtest navigation (dev-only; gated by DEV_BUILD = import.meta.env.DEV) --
// Resolve a dev party member to a Species, reusing the dex path: `level` (if given)
// widens the learnset band via loadSpeciesAt (Argent has no stat-leveling — level
// only gates moves). Falls back to the default-band species, then to the starter list.
function resolveDevSpecies(name: string, level: number | null): Species | null {
  const entry = (ch1BatchData as DexEntryJson[]).find((e) => e.name === name);
  if (entry) return loadSpeciesAt(entry, level ?? CH1_LEVEL);
  return STARTERS.find((s) => s.name === name) ?? CH1_DEX[name] ?? null;
}

function applyDevParty(members: readonly DevPartyMember[]): void {
  const sides: SideState[] = [];
  for (const m of members) {
    const sp = resolveDevSpecies(m.name, m.level);
    if (!sp) { console.warn(`Argent dev ?party: unknown mon "${m.name}"; skipped`); continue; }
    sides.push(createSide(sp));
  }
  if (sides.length === 0) sides.push(createSide(pickStarter()));
  run.party = sides;
  run.partyBond = sides.map(() => BOND_START_STARTER);
  run.partyOrigin = sides.map((_, i) => (i === 0 ? 'starter' : 'gift'));
}

// Apply a composed dev plan via the EXISTING setters: party-construction, flags,
// badges (recompute derives zephyr_earned), then a map warp. Marks the session dev
// so autosave is suppressed (real save slot protected).
function applyDevPlan(plan: DevPlan): void {
  devSession = true;
  if (plan.party && plan.party.length > 0) applyDevParty(plan.party);
  else { run.party = [createSide(pickStarter())]; run.partyBond = [BOND_START_STARTER]; run.partyOrigin = ['starter']; }
  applyBagFromUrl();
  applyMoneyFromUrl();
  if (run.bag.length === 0) bagAdd(run.bag, 'POTION', 3); // a sane default kit
  if (plan.badges.length > 0) run.badges = [...plan.badges];
  for (const f of plan.flags) sessionFlags.add(f);
  recomputeSignpostFlags();
  const target = plan.at ?? AT_TARGETS.hearthwick!; // ?state without ?at → land post-opening in town
  showOverworld(target.map, target.spawn, false);
}

// Debug menu (the convenient form). Built from the same AT_TARGETS / PRESETS tables
// as the URL form, so the two can never drift. Toggled by the backtick key (handled
// in the input dispatcher), dev-only. Map jumps warp (showOverworld REPLACES the
// menu); preset/party items seed state then close the menu.
let devMenuOpen = false;
function closeDevMenu(): void {
  if (!devMenuOpen) return;
  devMenuOpen = false;
  scenes.pop();
}
function ensureDevParty(): void {
  if (run.party.length > 0) return;
  run.party = [createSide(pickStarter())];
  run.partyBond = [BOND_START_STARTER];
  run.partyOrigin = ['starter'];
}
function openDevMenu(): void {
  const items: DevMenuItem[] = [];
  for (const [alias, t] of Object.entries(AT_TARGETS)) {
    items.push({
      label: `go: ${alias}`,
      run: () => {
        devSession = true;
        devMenuOpen = false; // showOverworld replaces the menu scene below
        ensureDevParty();
        recomputeSignpostFlags();
        showOverworld(t.map, t.spawn, false);
      },
    });
  }
  for (const [name, eff] of Object.entries(PRESETS)) {
    items.push({
      label: `state: ${name}`,
      run: () => {
        devSession = true;
        if (eff.badges.length > 0) run.badges = [...eff.badges];
        for (const f of eff.flags) sessionFlags.add(f);
        recomputeSignpostFlags();
        closeDevMenu();
      },
    });
  }
  items.push({
    label: 'party: CH1 trio',
    run: () => {
      devSession = true;
      applyDevParty([{ name: 'KINDRAKE', level: null }, { name: 'GRUBLEAF', level: null }, { name: 'SILTSKIP', level: null }]);
      closeDevMenu();
    },
  });
  devMenuOpen = true;
  scenes.push(createDevMenuScene(items, closeDevMenu));
}
function toggleDevMenu(): void {
  if (devMenuOpen) closeDevMenu();
  else openDevMenu();
}

// Dev-nav gate (dev-only). buildDevPlan returns inert when !DEV_BUILD or when no
// ?at/?state param is present, so a production build ignores ALL URL params and a
// dev build without dev-nav params falls through to the legacy ?skip chain / title.
const devPlan = buildDevPlan({ dev: DEV_BUILD, search: url });
if (!DEV_BUILD) {
  // Production: URL params are inert — always boot to the title.
  showTitle();
} else if (devPlan.active) {
  // Composable dev navigation: ?at=<map> & ?state=<presets> & ?party=<mon:lvl,…>
  applyDevPlan(devPlan);
} else if (skip === 'starter') {
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
  bagAdd(run.bag, 'BALL', 5); // dev hook — starting balls so catching is testable early (was the cold-start grant)
  showWildBattle();
} else if (skip === 'test-battle') {
  // Canonical Phase 0 hook: cold-start CH1 starter + a wild FLITPECK
  // encounter. Lets Mathias playtest combat in isolation in one click.
  applyPartyFromUrl();
  recomputeSignpostFlags();
  showTestBattle();
} else if (skip === 'pct-tiles') {
  // Pipeline test (NOT map authoring): render a few Pocket Creature Tamer
  // sample tiles at 320×180 so the pack's look + flow can be eye-checked.
  devSession = true;
  scenes.replace(createPctTileTestScene({ onExit: showTitle }));
} else if (skip === 'pct-prod') {
  // PRODUCTION-PATH pipeline verification (NOT map authoring): walk a tiny fixture
  // map (__PCT_VERIFY__) whose cells opt into the pct_* tiles via tileRef, rendered
  // through the REAL overworld renderer the live maps use (tileRef → registry →
  // indexed decode → draw). Confirms the pack tiles render as whole, correctly
  // positioned tiles in-engine — the confidence check before Tiled. Verified
  // headless by pctProdRender.test.ts; see docs/pct-pipeline-verify.md.
  devSession = true;
  showOverworld('__PCT_VERIFY__', 'default', false);
} else if (skip === 'tiled-test') {
  // Phase-8 Tiled IMPORT + WIRING demo: Mathias's painted test-map.tmj, imported
  // live and rendered through the REAL overworld path (multi-layer pct_* tiles), with
  // its npc_*/warp_* markers WIRED to real defs (docs/tiled-importer.md) — walk up to
  // npc_test for dialogue, step on warp_test to warp to Hearthwick. Import/wiring
  // warnings log to the console. Not shipping content.
  devSession = true;
  showOverworld('__TILED_TEST__', 'default', false);
} else if (skip === 'tiled-kitchen') {
  // Phase-8 KITCHEN-SINK: the full pipeline at once — collision, 3 NPCs (incl. a
  // trainer), 2 warps, 2 spawns, 4 encounter zones — all imported+wired live. Arrive
  // at spawn_player; walk into walls, talk to NPCs, fight the trainer, step the
  // encounter zones, use a warp. Proves all features coexist. Not shipping content.
  devSession = true;
  applyPartyFromUrl(); // a party so the trainer battle is fightable (?party=/?starter=)
  recomputeSignpostFlags();
  showOverworld('__KITCHEN_SINK__', 'player', false);
} else if (skip === 'route31-big') {
  // Route 31 — the Tiled-built map IS the live ROUTE31 now (Phase-4 capstone);
  // __ROUTE31_BIG__ is an alias that enters from the north gate (fromHearthwick) for
  // quick dev access. Full content: 6 trainers (incl. Jay's Calls-unlock), flavor +
  // lost-kid quest, signs, encounters, the guided catch, water, walk-behind.
  devSession = true;
  applyPartyFromUrl();
  recomputeSignpostFlags();
  showOverworld('__ROUTE31_BIG__', 'fromHearthwick', false);
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
      // Guided-catch onboarding (docs/guided-catch-redesign-note): the FIRST wild
      // encounter on Route 31 (after the lab lesson) is intercepted + wrapped as the
      // guided catch — contextual, where there's actually a mon to catch — then never
      // again. The practice mon is always FLITPECK (pushTutorialCatch), so it's
      // reliable regardless of which species the zone rolled.
      if (shouldFireGuidedCatch(map, (f) => flagStore.has(f))) {
        flagStore.set(GUIDED_CATCH_DONE_FLAG); // once; set BEFORE the catch so re-entry is normal
        autosaveNow();
        pushTutorialCatch();
        return;
      }
      pushWildEncounter(foeSpecies);
    },
    onTutorialCatch() {
      pushTutorialCatch();
    },
    onRivalBattle() {
      pushRivalGateFight();
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
  // CH1 ending — entering Route 32 (the road KAMON took) closes the chapter:
  // the quiet-resolve beat + the chapter card (replacing the old placard). Fires
  // ONCE (first entry) — the once-marker is persisted so re-entry is silent and
  // the dramatic close isn't cheapened by replay.
  if (shouldFireChapterEnd(map, flagStore.has(CH1_CLOSED_FLAG))) {
    flagStore.set(CH1_CLOSED_FLAG);
    autosaveNow(); // persist the once-marker before the beat plays
    pushChapterEndBeat();
  }
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
      ...bondSceneProps(foe, 'wild'), // Lane A — bond meter + post-win advance
      chooseFoeAction: (s, r) => wildFoeAI(s, r),
      intro: [`A wild ${foe.name}`, 'appeared!'],
      catchBreathUnlocked: callsUnlocked(),
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
      // Caught (Path 1) or joined (Path 2) → drop the battle, offer a nickname,
      // THEN add the wild mon (with the chosen name) + return to the overworld.
      onCaught: (finalState, origin) => {
        writebackParty(finalState);
        scenes.pop(); // back to the overworld; the prompt overlays it
        promptNickname(foe.name, (nickname) => {
          addCaughtMon(foe, origin, nickname); // 'read' (Path 1) | 'mercy' (Path 2)
          recomputeSignpostFlags();
          currentOverworldScene?.armPostBattleGrace();
          autosaveNow();
        });
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
        const bondCrossings = awardBondForFight(foe, 'wild', finalState, participants); // challenge-scaled (firewall: trivial→~0)
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
        showBondBeats(bondCrossings, () => maybeEvolve(() => {})); // bond beat, then evo gates
      },
    }),
  );
}

// Phase 7 — the scripted guided catch (the Catching 2.0 DO step). Launched
// once on Route 31's first tall-grass tile (the start-tutorial-catch verb,
// gated by catch_lesson_done). A normal Path-1 catch on a contained FLITPECK
// with the FORGIVING tutorial layer: max-legible info (every tell shown), a
// benign foe that can't punish, and `tutorial: true` so the scene blocks the
// flee + Wariness spiral and surfaces live read/throw prompts. The real catch
// MATH is unchanged (same callbacks as pushWildEncounter). The trigger's
// once-flag is already set when this fires, so normal encounters resume after.
function pushTutorialCatch(): void {
  const foe = CH1_DEX[TUTORIAL_CATCH_SPECIES] ?? SPECIES[TUTORIAL_CATCH_SPECIES];
  if (!foe) {
    console.warn(`Argent: tutorial-catch species not found: ${TUTORIAL_CATCH_SPECIES}`);
    return;
  }
  markSeen(run.dex, foe.name);
  const state = createBattleState(buildPlayerTeam(), createSide(foe), {
    typeChart: TYPECHART_CH1,
  });
  const popBack = () => {
    scenes.pop();
    currentOverworldScene?.armPostBattleGrace();
    autosaveNow();
  };
  scenes.push(
    createBattleScene({
      state,
      rng: run.rng,
      ...bondSceneProps(), // Lane A — static bond meter (tutorial catch; no bond award)
      // Benign, predictable practice foe (can't punish) — see tutorialCatch.ts.
      chooseFoeAction: (s, r) => tutorialFoeAI(s, r),
      // Maximally legible — open info-discipline, every tell shown.
      intentReliability: infoLevelToReliability('open'),
      intro: [...TUTORIAL_INTRO],
      catchBreathUnlocked: callsUnlocked(),
      canRun: true,
      canCatch: true,
      // The forgiving guard-rails (no flee, no Wariness, gentle correction,
      // live prompts) — isolated to this scripted encounter.
      tutorial: true,
      ballCount,
      medicineCount,
      // Real Path-1 math (unchanged) — the window opens reliably because the
      // benign foe telegraphs an opening every round, but the catch is a roll.
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
      onCaught: (finalState, origin) => {
        writebackParty(finalState);
        addCaughtMon(foe, origin);
        recomputeSignpostFlags();
        popBack();
      },
      // Declined / walked away — return to the grass, no catch, no black-out.
      onFlee: (finalState) => {
        writebackParty(finalState);
        popBack();
      },
      onFoeGone: (finalState) => {
        writebackParty(finalState);
        popBack();
      },
      // The player KO'd (or somehow lost to) the practice mon — either way
      // just return to the overworld. No black-out: it's a lesson, and the
      // benign foe can't realistically faint the player's healthy starter.
      onResolve: (_winner, finalState) => {
        writebackParty(finalState);
        recomputeSignpostFlags();
        popBack();
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
  // Combat Layer 4: a profiled trainer fights with its distinct policy; an
  // unprofiled one keeps the generic wildFoeAI (bit-identical).
  const profile = foeProfileForFlag(winFlag);
  const foePolicy = profile ? trainerPolicy(profile) : null;
  const intentInfo = profile ? profileIntentInfo(profile) : null;
  scenes.push(
    createBattleScene({
      state,
      rng: run.rng,
      ...bondSceneProps(foeTeam, 'trainer'), // Lane A — bond meter + post-win advance
      chooseFoeAction: (s, r) => (foePolicy ? foePolicy(s, 'foe', r) : wildFoeAI(s, r)),
      ...(intentInfo ? { intentReliability: intentInfo.intentReliability, foeFocusInfo: intentInfo.foeFocusInfo } : {}),
      intro: ['Gym trainer sent out', `${leadName}!`],
      catchBreathUnlocked: callsUnlocked(),
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
        const bondCrossings = awardBondForFight(foeTeam, 'trainer', finalState, participants); // trainers weighted above wilds
        // The designed Calls-unlock beat (JAY): a mon-defends-you win unlocks the Call
        // economy. Sets the EXISTING run.catchBreathUnlocked (what callsUnlocked() reads)
        // — not a parallel flag. After awardBondForFight, so a natural bond crossing can
        // still show its own "Calls unlocked" beat; this guarantees the unlock regardless.
        if (CALLS_UNLOCK_ON_WIN.has(winFlag)) run.catchBreathUnlocked = true;
        // Phase 5b — trainer payout (game-layer; engine untouched).
        // Wild wins never reach here (trainers-only, anti-grind).
        if (reward && reward > 0) run.money = awardMoney(run.money, reward);
        scenes.pop();
        // Trainer fights aren't grass-rolled, but the grace also
        // protects against the player stepping onto adjacent grass
        // immediately after a trainer victory and getting chained.
        currentOverworldScene?.armPostBattleGrace();
        autosaveNow();
        // bond beat → evo gates → FLOW 1: the trainer's follow-up line
        // auto-starts (no manual walk-up to re-talk).
        showBondBeats(bondCrossings, () =>
          maybeEvolve(() => currentOverworldScene?.runNpcFollowup(winFlag)),
        );
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
      ...bondSceneProps(team, 'boss'), // Lane A — bond meter + post-win advance
      chooseFoeAction: (s, r) => falknerBossAI(s, 'foe', r),
      // Phase 6.7-A — gym leader reads AMBIGUOUS (the ?skip=falkner path).
      intentReliability: 'ambiguous',
      // Layer 4 Stage 1 — Falkner's gust-Focus tell is VAGUE.
      foeFocusInfo: { discipline: 'veiled', releases: ['heavy'] },
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
          const bondCrossings = awardBondForFight(team, 'boss', finalState, participants); // boss clear = the big bonus
          // Demo-complete S1: award the ZEPHYR badge + a real payoff
          // beat, then return to the gym. awardBadge autosaves; the
          // pop after the fanfare lands the player back on the rooftop.
          awardBadge(ZEPHYR_BADGE);
          pushBadgeAward(() => {
            scenes.pop(); // drop the badge scene → back to the gym
            autosaveNow();
            // After the badge fanfare: the bond beat (a boss clear is the
            // biggest bond gain), then the evo gate check (ZEPHYR may also
            // complete a bonded mon's badge gate), then FALKNER's mentor line
            // — the game's thesis, delivered in-gym on the win. It promotes the
            // Academy as the next prompt (a Violet NPC appears on the flag).
            // One-shot: this win onResolve fires once; the flag persists it.
            showBondBeats(bondCrossings, () =>
              maybeEvolve(() => {
                flagStore.set(ACADEMY_PROMOTED_FLAG);
                autosaveNow(); // persist the promote-marker before the line plays
                pushMessage(falknerMentorLines());
              }),
            );
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
  // Per-scene logical resolution: swap the canvas backing size to match the scene
  // on top of the stack (battle → 640×360; the overworld + every menu → the base
  // 320×180). setLogicalSize is idempotent, so steady-state frames are a no-op and
  // only an actual scene change resizes. Applied BEFORE draw so the scene paints at
  // its declared size this frame.
  const size = scenes.top()?.logicalSize;
  canvasHost.setLogicalSize(size?.width ?? LOGICAL_W, size?.height ?? LOGICAL_H);
  scenes.draw(ctx);
  requestAnimationFrame(frame);
}
// Press Start 2P is banked (vendored, OFL) but NOT in use — UI_FONT is monospace
// (see ui.ts). Preload it fire-and-forget so re-enabling stays a ONE-LINE UI_FONT
// flip; non-blocking, so the loop starts immediately (no startup delay for a font
// we aren't rendering).
void loadUiFont();
requestAnimationFrame(frame);
