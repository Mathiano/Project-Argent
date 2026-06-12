import { LOGICAL_H, LOGICAL_W, mountCanvas } from './canvas';
import { PALETTE } from './palette';

const host = document.getElementById('app');
if (!host) throw new Error('Argent: #app element missing in index.html');

const { ctx, getScale, onResize } = mountCanvas(host);

function paintBootScreen(): void {
  ctx.fillStyle = PALETTE.battleSky;
  ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

  ctx.fillStyle = PALETTE.ink;
  ctx.fillRect(0, 0, LOGICAL_W, 14);

  ctx.font = '8px monospace';
  ctx.textBaseline = 'top';
  ctx.fillStyle = PALETTE.paper;
  ctx.fillText('PROJECT ARGENT — Sprint 1 boot', 6, 3);

  ctx.fillStyle = PALETTE.ink;
  ctx.fillText(`Canvas ${LOGICAL_W}x${LOGICAL_H} @ ${getScale()}x integer scale`, 6, 24);
  ctx.fillStyle = PALETTE.paperShadow;
  ctx.fillText('Resize the window — scale snaps to nearest integer.', 6, 36);

  // 1px corner pixels in stance colors prove the integer scale is exact.
  ctx.fillStyle = PALETTE.stanceA;
  ctx.fillRect(0, LOGICAL_H - 1, 1, 1);
  ctx.fillStyle = PALETTE.stanceG;
  ctx.fillRect(LOGICAL_W - 1, LOGICAL_H - 1, 1, 1);
  ctx.fillStyle = PALETTE.stanceF;
  ctx.fillRect(LOGICAL_W - 1, 0, 1, 1);
}

paintBootScreen();
onResize(paintBootScreen);
