export type InputKey = 'up' | 'down' | 'left' | 'right' | 'a' | 'b' | 'select' | 'start';

export interface Scene {
  enter?(): void;
  exit?(): void;
  update?(dt: number): void;
  input?(key: InputKey): void;
  // Raw-text channel for typed entry (the nickname field, future search boxes).
  // Receives the raw `KeyboardEvent.key` ('a', 'B', ' ', 'Backspace', 'Enter',
  // 'Escape', …). Returns true when consumed — the dispatcher then SKIPS the
  // gamepad `InputKey` mapping for that keypress, so typing 'z' enters a 'z'
  // instead of firing the 'a' button. Absent on every gameplay scene → unchanged.
  textInput?(key: string): boolean;
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

  // Route a raw typed key to the top scene's text channel. Returns true when
  // the scene consumed it (a text field is active), so the caller can suppress
  // the gamepad mapping for the same keypress.
  textInput(key: string): boolean {
    return this.top()?.textInput?.(key) ?? false;
  }
}
