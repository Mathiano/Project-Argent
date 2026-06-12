export type InputKey = 'up' | 'down' | 'left' | 'right' | 'a' | 'b' | 'select' | 'start';

export interface Scene {
  enter?(): void;
  exit?(): void;
  update?(dt: number): void;
  input?(key: InputKey): void;
  draw(ctx: CanvasRenderingContext2D): void;
}

export class SceneStack {
  private readonly stack: Scene[] = [];

  push(scene: Scene): void {
    this.stack.push(scene);
    scene.enter?.();
  }

  pop(): Scene | undefined {
    const s = this.stack.pop();
    s?.exit?.();
    return s;
  }

  replace(scene: Scene): void {
    const prev = this.stack.pop();
    prev?.exit?.();
    this.stack.push(scene);
    scene.enter?.();
  }

  top(): Scene | undefined {
    return this.stack[this.stack.length - 1];
  }

  depth(): number {
    return this.stack.length;
  }

  update(dt: number): void {
    this.top()?.update?.(dt);
  }

  draw(ctx: CanvasRenderingContext2D): void {
    this.top()?.draw(ctx);
  }

  input(key: InputKey): void {
    this.top()?.input?.(key);
  }
}
