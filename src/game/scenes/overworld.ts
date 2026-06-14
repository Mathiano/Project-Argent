import { LOGICAL_H, LOGICAL_W } from '../canvas';
import type { InputState } from '../input';
import { getMap } from '../overworld/maps';
import type { Tile, Tileset } from '../overworld/tileset';
import { getTileset } from '../overworld/tilesetCatalog';
import type { Facing, MapData, MapObject, ScriptCommand } from '../overworld/types';
import { findObjectAt, isWalkable } from '../overworld/types';
import { PALETTE } from '../palette';
import type { InputKey, Scene } from '../scene';
import { drawPanel, drawText } from '../ui';

const MOVE_DURATION = 0.18;
const FADE_DURATION = 0.25;

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
  readonly onWarp: (target: string) => void;
  readonly onEncounter: (foeSpecies: string) => void;
  readonly onTrainerBattle: (foeSpecies: string | readonly string[], winFlag: string) => void;
  readonly onBossBattle: (bossId: string) => void;
}

export function createOverworldScene(opts: OverworldSceneOpts): Scene {
  const map = getMap(opts.map);
  const rows = map.tiles.split('\n');
  const tileset = map.tilesetRef !== undefined ? getTileset(map.tilesetRef) : null;
  const tileCache = tileset ? bakeTileCache(tileset) : null;
  const spawn = map.spawns[opts.spawn] ?? Object.values(map.spawns)[0]!;

  let tx = spawn.x;
  let ty = spawn.y;
  let prevTx = tx;
  let prevTy = ty;
  let facing: Facing = spawn.facing;
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

  function openDialog(lines: readonly string[]): void {
    dialogLines = [...lines];
    dialogPage = 0;
  }
  function advanceDialog(): void {
    if (!dialogLines) return;
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
        opts.onTrainerBattle(cmd.foeSpecies, cmd.winFlag);
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
    }
  }

  function fireScript(script: Extract<MapObject, { type: 'script' }>): void {
    if (script.once && script.flag && opts.flags.has(script.flag)) return;
    if (script.once && script.flag) opts.flags.set(script.flag);
    scriptQueue = [...script.commands];
    runNextCommand();
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

  function npcAt(x: number, y: number): Extract<MapObject, { type: 'npc' }> | null {
    for (const obj of map.objects) {
      if (obj.type !== 'npc') continue;
      if (obj.x === x && obj.y === y) return obj;
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

  function pollMovement(): void {
    if (moving || fadePhase !== 'normal' || dialogLines !== null) return;
    const s = opts.inputState;
    if (s.pressed('up')) tryStartMove('up');
    else if (s.pressed('down')) tryStartMove('down');
    else if (s.pressed('left')) tryStartMove('left');
    else if (s.pressed('right')) tryStartMove('right');
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
      pendingWarp = warp.target;
      fadePhase = 'fadeOut';
      fadeT = 1;
      return;
    }

    const script = stepOnScriptAt(tx, ty);
    if (script) {
      fireScript(script);
      return;
    }

    const zone = findObjectAt(map, tx, ty, 'encounter_zone') as
      | Extract<MapObject, { type: 'encounter_zone' }>
      | null;
    if (zone && Math.random() < zone.rate) {
      const foe = zone.species[Math.floor(Math.random() * zone.species.length)]!;
      opts.onEncounter(foe);
    }
  }

  function stepOnScriptAt(x: number, y: number): Extract<MapObject, { type: 'script' }> | null {
    for (const obj of map.objects) {
      if (obj.type !== 'script') continue;
      if (obj.trigger !== 'step-on') continue;
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
      }

      if (moving) {
        moveT += dt / MOVE_DURATION;
        if (moveT >= 1) {
          moveT = 1;
          moving = false;
          onStepFinish();
        }
      }
      pollMovement();
    },

    input(key: InputKey) {
      if (dialogLines !== null) {
        if (key === 'a' || key === 'b' || key === 'start') advanceDialog();
        return;
      }
      if (fadePhase !== 'normal') return;
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

      if (map.cells !== undefined && tileset !== null) {
        drawTilesetCells(ctx, map, tileset, tileCache, camX, camY);
      } else {
        drawTiles(ctx, map, rows, camX, camY);
      }
      const gustState = drawGustOverlay(ctx, map, camX, camY, tick);
      drawObjectMarkers(ctx, map, camX, camY, opts.flags);
      // Walk phase: idle (0) when standing; otherwise the current stride
      // foot lifts for the middle 60% of the move and lands flat at the
      // ends, so steps "land" visually instead of hovering.
      const walkPhase: 0 | 1 | 2 = !moving
        ? 0
        : moveT > 0.2 && moveT < 0.8
          ? stride
          : 0;
      drawPlayer(ctx, px - camX, py - camY, map.tilesize, facing, walkPhase);

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
      ctx.fillStyle = def.color;
      ctx.fillRect(x * ts - camX, y * ts - camY, ts, ts);
    }
  }
}

