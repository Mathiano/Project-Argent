import type { InputKey } from './scene';

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

export function createInputDispatcher(
  onKey: (key: InputKey) => void,
  // Raw typed key (KeyboardEvent.key). Return true when a text field consumed
  // it — the gamepad mapping below is then skipped for that keypress so typing
  // doesn't also fire button actions. Omitted → no text routing (unchanged).
  onText?: (key: string) => boolean,
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

  const overlay = buildOverlay(onKey, held);
  document.body.appendChild(overlay);

  const isCoarse =
    typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
  if (!isCoarse && !window.location.search.includes('touch=1')) overlay.style.display = 'none';

  return {
    state: { pressed: (k) => held.has(k) },
    dispose() {
      window.removeEventListener('keydown', keyDown);
      window.removeEventListener('keyup', keyUp);
      window.removeEventListener('blur', blur);
      overlay.remove();
    },
  };
}

function buildOverlay(onKey: (key: InputKey) => void, held: Set<InputKey>): HTMLDivElement {
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

  const button = (key: InputKey, label: string, pos: string, kind: 'dpad' | 'ab' | 'meta'): void => {
    const el = document.createElement('button');
    el.textContent = label;
    const base =
      kind === 'dpad'
        ? 'width:54px;height:54px;border-radius:8px;font-size:20px;'
        : kind === 'ab'
          ? 'width:64px;height:64px;border-radius:50%;font-size:18px;'
          : 'padding:8px 12px;border-radius:18px;font-size:11px;letter-spacing:.1em;';
    el.style.cssText = [
      'position:absolute',
      'pointer-events:auto',
      'background:rgba(20,20,30,.72)',
      'color:rgba(243,231,207,.92)',
      'border:2px solid rgba(243,231,207,.4)',
      'font-family:monospace',
      'font-weight:700',
      'touch-action:manipulation',
      base,
      pos,
    ].join(';');
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      held.add(key);
      onKey(key);
    });
    const release = (e: Event): void => {
      e.preventDefault();
      held.delete(key);
    };
    el.addEventListener('pointerup', release);
    el.addEventListener('pointercancel', release);
    el.addEventListener('pointerleave', release);
    overlay.appendChild(el);
  };

  button('up', '▲', 'left:74px;bottom:148px', 'dpad');
  button('down', '▼', 'left:74px;bottom:40px', 'dpad');
  button('left', '◀', 'left:14px;bottom:94px', 'dpad');
  button('right', '▶', 'left:134px;bottom:94px', 'dpad');
  button('b', 'B', 'right:96px;bottom:54px', 'ab');
  button('a', 'A', 'right:18px;bottom:108px', 'ab');
  button('select', 'SELECT', 'right:18px;top:14px', 'meta');
  button('start', 'START', 'right:96px;top:14px', 'meta');

  return overlay;
}
