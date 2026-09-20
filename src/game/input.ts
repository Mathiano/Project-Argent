import type { InputKey } from './scene';
import { overlayLayout } from './viewport';
import type { OverlayKind } from './viewport';

const KEY_MAP: { readonly [code: string]: InputKey } = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  z: 'a',
  Z: 'a',
  x: 'b',
  X: 'b',
  c: 'select',
  C: 'select',
  Enter: 'start',
};

export interface InputState {
  pressed(key: InputKey): boolean;
}

export interface InputDispatcher {
  readonly state: InputState;
  dispose(): void;
}

// The mounted overlay, so a scene can relabel a button to what it currently
// does. Presentation only, and a no-op when no overlay is mounted (desktop,
// tests) — a scene never needs to know whether touch controls exist.
let liveOverlay: { setLabel(key: InputKey, label: string): void } | null = null;

// Rename a touch button. Used for SELECT, which is bound to exactly one action
// in the whole game — the battle stance cycle — so on a phone it reads
// "STANCE G" instead of a key name the hardware does not have.
export function setTouchKeyLabel(key: InputKey, label: string): void {
  liveOverlay?.setLabel(key, label);
}

export interface TouchOverlayOpts {
  // Where the overlay lives. Must be the canvas host: when canvas.ts rotates the
  // host for a portrait phone, a position:fixed overlay INSIDE it rotates along,
  // so the controls sit beside the game instead of sideways across it.
  readonly parent: HTMLElement;
  readonly canvas: HTMLCanvasElement;
  // The viewport the game is laid out in — post-rotation, so w ≥ h on a phone.
  viewport(): { readonly w: number; readonly h: number };
}

export function createInputDispatcher(
  onKey: (key: InputKey) => void,
  // Raw typed key (KeyboardEvent.key). Return true when a text field consumed
  // it — the gamepad mapping below is then skipped for that keypress so typing
  // doesn't also fire button actions. Omitted → no text routing (unchanged).
  onText?: (key: string) => boolean,
  // Touch overlay placement. Omitted → the overlay mounts on <body> and lays out
  // against the window (the pre-rotation behaviour, kept for any bare caller).
  touch?: TouchOverlayOpts,
): InputDispatcher {
  const held = new Set<InputKey>();

  const keyDown = (e: KeyboardEvent): void => {
    // Text field first: if it consumes the raw key, swallow it (no button map).
    if (onText && !e.repeat && onText(e.key)) {
      e.preventDefault();
      return;
    }
    const key = KEY_MAP[e.key];
    if (!key) return;
    e.preventDefault();
    if (!e.repeat) {
      held.add(key);
      onKey(key);
    }
  };
  const keyUp = (e: KeyboardEvent): void => {
    const key = KEY_MAP[e.key];
    if (!key) return;
    held.delete(key);
  };
  const blur = (): void => {
    held.clear();
  };

  window.addEventListener('keydown', keyDown);
  window.addEventListener('keyup', keyUp);
  window.addEventListener('blur', blur);

  const overlay = buildOverlay(onKey, held, touch);
  (touch?.parent ?? document.body).appendChild(overlay.el);
  overlay.layout();
  liveOverlay = overlay;

  const isCoarse =
    typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
  if (!isCoarse && !window.location.search.includes('touch=1')) overlay.el.style.display = 'none';

  return {
    state: { pressed: (k) => held.has(k) },
    dispose() {
      window.removeEventListener('keydown', keyDown);
      window.removeEventListener('keyup', keyUp);
      window.removeEventListener('blur', blur);
      if (liveOverlay === overlay) liveOverlay = null;
      overlay.dispose();
    },
  };
}

// Translucent at rest so the game reads through the buttons wherever the layout
// still has to overlap it (a gutterless 16:9 viewport); solid while held, as the
// press feedback a glass screen otherwise lacks.
const IDLE_BG = 'rgba(20,20,30,.45)';
const HELD_BG = 'rgba(20,20,30,.88)';

interface TouchOverlay {
  readonly el: HTMLDivElement;
  // Re-place the buttons against the current viewport + canvas footprint. Runs
  // on every window resize; call once after mounting.
  layout(): void;
  // Rename a button to the action it currently performs. Sticky across layouts.
  setLabel(key: InputKey, label: string): void;
  dispose(): void;
}

function buildOverlay(
  onKey: (key: InputKey) => void,
  held: Set<InputKey>,
  opts?: TouchOverlayOpts,
): TouchOverlay {
  const overlay = document.createElement('div');
  overlay.className = 'argent-touch';
  overlay.style.cssText = [
    'position:fixed',
    'inset:0',
    'pointer-events:none',
    'z-index:10',
    'user-select:none',
    '-webkit-user-select:none',
    'touch-action:manipulation',
  ].join(';');

  const buttons = new Map<InputKey, HTMLButtonElement>();
  const make = (key: InputKey, label: string, kind: OverlayKind): HTMLButtonElement => {
    const el = document.createElement('button');
    el.textContent = label;
    const shape =
      kind === 'dpad'
        ? 'border-radius:8px;'
        : kind === 'ab'
          ? 'border-radius:50%;'
          : 'border-radius:13px;letter-spacing:.1em;';
    el.style.cssText = [
      'position:absolute',
      'box-sizing:border-box',
      'padding:0',
      'pointer-events:auto',
      `background:${IDLE_BG}`,
      'color:rgba(243,231,207,.92)',
      'border:2px solid rgba(243,231,207,.35)',
      'font-family:monospace',
      'font-weight:700',
      'touch-action:manipulation',
      shape,
    ].join(';');
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      held.add(key);
      el.style.background = HELD_BG;
      onKey(key);
    });
    const release = (e: Event): void => {
      e.preventDefault();
      held.delete(key);
      el.style.background = IDLE_BG;
    };
    el.addEventListener('pointerup', release);
    el.addEventListener('pointercancel', release);
    el.addEventListener('pointerleave', release);
    buttons.set(key, el);
    overlay.appendChild(el);
    return el;
  };

  // Labels a scene has overridden — re-applied after every layout so a resize
  // does not silently restore the key name.
  const labelOverride = new Map<InputKey, string>();

  const layout = (): void => {
    const v = opts ? opts.viewport() : { w: window.innerWidth, h: window.innerHeight };
    const canvas = opts?.canvas ?? document.querySelector('canvas');
    // No canvas yet → treat the footprint as the whole viewport (no gutters).
    const cw = canvas?.clientWidth || v.w;
    for (const b of overlayLayout(v.w, v.h, cw)) {
      const el = buttons.get(b.key) ?? make(b.key, b.label, b.kind);
      el.style.left = `${b.x}px`;
      el.style.top = `${b.y}px`;
      el.style.width = `${b.w}px`;
      el.style.height = `${b.h}px`;
      el.style.fontSize =
        b.kind === 'meta' ? '11px' : `${Math.round(b.w * (b.kind === 'ab' ? 0.3 : 0.4))}px`;
      const override = labelOverride.get(b.key);
      if (override !== undefined) el.textContent = override;
    }
  };

  // canvas.ts registers its own resize listener first (mountCanvas precedes the
  // dispatcher in main.ts), so the canvas footprint is fresh by the time this runs.
  window.addEventListener('resize', layout);

  return {
    el: overlay,
    layout,
    setLabel(key, label) {
      labelOverride.set(key, label);
      const el = buttons.get(key);
      if (el) el.textContent = label;
    },
    dispose() {
      window.removeEventListener('resize', layout);
      overlay.remove();
    },
  };
}
