import { LOGICAL_H, LOGICAL_W } from '../canvas';
import type { InputState } from '../input';
import { getMap } from '../overworld/maps';
import { emitGameEvent } from '../gameEvents';
import type { Tile, Tileset } from '../overworld/tileset';
import { getTileset, hasTileset } from '../overworld/tilesetCatalog';
import type { Facing, MapData, MapObject, PlacedProp, ScriptCommand } from '../overworld/types';
import { findObjectAt, isWalkable } from '../overworld/types';
import { ySortOrder } from '../overworld/ysort';
import { PALETTE } from '../palette';
import type { InputKey, Scene } from '../scene';
import { drawPanel, drawText } from '../ui';
import { drawSpeciesInSlot } from '../sprites';
import type { ElementType } from '../../engine';

const MOVE_DURATION = 0.18;
const FADE_DURATION = 0.25;
// Gen-2-style turn-in-place: when a direction is pressed and the player
// is NOT already facing that way, set the facing immediately and wait
// this long before committing to a walk. Released within the window =
// pure turn; held past it = walk. Tuned to feel like a single deliberate
// frame — short enough not to lag a held-direction walk, long enough
// that a tap reliably ends as a turn-only.
const TURN_HOLD_DELAY = 0.1;

export interface FlagStore {
  has(flag: string): boolean;
  set(flag: string): void;
  unset(flag: string): void;
}

export interface OverworldSceneOpts {
  readonly map: string;
  readonly spawn: string;
  readonly inputState: InputState;
  readonly flags: FlagStore;
  readonly startFaded?: boolean;
  // Optional override: land at exact (x, y, facing) instead of looking
  // up by spawn id. Used by save/load to restore an arbitrary position.
  readonly spawnAt?: { readonly x: number; readonly y: number; readonly facing: Facing };
  readonly onWarp: (target: string) => void;
  readonly onEncounter: (foeSpecies: string) => void;
  readonly onTrainerBattle: (
    foeSpecies: string | readonly string[],
    winFlag: string,
    reward?: number,
  ) => void;
  readonly onBossBattle: (bossId: string) => void;
  // Phase 3 — opt-in. When the active map's script runs
  // `show-starter-pick`, the overworld delegates to this callback so
  // main.ts can push the starter-pick scene + handle the chosen
  // species. Maps without this verb in their scripts don't need it.
  readonly onStarterPick?: () => void;
  // Phase 4 — opt-in. START key in the overworld delegates to this
  // callback so main.ts can push the pause menu. No callback = no
  // pause menu (used by combat-only test hooks).
  readonly onPauseMenu?: () => void;
  // Phase 5a — opt-in. heal-party script verb (Pokémon Center NPC)
  // fires this so main.ts can fully restore run.party + autosave.
  readonly onHealParty?: () => void;
  // Phase 5b — opt-in. open-mart script verb (Poké Mart CLERK NPC)
  // fires this with the shop's stock so main.ts can push the Mart
  // scene. No callback = no shop (maps without a Mart don't need it).
  readonly onOpenMart?: (stock: readonly string[]) => void;
  // Phase 6.5 — opt-in. open-box script verb (the Center PC) fires this
  // so main.ts can push the box scene. No callback = no PC (maps without
  // a PC don't need it).
  readonly onOpenBox?: () => void;
  // Phase 7 — opt-in. give-item script verb (hidden items, event rewards)
  // fires this so main.ts can add to the bag + autosave. No callback =
  // no-op (maps without item grants don't need it).
  readonly onGiveItem?: (itemId: string, qty: number) => void;
  // Phase 7 — opt-in. The start-tutorial-catch verb fires this so main.ts can
  // push the one-time guided FLITPECK catch (forgiving tutorial layer). No
  // callback = no-op (maps without the lesson don't need it).
  readonly onTutorialCatch?: () => void;
  // Phase 7 — opt-in. The start-rival-battle verb fires this so main.ts can
  // launch the KAMON v2 fight (the Violet→Route 32 gate). No callback = no-op.
  readonly onRivalBattle?: () => void;
  readonly onRivalGate?: () => void;
  // Encounter RNG source (risks/gaps #2). Returns [0,1) like Math.random.
  // REQUIRED — main.ts passes the run's SEEDED rng so encounter sequences
  // are deterministic + testable, consistent with the combat engine. No
  // Math.random fallback: a caller without a seed must fail to compile
  // rather than silently going non-deterministic.
  readonly random: () => number;
}

// Richer Scene the autosave reads — currentPosition() lets main.ts
// snapshot the player's location at any moment without scene-internal
// peeking. Plain Scene callers ignore the extra method.
//
// armPostBattleGrace() is the one-shot "skip the next encounter roll"
// hook main.ts calls after a wild/trainer battle pops back to the
// overworld scene. Matches classic Gen-2 behavior: you don't immediately
// chain into a second battle on the same tile you just landed on.
export interface OverworldScene extends Scene {
  currentPosition(): { readonly map: string; readonly x: number; readonly y: number; readonly facing: Facing };
  armPostBattleGrace(): void;
  // FLOW 1 — after a trainer battle, auto-start the just-beaten NPC's
  // follow-up line (no manual walk-up). main.ts calls this on return from a
  // trainer win, passing the trainer's winFlag (= the NPC's blockedUntilFlag).
  runNpcFollowup(winFlag: string): void;
}

