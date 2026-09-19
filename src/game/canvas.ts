import { PALETTE } from './palette';
import { integerScale, shouldRotate } from './viewport';

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

// Coarse pointer (a phone/tablet) or the `?touch=1` override: the touch overlay
// shows and the portrait rotation fallback (below) is armed.
export function isTouchDevice(): boolean {
  const coarse =
    typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
  return coarse || window.location.search.includes('touch=1');
}

export interface Viewport {
  // The viewport the game is laid out in. When `rotated`, w/h are the window's
  // h/w — the host is turned 90° so the game runs along a portrait phone's long
  // axis (viewport.ts shouldRotate).
  readonly w: number;
  readonly h: number;
  readonly rotated: boolean;
}

export interface CanvasHost {
  readonly host: HTMLElement;
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  getScale(): number;
  getViewport(): Viewport;
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
  host.style.overflow = 'hidden';
  host.style.margin = '0';
  // Sized in px from window.inner* by applyScale (not 100vw/100vh: iOS Safari's
  // URL bar makes 100vh taller than the visible area), and rotated from the
  // top-left corner for the portrait fallback.
  host.style.transformOrigin = 'top left';

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

  const touch = isTouchDevice();
  let viewW = 0;
  let viewH = 0;
  let rotated = false;

  // Size the canvas ELEMENT (CSS display size) to the on-screen footprint, updating
  // `scale`. The footprint is defined by the BASE logical resolution at an integer
  // scale — it is the physical space the game fills, and it is the SAME for every
  // scene regardless of that scene's backing resolution. A scene that declares a
  // higher logical size (battle → 640×360) keeps this footprint and simply packs
  // more (crisper) pixels into it. It must NOT recompute the scale against its own
  // larger size: that yields `640 × floor(winW/640)`, which for most real window
  // sizes is well under winW, so the battle canvas would display smaller than the
  // window and cluster in the top-left corner — the Part 1 real-render bug. All
  // logical sizes share the 16:9 base aspect, so stretching a 640×360 backing store
  // into the 320-based footprint is a clean uniform 0.5×-per-pixel scale (no
  // distortion; on displays whose base scale is even, e.g. 1080p→6×, it is exactly
  // an integer 3× so it also stays pixel-crisp).
  //
  // Portrait fallback (touch devices only): when turning the window's w/h gives a
  // strictly larger integer scale — every phone held upright — the host is
  // rotated 90° and sized to the swapped dimensions, so the game runs along the
  // long axis at ×2 instead of a ×1 strip. Still integer scale (pilot-exit §1);
  // it just holds with rotation lock on. rotate(90deg) about the top-left corner
  // then translateY(-100%) puts the (ih×iw) box exactly over the (iw×ih) window,
  // with the game's top edge along the window's right edge — hold the phone
  // turned counter-clockwise, notch to the left. A position:fixed overlay inside
  // the host rotates with it (input.ts).
  function applyScale(): void {
    const iw = window.innerWidth;
    const ih = window.innerHeight;
    rotated = touch && shouldRotate(iw, ih, LOGICAL_W, LOGICAL_H);
    viewW = rotated ? ih : iw;
    viewH = rotated ? iw : ih;
    host.style.width = `${viewW}px`;
    host.style.height = `${viewH}px`;
    host.style.transform = rotated ? 'rotate(90deg) translateY(-100%)' : '';
    scale = integerScale(viewW, viewH, LOGICAL_W, LOGICAL_H);
    canvas.style.width = `${LOGICAL_W * scale}px`;
    canvas.style.height = `${LOGICAL_H * scale}px`;
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
    host,
    canvas,
    ctx,
    getScale: () => scale,
    getViewport: () => ({ w: viewW, h: viewH, rotated }),
    getLogicalSize: () => ({ width: logicalW, height: logicalH }),
    setLogicalSize,
    onResize(handler) {
      handlers.push(handler);
    },
  };
}
