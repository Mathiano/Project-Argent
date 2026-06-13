import {
  COMBAT,
  MOVES,
  TIERS,
  activeMon,
  forcedAction,
  isTeamWiped,
  resolveRound,
} from '../../engine';
import type {
  Action,
  BattleEvent,
  BattleState,
  RNG,
  Side,
  SideState,
  Stance,
} from '../../engine';
import { LOGICAL_H, LOGICAL_W } from '../canvas';
import { PALETTE } from '../palette';
import type { InputKey, Scene } from '../scene';
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

const STEP_SEC = 0.4;
const STANCES: readonly Stance[] = ['A', 'G', 'F'];

const FOE_PANEL = { x: 2, y: 2, w: 170, h: 36 } as const;
const FOE_SLOT = { x: 222, y: 2 } as const;
const INTENT = { x: 0, y: 60, w: 320, h: 12 } as const;
const PL_SLOT = { x: 30, y: 74 } as const;
const PL_PANEL = { x: 144, y: 82, w: 172, h: 36 } as const;
const BOTTOM = { x: 2, y: 132, w: 316, h: 46 } as const;

const TIER_TAG: { readonly [k: string]: string } = {
  light: 'LT',
  mid: 'MD',
  heavy: 'HV',
  nuke: 'NK',
};

export interface BattleSceneOpts {
  readonly state: BattleState;
  readonly rng: RNG;
  readonly chooseFoeAction: (state: BattleState, rng: RNG) => Action;
  readonly intro: readonly string[];
  readonly catchBreathUnlocked: boolean;
  readonly canRun: boolean;
  readonly onResolve: (winner: 'player' | 'foe') => void;
}

interface DisplaySide {
  hp: number;
  st: number;
  momentum: number;
  exhausted: boolean;
  staggered: boolean;
}

interface Display {
  player: DisplaySide;
  foe: DisplaySide;
}

function snapshot(side: SideState): DisplaySide {
  return {
    hp: side.hp,
    st: side.st,
    momentum: side.momentum,
    exhausted: side.exhausted,
    staggered: side.staggered,
  };
}

function opposite(side: Side): Side {
  return side === 'player' ? 'foe' : 'player';
}

