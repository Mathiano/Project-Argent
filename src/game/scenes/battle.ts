import {
  COMBAT,
  TIERS,
  activeMon,
  forcedAction,
  hasBenchSurvivor,
  isTeamWiped,
  lookupMove,
  mulberry32,
  resolveRound,
} from '../../engine';
import type {
  Action,
  BattleEvent,
  BattleState,
  RNG,
  Side,
  SideState,
  Species,
  Stance,
  Team,
} from '../../engine';
import { LOGICAL_H, LOGICAL_W } from '../canvas';
import { PALETTE } from '../palette';
import type { InputKey, Scene } from '../scene';
import { fleeTelegraphed } from '../catching';
import type { CatchWindow } from '../catching';
import { drawSpeciesInSlot } from '../sprites';
import {
  STANCE_NAME,
  drawBar,
  drawMomentum,
  drawPanel,
  drawStanceBadge,
  drawText,
  drawTextRight,
  drawWindedNotch,
  hpColor,
} from '../ui';

// Auto-cadence between non-hold log lines. Tuned so a human can read a
// short line at default speed without animation help; consequential
// lines (commits, dodge/opening/counter, eff ≠ 1 strikes, faints,
// breaks) then HOLD the playback until A/Start.
const STEP_SEC = 0.9;
const STANCES: readonly Stance[] = ['A', 'G', 'F'];
// Fixed seed for the intent-display feint RNG (Phase 6.7-A). Deliberately
// constant + independent of the engine RNG so degrading the FOE INTENT
// display never touches combat resolution (ladders stay bit-identical).
const INTENT_DISPLAY_SEED = 0x1a7e11;

const FOE_PANEL = { x: 2, y: 2, w: 170, h: 36 } as const;
const FOE_SLOT = { x: 222, y: 2 } as const;
const INTENT = { x: 0, y: 60, w: 320, h: 12 } as const;
const PL_SLOT = { x: 30, y: 74 } as const;
const PL_PANEL = { x: 144, y: 82, w: 172, h: 36 } as const;
const BOTTOM = { x: 2, y: 132, w: 316, h: 46 } as const;


export interface BattleSceneOpts {
  readonly state: BattleState;
  readonly rng: RNG;
  readonly chooseFoeAction: (state: BattleState, rng: RNG) => Action;
  readonly intro: readonly string[];
  readonly catchBreathUnlocked: boolean;
  readonly canRun: boolean;
  // Intent reliability ramp (Phase 6.7-A) — how truthfully the FOE INTENT
  // bar shows the foe's STANCE. Defaults HONEST (wild mons + every legacy
  // caller). Trainers/leaders are AMBIGUOUS; late bosses OPAQUE. This is
  // PRESENTATION only — the engine always commits the true stance.
  readonly intentReliability?: IntentReliability;
  // Final BattleState is handed back so the caller can write party
  // hp/st/momentum forward (the Phase 2 writeback). 1v1 callers can
  // ignore `finalState`; team callers extract state.player.members.
  readonly onResolve: (winner: 'player' | 'foe', finalState: BattleState) => void;
  // Fleeing (RUN, wild only) is distinct from a loss — it must NOT
  // black out. When wired, RUN calls this instead of onResolve('foe');
  // the caller returns the player to the same overworld tile, no heal.
  readonly onFlee?: (finalState: BattleState) => void;

  // ---- Phase 6a — Catching 2.0 (wild encounters only) -------------------
  // When true, the battle offers catching (the BALL menu row + the
  // Path-2 spare-offer on a foe faint). The catch MATH lives in the
  // callbacks below (game-side); the scene only tracks windows/Wariness
  // and plays the beats.
  readonly canCatch?: boolean;
  readonly ballCount?: () => number;
  readonly medicineCount?: () => number;
  // Path 1 — throw a ball. The scene passes the window it detected + the
  // foe HP fraction; the caller consumes a ball, rolls the catch, and
  // returns whether it caught.
  readonly onThrowBall?: (window: import('../catching').CatchWindow, foeHpFrac: number) => { readonly caught: boolean };
  // Caught (Path 1) — the caller adds the wild mon to the party/box.
  readonly onCaught?: (finalState: BattleState) => void;
  // Path 2 — spare a FAINTED wild mon with medicine. The caller consumes
  // medicine, rolls the willing-join, and returns whether it joined (+ a
  // refusal hint when it didn't).
  readonly onWillingJoin?: () => { readonly joined: boolean; readonly hint: string };
  // The wild mon escaped (Wariness flee, or a spare declined/refused with
  // the foe gone). Returns the player to the overworld, no catch, no
  // black-out (same shape as onFlee).
  readonly onFoeGone?: (finalState: BattleState) => void;
}

// Display carries everything the panel needs about the CURRENTLY-SHOWN
// mon (its species, maxHp, and live hp/st/etc). It LAGS the engine
// across a switch — state.player.active updates synchronously at
// commit, but display.player only catches up when the switchIn event
// applies. Routing the panel through display (not activeMon(state))
// keeps name + bar matched: the HP bar's numerator AND denominator
// always come from the same mon, so the bar can't overflow or appear
// to "regain" on switch-in.
interface DisplaySide {
  hp: number;
  maxHp: number;
  st: number;
  momentum: number;
  exhausted: boolean;
  staggered: boolean;
  species: Species;
}

interface Display {
  player: DisplaySide;
  foe: DisplaySide;
}

function snapshot(side: SideState): DisplaySide {
  return {
    hp: side.hp,
    maxHp: side.maxHp,
    st: side.st,
    momentum: side.momentum,
    exhausted: side.exhausted,
    staggered: side.staggered,
    species: side.species,
  };
}

function opposite(side: Side): Side {
  return side === 'player' ? 'foe' : 'player';
}

function computeInit(side: SideState, moveName: string | null, stance: Stance): number {
  if (moveName === null) return -1;
  const tier = lookupMove(moveName).tier;
  const weight = TIERS[tier].weight;
  const base = side.species.spd / weight;
  const stag = side.staggered ? base * COMBAT.staggerInitMult : base;
  void stance; // stance does not affect init; argument kept for completeness
  return stag;
}

function orderHint(
  pl: SideState,
  foe: SideState,
  plMove: string | null,
  plStance: Stance,
  foeMove: string | null,
  foeStance: Stance,
): 'YOU > FOE' | 'FOE > YOU' | 'TIE' {
  if (plMove !== null && foeMove !== null) {
    if (plStance === 'F' && foeStance === 'G') return 'YOU > FOE';
    if (foeStance === 'F' && plStance === 'G') return 'FOE > YOU';
  }
  const pi = computeInit(pl, plMove, plStance);
  const fi = computeInit(foe, foeMove, foeStance);
  if (pi < 0 && fi < 0) return 'TIE';
  if (pi < 0) return 'FOE > YOU';
  if (fi < 0) return 'YOU > FOE';
  if (pi > fi) return 'YOU > FOE';
  if (fi > pi) return 'FOE > YOU';
  return 'TIE';
}

function actionStance(action: Action): Stance {
  return action.kind === 'move' ? action.stance : 'G';
}

function actionMove(action: Action): string | null {
  return action.kind === 'move' ? action.move : null;
}

// ---- Intent reliability ramp (Phase 6.7-A; honest-partial model 6.7-A') ------
// The foe ALWAYS commits a real stance (foeAction → resolveRound, untouched).
// Intent is shown in PLAIN LANGUAGE and is always HONEST — reliability only
// controls how PRECISE it is: honest = the exact stance; ambiguous = an honest
// hint that narrows the guess to two stances (always one of which is the true
// one — never a lie); opaque = nothing at all (a pure cold read). The narrow
// pick is rng-injected so it's testable and never touches the engine stream.
export type IntentReliability = 'honest' | 'ambiguous' | 'opaque';

export interface ShownIntent {
  // The plain-language intent line to show after "FOE INTENT:", or null for
  // OPAQUE (the renderer shows a blank dash — no read).
  readonly line: string | null;
}

// Present-tense stance phrasing for the live intent bar.
function stanceIntentVerb(stance: Stance): string {
  return stance === 'A' ? 'attacks aggressively' : stance === 'G' ? 'braces' : 'strikes with agility';
}

// Confirmation for the resolution log (the teaching loop — the player learns
// whether their read was right). Names BOTH the stance (the read outcome) AND
// the move (what damage/effect landed), so neither piece of feedback is lost.
function stanceConfirmLine(name: string, stance: Stance, move: string): string {
  if (stance === 'A') return `${name} attacks aggressively with ${move}!`;
  if (stance === 'G') return `${name} braces with ${move}!`;
  return `${name} strikes with agility using ${move}!`;
}

