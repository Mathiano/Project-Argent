import { PALETTE } from './palette';

// The BASE logical resolution — the size every scene draws at unless it declares
// its own via Scene.logicalSize. The overworld + every menu are authored in these
// coordinates; DO NOT change these to resize a single scene (24 files depend on
// them) — declare a per-scene logicalSize instead (see BATTLE_LOGICAL_* + canvas
// setLogicalSize below).
export const LOGICAL_W = 320;
export const LOGICAL_H = 180;

// The battle scene's logical resolution — 2× the base for the 640×360 battle-UI
// rebuild. The battle Scene declares this via logicalSize; the shared canvas
// swaps its backing size to match while the battle is on top, then restores the
// base size when a default (320×180) scene returns to the top of the stack.
export const BATTLE_LOGICAL_W = 640;
export const BATTLE_LOGICAL_H = 360;

export interface CanvasHost {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  getScale(): number;
  // The canvas's CURRENT logical (backing) size — reflects the active scene's
  // declared size after setLogicalSize.
  getLogicalSize(): { readonly width: number; readonly height: number };
  // Swap the canvas backing size (and recompute the integer display scale) to a
  // scene's declared logical resolution. Idempotent — a no-op when the size is
  // unchanged, so the frame loop can call it every frame cheaply. Resizing a
  // canvas resets its 2D context state, so imageSmoothingEnabled is re-applied.
  setLogicalSize(width: number, height: number): void;
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

  // The live logical size — starts at the base, swapped by setLogicalSize when a
  // scene declares its own resolution.
  let logicalW = LOGICAL_W;
  let logicalH = LOGICAL_H;

  const canvas = document.createElement('canvas');
  canvas.width = logicalW;
  canvas.height = logicalH;
  canvas.style.imageRendering = 'pixelated';
  canvas.style.display = 'block';
  host.appendChild(canvas);

  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('Argent: 2D canvas context not available');
  ctx.imageSmoothingEnabled = false;

  let scale = 1;
  const handlers: Array<(s: number) => void> = [];

  // Fit the CURRENT logical size to the viewport at an integer scale, updating the
  // CSS display size. Returns the computed scale (does NOT notify handlers).
  function applyScale(): void {
    const sw = window.innerWidth;
    const sh = window.innerHeight;
    scale = Math.max(1, Math.floor(Math.min(sw / logicalW, sh / logicalH)));
    canvas.style.width = `${logicalW * scale}px`;
    canvas.style.height = `${logicalH * scale}px`;
  }

  function rescale(): void {
    const prev = scale;
    applyScale();
    if (scale !== prev) for (const h of handlers) h(scale);
  }

  function setLogicalSize(width: number, height: number): void {
    if (width === logicalW && height === logicalH) return;
    logicalW = width;
    logicalH = height;
    // Resizing the backing store clears the canvas AND resets 2D context state
    // (transform, imageSmoothingEnabled, fillStyle, …) — re-disable smoothing so
    // the pixel-art scaling stays crisp. The scene fully repaints each frame, so
    // the clear is harmless.
    canvas.width = width;
    canvas.height = height;
    ctx!.imageSmoothingEnabled = false; // non-null: guarded at context creation above
    const prev = scale;
    applyScale();
    if (scale !== prev) for (const h of handlers) h(scale);
  }

  applyScale();
  window.addEventListener('resize', rescale);

  return {
    canvas,
    ctx,
    getScale: () => scale,
    getLogicalSize: () => ({ width: logicalW, height: logicalH }),
    setLogicalSize,
    onResize(handler) {
      handlers.push(handler);
    },
  };
}
