import { LOGICAL_H, LOGICAL_W } from '../canvas';
import type { InputState } from '../input';
import { getMap } from '../overworld/maps';
import type { Facing, MapData } from '../overworld/types';
import { isWalkable } from '../overworld/types';
import { PALETTE } from '../palette';
import type { InputKey, Scene } from '../scene';
import { drawText } from '../ui';

const MOVE_DURATION = 0.18;

export interface OverworldSceneOpts {
  readonly map: string;
  readonly spawn: string;
  readonly inputState: InputState;
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
    if (moving) return;
    const s = opts.inputState;
    if (s.pressed('up')) tryStartMove('up');
    else if (s.pressed('down')) tryStartMove('down');
    else if (s.pressed('left')) tryStartMove('left');
    else if (s.pressed('right')) tryStartMove('right');
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
      if (moving) {
        moveT += dt / MOVE_DURATION;
        if (moveT >= 1) {
          moveT = 1;
          moving = false;
        }
      }
      pollMovement();
    },

    input(_key: InputKey) {
      // Task-2 stub: A/B/SELECT/START handled in later tasks. Movement is
      // polled from the dispatcher's held-key state above.
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
    },
  };
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
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