// The AMBIGUOUS hints. Each is HONEST: its `pair` of possible stances always
// CONTAINS the foe's true stance, so the hint halves the guess (a real 50/50)
// without ever deceiving the player.
const NARROW_HINTS: readonly { readonly text: string; readonly pair: readonly Stance[] }[] = [
  { text: 'intends to attack', pair: ['A', 'F'] }, // rules out Guard
  { text: 'looks focused', pair: ['G', 'F'] }, // rules out Aggressive
  { text: 'is hard to read', pair: ['A', 'G'] }, // rules out Fluid
];

// Honest, full-clarity plain-language line for any foe action.
//
// SEAM (forward design, do not build): an "intent" is "an action being
// telegraphed" — STANCE is just the first kind. This dispatches on action.kind
// already, so a future ENEMY CALL ("the leader reaches for something…",
// narrowed/hidden by the same reliability tier) flows through here as another
// case + its own narrow-hint set — no rewrite of degradeIntent or the renderer.
// See docs/intent-tells-design-note.md ("Call-intent" seam).
function foeActionLine(action: Action, name: string): { stance: Stance | null; line: string } {
  if (action.kind === 'rest') return { stance: null, line: `${name} is resting` };
  if (action.kind === 'catchBreath') return { stance: null, line: `${name} is recovering` };
  if (action.kind === 'switch') return { stance: null, line: `${name} is switching` };
  if (action.kind === 'throwBall') return { stance: null, line: `${name} readies a ball` };
  return { stance: action.stance, line: `${name} ${stanceIntentVerb(action.stance)}` };
}

export function degradeIntent(
  action: Action,
  name: string,
  reliability: IntentReliability,
  rng: RNG,
): ShownIntent {
  // OPAQUE (Elite Four / Champion) — no indicator at all. Pure cold read.
  if (reliability === 'opaque') return { line: null };
  const honest = foeActionLine(action, name);
  // HONEST tier, or a stance-less action (nothing to narrow): full clarity.
  if (reliability === 'honest' || honest.stance === null) return { line: honest.line };
  // AMBIGUOUS — an honest narrow-to-2 hint. Pick uniformly among the hints
  // whose pair contains the true stance so EVERY hint stays a genuine 50/50
  // (a fixed per-stance mapping would collapse one hint into a perfect tell).
  const valid = NARROW_HINTS.filter((h) => h.pair.includes(honest.stance!));
  const hint = valid[Math.floor(rng.next() * valid.length)] ?? valid[0]!;
  return { line: `${name} ${hint.text}` };
}

// Combat legibility (S1) — the explanatory callout for a resolved
// triangle interaction. Names the RULE, not just the event, so the
// player learns the triangle by playing. Returns null when the event
// isn't a triangle teaching moment.
export function stanceCallout(args: {
  readonly kind: 'counter' | 'opening' | 'dodge' | 'strike';
  readonly attackerStance?: Stance | undefined;
  readonly defenderStance?: Stance | undefined;
}): string | null {
  if (args.kind === 'counter') return 'COUNTER! GUARD turns AGGRESSION back';
  if (args.kind === 'opening') return 'OPENING! FLUID slips past GUARD';
  if (args.kind === 'dodge') return 'DODGE! FLUID evaded — it was faster';
  // A landed strike where the attacker went Aggressive into a Fluid
  // defender means the dodge check FAILED — the attacker was faster.
  if (args.kind === 'strike' && args.attackerStance === 'A' && args.defenderStance === 'F') {
    return "Couldn't evade — too slow!";
  }
  return null;
}

// Combat legibility (S2) — the player-vs-foe SPEED relationship. Speed
// decides dodges AND turn order; it's the hidden variable that makes
// combat feel random. Surfaced as a persistent readout.
export function speedLabel(
  playerSpd: number,
  foeSpd: number,
): 'YOU FASTER' | 'YOU SLOWER' | 'SPEED EVEN' {
  if (playerSpd > foeSpd) return 'YOU FASTER';
  if (playerSpd < foeSpd) return 'YOU SLOWER';
  return 'SPEED EVEN';
}

// The Call set the submenu reads (Call-menu sprint). DATA-driven so
// adding a Call later is data, not a rewrite. Only Catch Breath is
// BUILT this build (commits {kind:'catchBreath'}); Recover / Dodge / the
// rest are design-only per combat-2-0-spec.md and render greyed +
// cursor-skipped (locked). `{MON}` in the shout is the active mon name.
export interface CallDef {
  readonly id: string;
  readonly name: string;
  readonly starCost: number;
  readonly built: boolean;
  readonly shout: string;
}
export const CALL_SET: readonly CallDef[] = [
  { id: 'catch-breath', name: 'Catch Breath', starCost: 1, built: true, shout: '{MON}, catch your breath!' },
  { id: 'recover', name: 'Recover', starCost: 1, built: false, shout: '{MON}, shake it off!' },
  { id: 'dodge', name: 'Dodge', starCost: 1, built: false, shout: '{MON}, dodge it!' },
  { id: 'hang-on', name: 'Hang On', starCost: 1, built: false, shout: '{MON}, hang on!' },
  { id: 'full-power', name: 'Full Power', starCost: 2, built: false, shout: 'Now — {MON}, full power!' },
  { id: 'get-back', name: 'Get Back', starCost: 1, built: false, shout: '{MON}, get back!' },
];

export function callShout(call: CallDef, monName: string): string {
  return call.shout.replace('{MON}', monName);
}

