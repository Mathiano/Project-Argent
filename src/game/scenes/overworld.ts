import { LOGICAL_H, LOGICAL_W } from '../canvas';
import type { InputState } from '../input';
import { getMap } from '../overworld/maps';
import type { Facing, MapData, MapObject } from '../overworld/types';
import { findObjectAt, isWalkable } from '../overworld/types';
import { PALETTE } from '../palette';
import type { InputKey, Scene } from '../scene';
import { drawPanel, drawText } from '../ui';

const MOVE_DURATION = 0.18;
const FADE_DURATION = 0.25;

export interface OverworldSceneOpts {
  readonly map: string;
  readonly spawn: string;
  readonly inputState: InputState;
  readonly startFaded?: boolean;
  readonly onWarp: (target: string) => void;
}

export function createOverworldScene(opts: OverworldSceneOpts): Scene {
  const map = getMap(opts.map);
  const rows = map.tiles.split('\n');
  const spawn = map.spawns[opts.spawn] ?? Object.values(map.spawns)[0]!;

  let tx = spawn.x;
  let ty = spawn.y;
  let prevTx = tx;
  let prevTy = ty;
  let facing: Facing = spawn.facing;
  let moveT = 1;
  let moving = false;

  type FadePhase = 'normal' | 'fadeIn' | 'fadeOut';
  let fadePhase: FadePhase = opts.startFaded ? 'fadeIn' : 'normal';
  let fadeT = opts.startFaded ? 0 : 1;
  let pendingWarp: string | null = null;
  let tick = 0;

  let dialogLines: string[] | null = null;
  let dialogPage = 0;
  const DIALOG_LINES_PER_PAGE = 3;

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
    }
  }
  function facingDelta(f: Facing): { dx: number; dy: number } {
    if (f === 'up') return { dx: 0, dy: -1 };
    if (f === 'down') return { dx: 0, dy: 1 };
    if (f === 'left') return { dx: -1, dy: 0 };
    return { dx: 1, dy: 0 };
  }

  function tryStartMove(dir: Facing): void {
    facing = dir;
    let dx = 0;
    let dy = 0;
    if (dir === 'up') dy = -1;
    else if (dir === 'down') dy = 1;
    else if (dir === 'left') dx = -1;
    else if (dir === 'right') dx = 1;
    const nx = tx + dx;
    const ny = ty + dy;
    if (!isWalkable(map, nx, ny)) return;
    prevTx = tx;
    prevTy = ty;
    tx = nx;
    ty = ny;
    moveT = 0;
    moving = true;
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
    const warp = findObjectAt(map, tx, ty, 'warp') as Extract<MapObject, { type: 'warp' }> | null;
    if (warp) {
      pendingWarp = warp.target;
      fadePhase = 'fadeOut';
      fadeT = 1;
    }
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

      drawTiles(ctx, map, rows, camX, camY);
      drawObjectMarkers(ctx, map, camX, camY);
      drawPlayer(ctx, px - camX, py - camY, map.tilesize, facing);

      ctx.fillStyle = 'rgba(32, 32, 44, 0.85)';
      ctx.fillRect(0, 0, LOGICAL_W, 10);
      drawText(ctx, `${map.name}  (${tx},${ty}) facing ${facing}`, 3, 1, PALETTE.paper);

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

function drawObjectMarkers(
  ctx: CanvasRenderingContext2D,
  map: MapData,
  camX: number,
  camY: number,
): void {
  const ts = map.tilesize;
  for (const obj of map.objects) {
    if (obj.type === 'sign') {
      ctx.fillStyle = '#ffd700';
      ctx.fillRect(obj.x * ts - camX + ts / 2 - 1, obj.y * ts - camY + 2, 2, 4);
    } else if (obj.type === 'warp') {
      // Doors already render as the 'D' tile — no extra marker needed.
      void obj;
    } else if (obj.type === 'encounter_zone') {
      // Grass tiles already render — no extra overlay during gameplay.
      void obj;
    }
  }
}

function drawPlayer(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  ts: number,
  facing: Facing,
): void {
  const inset = 2;
  ctx.fillStyle = '#d22f2f';
  ctx.fillRect(px + inset, py + inset, ts - 2 * inset, ts - 2 * inset);
  ctx.strokeStyle = '#1d1d28';
  ctx.lineWidth = 1;
  ctx.strokeRect(px + inset + 0.5, py + inset + 0.5, ts - 2 * inset - 1, ts - 2 * inset - 1);

  ctx.fillStyle = '#f2c79a';
  const eye = 2;
  if (facing === 'up') {
    ctx.fillRect(px + 5, py + inset + 1, eye, eye);
    ctx.fillRect(px + ts - 5 - eye, py + inset + 1, eye, eye);
  } else if (facing === 'down') {
    ctx.fillRect(px + 5, py + ts - inset - 1 - eye, eye, eye);
    ctx.fillRect(px + ts - 5 - eye, py + ts - inset - 1 - eye, eye, eye);
  } else if (facing === 'left') {
    ctx.fillRect(px + inset + 1, py + 5, eye, eye);
    ctx.fillRect(px + inset + 1, py + ts - 5 - eye, eye, eye);
  } else {
    ctx.fillRect(px + ts - inset - 1 - eye, py + 5, eye, eye);
    ctx.fillRect(px + ts - inset - 1 - eye, py + ts - 5 - eye, eye, eye);
  }
}
