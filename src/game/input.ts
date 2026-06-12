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

export interface InputDispatcher {
  dispose(): void;
}

export function createInputDispatcher(
  onKey: (key: InputKey) => void,
): InputDispatcher {
  const keyHandler = (e: KeyboardEvent): void => {
    const key = KEY_MAP[e.key];
    if (!key) return;
    e.preventDefault();
    onKey(key);
  };
  window.addEventListener('keydown', keyHandler);

  const overlay = buildOverlay(onKey);
  document.body.appendChild(overlay);

  // Only show the touch overlay when the device is touch-first.
  const isCoarse =
    typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
  if (!isCoarse && !window.location.search.includes('touch=1')) overlay.style.display = 'none';

  return {
    dispose() {
      window.removeEventListener('keydown', keyHandler);
      overlay.remove();
    },
  };
}

function buildOverlay(onKey: (key: InputKey) => void): HTMLDivElement {
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
    const press = (e: Event): void => {
      e.preventDefault();
      onKey(key);
    };
    el.addEventListener('pointerdown', press);
    overlay.appendChild(el);
  };

  // D-pad — bottom-left cluster
  button('up', '▲', 'left:74px;bottom:148px', 'dpad');
  button('down', '▼', 'left:74px;bottom:40px', 'dpad');
  button('left', '◀', 'left:14px;bottom:94px', 'dpad');
  button('right', '▶', 'left:134px;bottom:94px', 'dpad');

  // A/B — bottom-right cluster
  button('b', 'B', 'right:96px;bottom:54px', 'ab');
  button('a', 'A', 'right:18px;bottom:108px', 'ab');

  // SELECT / START — top-right meta
  button('select', 'SELECT', 'right:18px;top:14px', 'meta');
  button('start', 'START', 'right:96px;top:14px', 'meta');

  return overlay;
}
