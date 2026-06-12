import { LOGICAL_H, LOGICAL_W } from '../canvas';
import { getMap } from '../overworld/maps';
import type { MapData } from '../overworld/types';
import { PALETTE } from '../palette';
import type { Scene } from '../scene';
import { drawText } from '../ui';

export interface OverworldSceneOpts {
  readonly map: string;
  readonly spawn: string;
}

export function createOverworldScene(opts: OverworldSceneOpts): Scene {
  const map = getMap(opts.map);
  const rows = map.tiles.split('\n');
  const spawn = map.spawns[opts.spawn] ?? Object.values(map.spawns)[0]!;

  return {
    draw(ctx) {
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

      // Centered camera around the spawn for task 1 — task 2 turns this into
      // a real camera follow with edge clamping.
      const camX = clamp(spawn.x * map.tilesize - LOGICAL_W / 2, 0, map.width * map.tilesize - LOGICAL_W);
      const camY = clamp(spawn.y * map.tilesize - LOGICAL_H / 2, 0, map.height * map.tilesize - LOGICAL_H);

      drawTiles(ctx, map, rows, camX, camY);
      drawObjects(ctx, map, camX, camY);
      drawSpawnMarker(ctx, spawn, map.tilesize, camX, camY);
      drawHud(ctx, map, opts.spawn);
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
  for (let y = 0; y < map.height; y += 1) {
    const row = rows[y] ?? '';
    for (let x = 0; x < map.width; x += 1) {
      const ch = row[x];
      const def = ch ? map.tileset[ch] : null;
      if (!def) continue;
      ctx.fillStyle = def.color;
      ctx.fillRect(x * ts - camX, y * ts - camY, ts, ts);
    }
  }
}

function drawObjects(
  ctx: CanvasRenderingContext2D,
  map: MapData,
  camX: number,
  camY: number,
): void {
  const ts = map.tilesize;
  for (const obj of map.objects) {
    if (obj.type === 'encounter_zone') {
      ctx.fillStyle = 'rgba(255, 200, 0, 0.15)';
      ctx.fillRect(obj.x * ts - camX, obj.y * ts - camY, obj.width * ts, obj.height * ts);
      ctx.strokeStyle = 'rgba(255, 200, 0, 0.6)';
      ctx.lineWidth = 1;
      ctx.strokeRect(
        obj.x * ts - camX + 0.5,
        obj.y * ts - camY + 0.5,
        obj.width * ts - 1,
        obj.height * ts - 1,
      );
    } else if (obj.type === 'warp') {
      ctx.strokeStyle = '#ffd700';
      ctx.lineWidth = 1;
      ctx.strokeRect(obj.x * ts - camX + 0.5, obj.y * ts - camY + 0.5, ts - 1, ts - 1);
    } else if (obj.type === 'sign') {
      ctx.fillStyle = '#ffd700';
      ctx.fillRect(obj.x * ts - camX + ts / 2 - 1, obj.y * ts - camY + 2, 2, 4);
    } else if (obj.type === 'script') {
      ctx.strokeStyle = 'rgba(255, 100, 200, 0.7)';
      ctx.lineWidth = 1;
      ctx.strokeRect(obj.x * ts - camX + 2.5, obj.y * ts - camY + 2.5, ts - 5, ts - 5);
    }
  }
}

function drawSpawnMarker(
  ctx: CanvasRenderingContext2D,
  spawn: { x: number; y: number },
  ts: number,
  camX: number,
  camY: number,
): void {
  const cx = spawn.x * ts - camX + ts / 2;
  const cy = spawn.y * ts - camY + ts / 2;
  ctx.fillStyle = PALETTE.hpCrit;
  ctx.beginPath();
  ctx.ellipse(cx, cy, 5, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = PALETTE.paper;
  ctx.stroke();
}

function drawHud(ctx: CanvasRenderingContext2D, map: MapData, spawnId: string): void {
  ctx.fillStyle = 'rgba(32, 32, 44, 0.85)';
  ctx.fillRect(0, 0, LOGICAL_W, 10);
  drawText(ctx, `${map.name}  spawn=${spawnId}  (${map.width}x${map.height})`, 3, 1, PALETTE.paper);
}
