import { PALETTE } from './palette';

export const LOGICAL_W = 320;
export const LOGICAL_H = 180;

export interface CanvasHost {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  getScale(): number;
  onResize(handler: (scale: number) => void): void;
}

export function mountCanvas(host: HTMLElement): CanvasHost {
  host.style.display = 'flex';
  host.style.alignItems = 'center';
  host.style.justifyContent = 'center';
  host.style.background = PALETTE.shellBlack;
  host.style.width = '100vw';
  host.style.height = '100vh';
  host.style.overflow = 'hidden';
  host.style.margin = '0';

  const canvas = document.createElement('canvas');
  canvas.width = LOGICAL_W;
  canvas.height = LOGICAL_H;
  canvas.style.imageRendering = 'pixelated';
  canvas.style.display = 'block';
  host.appendChild(canvas);

  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('Argent: 2D canvas context not available');
  ctx.imageSmoothingEnabled = false;

  let scale = 1;
  const handlers: Array<(s: number) => void> = [];

  function rescale(): void {
    const sw = window.innerWidth;
    const sh = window.innerHeight;
    const next = Math.max(1, Math.floor(Math.min(sw / LOGICAL_W, sh / LOGICAL_H)));
    if (next === scale) return;
    scale = next;
    canvas.style.width = `${LOGICAL_W * scale}px`;
    canvas.style.height = `${LOGICAL_H * scale}px`;
    for (const h of handlers) h(scale);
  }

  // Force first sizing even if next === 1 (rescale's idempotent skip would prevent it).
  scale = 0;
  rescale();
  window.addEventListener('resize', rescale);

  return {
    canvas,
    ctx,
    getScale: () => scale,
    onResize(handler) {
      handlers.push(handler);
    },
  };
}
