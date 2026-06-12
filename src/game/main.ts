import { mountCanvas } from './canvas';
import { SceneStack } from './scene';
import type { InputKey } from './scene';
import { createBootScene } from './scenes/boot';

const host = document.getElementById('app');
if (!host) throw new Error('Argent: #app element missing in index.html');

const { ctx, getScale } = mountCanvas(host);

const scenes = new SceneStack();
scenes.push(createBootScene(getScale));

let lastTime = performance.now();
function frame(now: number): void {
  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;
  scenes.update(dt);
  scenes.draw(ctx);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Keyboard-only input until task 6 lands the unified dispatcher.
const KEYS: Record<string, InputKey> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  z: 'a', Z: 'a',
  x: 'b', X: 'b',
  c: 'select', C: 'select',
  Enter: 'start',
};

window.addEventListener('keydown', (e) => {
  const key = KEYS[e.key];
  if (!key) return;
  e.preventDefault();
  scenes.input(key);
});