export function createBattleScene(opts: BattleSceneOpts): Scene {
  let state: BattleState = opts.state;
  let foeAction: Action = { kind: 'rest' };
  // Intent reliability ramp (Phase 6.7-A). `shownIntent` is the (possibly
  // degraded) display recomputed once per turn from the TRUE foeAction; the
  // renderer reads it, never foeAction directly. The feint roll runs on a
  // scene-local RNG seeded independently of opts.rng, so degrading the
  // display cannot perturb the engine stream → ladders stay bit-identical.
  const reliability: IntentReliability = opts.intentReliability ?? 'honest';
  const intentRng: RNG = mulberry32(INTENT_DISPLAY_SEED);
  let shownIntent: ShownIntent = degradeIntent(
    foeAction,
    activeMon(state.foe).species.name,
    reliability,
    intentRng,
  );
  let display: Display = {
    player: snapshot(activeMon(state.player)),
    foe: snapshot(activeMon(state.foe)),
  };
  const breakThreshold = state.bossCard?.breakBar ?? 0;
  let displayBreakProgress = state.breakProgress ?? 0;
  let breakFlashT = 0;
  // BUG 3 — boss legibility. Track the displayed phase + a short flash
  // when the break meter ticks up, so the metronome boss READS like one.
  let displayPhase = state.phase ?? 1;
  let breakPipFlashT = 0;
  // Combat legibility (S1) — the current round's committed stances (so a
  // landed strike can tell an A-vs-F "couldn't evade" from a normal hit)
  // + the explanatory callout banner shown during resolve.
  let roundStance: { player: Stance | null; foe: Stance | null } = { player: null, foe: null };
  let calloutLine: string | null = null;

  let phase: 'text' | 'menu' | 'move' | 'call' | 'spare' | 'party' | 'resolve' | 'end' = 'text';
  // Phase 6a catch state (wild only). pendingReadWindow = a player
  // read-win opened a 1-round window last round; wariness rises on
  // out-of-window throws → flee telegraph; spareCursor drives the
  // Path-2 spare offer.
  let wariness = 0;
  let pendingReadWindow = false;
  let fleeWarned = false;
  let spareCursor: 0 | 1 = 0;
  let textQueue: string[] = [...opts.intro];
  let textNext: (() => void) | null = beginTurn;
  // Party-picker mode. 'voluntary' = opened from FIGHT menu's PKMN row
  // (switch is a turn action; B cancels back to menu). 'forced' = opened
  // by a faint→forcedSwitch event mid-resolve (player MUST pick the
  // next mon — choosing the next survivor is a tactical READ per the
  // Phase 1 ruling, not just a confirmation). On a forced switch we
  // resume the resolve drain after the player confirms.
  let partyMode: 'voluntary' | 'forced' | null = null;
  let partyCursor = 0;
  let resumeResolveAfterParty = false;
  // Dismissable dialogs (e.g. "Calls unlock", "Too winded") let B back
  // out to the prior phase. Forced/sequential dialogs (intro, end-text,
  // "Got away safely!") MUST be read — B is a no-op on them. Per the
  // working agreement: B dismisses dismissable dialogs only.
  let textDismissable = false;
  let log: string[] = [];
  let pendingEvents: BattleEvent[] = [];
  let eventTimer = 0;
  // resolveHeld: the last applied event was "consequential" (a commit,
  // a dodge/opening/counter/clash, a typed-effective strike, a faint,
  // a break). Auto-advance is paused until A/Start releases it.
  // A press while NOT held still triggers skipResolve (impatient flush).
  let resolveHeld = false;
  let endingWinner: 'player' | 'foe' | null = null;

  let menuCursor = 0;
  let moveCursor = 0;
  // Move list scroll window — evolved mons carry up to 8 moves, more than
  // fit the panel; show MOVES_VISIBLE at a time and scroll to keep the
  // cursor in view (with ▲▼ indicators).
  const MOVES_VISIBLE = 5;
  let moveScroll = 0;
  let stanceIdx = 0;
  let callCursor = 0;
  let tick = 0;

  function clampMoveScroll(): void {
    const n = activeMon(state.player).species.moves.length;
    if (moveCursor < moveScroll) moveScroll = moveCursor;
    else if (moveCursor >= moveScroll + MOVES_VISIBLE) moveScroll = moveCursor - MOVES_VISIBLE + 1;
    moveScroll = Math.max(0, Math.min(moveScroll, Math.max(0, n - MOVES_VISIBLE)));
  }

  let animSide: Side | null = null;
  let animKind: 'strike' | 'dodge' | 'opening' | 'counter' | 'clash' | null = null;
  let animT = 0;

  function pushLog(line: string): void {
    log.push(line);
    if (log.length > 3) log.shift();
  }

  function setText(
    lines: readonly string[],
    then: () => void,
    options: { dismissable?: boolean } = {},
  ): void {
    phase = 'text';
    textQueue = [...lines];
    textNext = then;
    textDismissable = options.dismissable ?? false;
  }

  function foeGone(): void {
    const cb = opts.onFoeGone ?? opts.onFlee;
    if (cb) cb(state);
    else opts.onResolve('foe', state);
  }

  function beginTurn(): void {
    // Phase 6a — Wariness flee (wild catch only). One telegraph turn,
    // then the mon escapes — never instant-poof.
    if (opts.canCatch) {
      if (fleeWarned) {
        setText([`The wild ${activeMon(state.foe).species.name} fled!`], foeGone);
        return;
      }
      if (fleeTelegraphed(wariness)) {
        fleeWarned = true;
        setText([`The ${activeMon(state.foe).species.name} is looking for an escape!`], beginTurnInner);
        return;
      }
    }
    beginTurnInner();
  }

  function beginTurnInner(): void {
    // Commit the foe's TRUE action first, then snapshot the (possibly
    // degraded) display for this turn. forcedAction draws no RNG, so moving
    // the choose ahead of the forced check leaves the engine stream intact.
    foeAction = opts.chooseFoeAction(state, opts.rng);
    shownIntent = degradeIntent(
      foeAction,
      activeMon(state.foe).species.name,
      reliability,
      intentRng,
    );
    const forced = forcedAction(activeMon(state.player));
    if (forced) {
      commit(forced);
      return;
    }
    phase = 'menu';
    menuCursor = 0;
  }

  function commit(action: Action): void {
    log = [];
    roundStance = { player: null, foe: null };
    calloutLine = null;
    // A read window lasts exactly one round — consumed/lost the moment
    // the player commits their next action.
    pendingReadWindow = false;
    const result = resolveRound(state, action, foeAction, opts.rng);
    state = result.state;
    pendingEvents = [...result.events];
    eventTimer = 0;
    resolveHeld = false;
    // Display state is reseated by the first roundStart event's snapshot.
    phase = 'resolve';
  }

  // A line is "consequential" when it carries information the player
  // needs to actually read before the round resolves: which move was
  // committed, type-effective hits, the read-vs-read events (dodge,
  // opening, counter, clash), and faints/breaks. tickResolve pauses
  // after applying one of these until the player presses A/Start.
  function isConsequential(ev: BattleEvent): boolean {
    if (ev.kind === 'commit' && ev.action.kind === 'move') return true;
    // EVERY strike holds — gives the player a visible beat between the
    // faster and slower mon's actions. Initiative is computed by the
    // engine; the renderer surfaces "who acted now" by pausing between
    // each strike.
    if (ev.kind === 'strike') return true;
    if (ev.kind === 'dodge') return true;
    if (ev.kind === 'opening') return true;
    if (ev.kind === 'counter') return true;
    if (ev.kind === 'clash') return true;
    if (ev.kind === 'faint') return true;
    if (ev.kind === 'break') return true;
    // S4 — hold on Catch Breath so the player reads the restore + sees
    // the ST bar at its new value (it used to flash past).
    if (ev.kind === 'catchBreath') return true;
    return false;
  }

  function applyEvent(ev: BattleEvent): void {
    if (ev.kind === 'roundStart') {
      // roundStart's snapshot is of the PRE-resolve active mon — before
      // any in-round switch fires. Preserve display.species (which is
      // also the pre-resolve mon) so the panel name + hp/maxHp stay
      // consistent. switchIn / forcedSwitch fire later in the event
      // stream and reseat species too.
      display.player = {
        ...display.player,
        hp: ev.player.hp,
        maxHp: ev.player.maxHp,
        st: ev.player.st,
        momentum: ev.player.momentum,
        exhausted: ev.player.exhausted,
        staggered: ev.player.staggered,
      };
      display.foe = {
        ...display.foe,
        hp: ev.foe.hp,
        maxHp: ev.foe.maxHp,
        st: ev.foe.st,
        momentum: ev.foe.momentum,
        exhausted: ev.foe.exhausted,
        staggered: ev.foe.staggered,
      };
      pushLog(`— round ${ev.round} —`);
      return;
    }
    if (ev.kind === 'initiative') {
      // Reserved for the action-timeline strip (Combat 2.0 spec).
      // No log/animation here yet — order is implicit in the strike sequence.
      return;
    }
    if (ev.kind === 'stamina') {
      display[ev.side].st = ev.after;
      return;
    }
    if (ev.kind === 'commit') {
      // Remember each side's committed stance so a landed strike can be
      // labelled (A-vs-F that DIDN'T dodge = "too slow").
      if (ev.action.kind === 'move') roundStance[ev.side] = ev.action.stance;
      if (ev.action.kind === 'rest') {
        const who = ev.side === 'player' ? activeMon(state.player).species.name : activeMon(state.foe).species.name;
        const note = ev.action.reason === 'exhaustion' ? 'is spent — resting.' : 'has no moves — resting.';
        pushLog(`${who} ${note}`);
      } else if (ev.action.kind === 'catchBreath') {
        const who = ev.side === 'player' ? activeMon(state.player).species.name : activeMon(state.foe).species.name;
        pushLog(`${who}: catch your breath!`);
      } else if (ev.action.kind === 'throwBall') {
        pushLog('You hurled a ball!');
      } else if (ev.side === 'foe' && ev.action.kind === 'move') {
        // Resolution confirmation (the teaching loop, all tiers): name the
        // foe's committed STANCE *and* MOVE in plain language so the player
        // learns whether their read was right AND what landed — even when
        // intent was ambiguous/opaque.
        pushLog(stanceConfirmLine(display.foe.species.name, ev.action.stance, ev.action.move));
      } else {
        const who = ev.side === 'player' ? activeMon(state.player).species.name : `Foe ${activeMon(state.foe).species.name}`;
        pushLog(`${who} used ${ev.action.move}.`);
      }
      return;
    }
    if (ev.kind === 'catchBreath') {
      // S4 — surface the effect: the ST bar visibly jumps (display.st
      // updates here) AND a held callout names the restore amount, so
      // the player can SEE what Catch Breath did.
      display[ev.side].st = Math.min(100, display[ev.side].st + ev.restored);
      display[ev.side].momentum = Math.max(0, display[ev.side].momentum - 1);
      const who =
        ev.side === 'player' ? activeMon(state.player).species.name : `Foe ${activeMon(state.foe).species.name}`;
      calloutLine = `${who} catches its breath — stamina +${ev.restored}!`;
      pushLog(`${who} catches its breath — +${ev.restored} ST!`);
      return;
    }
    if (ev.kind === 'clash') {
      animKind = 'clash';
      animSide = ev.winner;
      animT = 0.3;
      if (ev.winner === 'player') pendingReadWindow = true; // read window
      pushLog(`CLASH! ${ev.winner === 'player' ? activeMon(state.player).species.name : 'Foe'} broke through.`);
      return;
    }
    if (ev.kind === 'strike') {
      const def = opposite(ev.side);
      display[def].hp = Math.max(0, display[def].hp - ev.damage);
      animSide = ev.side;
      animKind = 'strike';
      animT = 0.25;
      if (ev.effectiveness > 1) pushLog('It hit hard!');
      else if (ev.effectiveness < 1) pushLog('Not very effective…');
      // S1 — an Aggressive strike that LANDED on a Fluid defender means
      // the dodge check failed: the attacker was faster. Name the rule.
      const c = stanceCallout({
        kind: 'strike',
        attackerStance: roundStance[ev.side] ?? undefined,
        defenderStance: roundStance[def] ?? undefined,
      });
      if (c) {
        calloutLine = c;
        pushLog('Too slow to evade!');
      }
      return;
    }
    if (ev.kind === 'dodge') {
      // S1 — FLUID dodged an Aggressive strike because it was faster.
      const who = ev.side === 'player' ? display.player.species.name : 'Foe ' + display.foe.species.name;
      if (ev.side === 'player') pendingReadWindow = true; // read window
      calloutLine = stanceCallout({ kind: 'dodge' });
      pushLog(`DODGE! ${who}'s FLUID was faster.`);
      animSide = ev.side;
      animKind = 'dodge';
      animT = 0.25;
      return;
    }
    if (ev.kind === 'opening') {
      // S1 — FLUID slipped past a GUARD stance (acts first, no counter).
      const def = opposite(ev.side);
      display[def].hp = Math.max(0, display[def].hp - ev.damage);
      if (ev.side === 'player') pendingReadWindow = true; // read window (the cleanest catch opener)
      calloutLine = stanceCallout({ kind: 'opening' });
      pushLog('OPENING! FLUID slips past GUARD.');
      animSide = ev.side;
      animKind = 'opening';
      animT = 0.25;
      return;
    }
    if (ev.kind === 'counter') {
      // S1 — GUARD turned an Aggressive strike back (reflect + stagger).
      const att = opposite(ev.side);
      display[att].hp = Math.max(0, display[att].hp - ev.damage);
      const who = ev.side === 'player' ? display.player.species.name : 'Foe';
      if (ev.side === 'player') pendingReadWindow = true; // read window
      calloutLine = stanceCallout({ kind: 'counter' });
      pushLog(`COUNTER! ${who}'s GUARD turns it back.`);
      animSide = ev.side;
      animKind = 'counter';
      animT = 0.25;
      return;
    }
    if (ev.kind === 'staggered') {
      display[ev.side].staggered = true;
      return;
    }
    if (ev.kind === 'momentum') {
      display[ev.side].momentum = ev.total;
      pushLog(`★ Momentum +1 (${ev.total}).`);
      return;
    }
    if (ev.kind === 'winded') {
      pushLog(`${ev.side === 'player' ? activeMon(state.player).species.name : 'Foe'} is winded — heavy moves locked.`);
      return;
    }
    if (ev.kind === 'exhausted') {
      display[ev.side].exhausted = true;
      pushLog(`${ev.side === 'player' ? activeMon(state.player).species.name : 'Foe'} is exhausted!`);
      return;
    }
    if (ev.kind === 'breakProgress') {
      displayBreakProgress = ev.progress;
      breakPipFlashT = 0.6; // BUG 3 — flash the meter as it fills
      pushLog(`★ BREAK ${ev.progress}/${ev.threshold} — read landed!`);
      return;
    }
    if (ev.kind === 'break') {
      displayBreakProgress = 0;
      displayPhase = ev.newPhase;
      breakFlashT = 0.6;
      pushLog(`BREAK! ${display.foe.species.name} reels — PHASE ${ev.newPhase}!`);
      animKind = 'clash';
      animT = 0.5;
      return;
    }
    if (ev.kind === 'ko') {
      // Hide the active sprite (hp=0) but do not end the battle here —
      // 'faint' handles the narrative, and team-wipe is detected in
      // finishResolve via isTeamWiped.
      display[ev.side].hp = 0;
      return;
    }
    if (ev.kind === 'switchOut') {
      const who = ev.side === 'player' ? ev.species : `Foe ${ev.species}`;
      pushLog(`${who} withdrew.`);
      return;
    }
    if (ev.kind === 'switchIn') {
      const who = ev.side === 'player' ? ev.species : `Foe ${ev.species}`;
      pushLog(`${who} took the field!`);
      // The active mon swapped on the state side. Reseat display so HP/ST
      // bars reflect the new active's values immediately.
      const fresh = activeMon(state[ev.side]);
      display[ev.side] = snapshot(fresh);
      return;
    }
    if (ev.kind === 'faint') {
      const who = ev.side === 'player' ? ev.species : `Foe ${ev.species}`;
      pushLog(`${who} fainted!`);
      return;
    }
    if (ev.kind === 'forcedSwitch') {
      const who = ev.side === 'player' ? ev.species : `Foe sent out ${ev.species}`;
      pushLog(`${who}!`);
      const fresh = activeMon(state[ev.side]);
      display[ev.side] = snapshot(fresh);
      // PLAYER side: open the party picker so the player CHOOSES the
      // next mon. The engine's auto-pick (ev.toIndex) becomes the
      // default highlight; the player can confirm or override. This is
      // the Phase 1 ruling — picking the next mon is a tactical read,
      // not a confirmation. Resume the resolve drain after the choice.
      if (ev.side === 'player' && state.player.members.length > 1) {
        partyMode = 'forced';
        partyCursor = ev.toIndex;
        phase = 'party';
        resumeResolveAfterParty = true;
      }
      return;
    }
  }

  function finishResolve(): void {
    // Snap display to engine final state for stamina/momentum settle that the
    // event stream did not cover (stamina costs, regen).
    display = {
      player: snapshot(activeMon(state.player)),
      foe: snapshot(activeMon(state.foe)),
    };
    // Team-wipe is the only end-of-battle condition now. Individual KOs
    // are handled by the engine via forced-switch unless the team is out.
    if (isTeamWiped(state.player)) endingWinner = 'foe';
    else if (isTeamWiped(state.foe)) {
      // Phase 6a Path 2 — a fainted wild mon can be SPARED with medicine
      // (the willing-join). Offer it before declaring victory; otherwise
      // it's a normal win.
      if (opts.canCatch && (opts.medicineCount?.() ?? 0) > 0) {
        phase = 'spare';
        spareCursor = 0;
        return;
      }
      endingWinner = 'player';
    }
    if (endingWinner !== null) {
      phase = 'end';
      const msg =
        endingWinner === 'player'
          ? ['You won the battle!', 'Press A to continue.']
          : ['Your team fell.', 'Press A to continue.'];
      setText(msg, () => {
        opts.onResolve(endingWinner!, state);
      });
      return;
    }
    beginTurn();
  }

  function tickResolve(dt: number): void {
    if (animT > 0) animT = Math.max(0, animT - dt);
    // While held on a consequential event, auto-advance pauses entirely
    // — eventTimer doesn't tick, no new events pop. handleResolveInput
    // releases the hold and play continues.
    if (resolveHeld) return;
    eventTimer -= dt;
    while (eventTimer <= 0 && pendingEvents.length > 0) {
      const ev = pendingEvents.shift()!;
      applyEvent(ev);
      // applyEvent may flip phase (forcedSwitch on player → 'party').
      // Stop draining so the renderer can show the party picker.
      if (phase !== 'resolve') return;
      if (isConsequential(ev)) {
        resolveHeld = true;
        eventTimer = 0;
        return;
      }
      eventTimer += STEP_SEC;
    }
    if (pendingEvents.length === 0 && eventTimer <= 0) finishResolve();
  }

  function skipResolve(): void {
    while (pendingEvents.length > 0) {
      applyEvent(pendingEvents.shift()!);
      // applyEvent may flip phase (forcedSwitch on player → 'party').
      // Stop draining + don't call finishResolve — that would call
      // beginTurn and overwrite the party picker. Resumes when the
      // player confirms in handlePartyInput.
      if (phase !== 'resolve') {
        eventTimer = 0;
        resolveHeld = false;
        return;
      }
    }
    eventTimer = 0;
    resolveHeld = false;
    finishResolve();
  }

  // Menu rows in DISPLAY order. The `enabled` flag controls whether the
  // cursor can rest on this row — disabled rows render greyed and are
  // skipped during up/down navigation. Keeping the row visible (not
  // collapsing it) preserves a stable visual layout as state changes.
  type MenuKind = 'fight' | 'pkmn' | 'catch' | 'call' | 'run';
  function menuItems(): ReadonlyArray<{ readonly kind: MenuKind; readonly enabled: boolean }> {
    return [
      { kind: 'fight', enabled: true },
      // PKMN enabled only when the bench has a non-fainted non-active
      // mon (so voluntary switching is meaningful). Single-mon teams
      // see this row greyed; the cursor skips it.
      { kind: 'pkmn', enabled: hasBenchSurvivor(state.player) },
      // BALL (Phase 6a) — wild encounters only, when the player has
      // balls. Throws at the active foe (Path 1).
      { kind: 'catch', enabled: !!opts.canCatch && (opts.ballCount?.() ?? 0) > 0 },
      { kind: 'call', enabled: opts.catchBreathUnlocked },
      // RUN row stays enabled even when canRun is false — confirming it
      // surfaces the "No running from a rival!" dialog (intentional UX).
      { kind: 'run', enabled: true },
    ];
  }

  // Phase 6a — the catch window at the moment of a throw. Exhausted is a
  // standing window; a read-win opened a 1-round 'read' window last
  // round; otherwise none (out of window → auto-fail). (A guarding foe
  // that was never opened stays 'none' — you must expose it first.)
  function currentWindow(): CatchWindow {
    if (activeMon(state.foe).exhausted) return 'exhausted';
    if (pendingReadWindow) return 'read';
    return 'none';
  }

  function throwBall(): void {
    const foe = activeMon(state.foe);
    const window = currentWindow();
    const hpFrac = foe.hp / Math.max(1, foe.maxHp);
    const result = opts.onThrowBall ? opts.onThrowBall(window, hpFrac) : { caught: false };
    if (result.caught) {
      setText([`Gotcha! ${foe.species.name} was caught!`], () => opts.onCaught?.(state));
      return;
    }
    if (window === 'none') {
      // Out-of-window throw — auto-fail + Wariness. Then the foe acts.
      wariness += 1;
      setText([`The ${foe.species.name} wasn't exposed — missed!`], () => commit({ kind: 'throwBall' }));
    } else {
      setText([`Aww — the ${foe.species.name} broke free!`], () => commit({ kind: 'throwBall' }));
    }
  }

  function stepCursor(start: number, dir: 1 | -1): number {
    const items = menuItems();
    let i = start;
    for (let n = 0; n < items.length; n += 1) {
      i = (i + dir + items.length) % items.length;
      if (items[i]!.enabled) return i;
    }
    return start;
  }

  function confirmMenu(): void {
    const items = menuItems();
    const focus = items[menuCursor];
    if (!focus || !focus.enabled) return;
    if (focus.kind === 'fight') {
      phase = 'move';
      moveCursor = 0;
      moveScroll = 0;
      return;
    }
    if (focus.kind === 'pkmn') {
      // Voluntary switch — switching is a turn action. Open party
      // picker with the first selectable bench mon highlighted; A
      // confirms (commits {kind:'switch'}); B cancels back to menu.
      partyMode = 'voluntary';
      partyCursor = stepPartyCursor(state.player.active, 1);
      phase = 'party';
      return;
    }
    if (focus.kind === 'catch') {
      // Phase 6a — throw a ball at the wild foe (Path 1).
      throwBall();
      return;
    }
    if (focus.kind === 'call') {
      // Call-menu sprint — open the Call SUBMENU (mirror FIGHT → moves),
      // never instant-fire. Land the cursor on the first unlocked Call.
      callCursor = firstSelectableCall();
      phase = 'call';
      return;
    }
    // RUN
    if (opts.canRun) {
      // Forced — leaves the battle, no take-backs. Fleeing is NOT a
      // loss: a dedicated onFlee returns the player to the SAME tile,
      // no heal/black-out. Falls back to onResolve('foe') only if a
      // caller didn't wire onFlee (legacy/test paths).
      setText(['Got away safely!'], () => {
        if (opts.onFlee) opts.onFlee(state);
        else opts.onResolve('foe', state);
      });
    } else {
      setText(
        ['No running from', 'a rival!'],
        () => {
          phase = 'menu';
        },
        { dismissable: true },
      );
    }
  }

  function handleMenuInput(key: InputKey): void {
    if (key === 'up') menuCursor = stepCursor(menuCursor, -1);
    else if (key === 'down') menuCursor = stepCursor(menuCursor, 1);
    // START acts as a second confirm — no auto-jump to CALL (that
    // shortcut used to fire CALL even when the user thought they were
    // confirming the FIGHT row, which is the bug this guards against).
    else if (key === 'a' || key === 'start') confirmMenu();
  }

  // Party-picker — used for both voluntary switching (PKMN menu) and
  // forced switching (faint with bench survivor). In voluntary mode the
  // cursor skips the currently-active mon (you can't switch to yourself)
  // and B cancels back to menu. In forced mode the cursor lands on the
  // engine's auto-pick (firstSurvivor) by default but the player can
  // pick any survivor; B is a no-op (must choose someone).
  function isPartySelectable(idx: number): boolean {
    const team = state.player;
    const m = team.members[idx];
    if (!m) return false;
    if (m.hp <= 0) return false;
    if (partyMode === 'voluntary' && idx === team.active) return false;
    return true;
  }

  function stepPartyCursor(start: number, dir: 1 | -1): number {
    const n = state.player.members.length;
    let i = start;
    for (let k = 0; k < n; k += 1) {
      i = (i + dir + n) % n;
      if (isPartySelectable(i)) return i;
    }
    return start;
  }

  // Phase 6a Path 2 — the spare offer (a fainted wild foe + medicine).
  function endWithWin(): void {
    setText(['You won the battle!', 'Press A to continue.'], () => opts.onResolve('player', state));
  }
  function handleSpareInput(key: InputKey): void {
    if (key === 'up' || key === 'down') spareCursor = spareCursor === 0 ? 1 : 0;
    else if (key === 'b') endWithWin(); // decline = claim the normal win
    else if (key === 'a' || key === 'start') {
      if (spareCursor === 1) {
        endWithWin();
        return;
      }
      // YES — show mercy: spend medicine on the fallen foe, roll the join.
      const foeName = activeMon(state.foe).species.name;
      const r = opts.onWillingJoin ? opts.onWillingJoin() : { joined: false, hint: '' };
      if (r.joined) {
        setText([`You tend the fallen ${foeName} — it chose to join you!`], () => opts.onCaught?.(state));
      } else {
        setText([r.hint], endWithWin);
      }
    }
  }

  function handlePartyInput(key: InputKey): void {
    if (key === 'up') partyCursor = stepPartyCursor(partyCursor, -1);
    else if (key === 'down') partyCursor = stepPartyCursor(partyCursor, 1);
    else if (key === 'b') {
      // Voluntary switches can be cancelled. Forced switches require a
      // pick — B is a no-op (per the working agreement, B is no-op on
      // forced/sequential prompts the player must answer).
      if (partyMode === 'voluntary') {
        partyMode = null;
        phase = 'menu';
      }
    } else if (key === 'a' || key === 'start') {
      if (!isPartySelectable(partyCursor)) return;
      const mode = partyMode;
      partyMode = null;
      if (mode === 'voluntary') {
        // Switching is a turn action — commit it and the round resolves.
        commit({ kind: 'switch', toIndex: partyCursor });
        return;
      }
      if (mode === 'forced') {
        // Override the engine's auto-pick if the player chose otherwise.
        const team = state.player;
        if (partyCursor !== team.active) {
          const nextTeam: Team = { ...team, active: partyCursor };
          state = { ...state, player: nextTeam };
          display.player = snapshot(activeMon(nextTeam));
        }
        if (resumeResolveAfterParty) {
          resumeResolveAfterParty = false;
          phase = 'resolve';
        } else {
          // Out-of-round forced (rare path): fall back to beginTurn.
          beginTurn();
        }
      }
    }
  }

  function handleMoveInput(key: InputKey): void {
    const moves = activeMon(state.player).species.moves;
    if (key === 'up') {
      moveCursor = (moveCursor + moves.length - 1) % moves.length;
      clampMoveScroll();
    } else if (key === 'down') {
      moveCursor = (moveCursor + 1) % moves.length;
      clampMoveScroll();
    } else if (key === 'select') stanceIdx = (stanceIdx + 1) % 3;
    else if (key === 'b') phase = 'menu';
    else if (key === 'a' || key === 'start') {
      const moveName = moves[moveCursor]!;
      const move = lookupMove(moveName);
      if (activeMon(state.player).st <= COMBAT.winded && (move.tier === 'heavy' || move.tier === 'nuke')) {
        setText(
          ['Too winded for', 'heavy moves!'],
          () => {
            phase = 'move';
          },
          { dismissable: true },
        );
        return;
      }
      if (activeMon(state.player).st < TIERS[move.tier].cost) {
        setText(
          ['Not enough stamina!'],
          () => {
            phase = 'move';
          },
          { dismissable: true },
        );
        return;
      }
      commit({ kind: 'move', move: moveName, stance: STANCES[stanceIdx]! });
    }
  }

  // ---- Call submenu (Call-menu sprint) -------------------------------------
  // A Call is UNLOCKED (cursor can land) when it's built AND unlocked for
  // this run. Catch Breath is the only built Call; it unlocks via the run
  // flag. The others are design-only → locked → cursor-skipped + greyed.
  // NOTE (later pass): make locked Calls invisible-until-unlocked rather
  // than greyed — for now they're greyed so the player sees the set.
  function callUnlocked(call: CallDef): boolean {
    if (!call.built) return false;
    if (call.id === 'catch-breath') return opts.catchBreathUnlocked;
    return false;
  }
  function callAffordable(call: CallDef): boolean {
    return activeMon(state.player).momentum >= call.starCost;
  }
  function firstSelectableCall(): number {
    for (let i = 0; i < CALL_SET.length; i += 1) {
      if (callUnlocked(CALL_SET[i]!)) return i;
    }
    return 0;
  }
  function stepCallCursor(start: number, dir: 1 | -1): number {
    let i = start;
    for (let n = 0; n < CALL_SET.length; n += 1) {
      i = (i + dir + CALL_SET.length) % CALL_SET.length;
      if (callUnlocked(CALL_SET[i]!)) return i;
    }
    return start;
  }
  // Fire a Call: shout FIRST (the trainer command beat — a Call is never
  // silent), then the effect. Only Catch Breath has an engine effect this
  // build; design-only Calls are cursor-skipped so never reach here.
  function fireCall(call: CallDef): void {
    const monName = activeMon(state.player).species.name;
    setText([callShout(call, monName)], () => {
      if (call.id === 'catch-breath') commit({ kind: 'catchBreath' });
      else phase = 'menu';
    });
  }
  function handleCallInput(key: InputKey): void {
    if (key === 'up') callCursor = stepCallCursor(callCursor, -1);
    else if (key === 'down') callCursor = stepCallCursor(callCursor, 1);
    else if (key === 'b') phase = 'menu'; // exit the submenu (fixes misclick trap)
    else if (key === 'a' || key === 'start') {
      const call = CALL_SET[callCursor];
      if (!call) return;
      if (!callUnlocked(call)) {
        // Defensive — the cursor skips locked Calls, so this is only hit
        // if somehow landed (e.g. nothing unlocked). Small toast, no fire.
        setText(['That Call is not', 'unlocked yet.'], () => { phase = 'call'; }, { dismissable: true });
        return;
      }
      if (!callAffordable(call)) {
        setText(
          [`Not enough ★ for ${call.name}.`, `Needs ★${call.starCost} — win reads to charge.`],
          () => { phase = 'call'; },
          { dismissable: true },
        );
        return;
      }
      fireCall(call);
    }
  }

  function handleTextInput(key: InputKey): void {
    if (key === 'b') {
      // Only dismissable dialogs back out — sequential/forced dialogs
      // (intro, end-text, "Got away safely!") must be read with A/Start.
      if (!textDismissable) return;
      const next = textNext;
      textNext = null;
      textQueue = [];
      textDismissable = false;
      if (next) next();
      return;
    }
    if (key !== 'a' && key !== 'start') return;
    textQueue.shift();
    if (textQueue.length === 0) {
      const next = textNext;
      textNext = null;
      textDismissable = false;
      if (next) next();
    }
  }

  function handleResolveInput(key: InputKey): void {
    if (key !== 'a' && key !== 'start') return;
    if (resolveHeld) {
      // Release just this hold; auto-play continues until the next
      // consequential event or the end. Gives the reader pace control
      // without forcing them to skip the rest.
      resolveHeld = false;
      eventTimer = 0;
      return;
    }
    // Between holds (or hold-free runs): flush fast for impatient replay.
    skipResolve();
  }

  function spriteOffset(side: Side): number {
    if (animSide !== side || animT <= 0) return 0;
    if (animKind === 'strike' || animKind === 'opening' || animKind === 'clash') {
      return side === 'player' ? 4 : -4;
    }
    if (animKind === 'dodge') return side === 'player' ? -6 : 6;
    return 0;
  }

  // ---------- draw ----------

  function drawFoePanel(ctx: CanvasRenderingContext2D): void {
    drawPanel(ctx, FOE_PANEL.x, FOE_PANEL.y, FOE_PANEL.w, FOE_PANEL.h);
    drawText(ctx, display.foe.species.name, FOE_PANEL.x + 8, FOE_PANEL.y + 6);
    if (display.foe.staggered) drawText(ctx, 'STAG', FOE_PANEL.x + 78, FOE_PANEL.y + 6, PALETTE.hpWarn);
    if (display.foe.exhausted) drawText(ctx, 'EXH', FOE_PANEL.x + 108, FOE_PANEL.y + 6, PALETTE.hpCrit);
    drawMomentum(ctx, FOE_PANEL.x + 132, FOE_PANEL.y + 6, display.foe.momentum, COMBAT.momentumCap);
    // Break meter moved to the dedicated boss strip below the panel
    // (BUG 3 — the in-panel pips were too small to notice).

    drawText(ctx, 'HP', FOE_PANEL.x + 8, FOE_PANEL.y + 18, PALETTE.paperShadow);
    drawBar(
      ctx,
      FOE_PANEL.x + 26,
      FOE_PANEL.y + 19,
      FOE_PANEL.w - 36,
      display.foe.hp,
      display.foe.maxHp,
      hpColor(display.foe.hp, display.foe.maxHp),
    );
    drawText(ctx, 'ST', FOE_PANEL.x + 8, FOE_PANEL.y + 26, PALETTE.paperShadow);
    drawBar(
      ctx,
      FOE_PANEL.x + 26,
      FOE_PANEL.y + 27,
      FOE_PANEL.w - 36,
      display.foe.st,
      100,
      PALETTE.stamina,
    );
    drawWindedNotch(ctx, FOE_PANEL.x + 26, FOE_PANEL.y + 27, FOE_PANEL.w - 36);
    // Bench indicators (S5): tucked just under the panel, 4×4 dots
    // tinted by status (active / alive / fainted). For 1-mon "teams"
    // nothing draws — the row stays empty and clean. Suppressed for a
    // boss fight, where the boss strip owns that row.
    if (breakThreshold === 0) {
      drawBenchIndicators(ctx, FOE_PANEL.x + 8, FOE_PANEL.y + FOE_PANEL.h + 2, state.foe);
    }
  }

  // BUG 3 — boss status strip under the foe panel: PHASE + a labeled,
  // legible BREAK meter that fills on read-wins (flashes when it ticks),
  // plus a compact bench row. Only for boss fights (breakThreshold > 0).
  function drawBossStrip(ctx: CanvasRenderingContext2D): void {
    const x = FOE_PANEL.x;
    const y = FOE_PANEL.y + FOE_PANEL.h + 1;
    const w = FOE_PANEL.w;
    ctx.fillStyle = 'rgba(28,30,46,0.92)';
    ctx.fillRect(x, y, w, 11);
    drawText(ctx, `PHASE ${displayPhase}`, x + 3, y + 2, PALETTE.paper);
    drawText(
      ctx,
      'BREAK',
      x + 50,
      y + 2,
      breakPipFlashT > 0 ? '#ffd76a' : PALETTE.paperShadow,
    );
    const pipX = x + 84;
    for (let i = 0; i < breakThreshold; i += 1) {
      const filled = i < displayBreakProgress;
      const isNewest = breakPipFlashT > 0 && i === Math.max(0, displayBreakProgress - 1);
      ctx.fillStyle = isNewest ? '#fff4c2' : filled ? '#e23a1e' : '#4a3c24';
      ctx.fillRect(pipX + i * 9, y + 2, 7, 7);
      ctx.strokeStyle = PALETTE.ink;
      ctx.lineWidth = 1;
      ctx.strokeRect(pipX + i * 9 + 0.5, y + 2 + 0.5, 6, 6);
    }
    // Compact bench row at the far right (always visible for the boss).
    const foe = state.foe;
    if (foe.members.length > 1) {
      const bx = x + w - foe.members.length * 6 - 3;
      for (let i = 0; i < foe.members.length; i += 1) {
        const mon = foe.members[i]!;
        ctx.fillStyle = mon.hp <= 0 ? '#1d1d28' : i === foe.active ? PALETTE.hpOk : PALETTE.paperDim;
        ctx.fillRect(bx + i * 6, y + 3, 4, 4);
        ctx.strokeStyle = PALETTE.ink;
        ctx.strokeRect(bx + i * 6 + 0.5, y + 3 + 0.5, 3, 3);
      }
    }
  }

  function drawPlayerPanel(ctx: CanvasRenderingContext2D): void {
    drawPanel(ctx, PL_PANEL.x, PL_PANEL.y, PL_PANEL.w, PL_PANEL.h);
    drawText(ctx, display.player.species.name, PL_PANEL.x + 8, PL_PANEL.y + 6);
    if (display.player.staggered) drawText(ctx, 'STAG', PL_PANEL.x + 78, PL_PANEL.y + 6, PALETTE.hpWarn);
    if (display.player.exhausted) drawText(ctx, 'EXH', PL_PANEL.x + 108, PL_PANEL.y + 6, PALETTE.hpCrit);
    drawMomentum(ctx, PL_PANEL.x + 132, PL_PANEL.y + 6, display.player.momentum, COMBAT.momentumCap);

    drawText(ctx, 'HP', PL_PANEL.x + 8, PL_PANEL.y + 18, PALETTE.paperShadow);
    drawBar(
      ctx,
      PL_PANEL.x + 26,
      PL_PANEL.y + 19,
      PL_PANEL.w - 36,
      display.player.hp,
      display.player.maxHp,
      hpColor(display.player.hp, display.player.maxHp),
    );
    drawText(ctx, 'ST', PL_PANEL.x + 8, PL_PANEL.y + 26, PALETTE.paperShadow);
    drawBar(
      ctx,
      PL_PANEL.x + 26,
      PL_PANEL.y + 27,
      PL_PANEL.w - 36,
      display.player.st,
      100,
      PALETTE.stamina,
    );
    drawWindedNotch(ctx, PL_PANEL.x + 26, PL_PANEL.y + 27, PL_PANEL.w - 36);
    drawBenchIndicators(ctx, PL_PANEL.x + 8, PL_PANEL.y + PL_PANEL.h + 2, state.player);
  }

  // Bench dots (one per team member) tinted by status. Suppressed
  // during resolve to keep focus on the strike. Only draws when the
  // team has >1 mon — solo "teams" leave the strip empty.
  function drawBenchIndicators(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    team: Team,
  ): void {
    if (team.members.length <= 1) return;
    if (phase === 'resolve' || phase === 'end' || phase === 'text') return;
    for (let i = 0; i < team.members.length; i += 1) {
      const mon = team.members[i]!;
      const fainted = mon.hp <= 0;
      const isActive = i === team.active;
      let fill: string;
      if (fainted) fill = '#1d1d28';
      else if (isActive) fill = PALETTE.hpOk;
      else fill = PALETTE.paperDim;
      ctx.fillStyle = fill;
      ctx.fillRect(x + i * 6, y, 4, 4);
      ctx.strokeStyle = PALETTE.ink;
      ctx.lineWidth = 1;
      ctx.strokeRect(x + i * 6 + 0.5, y + 0.5, 3, 3);
    }
  }

  function drawIntent(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = 'rgba(32,32,44,0.92)';
    ctx.fillRect(INTENT.x, INTENT.y, INTENT.w, INTENT.h);
    drawText(ctx, 'FOE INTENT:', INTENT.x + 4, INTENT.y + 2, PALETTE.paper);
    // Plain-language intent (honest, precision degraded per the reliability
    // ramp). A null line = OPAQUE: show a blank dash, no read. The SPD readout
    // below stays honest — speed isn't hidden, the foe's STANCE intent is.
    drawText(ctx, shownIntent.line ?? '———', INTENT.x + 60, INTENT.y + 2, PALETTE.paper);
    // S2 — speed relationship (decides dodges AND turn order), the
    // hidden variable. Persistent on the intent bar while choosing.
    const sl = speedLabel(activeMon(state.player).species.spd, activeMon(state.foe).species.spd);
    const slColor =
      sl === 'YOU FASTER' ? PALETTE.hpOk : sl === 'YOU SLOWER' ? PALETTE.hpCrit : PALETTE.paperShadow;
    drawTextRight(ctx, `SPD: ${sl}`, INTENT.x + INTENT.w - 4, INTENT.y + 2, slColor);
  }

  // S1 — the explanatory callout banner. Shown during resolve (the intent
  // bar's slot is free then), naming the rule behind what just happened.
  function drawCallout(ctx: CanvasRenderingContext2D): void {
    if (!calloutLine) return;
    const w = 300;
    const h = 14;
    const x = (LOGICAL_W - w) / 2;
    const y = INTENT.y;
    ctx.fillStyle = 'rgba(255, 215, 90, 0.94)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = PALETTE.ink;
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    ctx.font = '8px monospace';
    ctx.textBaseline = 'top';
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.ink;
    ctx.fillText(calloutLine, LOGICAL_W / 2, y + 3);
    ctx.textAlign = 'start';
  }

  function drawBottomDialog(ctx: CanvasRenderingContext2D, lines: readonly string[]): void {
    drawPanel(ctx, BOTTOM.x, BOTTOM.y, BOTTOM.w, BOTTOM.h);
    for (let i = 0; i < Math.min(3, lines.length); i += 1) {
      drawText(ctx, lines[i]!, BOTTOM.x + 8, BOTTOM.y + 8 + i * 12);
    }
    if (Math.floor(tick * 2) % 2 === 0) {
      drawText(ctx, '▼', BOTTOM.x + BOTTOM.w - 14, BOTTOM.y + BOTTOM.h - 12, PALETTE.ink);
    }
  }

  function drawBottomMenu(ctx: CanvasRenderingContext2D): void {
    drawPanel(ctx, BOTTOM.x, BOTTOM.y, BOTTOM.w, BOTTOM.h);
    const me = activeMon(state.player);
    const labels: { readonly [K in 'fight' | 'pkmn' | 'catch' | 'call' | 'run']: string } = {
      fight: 'FIGHT',
      pkmn: 'PKMN',
      catch: opts.canCatch ? `BALL x${opts.ballCount?.() ?? 0}` : 'BALL -',
      call: opts.catchBreathUnlocked ? `CALL ★${me.momentum}` : 'CALL -',
      run: opts.canRun ? 'RUN' : 'STAY',
    };
    const items = menuItems();
    items.forEach((it, i) => {
      // PKMN is dimmed when no bench survivor; CALL when locked or 0 ★;
      // RUN never dimmed (its row dispatches the "no running" text when
      // canRun is false). FIGHT always lit.
      let dim = !it.enabled;
      if (it.kind === 'call' && (!opts.catchBreathUnlocked || me.momentum < 1)) dim = true;
      drawText(
        ctx,
        `${menuCursor === i ? '>' : ' '} ${labels[it.kind]}`,
        BOTTOM.x + 10,
        BOTTOM.y + 8 + i * 10,
        dim ? PALETTE.paperDim : PALETTE.ink,
      );
    });
    drawText(ctx, `R${state.round}`, BOTTOM.x + BOTTOM.w - 28, BOTTOM.y + 10, PALETTE.paperDim);
    drawText(
      ctx,
      'A confirm  B back',
      BOTTOM.x + 120,
      BOTTOM.y + BOTTOM.h - 12,
      PALETTE.paperDim,
    );
  }

  function drawBottomParty(ctx: CanvasRenderingContext2D): void {
    drawPanel(ctx, BOTTOM.x, BOTTOM.y, BOTTOM.w, BOTTOM.h);
    drawText(
      ctx,
      partyMode === 'forced' ? 'SEND OUT WHO?' : 'PARTY',
      BOTTOM.x + 8,
      BOTTOM.y + 4,
      PALETTE.paperShadow,
    );
    const team = state.player;
    team.members.forEach((side, i) => {
      const isActive = i === team.active;
      const fainted = side.hp <= 0;
      const selectable = isPartySelectable(i);
      const color = !selectable ? PALETTE.paperDim : PALETTE.ink;
      const cursor = partyCursor === i ? '>' : ' ';
      const hpStr = `HP ${Math.round(side.hp)}/${side.maxHp}`;
      const tag = fainted ? 'FNT' : isActive ? 'ACT' : '';
      const row = `${cursor}${side.species.name.padEnd(10, ' ')} ${hpStr.padEnd(10, ' ')} ${tag}`;
      drawText(ctx, row, BOTTOM.x + 8, BOTTOM.y + 14 + i * 9, color);
    });
    const help = partyMode === 'forced' ? 'A: send out' : 'A: switch  B: back';
    drawText(ctx, help, BOTTOM.x + 10, BOTTOM.y + BOTTOM.h - 12, PALETTE.paperDim);
  }

  function drawBottomMoves(ctx: CanvasRenderingContext2D): void {
    drawPanel(ctx, BOTTOM.x, BOTTOM.y, BOTTOM.w, BOTTOM.h);
    const moves = activeMon(state.player).species.moves;
    // Window the move list (evolved mons carry up to 8 moves). Show
    // MOVES_VISIBLE rows starting at moveScroll, with ▲▼ when there's
    // more above/below — nothing spills past the panel edge.
    const end = Math.min(moves.length, moveScroll + MOVES_VISIBLE);
    for (let i = moveScroll; i < end; i += 1) {
      const m = moves[i]!;
      const move = lookupMove(m);
      const tier = TIERS[move.tier];
      const locked =
        (activeMon(state.player).st <= COMBAT.winded && (move.tier === 'heavy' || move.tier === 'nuke')) ||
        activeMon(state.player).st < tier.cost;
      const color = locked ? PALETTE.paperDim : PALETTE.ink;
      const y = BOTTOM.y + 6 + (i - moveScroll) * 8;
      drawText(ctx, `${moveCursor === i ? '>' : ' '}${m}`, BOTTOM.x + 8, y, color);
      drawTextRight(ctx, `ST${tier.cost}`, BOTTOM.x + 150, y, color);
    }
    // Scroll indicators (only when there's more off-window).
    if (moveScroll > 0) drawText(ctx, '▲', BOTTOM.x + 158, BOTTOM.y + 4, PALETTE.paperDim);
    if (end < moves.length) drawText(ctx, '▼', BOTTOM.x + 158, BOTTOM.y + BOTTOM.h - 12, PALETTE.paperDim);

    const stance = STANCES[stanceIdx]!;
    drawStanceBadge(ctx, BOTTOM.x + 170, BOTTOM.y + 8, stance);
    drawText(ctx, STANCE_NAME[stance], BOTTOM.x + 182, BOTTOM.y + 8);

    // Order preview
    const previewMove = moves[moveCursor]!;
    const order = orderHint(
      activeMon(state.player),
      activeMon(state.foe),
      previewMove,
      stance,
      actionMove(foeAction),
      actionStance(foeAction),
    );
    drawText(ctx, `NEXT: ${order}`, BOTTOM.x + 170, BOTTOM.y + 22, PALETTE.paperShadow);
    drawText(ctx, 'SEL=stance  B=back', BOTTOM.x + 170, BOTTOM.y + BOTTOM.h - 12, PALETTE.paperDim);
  }

  function drawBottomCall(ctx: CanvasRenderingContext2D): void {
    drawPanel(ctx, BOTTOM.x, BOTTOM.y, BOTTOM.w, BOTTOM.h);
    // Two columns (the full set is 6) so the player sees the Calls they
    // grow into. Locked + unaffordable render greyed; only Catch Breath
    // is selectable for now.
    CALL_SET.forEach((call, i) => {
      const unlocked = callUnlocked(call);
      const greyed = !unlocked || !callAffordable(call);
      const color = greyed ? PALETTE.paperDim : PALETTE.ink;
      const col = i < 3 ? 0 : 1;
      const row = i % 3;
      const x = BOTTOM.x + 8 + col * 154;
      const y = BOTTOM.y + 5 + row * 10;
      const marker = callCursor === i ? '>' : ' ';
      const tag = !unlocked ? ' ·LOCKED' : '';
      drawText(ctx, `${marker}${call.name}${tag}`, x, y, color);
      drawTextRight(ctx, `★${call.starCost}`, x + 148, y, color);
    });
    drawText(
      ctx,
      `Your ★${activeMon(state.player).momentum}   A use · B back`,
      BOTTOM.x + 8,
      BOTTOM.y + BOTTOM.h - 10,
      PALETTE.paperDim,
    );
  }

  function drawBottomSpare(ctx: CanvasRenderingContext2D): void {
    drawPanel(ctx, BOTTOM.x, BOTTOM.y, BOTTOM.w, BOTTOM.h);
    const foeName = display.foe.species.name;
    drawText(ctx, `The wild ${foeName} fell.`, BOTTOM.x + 8, BOTTOM.y + 6);
    drawText(ctx, 'Tend it with medicine — show mercy?', BOTTOM.x + 8, BOTTOM.y + 16, PALETTE.paperShadow);
    drawText(
      ctx,
      `${spareCursor === 0 ? '>' : ' '} YES — spare it`,
      BOTTOM.x + 12,
      BOTTOM.y + 30,
      spareCursor === 0 ? PALETTE.ink : PALETTE.paperDim,
    );
    drawText(
      ctx,
      `${spareCursor === 1 ? '>' : ' '} NO — claim the win`,
      BOTTOM.x + 160,
      BOTTOM.y + 30,
      spareCursor === 1 ? PALETTE.ink : PALETTE.paperDim,
    );
  }

  function drawBottomLog(ctx: CanvasRenderingContext2D): void {
    drawPanel(ctx, BOTTOM.x, BOTTOM.y, BOTTOM.w, BOTTOM.h);
    for (let i = 0; i < log.length; i += 1) {
      drawText(ctx, log[i]!, BOTTOM.x + 8, BOTTOM.y + 8 + i * 12);
    }
  }

  // No-intro mode: jump straight into the first turn.
  if (textQueue.length === 0) {
    textNext = null;
    beginTurn();
  }

  return {
    update(dt) {
      tick += dt;
      if (breakFlashT > 0) breakFlashT = Math.max(0, breakFlashT - dt);
      if (breakPipFlashT > 0) breakPipFlashT = Math.max(0, breakPipFlashT - dt);
      if (phase === 'resolve') tickResolve(dt);
    },

    input(key) {
      if (phase === 'text') {
        handleTextInput(key);
        return;
      }
      if (phase === 'menu') {
        handleMenuInput(key);
        return;
      }
      if (phase === 'move') {
        handleMoveInput(key);
        return;
      }
      if (phase === 'call') {
        handleCallInput(key);
        return;
      }
      if (phase === 'spare') {
        handleSpareInput(key);
        return;
      }
      if (phase === 'party') {
        handlePartyInput(key);
        return;
      }
      if (phase === 'resolve') {
        handleResolveInput(key);
        return;
      }
    },

    draw(ctx) {
      ctx.fillStyle = PALETTE.battleSky;
      ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
      ctx.fillStyle = PALETTE.battleGround;
      ctx.fillRect(0, 124, LOGICAL_W, 8);

      // Platforms under each fighter
      ctx.fillStyle = PALETTE.platform;
      ctx.beginPath();
      ctx.ellipse(FOE_SLOT.x + 28, FOE_SLOT.y + 56, 30, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(PL_SLOT.x + 28, PL_SLOT.y + 56, 32, 6, 0, 0, Math.PI * 2);
      ctx.fill();

      drawSpeciesInSlot(
        ctx,
        { name: display.foe.species.name, type: display.foe.species.types[0] ?? null },
        FOE_SLOT.x + spriteOffset('foe'),
        FOE_SLOT.y,
        { facing: 'left' },
      );
      drawSpeciesInSlot(
        ctx,
        { name: display.player.species.name, type: display.player.species.types[0] ?? null },
        PL_SLOT.x + spriteOffset('player'),
        PL_SLOT.y,
        { facing: 'right' },
      );

      drawFoePanel(ctx);
      if (breakThreshold > 0) drawBossStrip(ctx);
      drawPlayerPanel(ctx);

      if (phase === 'menu' || phase === 'move' || phase === 'call') drawIntent(ctx);
      // S1 — the triangle callout occupies the intent slot during resolve.
      if (phase === 'resolve') drawCallout(ctx);

      // BUG 3 — gust legibility. Two distinct states:
      //  • ACTIVE: the round in play IS a gust round (this is what the
      //    "wind is rising" was only ever warning about) — say what it
      //    DOES. During resolve the round counter has already advanced,
      //    so the round being resolved is state.round - 1.
      //  • TELEGRAPH: the NEXT round will be a gust round.
      const arena = state.bossCard?.arenaSchedule;
      if (arena && arena.rhythmEveryN > 0) {
        const anchor = state.rhythmAnchor ?? 0;
        const activeRound = phase === 'resolve' ? state.round - 1 : state.round;
        const currentIsGust = (activeRound - anchor) % arena.rhythmEveryN === 0;
        const nextIsGust = (state.round + 1 - anchor) % arena.rhythmEveryN === 0;
        if (currentIsGust && (phase === 'menu' || phase === 'move' || phase === 'resolve')) {
          const pulse = 0.7 + 0.3 * Math.sin(tick * 6);
          ctx.fillStyle = `rgba(70,150,230,${pulse})`;
          ctx.fillRect(0, 14, LOGICAL_W, 12);
          drawText(ctx, '≋ GUST ROUND — heavies cost +ST, gale bites harder ≋', 16, 16, PALETTE.paper);
        } else if (nextIsGust && (phase === 'menu' || phase === 'move')) {
          ctx.fillStyle = 'rgba(80,140,210,0.7)';
          ctx.fillRect(0, 14, LOGICAL_W, 12);
          drawText(ctx, '~~ the wind is rising… GUST next round ~~', 40, 16, PALETTE.paper);
        }
      }

      if (breakFlashT > 0) {
        const a = breakFlashT / 0.6;
        ctx.fillStyle = `rgba(255,240,200,${0.6 * a})`;
        ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
      }

      if (phase === 'text') drawBottomDialog(ctx, textQueue);
      else if (phase === 'menu') drawBottomMenu(ctx);
      else if (phase === 'move') drawBottomMoves(ctx);
      else if (phase === 'call') drawBottomCall(ctx);
      else if (phase === 'spare') drawBottomSpare(ctx);
      else if (phase === 'party') drawBottomParty(ctx);
      else if (phase === 'resolve' || phase === 'end') drawBottomLog(ctx);
    },
  };
}