function computeInit(side: SideState, moveName: string | null, stance: Stance): number {
  if (moveName === null) return -1;
  const tier = MOVES[moveName]!.tier;
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

function describeFoeIntent(action: Action): { stance: Stance | null; tag: string } {
  if (action.kind === 'rest') return { stance: null, tag: 'RESTING' };
  if (action.kind === 'catchBreath') return { stance: null, tag: 'RECOVERING' };
  if (action.kind === 'switch') return { stance: null, tag: 'SWITCHING' };
  return { stance: action.stance, tag: `${TIER_TAG[MOVES[action.move]!.tier]} ATTACK` };
}

export function createBattleScene(opts: BattleSceneOpts): Scene {
  let state: BattleState = opts.state;
  let foeAction: Action = { kind: 'rest' };
  let display: Display = {
    player: snapshot(activeMon(state.player)),
    foe: snapshot(activeMon(state.foe)),
  };
  const breakThreshold = state.bossCard?.breakBar ?? 0;
  let displayBreakProgress = state.breakProgress ?? 0;
  let breakFlashT = 0;

  let phase: 'text' | 'menu' | 'move' | 'resolve' | 'end' = 'text';
  let textQueue: string[] = [...opts.intro];
  let textNext: (() => void) | null = beginTurn;
  let log: string[] = [];
  let pendingEvents: BattleEvent[] = [];
  let eventTimer = 0;
  let endingWinner: 'player' | 'foe' | null = null;

  let menuCursor = 0;
  let moveCursor = 0;
  let stanceIdx = 0;
  let tick = 0;

  let animSide: Side | null = null;
  let animKind: 'strike' | 'dodge' | 'opening' | 'counter' | 'clash' | null = null;
  let animT = 0;

  function pushLog(line: string): void {
    log.push(line);
    if (log.length > 3) log.shift();
  }

  function setText(lines: readonly string[], then: () => void): void {
    phase = 'text';
    textQueue = [...lines];
    textNext = then;
  }

  function beginTurn(): void {
    const forced = forcedAction(activeMon(state.player));
    if (forced) {
      foeAction = opts.chooseFoeAction(state, opts.rng);
      commit(forced);
      return;
    }
    foeAction = opts.chooseFoeAction(state, opts.rng);
    phase = 'menu';
    menuCursor = 0;
  }

  function commit(action: Action): void {
    log = [];
    const result = resolveRound(state, action, foeAction, opts.rng);
    state = result.state;
    pendingEvents = [...result.events];
    eventTimer = 0;
    // Display state is reseated by the first roundStart event's snapshot.
    phase = 'resolve';
  }

  function applyEvent(ev: BattleEvent): void {
    if (ev.kind === 'roundStart') {
      display.player = {
        hp: ev.player.hp,
        st: ev.player.st,
        momentum: ev.player.momentum,
        exhausted: ev.player.exhausted,
        staggered: ev.player.staggered,
      };
      display.foe = {
        hp: ev.foe.hp,
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
      if (ev.action.kind === 'rest') {
        const who = ev.side === 'player' ? activeMon(state.player).species.name : activeMon(state.foe).species.name;
        const note = ev.action.reason === 'exhaustion' ? 'is spent — resting.' : 'has no moves — resting.';
        pushLog(`${who} ${note}`);
      } else if (ev.action.kind === 'catchBreath') {
        const who = ev.side === 'player' ? activeMon(state.player).species.name : activeMon(state.foe).species.name;
        pushLog(`${who}: catch your breath!`);
      } else {
        const who = ev.side === 'player' ? activeMon(state.player).species.name : `Foe ${activeMon(state.foe).species.name}`;
        pushLog(`${who} used ${ev.action.move}.`);
      }
      return;
    }
    if (ev.kind === 'catchBreath') {
      display[ev.side].st = Math.min(100, display[ev.side].st + ev.restored);
      display[ev.side].momentum = Math.max(0, display[ev.side].momentum - 1);
      pushLog(`Recovered +${ev.restored} ST.`);
      return;
    }
    if (ev.kind === 'clash') {
      animKind = 'clash';
      animSide = ev.winner;
      animT = 0.3;
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
      return;
    }
    if (ev.kind === 'dodge') {
      const who = ev.side === 'player' ? activeMon(state.player).species.name : 'Foe ' + activeMon(state.foe).species.name;
      pushLog(`${who} dodged it!`);
      animSide = ev.side;
      animKind = 'dodge';
      animT = 0.25;
      return;
    }
    if (ev.kind === 'opening') {
      const def = opposite(ev.side);
      display[def].hp = Math.max(0, display[def].hp - ev.damage);
      pushLog('Found an opening!');
      animSide = ev.side;
      animKind = 'opening';
      animT = 0.25;
      return;
    }
    if (ev.kind === 'counter') {
      const att = opposite(ev.side);
      display[att].hp = Math.max(0, display[att].hp - ev.damage);
      const who = ev.side === 'player' ? activeMon(state.player).species.name : 'Foe';
      pushLog(`${who} countered!`);
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
      pushLog(`★ Break progress ${ev.progress}/${ev.threshold}.`);
      return;
    }
    if (ev.kind === 'break') {
      displayBreakProgress = 0;
      breakFlashT = 0.6;
      pushLog(`The foe is BROKEN! Phase ${ev.newPhase}.`);
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
    else if (isTeamWiped(state.foe)) endingWinner = 'player';
    if (endingWinner !== null) {
      phase = 'end';
      const msg =
        endingWinner === 'player'
          ? ['You won the battle!', 'Press A to continue.']
          : ['Your team fell.', 'Press A to continue.'];
      setText(msg, () => {
        opts.onResolve(endingWinner!);
      });
      return;
    }
    beginTurn();
  }

  function tickResolve(dt: number): void {
    if (animT > 0) animT = Math.max(0, animT - dt);
    eventTimer -= dt;
    while (eventTimer <= 0 && pendingEvents.length > 0) {
      const ev = pendingEvents.shift()!;
      applyEvent(ev);
      eventTimer += STEP_SEC;
    }
    if (pendingEvents.length === 0 && eventTimer <= 0) finishResolve();
  }

  function skipResolve(): void {
    while (pendingEvents.length > 0) applyEvent(pendingEvents.shift()!);
    eventTimer = 0;
    finishResolve();
  }

  function handleMenuInput(key: InputKey): void {
    if (key === 'up') menuCursor = (menuCursor + 2) % 3;
    else if (key === 'down') menuCursor = (menuCursor + 1) % 3;
    else if (key === 'a') {
      if (menuCursor === 0) {
        phase = 'move';
        moveCursor = 0;
      } else if (menuCursor === 1) {
        if (!opts.catchBreathUnlocked) {
          setText(['Calls unlock after', 'your first win.'], () => {
            phase = 'menu';
          });
        } else if (activeMon(state.player).momentum < 1) {
          setText(
            ['No ★ yet —', 'win reads to charge:', 'counter, dodge, open.'],
            () => {
              phase = 'menu';
            },
          );
        } else {
          commit({ kind: 'catchBreath' });
        }
      } else {
        if (opts.canRun) {
          setText(['Got away safely!'], () => {
            opts.onResolve('foe');
          });
        } else {
          setText(['No running from', 'a rival!'], () => {
            phase = 'menu';
          });
        }
      }
    } else if (key === 'start') {
      // START shortcut for CALL
      menuCursor = 1;
      handleMenuInput('a');
    }
  }

  function handleMoveInput(key: InputKey): void {
    const moves = activeMon(state.player).species.moves;
    if (key === 'up') moveCursor = (moveCursor + moves.length - 1) % moves.length;
    else if (key === 'down') moveCursor = (moveCursor + 1) % moves.length;
    else if (key === 'select') stanceIdx = (stanceIdx + 1) % 3;
    else if (key === 'b') phase = 'menu';
    else if (key === 'a') {
      const moveName = moves[moveCursor]!;
      const move = MOVES[moveName]!;
      if (activeMon(state.player).st <= COMBAT.winded && (move.tier === 'heavy' || move.tier === 'nuke')) {
        setText(['Too winded for', 'heavy moves!'], () => {
          phase = 'move';
        });
        return;
      }
      if (activeMon(state.player).st < TIERS[move.tier].cost) {
        setText(['Not enough stamina!'], () => {
          phase = 'move';
        });
        return;
      }
      commit({ kind: 'move', move: moveName, stance: STANCES[stanceIdx]! });
    }
  }

  function handleTextInput(key: InputKey): void {
    if (key !== 'a' && key !== 'start') return;
    textQueue.shift();
    if (textQueue.length === 0) {
      const next = textNext;
      textNext = null;
      if (next) next();
    }
  }

  function handleResolveInput(key: InputKey): void {
    if (key === 'a') skipResolve();
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

  function drawBreakPips(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    progress: number,
    threshold: number,
  ): void {
    for (let i = 0; i < threshold; i += 1) {
      const filled = i < progress;
      ctx.fillStyle = filled ? '#e23a1e' : '#5a4a2a';
      ctx.fillRect(x + i * 6, y + 1, 4, 4);
      ctx.strokeStyle = PALETTE.ink;
      ctx.lineWidth = 1;
      ctx.strokeRect(x + i * 6 + 0.5, y + 1 + 0.5, 3, 3);
    }
  }

  function drawFoePanel(ctx: CanvasRenderingContext2D): void {
    drawPanel(ctx, FOE_PANEL.x, FOE_PANEL.y, FOE_PANEL.w, FOE_PANEL.h);
    drawText(ctx, activeMon(state.foe).species.name, FOE_PANEL.x + 8, FOE_PANEL.y + 6);
    if (display.foe.staggered) drawText(ctx, 'STAG', FOE_PANEL.x + 78, FOE_PANEL.y + 6, PALETTE.hpWarn);
    if (display.foe.exhausted) drawText(ctx, 'EXH', FOE_PANEL.x + 108, FOE_PANEL.y + 6, PALETTE.hpCrit);
    drawMomentum(ctx, FOE_PANEL.x + 132, FOE_PANEL.y + 6, display.foe.momentum, COMBAT.momentumCap);
    if (breakThreshold > 0) {
      drawBreakPips(ctx, FOE_PANEL.x + 110, FOE_PANEL.y + 6, displayBreakProgress, breakThreshold);
    }

    drawText(ctx, 'HP', FOE_PANEL.x + 8, FOE_PANEL.y + 18, PALETTE.paperShadow);
    drawBar(
      ctx,
      FOE_PANEL.x + 26,
      FOE_PANEL.y + 19,
      FOE_PANEL.w - 36,
      display.foe.hp,
      activeMon(state.foe).maxHp,
      hpColor(display.foe.hp, activeMon(state.foe).maxHp),
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
  }

  function drawPlayerPanel(ctx: CanvasRenderingContext2D): void {
    drawPanel(ctx, PL_PANEL.x, PL_PANEL.y, PL_PANEL.w, PL_PANEL.h);
    drawText(ctx, activeMon(state.player).species.name, PL_PANEL.x + 8, PL_PANEL.y + 6);
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
      activeMon(state.player).maxHp,
      hpColor(display.player.hp, activeMon(state.player).maxHp),
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
  }

  function drawIntent(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = 'rgba(32,32,44,0.92)';
    ctx.fillRect(INTENT.x, INTENT.y, INTENT.w, INTENT.h);
    drawText(ctx, 'FOE INTENT:', INTENT.x + 4, INTENT.y + 2, PALETTE.paper);
    const intent = describeFoeIntent(foeAction);
    if (intent.stance) {
      drawStanceBadge(ctx, INTENT.x + 64, INTENT.y + 1, intent.stance);
      drawText(ctx, intent.tag, INTENT.x + 76, INTENT.y + 2, PALETTE.paper);
    } else {
      drawText(ctx, intent.tag, INTENT.x + 64, INTENT.y + 2, PALETTE.paper);
    }
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
    const items = ['FIGHT', opts.catchBreathUnlocked ? `CALL ★${activeMon(state.player).momentum}` : 'CALL -', opts.canRun ? 'RUN' : 'STAY'];
    items.forEach((it, i) => {
      const dim =
        (i === 1 && (!opts.catchBreathUnlocked || activeMon(state.player).momentum < 1)) ||
        (i === 2 && !opts.canRun);
      drawText(
        ctx,
        `${menuCursor === i ? '>' : ' '} ${it}`,
        BOTTOM.x + 10,
        BOTTOM.y + 10 + i * 12,
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

  function drawBottomMoves(ctx: CanvasRenderingContext2D): void {
    drawPanel(ctx, BOTTOM.x, BOTTOM.y, BOTTOM.w, BOTTOM.h);
    const moves = activeMon(state.player).species.moves;
    moves.forEach((m, i) => {
      const move = MOVES[m]!;
      const tier = TIERS[move.tier];
      const locked =
        (activeMon(state.player).st <= COMBAT.winded && (move.tier === 'heavy' || move.tier === 'nuke')) ||
        activeMon(state.player).st < tier.cost;
      const color = locked ? PALETTE.paperDim : PALETTE.ink;
      drawText(ctx, `${moveCursor === i ? '>' : ' '}${m}`, BOTTOM.x + 8, BOTTOM.y + 8 + i * 10, color);
      drawTextRight(ctx, `ST${tier.cost}`, BOTTOM.x + 152, BOTTOM.y + 8 + i * 10, color);
    });

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
        { name: activeMon(state.foe).species.name, type: activeMon(state.foe).species.types[0] ?? null },
        FOE_SLOT.x + spriteOffset('foe'),
        FOE_SLOT.y,
        { facing: 'left' },
      );
      drawSpeciesInSlot(
        ctx,
        { name: activeMon(state.player).species.name, type: activeMon(state.player).species.types[0] ?? null },
        PL_SLOT.x + spriteOffset('player'),
        PL_SLOT.y,
        { facing: 'right' },
      );

      drawFoePanel(ctx);
      drawPlayerPanel(ctx);

      if (phase === 'menu' || phase === 'move') drawIntent(ctx);

      // Gust telegraph: the round AFTER this one is a rhythm round.
      const arena = state.bossCard?.arenaSchedule;
      if (arena && (phase === 'menu' || phase === 'move')) {
        const nextRound = state.round + 1;
        const anchor = state.rhythmAnchor ?? 0;
        const nextIsRhythm = ((nextRound - anchor) % arena.rhythmEveryN) === 0;
        if (nextIsRhythm) {
          ctx.fillStyle = 'rgba(80,140,210,0.85)';
          ctx.fillRect(0, 14, LOGICAL_W, 12);
          drawText(ctx, '~~  THE WIND IS RISING…  ~~', 84, 16, PALETTE.paper);
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
      else if (phase === 'resolve' || phase === 'end') drawBottomLog(ctx);
    },
  };
}