export function createOverworldScene(opts: OverworldSceneOpts): OverworldScene {
  const map = getMap(opts.map);
  const rows = map.tiles.split('\n');
  const tileset = map.tilesetRef !== undefined ? getTileset(map.tilesetRef) : null;
  const tileCache = tileset ? bakeTileCache(tileset) : null;
  // Registry→engine bridge: any graybox TileDef carrying a `tileRef` (authored
  // pixel art from the asset registry) gets its tileset decoded + baked once.
  // Missing/unregistered → simply skipped (the cell falls back to its flat color,
  // never a broken tile). This same bridge is what a Tiled importer will reuse.
  type Baked = Map<string, (HTMLCanvasElement | OffscreenCanvas)[]> | null;
  const refTilesets = new Map<string, Tileset>();
  const refCaches = new Map<string, Baked>();
  const registerRef = (tilesetName: string): void => {
    if (refTilesets.has(tilesetName) || !hasTileset(tilesetName)) return;
    const rts = getTileset(tilesetName);
    refTilesets.set(tilesetName, rts);
    refCaches.set(tilesetName, bakeTileCache(rts));
  };
  // Graybox TileDef.tileRef (Hearthwick-style patches)…
  for (const key of Object.keys(map.tileset)) {
    const ref = map.tileset[key]?.tileRef;
    if (ref) registerRef(ref.tileset);
  }
  // …and the DATA-DRIVEN per-tile-id overrides (map.tileRefs, e.g. Route 31 grass).
  for (const ref of Object.values(map.tileRefs ?? {})) registerRef(ref.tileset);
  // …and the Phase-8 IMPORTED multi-layer refs (Tiled import — every tileset any
  // layer cell references).
  for (const layer of map.importedLayers ?? []) {
    for (const row of layer.tiles) for (const cell of row) if (cell) registerRef(cell.tileset);
  }
  const spawn = map.spawns[opts.spawn] ?? Object.values(map.spawns)[0]!;
  // spawnAt overrides the named-spawn lookup — used by the save/load
  // restore path to land at the exact previous position. Falls back to
  // the named spawn for normal play.
  const landAt = opts.spawnAt ?? spawn;

  let tx = landAt.x;
  let ty = landAt.y;
  let prevTx = tx;
  let prevTy = ty;
  let facing: Facing = landAt.facing;
  let moveT = 1;
  let moving = false;
  // Walk cycle: stride flips between 1 and 2 each tile crossed; idle = 0.
  // The renderer reads walkPhase (computed in draw) so the foot lifts
  // mid-step and lands flat at the end of the move.
  let stride: 1 | 2 = 1;

  type FadePhase = 'normal' | 'fadeIn' | 'fadeOut';
  let fadePhase: FadePhase = opts.startFaded ? 'fadeIn' : 'normal';
  let fadeT = opts.startFaded ? 0 : 1;
  let pendingWarp: string | null = null;
  let tick = 0;

  let dialogLines: string[] | null = null;
  let dialogPage = 0;
  const DIALOG_LINES_PER_PAGE = 3;

  let scriptQueue: ScriptCommand[] = [];
  let autoTriggersFired = false;

  // Per-direction edge + hold state for Gen-2 turn-in-place. The press
  // history lets us detect rising edges without an event-based input
  // dispatcher (the polled InputState only reports current held).
  // `turnHold[dir]` is the time remaining before a held direction
  // commits to a walk; null means we're not in a hold-pending state.
  const wasPressed: Record<Facing, boolean> = { up: false, down: false, left: false, right: false };
  const turnHold: { [K in Facing]: number | null } = { up: null, down: null, left: null, right: null };

  // One-shot: when true, the next onStepFinish skips its encounter roll.
  // main.ts arms this after a wild/trainer battle resolves so the player
  // can't chain straight into a second encounter on the very tile they
  // just landed back on.
  let skipNextEncounter = false;

  // Trainer line-of-sight cutscene (F2). Non-null while a sighted trainer
  // walks up to force its battle; freezes player input/movement until it
  // fires. `x/y` is the trainer's animated tile, `px/py` the previous tile
  // (for the lerp), `t` the 0..1 step progress, `stopX/Y` the tile adjacent
  // to the player where it halts. `alertT` holds the "!" beat first.
  const SIGHT_ALERT_SEC = 0.5;
  type NpcObj = Extract<MapObject, { type: 'npc' }>;
  let approach:
    | {
        npc: NpcObj;
        x: number;
        y: number;
        px: number;
        py: number;
        t: number;
        stopX: number;
        stopY: number;
        alertT: number;
      }
    | null = null;

  // The tile a forced/sighted trainer WALKED UP to (set when the approach
  // arrives). Persists for the scene's life so the trainer renders at the spot
  // it confronted the player from — through the dialogue, battle, and relent —
  // instead of snapping back to its map spawn tile.
  let confront: { npc: NpcObj; x: number; y: number } | null = null;

  // Begin a trainer's walk-up cutscene: the NPC paces from its tile to
  // (stopX, stopY) (adjacent to the player), then fires its interact. Used by
  // both line-of-sight (straight line) and forced-entry (greedy path).
  function startApproach(npc: NpcObj, stopX: number, stopY: number): void {
    approach = { npc, x: npc.x, y: npc.y, px: npc.x, py: npc.y, t: 1, stopX, stopY, alertT: SIGHT_ALERT_SEC };
  }

  // Scan for a sight-trainer whose straight-ahead line (along its facing,
  // unobstructed by solids/other NPCs) lands on the player's tile. Returns
  // the trainer + the tile it should stop on (adjacent to the player).
  function trainerSightingAt(playerX: number, playerY: number): {
    npc: NpcObj;
    stopX: number;
    stopY: number;
  } | null {
    for (const obj of map.objects) {
      if (obj.type !== 'npc') continue;
      if (obj.sightRange === undefined || obj.facing === undefined) continue;
      // Already defeated → its winFlag (reused as blockedUntilFlag) is set.
      if (obj.blockedUntilFlag && opts.flags.has(obj.blockedUntilFlag)) continue;
      const { dx, dy } = facingDelta(obj.facing);
      for (let step = 1; step <= obj.sightRange; step += 1) {
        const sx = obj.x + dx * step;
        const sy = obj.y + dy * step;
        if (!isWalkable(map, sx, sy)) break; // a wall blocks the sight line
        if (sx === playerX && sy === playerY) {
          return { npc: obj, stopX: obj.x + dx * (step - 1), stopY: obj.y + dy * (step - 1) };
        }
        if (npcAt(sx, sy)) break; // another NPC blocks the line of sight
      }
    }
    return null;
  }

  // The walkable tile adjacent to the player nearest `(fromX, fromY)` — where
  // a forced-entry trainer halts (so it never steps onto the player).
  function adjacentStopToward(px: number, py: number, fromX: number, fromY: number): { x: number; y: number } {
    const cands: ReadonlyArray<[number, number]> = [
      [px + 1, py],
      [px - 1, py],
      [px, py + 1],
      [px, py - 1],
    ];
    let best: { x: number; y: number } | null = null;
    let bestD = Infinity;
    for (const [cx, cy] of cands) {
      if (!isWalkable(map, cx, cy) || npcBlocksAt(cx, cy)) continue;
      const d = Math.abs(cx - fromX) + Math.abs(cy - fromY);
      if (d < bestD) {
        bestD = d;
        best = { x: cx, y: cy };
      }
    }
    return best ?? { x: px, y: py };
  }

  function updateApproach(dt: number): void {
    if (!approach) return;
    if (approach.alertT > 0) {
      approach.alertT -= dt;
      return;
    }
    const atStop = approach.x === approach.stopX && approach.y === approach.stopY;
    if (atStop && approach.t >= 1) {
      // Arrived — fire the trainer's battle script (dialog + battle). Clear
      // approach FIRST so the resumed scene (after the battle) isn't mid-cutscene.
      const npc = approach.npc;
      // Persist the WALKED-UP position so the trainer STAYS there through the
      // dialogue + battle (he's confronting you — no snap-back to his spawn
      // tile). The scene survives the battle, so this holds for the relent too.
      confront = { npc, x: approach.x, y: approach.y };
      approach = null;
      scriptQueue = [...npc.interact];
      runNextCommand();
      return;
    }
    approach.t += dt / MOVE_DURATION;
    if (approach.t >= 1) {
      if (atStop) {
        approach.t = 1; // halt; fire next tick
      } else {
        // Greedy Manhattan step toward the stop tile (x first, then y) — works
        // for a straight-line LoS approach AND a forced-entry diagonal walk.
        approach.px = approach.x;
        approach.py = approach.y;
        if (approach.x !== approach.stopX) approach.x += Math.sign(approach.stopX - approach.x);
        else if (approach.y !== approach.stopY) approach.y += Math.sign(approach.stopY - approach.y);
        approach.t = 0;
      }
    }
  }

  function openDialog(lines: readonly string[]): void {
    dialogLines = [...lines];
    dialogPage = 0;
    emitGameEvent({ kind: 'dialogue-open' }); // audio: a textbox opened (talk blip)
  }
  function advanceDialog(): void {
    if (!dialogLines) return;
    emitGameEvent({ kind: 'dialogue-advance' }); // audio: paged the conversation forward

    const totalPages = Math.max(1, Math.ceil(dialogLines.length / DIALOG_LINES_PER_PAGE));
    dialogPage += 1;
    if (dialogPage >= totalPages) {
      dialogLines = null;
      dialogPage = 0;
      runNextCommand();
    }
  }

  function runNextCommand(): void {
    while (scriptQueue.length > 0) {
      const cmd = scriptQueue.shift()!;
      if (cmd.kind === 'dialog') {
        openDialog(cmd.lines);
        return;
      }
      if (cmd.kind === 'set-flag') {
        opts.flags.set(cmd.flag);
        continue;
      }
      if (cmd.kind === 'move-player') {
        const nx = tx + cmd.dx;
        const ny = ty + cmd.dy;
        if (isWalkable(map, nx, ny)) {
          prevTx = tx;
          prevTy = ty;
          tx = nx;
          ty = ny;
          moveT = 1;
        }
        continue;
      }
      if (cmd.kind === 'warp') {
        pendingWarp = cmd.target;
        fadePhase = 'fadeOut';
        fadeT = 1;
        return;
      }
      if (cmd.kind === 'start-battle') {
        opts.onEncounter(cmd.species);
        return;
      }
      if (cmd.kind === 'start-trainer-battle') {
        opts.onTrainerBattle(cmd.foeSpecies, cmd.winFlag, cmd.reward);
        return;
      }
      if (cmd.kind === 'start-boss-battle') {
        opts.onBossBattle(cmd.bossId);
        return;
      }
      if (cmd.kind === 'if-flag') {
        if (opts.flags.has(cmd.flag)) {
          scriptQueue = [...cmd.commands, ...scriptQueue];
        }
        continue;
      }
      if (cmd.kind === 'show-starter-pick') {
        // Pass control to main.ts to push the starter-pick scene.
        // The pick handler is responsible for setting flags + popping
        // back. Maps without an onStarterPick wiring no-op silently.
        opts.onStarterPick?.();
        return;
      }
      if (cmd.kind === 'heal-party') {
        // Phase 5a Pokémon Center. Game-layer effect — main.ts
        // mutates run.party + autosaves. The script continues with
        // the next command (typically a confirmation dialog).
        opts.onHealParty?.();
        continue;
      }
      if (cmd.kind === 'open-mart') {
        // Phase 5b Poké Mart. Terminal — hand control to main.ts to
        // push the shop scene (same delegation as show-starter-pick).
        // Maps without an onOpenMart wiring no-op silently.
        opts.onOpenMart?.(cmd.stock);
        return;
      }
      if (cmd.kind === 'open-box') {
        // Phase 6.5 PC. Terminal — hand control to main.ts to push the
        // box scene (same delegation as open-mart). Maps without an
        // onOpenBox wiring no-op silently.
        opts.onOpenBox?.();
        return;
      }
      if (cmd.kind === 'give-item') {
        // Phase 7. Non-terminal — grant the item (main.ts mutates the bag
        // + autosaves), then continue the script so a follow-up dialog can
        // announce the pickup. Maps without onGiveItem no-op silently.
        opts.onGiveItem?.(cmd.itemId, cmd.qty);
        continue;
      }
      if (cmd.kind === 'start-tutorial-catch') {
        // Phase 7. Terminal — hand control to main.ts to push the guided
        // FLITPECK catch (the forgiving tutorial layer). Same delegation as
        // start-battle. Maps without onTutorialCatch no-op silently.
        opts.onTutorialCatch?.();
        return;
      }
      if (cmd.kind === 'start-rival-battle') {
        // Phase 7. Terminal — hand control to main.ts to fire the KAMON v2
        // rival fight (the Violet→Route 32 gate). Same delegation as
        // start-trainer-battle. Maps without onRivalBattle no-op silently.
        opts.onRivalBattle?.();
        return;
      }
      if (cmd.kind === 'start-rival-gate') {
        // Content era — the KAMON GATE (map-placeable). Terminal; main.ts runs
        // the 2v2 gate flow. Maps without onRivalGate no-op silently.
        opts.onRivalGate?.();
        return;
      }
    }
  }

  // Returns true if the script actually ran (so a step-on trigger can
  // pre-empt the encounter roll only when it fires). A skipped trigger —
  // requiresFlag unmet, or an already-fired `once` — returns false so the
  // caller falls through to the normal encounter roll. This is what lets a
  // one-time grass trigger (the guided catch) hand the tile BACK to random
  // encounters once it's done, instead of suppressing them forever.
  function fireScript(script: Extract<MapObject, { type: 'script' }>): boolean {
    // requiresFlag: skip-fire when the gate flag isn't set. Stops a
    // step-on trigger from burning its `flag`+`once` marker on a
    // no-op (e.g., player wanders out before picking a starter).
    if (script.requiresFlag && !opts.flags.has(script.requiresFlag)) return false;
    if (script.once && script.flag && opts.flags.has(script.flag)) return false;
    if (script.once && script.flag) opts.flags.set(script.flag);
    scriptQueue = [...script.commands];
    runNextCommand();
    return true;
  }
  function facingDelta(f: Facing): { dx: number; dy: number } {
    if (f === 'up') return { dx: 0, dy: -1 };
    if (f === 'down') return { dx: 0, dy: 1 };
    if (f === 'left') return { dx: -1, dy: 0 };
    return { dx: 1, dy: 0 };
  }

  function tryStartMove(dir: Facing): void {
    facing = dir;
    const { dx, dy } = facingDelta(dir);
    const nx = tx + dx;
    const ny = ty + dy;
    if (!isWalkable(map, nx, ny)) return;
    if (npcBlocksAt(nx, ny)) return;
    prevTx = tx;
    prevTy = ty;
    tx = nx;
    ty = ny;
    moveT = 0;
    moving = true;
  }

  // Presence gating (Phase 7) — an NPC with requiresFlag is absent until that
  // flag is set; with hiddenAfterFlag it's absent once that flag is set. Unlike
  // blockedUntilFlag (which keeps a non-blocking NPC around), an inactive NPC is
  // fully gone: not drawn, not solid, not interactable. Used by the Violet gate
  // (obstacle replaced by KAMON, KAMON gone once beaten).
  function npcActive(npc: Extract<MapObject, { type: 'npc' }>): boolean {
    if (npc.requiresFlag && !opts.flags.has(npc.requiresFlag)) return false;
    if (npc.hiddenAfterFlag && opts.flags.has(npc.hiddenAfterFlag)) return false;
    return true;
  }

  function npcAt(x: number, y: number): Extract<MapObject, { type: 'npc' }> | null {
    for (const obj of map.objects) {
      if (obj.type !== 'npc') continue;
      if (obj.x !== x || obj.y !== y) continue;
      if (!npcActive(obj)) continue; // skip a gated-away NPC (return the active one)
      return obj;
    }
    return null;
  }

  function npcBlocksAt(x: number, y: number): boolean {
    const npc = npcAt(x, y);
    if (!npc) return false;
    if (!npc.blockedUntilFlag) return true;
    return !opts.flags.has(npc.blockedUntilFlag);
  }

  function activeGusts(): Array<Extract<MapObject, { type: 'gust_pulse' }>> {
    const out: Array<Extract<MapObject, { type: 'gust_pulse' }>> = [];
    for (const obj of map.objects) {
      if (obj.type !== 'gust_pulse') continue;
      const t = (tick + (obj.phaseSec ?? 0)) % obj.periodSec;
      if (t < obj.activeSec) out.push(obj);
    }
    return out;
  }

  function gustAffecting(x: number, y: number): Extract<MapObject, { type: 'gust_pulse' }> | null {
    for (const g of activeGusts()) {
      if (x >= g.x && x < g.x + g.width && y >= g.y && y < g.y + g.height) return g;
    }
    return null;
  }

  // Gen-2 input model — distinguishes a tap from a hold.
  //
  //   * Rising edge in a direction the player isn't facing:
  //     turn immediately + start a hold timer. Released before the
  //     timer fires = pure turn (no move). Held past the timer = walk.
  //   * Rising edge in the direction already faced: walk immediately.
  //   * Steady-state hold (no rising edge this frame): walk on the
  //     same direction once any in-progress turn timer expires.
  //
  // First-pressed direction wins when multiple are held. We poll in a
  // stable up/down/left/right order so the player's input feels
  // predictable on edge cases.
  function pollMovement(dt: number): void {
    if (fadePhase !== 'normal' || dialogLines !== null) {
      // Reset edge memory while blocked so resuming play counts the
      // next press as a fresh edge (not a steady-state hold left over
      // from before a dialog).
      for (const dir of ['up', 'down', 'left', 'right'] as const) {
        wasPressed[dir] = false;
        turnHold[dir] = null;
      }
      return;
    }
    const s = opts.inputState;
    const dirs: readonly Facing[] = ['up', 'down', 'left', 'right'];
    const pressedNow: Record<Facing, boolean> = {
      up: s.pressed('up'),
      down: s.pressed('down'),
      left: s.pressed('left'),
      right: s.pressed('right'),
    };

    // First handle rising edges (turn + maybe queue a walk).
    for (const dir of dirs) {
      if (pressedNow[dir] && !wasPressed[dir]) {
        if (facing !== dir) {
          // Tap-to-turn: change facing, defer walk until hold delay.
          facing = dir;
          turnHold[dir] = TURN_HOLD_DELAY;
        } else {
          // Already facing — held in the same direction, walk now.
          turnHold[dir] = 0;
        }
      } else if (!pressedNow[dir]) {
        // Released. Any pending hold-timer is cancelled — this was a
        // turn-only tap.
        turnHold[dir] = null;
      }
      wasPressed[dir] = pressedNow[dir];
    }

    if (moving) return;

    // Tick down any active hold timers. The first direction whose
    // timer reaches zero and is still held this frame starts a move.
    for (const dir of dirs) {
      const t = turnHold[dir];
      if (t === null) continue;
      if (!pressedNow[dir]) {
        turnHold[dir] = null;
        continue;
      }
      const next = t - dt;
      if (next <= 0) {
        turnHold[dir] = null;
        tryStartMove(dir);
        return;
      }
      turnHold[dir] = next;
    }

    // Continuous hold-to-walk: no rising edge / hold timer pending,
    // but a direction is steady-held and matches the current facing.
    // Start the next step on this tick so the player walks smoothly
    // tile-by-tile while the key remains down (classic GBC feel).
    for (const dir of dirs) {
      if (pressedNow[dir] && facing === dir && turnHold[dir] === null) {
        tryStartMove(dir);
        return;
      }
    }
  }

  function onStepFinish(): void {
    // Flip the walk stride each completed tile so the next move starts
    // on the opposite foot.
    stride = stride === 1 ? 2 : 1;
    // Wind pushes happen FIRST — caught mid-pulse means you get blown back
    // before any warp / encounter resolves.
    const gust = gustAffecting(tx, ty);
    if (gust) {
      const { dx, dy } = facingDelta(gust.pushDir);
      const nx = tx + dx;
      const ny = ty + dy;
      if (isWalkable(map, nx, ny) && !npcBlocksAt(nx, ny)) {
        prevTx = tx;
        prevTy = ty;
        tx = nx;
        ty = ny;
        moveT = 0;
        moving = true;
        return;
      }
    }

    const warp = findObjectAt(map, tx, ty, 'warp') as Extract<MapObject, { type: 'warp' }> | null;
    if (warp) {
      if (isDoorAt(tx, ty)) emitGameEvent({ kind: 'door-enter' }); // audio: door blip (not route edges)
      pendingWarp = warp.target;
      fadePhase = 'fadeOut';
      fadeT = 1;
      return;
    }

    const script = stepOnScriptAt(tx, ty);
    if (script && fireScript(script)) {
      // Only pre-empt the encounter roll when the script actually fired; a
      // spent one-time trigger falls through so encounters resume on this tile.
      return;
    }

    // Trainer line-of-sight (F2): a watching trainer caught the player in
    // its sight line → walk up and force the battle (takes priority over a
    // wild encounter on this tile).
    const sighting = trainerSightingAt(tx, ty);
    if (sighting) {
      startApproach(sighting.npc, sighting.stopX, sighting.stopY);
      return;
    }

    const zone = findObjectAt(map, tx, ty, 'encounter_zone') as
      | Extract<MapObject, { type: 'encounter_zone' }>
      | null;
    // Encounters fire on a zone's grass/encounter tiles — but NOT on a path/road
    // carved THROUGH the zone rectangle. The generator stamps grass then carves the
    // winding path over it, so a rect can't exclude the road; gate on the actual
    // tile so the player crosses between grass patches encounter-free.
    if (zone && !isThoroughfareAt(tx, ty)) {
      // Post-battle grace: skip exactly one encounter roll on the very
      // first step after returning from a wild/trainer battle. Consume
      // the flag whether or not the roll would have hit — the contract
      // is "the very next step", not "the next attempted roll".
      if (skipNextEncounter) {
        skipNextEncounter = false;
      } else {
        // Seeded encounter roll (risks/gaps #2) — through opts.random (the
        // run's seeded rng) so sequences are deterministic + testable.
        const rand = opts.random;
        if (rand() < zone.rate) {
          const foe = zone.species[Math.floor(rand() * zone.species.length)]!;
          opts.onEncounter(foe);
        }
      }
    }
  }

  // A cleared path/road tile — encounters never roll here even inside a zone rect.
  // Works for both formats: data-driven cells carry the resolved tile id; graybox
  // uses the per-char tile label. (Grass / tall_grass / cave_mouth are NOT thoroughfares.)
  const THOROUGHFARE_IDS = new Set(['path', 'path_exit', 'road']);
  function isThoroughfareAt(x: number, y: number): boolean {
    if (map.cells) {
      const id = map.cells[y]?.[x];
      return id !== undefined && THOROUGHFARE_IDS.has(id);
    }
    const ch = rows[y]?.[x];
    const def = ch ? map.tileset[ch] : undefined;
    return def?.label !== undefined && THOROUGHFARE_IDS.has(def.label);
  }

  // A door tile — building doors (gym_door / academy_door / wall_door / *_door) read
  // by id (data-driven) or label (graybox). Route-EDGE warps sit on path/grass, so
  // this keeps the door sound on building entrances/exits, not seamless map edges.
  // IMPORTED (Tiled) maps carry no door-tile LABELS — their tiles live in
  // importedLayers as opaque pct_* refs. There, read the warp's explicit `door` flag
  // (set on BUILDING-entrance warps by the wiring; route/edge warps omit it), so the
  // blip fires on building doors but not on seamless route↔town edges. Graybox maps
  // never carry the flag → they keep the label path → bit-identical.
  function isDoorAt(x: number, y: number): boolean {
    const id = map.cells ? map.cells[y]?.[x] : map.tileset[rows[y]?.[x] ?? '']?.label;
    if (id !== undefined && id.includes('door')) return true;
    const w = map.objects.find((o) => o.type === 'warp' && o.x === x && o.y === y);
    return w?.type === 'warp' && w.door === true;
  }

  function stepOnScriptAt(x: number, y: number): Extract<MapObject, { type: 'script' }> | null {
    for (const obj of map.objects) {
      if (obj.type !== 'script') continue;
      if (obj.trigger !== 'step-on') continue;
      // ZONE step-on: width+height present → fire anywhere inside the rectangle
      // (one object covers a whole patch). Otherwise the legacy single-tile match.
      if (obj.width !== undefined && obj.height !== undefined) {
        if (x >= obj.x && x < obj.x + obj.width && y >= obj.y && y < obj.y + obj.height) return obj;
        continue;
      }
      if (obj.x === x && obj.y === y) return obj;
    }
    return null;
  }

  function playerPixel(): { px: number; py: number } {
    const ts = map.tilesize;
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
    const px = lerp(prevTx, tx, moveT) * ts;
    const py = lerp(prevTy, ty, moveT) * ts;
    return { px, py };
  }

  function cameraOf(playerPx: number, playerPy: number): { camX: number; camY: number } {
    const mapPxW = map.width * map.tilesize;
    const mapPxH = map.height * map.tilesize;
    const camX = Math.round(clamp(playerPx + map.tilesize / 2 - LOGICAL_W / 2, 0, Math.max(0, mapPxW - LOGICAL_W)));
    const camY = Math.round(clamp(playerPy + map.tilesize / 2 - LOGICAL_H / 2, 0, Math.max(0, mapPxH - LOGICAL_H)));
    return { camX, camY };
  }

  return {
    currentPosition() {
      return { map: opts.map, x: tx, y: ty, facing };
    },
    armPostBattleGrace() {
      skipNextEncounter = true;
    },
    runNpcFollowup(winFlag: string) {
      // Auto-start the beaten trainer's follow-up dialogue (their
      // interactAfterFlag), so story/gym trainers tell you their line the
      // moment the fight ends — no manual walk-up. No-op if the NPC has no
      // follow-up, or if a dialog/cutscene is already running.
      if (dialogLines !== null || scriptQueue.length > 0 || approach) return;
      for (const obj of map.objects) {
        if (obj.type !== 'npc' || obj.blockedUntilFlag !== winFlag) continue;
        if (obj.interactAfterFlag && obj.interactAfterFlag.length > 0) {
          scriptQueue = [...obj.interactAfterFlag];
          runNextCommand();
        }
        return;
      }
    },
    update(dt) {
      tick += dt;
      if (fadePhase === 'fadeIn') {
        fadeT += dt / FADE_DURATION;
        if (fadeT >= 1) { fadeT = 1; fadePhase = 'normal'; }
      } else if (fadePhase === 'fadeOut') {
        fadeT -= dt / FADE_DURATION;
        if (fadeT <= 0) {
          fadeT = 0;
          if (pendingWarp !== null) {
            const target = pendingWarp;
            pendingWarp = null;
            opts.onWarp(target);
            return;
          }
        }
      }

      if (fadePhase === 'normal' && !autoTriggersFired) {
        autoTriggersFired = true;
        for (const obj of map.objects) {
          if (obj.type !== 'script' || obj.trigger !== 'auto') continue;
          fireScript(obj);
          break;
        }
        // FORCED-ENTRY confrontation (JAY): once the map is in, a not-yet-
        // beaten approachOnEnter trainer walks up to the player and starts
        // its battle — unmissable, no walk-around. (Runs after auto-scripts;
        // skipped if one already opened a dialog this entry.)
        if (dialogLines === null && !approach) {
          for (const obj of map.objects) {
            if (obj.type !== 'npc' || !obj.approachOnEnter) continue;
            if (!npcActive(obj)) continue; // gated away (presence)
            if (obj.blockedUntilFlag && opts.flags.has(obj.blockedUntilFlag)) continue; // already beaten
            const stop = adjacentStopToward(tx, ty, obj.x, obj.y);
            startApproach(obj, stop.x, stop.y);
            break;
          }
        }
      }

      // Trainer line-of-sight cutscene takes over: the trainer walks up and
      // fires its battle. Player movement/input is frozen until it resolves.
      if (approach && fadePhase === 'normal') {
        updateApproach(dt);
        return;
      }

      if (moving) {
        moveT += dt / MOVE_DURATION;
        if (moveT >= 1) {
          moveT = 1;
          moving = false;
          onStepFinish();
        }
      }
      pollMovement(dt);
    },

    input(key: InputKey) {
      if (dialogLines !== null) {
        if (key === 'a' || key === 'b' || key === 'start') advanceDialog();
        return;
      }
      // Frozen during a trainer's line-of-sight approach — no input until the
      // forced battle fires.
      if (approach) return;
      if (fadePhase !== 'normal') return;
      if (key === 'start' && opts.onPauseMenu) {
        // Phase 4: START opens the pause menu when wired. No-op when
        // not wired (combat-only test hooks).
        opts.onPauseMenu();
        return;
      }
      if (key === 'a') {
        const { dx, dy } = facingDelta(facing);
        const fx = tx + dx;
        const fy = ty + dy;
        const npc = npcAt(fx, fy);
        if (npc) {
          const cmds =
            npc.blockedUntilFlag && opts.flags.has(npc.blockedUntilFlag) && npc.interactAfterFlag
              ? npc.interactAfterFlag
              : npc.interact;
          scriptQueue = [...cmds];
          runNextCommand();
          return;
        }
        const sign = findObjectAt(map, fx, fy, 'sign') as
          | Extract<MapObject, { type: 'sign' }>
          | null;
        if (sign) {
          openDialog(sign.lines);
          return;
        }
      }
    },

    draw(ctx) {
      const { px, py } = playerPixel();
      const { camX, camY } = cameraOf(px, py);

      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

      if (map.importedLayers !== undefined) {
        // Phase-8 Tiled import: draw the BELOW-player layers (bottom→top); the
        // Overhead layers draw AFTER the player (walk-behind) — see below.
        drawImportedLayers(ctx, map, refTilesets, refCaches, camX, camY, tick, false);
      } else if (map.cells !== undefined && tileset !== null) {
        drawTilesetCells(ctx, map, tileset, tileCache, camX, camY, tick, refTilesets, refCaches);
      } else {
        drawTiles(ctx, map, rows, camX, camY, refTilesets, refCaches, tick);
      }
      // Layer 1 — fringe overlay (decals / ledges / edge decoration): above the
      // base, below props + player.
      if (map.fringe !== undefined && tileset !== null) {
        drawFringeCells(ctx, map, tileset, tileCache, camX, camY, tick);
      }
      const gustState = drawGustOverlay(ctx, map, camX, camY, tick);
      // The confronting trainer is drawn separately (mid-walk-up OR parked at
      // its walked-up tile), so skip its static marker to avoid a double-draw
      // back at its spawn tile.
      const confrontingNpc = approach?.npc ?? confront?.npc;
      drawObjectMarkers(ctx, map, camX, camY, opts.flags, tick, confrontingNpc);
      // Phase-8 import: carried-through named markers (npc_*/warp_*), drawn as a
      // labelled placeholder until the wiring layer resolves each name to a real def.
      if (map.importedObjects !== undefined) drawImportedObjectMarkers(ctx, map, camX, camY);
      const ts = map.tilesize;
      if (approach) {
        // Walking up on sight/entry: draw at its animated tile + an "!".
        const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
        const ax = lerp(approach.px, approach.x, approach.t) * ts - camX;
        const ay = lerp(approach.py, approach.y, approach.t) * ts - camY;
        ctx.fillStyle = approach.npc.color ?? '#d22f2f';
        ctx.fillRect(ax + 3, ay + 3, ts - 6, ts - 6);
        ctx.strokeStyle = '#1d1d28';
        ctx.lineWidth = 1;
        ctx.strokeRect(ax + 3.5, ay + 3.5, ts - 7, ts - 7);
        if (approach.alertT > 0) {
          drawText(ctx, '!', ax + ts / 2 - 1, ay - 7, PALETTE.hpCrit);
        }
      } else if (confront) {
        // Arrived — STAYS at the walked-up tile through the dialogue + battle
        // (+ relent), no snap-back to spawn.
        const cx = confront.x * ts - camX;
        const cy = confront.y * ts - camY;
        ctx.fillStyle = confront.npc.color ?? '#d22f2f';
        ctx.fillRect(cx + 3, cy + 3, ts - 6, ts - 6);
        ctx.strokeStyle = '#1d1d28';
        ctx.lineWidth = 1;
        ctx.strokeRect(cx + 3.5, cy + 3.5, ts - 7, ts - 7);
      }
      // Walk phase: idle (0) when standing; otherwise the current stride
      // foot lifts for the middle 60% of the move and lands flat at the
      // ends, so steps "land" visually instead of hovering.
      const walkPhase: 0 | 1 | 2 = !moving
        ? 0
        : moveT > 0.2 && moveT < 0.8
          ? stride
          : 0;
      // Layer 2 — Y-sorted depth pass: interleave the player with the props by
      // base-Y so the player walks BEHIND tree-tops/roofs (occluded) when north
      // of their base, and IN FRONT when south. No props → player draws as before.
      const drawPlayerSprite = (): void =>
        drawPlayer(ctx, px - camX, py - camY, map.tilesize, facing, walkPhase);
      if (map.props !== undefined && map.props.length > 0 && tileset !== null) {
        type Drawable = { readonly sortY: number; readonly render: () => void };
        const layer2: Drawable[] = [
          { sortY: py + ts, render: drawPlayerSprite },
          ...map.props.map(
            (p): Drawable => ({
              sortY: p.sortY,
              render: () => drawPropCells(ctx, p, tileset, tileCache, camX, camY, tick),
            }),
          ),
        ];
        for (const d of ySortOrder(layer2)) d.render();
      } else {
        drawPlayerSprite();
      }

      // Phase-8 import: the OVERHEAD layers draw AFTER the player → tree-tops/roofs
      // occlude the player (walk-behind). Non-overhead imported layers already drew
      // below, before the player.
      if (map.importedLayers !== undefined) {
        drawImportedLayers(ctx, map, refTilesets, refCaches, camX, camY, tick, true);
      }

      ctx.fillStyle = 'rgba(32, 32, 44, 0.85)';
      ctx.fillRect(0, 0, LOGICAL_W, 10);
      drawText(ctx, `${map.name}  (${tx},${ty}) facing ${facing}`, 3, 1, PALETTE.paper);

      if (gustState.active || gustState.telegraph) {
        ctx.fillStyle = gustState.active ? 'rgba(80,140,210,0.85)' : 'rgba(80,140,210,0.5)';
        ctx.fillRect(0, 10, LOGICAL_W, 10);
        drawText(
          ctx,
          gustState.active ? 'GUST!  the wind blows you back' : 'the wind is rising…',
          4,
          11,
          PALETTE.paper,
        );
      }

      if (fadeT < 1) {
        ctx.fillStyle = `rgba(0,0,0,${1 - fadeT})`;
        ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
      }

      if (dialogLines !== null) {
        const startIdx = dialogPage * DIALOG_LINES_PER_PAGE;
        const slice = dialogLines.slice(startIdx, startIdx + DIALOG_LINES_PER_PAGE);
        drawDialog(ctx, slice, tick);
      }
    },
  };
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function drawDialog(
  ctx: CanvasRenderingContext2D,
  lines: readonly string[],
  tick: number,
): void {
  const x = 2;
  const y = LOGICAL_H - 50;
  const w = LOGICAL_W - 4;
  const h = 48;
  drawPanel(ctx, x, y, w, h);
  for (let i = 0; i < lines.length; i += 1) {
    drawText(ctx, lines[i]!, x + 8, y + 8 + i * 12);
  }
  if (Math.floor(tick * 2) % 2 === 0) {
    drawText(ctx, '▼', x + w - 14, y + h - 12, PALETTE.ink);
  }
}

function drawTiles(
  ctx: CanvasRenderingContext2D,
  map: MapData,
  rows: readonly string[],
  camX: number,
  camY: number,
  refTilesets: Map<string, Tileset>,
  refCaches: Map<string, Map<string, (HTMLCanvasElement | OffscreenCanvas)[]> | null>,
  tick: number,
): void {
  const ts = map.tilesize;
  const minX = Math.max(0, Math.floor(camX / ts));
  const maxX = Math.min(map.width, Math.ceil((camX + LOGICAL_W) / ts) + 1);
  const minY = Math.max(0, Math.floor(camY / ts));
  const maxY = Math.min(map.height, Math.ceil((camY + LOGICAL_H) / ts) + 1);
  for (let y = minY; y < maxY; y += 1) {
    const row = rows[y] ?? '';
    for (let x = minX; x < maxX; x += 1) {
      const ch = row[x];
      const def = ch ? map.tileset[ch] : null;
      if (!def) continue;
      const sx = x * ts - camX;
      const sy = y * ts - camY;
      // Registry pixel tile, if this cell opts in and the asset resolved.
      const ref = def.tileRef;
      if (ref) {
        const rts = refTilesets.get(ref.tileset);
        if (rts && rts.tiles[ref.tile]) {
          drawOneTile(ctx, rts, refCaches.get(ref.tileset) ?? null, ref.tile, sx, sy, tick);
          continue;
        }
      }
      ctx.fillStyle = def.color; // flat-color fallback (graybox default)
      ctx.fillRect(sx, sy, ts, ts);
    }
  }
}

// Pre-bake each tile to an OffscreenCanvas / canvas at load time so the
// per-frame render is one drawImage per visible tile. Without this, the
// data-driven path would fillRect each pixel (~60k/frame for a 20×15
// map) and stutter immediately. Falls back gracefully — if neither
// OffscreenCanvas nor document is available (tests), returns null and
// drawTilesetCells per-pixel-fills instead.
// Bake every tile's every FRAME to a canvas. Cache value is the array of
// frame canvases (length 1 for a static tile); drawTilesetCells indexes
// it by the animated frame number. Returns null (per-pixel fallback) when
// no canvas backend exists (tests).
function bakeTileCache(
  tileset: Tileset,
): Map<string, (HTMLCanvasElement | OffscreenCanvas)[]> | null {
  const hasDom = typeof document !== 'undefined' || typeof OffscreenCanvas !== 'undefined';
  if (!hasDom) return null;
  const cache = new Map<string, (HTMLCanvasElement | OffscreenCanvas)[]>();
  const ts = tileset.tilesize;
  for (const id of Object.keys(tileset.tiles)) {
    const tile = tileset.tiles[id]!;
    const baked: (HTMLCanvasElement | OffscreenCanvas)[] = [];
    for (const frame of tile.frames) {
      const c: HTMLCanvasElement | OffscreenCanvas =
        typeof OffscreenCanvas !== 'undefined'
          ? new OffscreenCanvas(ts, ts)
          : Object.assign(document.createElement('canvas'), { width: ts, height: ts });
      const cctx = (c as HTMLCanvasElement).getContext('2d') as CanvasRenderingContext2D | null;
      if (!cctx) continue;
      cctx.imageSmoothingEnabled = false;
      for (let py = 0; py < ts; py += 1) {
        for (let px = 0; px < ts; px += 1) {
          const color = frame[py * ts + px];
          if (color === null || color === undefined) continue;
          cctx.fillStyle = color;
          cctx.fillRect(px, py, 1, 1);
        }
      }
      baked.push(c);
    }
    cache.set(id, baked);
  }
  return cache;
}

// Which frame of an animated tile is showing at time `tick`.
function frameIndex(tile: Tile, tick: number): number {
  const n = tile.frames.length;
  if (n <= 1) return 0;
  return Math.floor(tick * tile.fps) % n;
}

function drawTilesetCells(
  ctx: CanvasRenderingContext2D,
  map: MapData,
  tileset: Tileset,
  cache: Map<string, (HTMLCanvasElement | OffscreenCanvas)[]> | null,
  camX: number,
  camY: number,
  tick: number,
  refTilesets: Map<string, Tileset>,
  refCaches: Map<string, Map<string, (HTMLCanvasElement | OffscreenCanvas)[]> | null>,
): void {
  const ts = map.tilesize;
  const minX = Math.max(0, Math.floor(camX / ts));
  const maxX = Math.min(map.width, Math.ceil((camX + LOGICAL_W) / ts) + 1);
  const minY = Math.max(0, Math.floor(camY / ts));
  const maxY = Math.min(map.height, Math.ceil((camY + LOGICAL_H) / ts) + 1);
  const cells = map.cells!;
  for (let y = minY; y < maxY; y += 1) {
    const row = cells[y]!;
    for (let x = minX; x < maxX; x += 1) {
      const id = row[x];
      if (id === undefined) continue;
      // Registry override: draw an authored registry tile for this base id if mapped.
      const ref = map.tileRefs?.[id];
      if (ref) {
        const rts = refTilesets.get(ref.tileset);
        if (rts && rts.tiles[ref.tile]) {
          drawOneTile(ctx, rts, refCaches.get(ref.tileset) ?? null, ref.tile, x * ts - camX, y * ts - camY, tick);
          continue;
        }
      }
      const tile = tileset.tiles[id];
      if (!tile) continue;
      const f = frameIndex(tile, tick);
      const baked = cache?.get(id);
      if (baked && baked.length > 0) {
        ctx.drawImage((baked[f] ?? baked[0]) as CanvasImageSource, x * ts - camX, y * ts - camY);
      } else {
        drawTilePixels(ctx, tile.frames[f] ?? tile.pixels, x * ts - camX, y * ts - camY, ts);
      }
    }
  }
}

// Draw a single tile id at a screen position (baked bitmap, or per-pixel
// fallback in tests). Shared by the fringe + prop layers.
function drawOneTile(
  ctx: CanvasRenderingContext2D,
  tileset: Tileset,
  cache: Map<string, (HTMLCanvasElement | OffscreenCanvas)[]> | null,
  id: string,
  sx: number,
  sy: number,
  tick: number,
): void {
  const tile = tileset.tiles[id];
  if (!tile) return;
  const f = frameIndex(tile, tick);
  const baked = cache?.get(id);
  if (baked && baked.length > 0) {
    ctx.drawImage((baked[f] ?? baked[0]) as CanvasImageSource, sx, sy);
  } else {
    drawTilePixels(ctx, tile.frames[f] ?? tile.pixels, sx, sy, tileset.tilesize);
  }
}

// Layer 1 — fringe overlay grid (transparent where null). Same viewport cull as
// the base layer; drawn over the base, under props/player.
function drawFringeCells(
  ctx: CanvasRenderingContext2D,
  map: MapData,
  tileset: Tileset,
  cache: Map<string, (HTMLCanvasElement | OffscreenCanvas)[]> | null,
  camX: number,
  camY: number,
  tick: number,
): void {
  const ts = map.tilesize;
  const fringe = map.fringe!;
  const minX = Math.max(0, Math.floor(camX / ts));
  const maxX = Math.min(map.width, Math.ceil((camX + LOGICAL_W) / ts) + 1);
  const minY = Math.max(0, Math.floor(camY / ts));
  const maxY = Math.min(map.height, Math.ceil((camY + LOGICAL_H) / ts) + 1);
  for (let y = minY; y < maxY; y += 1) {
    const row = fringe[y];
    if (!row) continue;
    for (let x = minX; x < maxX; x += 1) {
      const id = row[x];
      if (id === null || id === undefined) continue;
      drawOneTile(ctx, tileset, cache, id, x * ts - camX, y * ts - camY, tick);
    }
  }
}

// Layer 2 — draw one prop's cells (already in world tile coords). Off-screen
// cells are culled. Called in the Y-sorted depth pass.
function drawPropCells(
  ctx: CanvasRenderingContext2D,
  prop: PlacedProp,
  tileset: Tileset,
  cache: Map<string, (HTMLCanvasElement | OffscreenCanvas)[]> | null,
  camX: number,
  camY: number,
  tick: number,
): void {
  const ts = tileset.tilesize;
  for (const c of prop.cells) {
    const sx = c.tx * ts - camX;
    const sy = c.ty * ts - camY;
    if (sx <= -ts || sy <= -ts || sx >= LOGICAL_W || sy >= LOGICAL_H) continue;
    drawOneTile(ctx, tileset, cache, c.tile, sx, sy, tick);
  }
}

// Phase-8 Tiled import: draw the ordered registry-ref layers bottom→top. Each
// non-null cell resolves its tileset from refTilesets and reuses the SAME verified
// per-tile draw (drawOneTile → baked bitmap / per-pixel fallback) as live maps.
// Same viewport cull as the base layer; an unregistered/empty cell is skipped.
function drawImportedLayers(
  ctx: CanvasRenderingContext2D,
  map: MapData,
  refTilesets: Map<string, Tileset>,
  refCaches: Map<string, Map<string, (HTMLCanvasElement | OffscreenCanvas)[]> | null>,
  camX: number,
  camY: number,
  tick: number,
  overhead: boolean,
): void {
  const ts = map.tilesize;
  const minX = Math.max(0, Math.floor(camX / ts));
  const maxX = Math.min(map.width, Math.ceil((camX + LOGICAL_W) / ts) + 1);
  const minY = Math.max(0, Math.floor(camY / ts));
  const maxY = Math.min(map.height, Math.ceil((camY + LOGICAL_H) / ts) + 1);
  for (const layer of map.importedLayers!) {
    if ((layer.overhead ?? false) !== overhead) continue; // below-player vs above-player pass
    for (let y = minY; y < maxY; y += 1) {
      const row = layer.tiles[y];
      if (!row) continue;
      for (let x = minX; x < maxX; x += 1) {
        const ref = row[x];
        if (!ref) continue;
        const rts = refTilesets.get(ref.tileset);
        if (!rts || !rts.tiles[ref.tile]) continue; // unregistered/missing → empty
        drawOneTile(ctx, rts, refCaches.get(ref.tileset) ?? null, ref.tile, x * ts - camX, y * ts - camY, tick);
      }
    }
  }
}

// Phase-8 import: a carried-through named marker (npc_*/warp_*). Placeholder box +
// name label — the wiring layer (later) resolves the name to a real NPC/warp def.
function drawImportedObjectMarkers(
  ctx: CanvasRenderingContext2D,
  map: MapData,
  camX: number,
  camY: number,
): void {
  const ts = map.tilesize;
  for (const obj of map.importedObjects!) {
    const sx = obj.x * ts - camX;
    const sy = obj.y * ts - camY;
    if (sx <= -ts || sy <= -ts || sx >= LOGICAL_W || sy >= LOGICAL_H) continue;
    const warp = obj.name.startsWith('warp');
    ctx.strokeStyle = warp ? PALETTE.star : PALETTE.hpCrit;
    ctx.lineWidth = 1;
    ctx.strokeRect(sx + 1.5, sy + 1.5, ts - 3, ts - 3);
    drawText(ctx, obj.name, sx, sy - 7, warp ? PALETTE.star : PALETTE.hpCrit);
  }
}

function drawTilePixels(
  ctx: CanvasRenderingContext2D,
  pixels: ReadonlyArray<string | null>,
  ox: number,
  oy: number,
  ts: number,
): void {
  for (let py = 0; py < ts; py += 1) {
    for (let px = 0; px < ts; px += 1) {
      const color = pixels[py * ts + px];
      if (color === null || color === undefined) continue;
      ctx.fillStyle = color;
      ctx.fillRect(ox + px, oy + py, 1, 1);
    }
  }
}

// A warp tile reads as a bare floor/path tile unless we mark it — a
// player can't use an exit they can't see (BUG 1). Draw a pulsing
// directional arrow pointing the way out: down/up/left/right for an
// edge exit, up (into the doorway) for an interior door.
function drawWarpMarker(
  ctx: CanvasRenderingContext2D,
  map: MapData,
  obj: Extract<MapObject, { type: 'warp' }>,
  camX: number,
  camY: number,
  tick: number,
): void {
  const ts = map.tilesize;
  const cx = obj.x * ts - camX;
  const cy = obj.y * ts - camY;
  // Direction from the tile's position on the map.
  let glyph = '▴';
  if (obj.y >= map.height - 2) glyph = '▾';
  else if (obj.y <= 1) glyph = '▴';
  else if (obj.x <= 1) glyph = '◂';
  else if (obj.x >= map.width - 2) glyph = '▸';
  // Pulse so the eye is drawn to it; never fully off so it stays legible.
  const pulse = 0.55 + 0.45 * (0.5 + 0.5 * Math.sin(tick * 4));
  ctx.save();
  ctx.globalAlpha = pulse;
  ctx.fillStyle = '#fff4c2';
  ctx.font = '8px monospace';
  ctx.textBaseline = 'top';
  ctx.textAlign = 'center';
  ctx.fillText(glyph, cx + ts / 2, cy + ts / 2 - 4);
  ctx.restore();
  ctx.textAlign = 'start';
}

function drawObjectMarkers(
  ctx: CanvasRenderingContext2D,
  map: MapData,
  camX: number,
  camY: number,
  flags: FlagStore,
  tick: number,
  skipNpc?: MapObject,
): void {
  const ts = map.tilesize;
  for (const obj of map.objects) {
    if (skipNpc && obj === skipNpc) continue; // drawn separately (mid-approach)
    // Presence gating (Phase 7) — don't draw an NPC that's gated away.
    if (obj.type === 'npc') {
      if (obj.requiresFlag && !flags.has(obj.requiresFlag)) continue;
      if (obj.hiddenAfterFlag && flags.has(obj.hiddenAfterFlag)) continue;
    }
    if (obj.type === 'sign') {
      ctx.fillStyle = '#ffd700';
      ctx.fillRect(obj.x * ts - camX + ts / 2 - 1, obj.y * ts - camY + 2, 2, 4);
    } else if (obj.type === 'warp') {
      drawWarpMarker(ctx, map, obj, camX, camY, tick);
    } else if (obj.type === 'encounter_zone') {
      void obj;
    } else if (obj.type === 'npc') {
      if (obj.sprite) {
        // Phase 7: render as a species overworld sprite (placeholder when
        // no art) so the player can SEE it — e.g. a lost mon in the grass.
        drawSpeciesInSlot(
          ctx,
          { name: obj.sprite, type: (obj.spriteType ?? null) as ElementType | null },
          obj.x * ts - camX,
          obj.y * ts - camY,
          { slotSize: ts },
        );
        continue;
      }
      const beaten = obj.blockedUntilFlag ? flags.has(obj.blockedUntilFlag) : false;
      const color = beaten ? '#777' : obj.color ?? '#d22f2f';
      const px = obj.x * ts - camX + 3;
      const py = obj.y * ts - camY + 3;
      ctx.fillStyle = color;
      ctx.fillRect(px, py, ts - 6, ts - 6);
      ctx.strokeStyle = '#1d1d28';
      ctx.lineWidth = 1;
      ctx.strokeRect(px + 0.5, py + 0.5, ts - 7, ts - 7);
    }
  }
}

function drawGustOverlay(
  ctx: CanvasRenderingContext2D,
  map: MapData,
  camX: number,
  camY: number,
  tick: number,
): { telegraph: boolean; active: boolean } {
  const ts = map.tilesize;
  let active = false;
  let telegraph = false;
  for (const obj of map.objects) {
    if (obj.type !== 'gust_pulse') continue;
    const t = (tick + (obj.phaseSec ?? 0)) % obj.periodSec;
    const isActive = t < obj.activeSec;
    const isWarning = !isActive && t > obj.periodSec - 0.6;
    if (isActive) active = true;
    if (isWarning) telegraph = true;
    for (let y = obj.y; y < obj.y + obj.height; y += 1) {
      for (let x = obj.x; x < obj.x + obj.width; x += 1) {
        if (isActive) {
          ctx.fillStyle = 'rgba(150, 200, 255, 0.55)';
          ctx.fillRect(x * ts - camX, y * ts - camY, ts, ts);
          // Direction streaks
          ctx.fillStyle = 'rgba(220, 240, 255, 0.9)';
          const dy = obj.pushDir === 'down' ? 1 : obj.pushDir === 'up' ? -1 : 0;
          const dx = obj.pushDir === 'right' ? 1 : obj.pushDir === 'left' ? -1 : 0;
          for (let i = 0; i < 3; i += 1) {
            const ox = x * ts - camX + 4 + (Math.floor(tick * 30 + i * 5) % (ts - 8));
            const oy = y * ts - camY + ts / 2 - 1;
            ctx.fillRect(ox + dx * i, oy + dy * 2, 3, 1);
          }
        } else if (isWarning) {
          ctx.fillStyle = 'rgba(150, 200, 255, 0.18)';
          ctx.fillRect(x * ts - camX, y * ts - camY, ts, ts);
        }
      }
    }
  }
  return { telegraph, active };
}

// 3-frame walk cycle: 0 = idle (legs together), 1 = left-step, 2 = right-step.
// Caller passes `walkPhase` derived from movement time so the legs swap
// each tile crossed. PLACEHOLDER programmatic art — replace with sprite
// sheet once the real character asset lands (drop a 16×48 spritesheet
// JSON in the same format the tileset uses and read frames by id).
function drawPlayer(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  ts: number,
  facing: Facing,
  walkPhase: 0 | 1 | 2,
): void {
  // Head
  const headInset = 3;
  const headH = 6;
  ctx.fillStyle = '#f2c79a';
  ctx.fillRect(px + headInset, py + 1, ts - 2 * headInset, headH);
  ctx.strokeStyle = '#1d1d28';
  ctx.lineWidth = 1;
  ctx.strokeRect(px + headInset + 0.5, py + 1 + 0.5, ts - 2 * headInset - 1, headH - 1);

  // Body / shirt
  ctx.fillStyle = '#d22f2f';
  ctx.fillRect(px + 3, py + 7, ts - 6, 5);
  ctx.strokeRect(px + 3 + 0.5, py + 7 + 0.5, ts - 6 - 1, 5 - 1);

  // Legs (walk cycle): two legs side-by-side, alternating Y offset by 1px.
  const legW = 3;
  const legY = py + 12;
  // Leg offsets in pixels per phase. Idle = both grounded.
  let lOff = 0;
  let rOff = 0;
  if (walkPhase === 1) lOff = -1; // left foot up
  else if (walkPhase === 2) rOff = -1; // right foot up
  ctx.fillStyle = '#3a3a4a';
  ctx.fillRect(px + 4, legY + lOff, legW, 3);
  ctx.fillRect(px + ts - 4 - legW, legY + rOff, legW, 3);

  // Eyes facing direction — placed on the head.
  ctx.fillStyle = '#1d1d28';
  const eye = 1;
  if (facing === 'up') {
    // back of head — no eyes visible
    ctx.fillRect(px + 6, py + 3, ts - 12, 1); // hair line
  } else if (facing === 'down') {
    ctx.fillRect(px + 6, py + 4, eye, 2);
    ctx.fillRect(px + ts - 6 - eye, py + 4, eye, 2);
  } else if (facing === 'left') {
    ctx.fillRect(px + 4, py + 4, eye, 2);
  } else {
    ctx.fillRect(px + ts - 4 - eye, py + 4, eye, 2);
  }
}