// Pre-bake each tile to an OffscreenCanvas / canvas at load time so the
// per-frame render is one drawImage per visible tile. Without this, the
// data-driven path would fillRect each pixel (~60k/frame for a 20×15
// map) and stutter immediately. Falls back gracefully — if neither
// OffscreenCanvas nor document is available (tests), returns null and
// drawTilesetCells per-pixel-fills instead.
function bakeTileCache(
  tileset: Tileset,
): Map<string, HTMLCanvasElement | OffscreenCanvas> | null {
  const hasDom = typeof document !== 'undefined' || typeof OffscreenCanvas !== 'undefined';
  if (!hasDom) return null;
  const cache = new Map<string, HTMLCanvasElement | OffscreenCanvas>();
  const ts = tileset.tilesize;
  for (const id of Object.keys(tileset.tiles)) {
    const tile = tileset.tiles[id]!;
    const c: HTMLCanvasElement | OffscreenCanvas =
      typeof OffscreenCanvas !== 'undefined'
        ? new OffscreenCanvas(ts, ts)
        : Object.assign(document.createElement('canvas'), { width: ts, height: ts });
    const cctx = (c as HTMLCanvasElement).getContext('2d') as CanvasRenderingContext2D | null;
    if (!cctx) continue;
    cctx.imageSmoothingEnabled = false;
    for (let py = 0; py < ts; py += 1) {
      for (let px = 0; px < ts; px += 1) {
        const color = tile.pixels[py * ts + px];
        if (color === null || color === undefined) continue;
        cctx.fillStyle = color;
        cctx.fillRect(px, py, 1, 1);
      }
    }
    cache.set(id, c);
  }
  return cache;
}

function drawTilesetCells(
  ctx: CanvasRenderingContext2D,
  map: MapData,
  tileset: Tileset,
  cache: Map<string, HTMLCanvasElement | OffscreenCanvas> | null,
  camX: number,
  camY: number,
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
      const tile = tileset.tiles[id];
      if (!tile) continue;
      const baked = cache?.get(id);
      if (baked) {
        ctx.drawImage(baked as CanvasImageSource, x * ts - camX, y * ts - camY);
      } else {
        drawTilePixels(ctx, tile, x * ts - camX, y * ts - camY, ts);
      }
    }
  }
}

function drawTilePixels(
  ctx: CanvasRenderingContext2D,
  tile: Tile,
  ox: number,
  oy: number,
  ts: number,
): void {
  for (let py = 0; py < ts; py += 1) {
    for (let px = 0; px < ts; px += 1) {
      const color = tile.pixels[py * ts + px];
      if (color === null || color === undefined) continue;
      ctx.fillStyle = color;
      ctx.fillRect(ox + px, oy + py, 1, 1);
    }
  }
}

function drawObjectMarkers(
  ctx: CanvasRenderingContext2D,
  map: MapData,
  camX: number,
  camY: number,
  flags: FlagStore,
): void {
  const ts = map.tilesize;
  for (const obj of map.objects) {
    if (obj.type === 'sign') {
      ctx.fillStyle = '#ffd700';
      ctx.fillRect(obj.x * ts - camX + ts / 2 - 1, obj.y * ts - camY + 2, 2, 4);
    } else if (obj.type === 'warp' || obj.type === 'encounter_zone') {
      void obj;
    } else if (obj.type === 'npc') {
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
