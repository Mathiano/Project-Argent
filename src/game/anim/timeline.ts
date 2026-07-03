// The animation RUNTIME — a timeline-JSON interpreter (docs/animation-pipeline-
// plan.md). PURE + headless: it knows nothing about canvas, the battle, or the
// engine. It plays DATA (tracks of {target, property, from→to, durationFrames,
// easing, delayFrames, side?}) against a registry of named BINDINGS the host
// provides. `side` ('player' | 'foe', OPTIONAL) picks which side a track drives —
// absent → the triggering event's subject (so subject-less events, e.g. the
// battle-start entrance, can still choreograph both sides explicitly).
// Frame-based timing (60fps units), never ms. Deterministic (zero RNG).
//
// The same JSON the game plays is the JSON the preview harness plays — that
// identity is the whole point (a CD approval in the harness ships byte-identical).

// ── The five-easing whitelist (reject anything else at load) ────────────────
export type EasingName = 'linear' | 'easeIn' | 'easeOut' | 'easeInOut' | 'hold';
export const EASINGS: Readonly<Record<EasingName, (t: number) => number>> = {
  linear: (t) => t,
  easeIn: (t) => t * t,
  easeOut: (t) => 1 - (1 - t) * (1 - t),
  easeInOut: (t) => (t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t)),
  // A STEP hold: the value sits at `from` for the duration, then snaps to `to`.
  hold: (t) => (t >= 1 ? 1 : 0),
};
export const EASING_NAMES: readonly EasingName[] = Object.keys(EASINGS) as EasingName[];
function isEasing(x: unknown): x is EasingName {
  return typeof x === 'string' && (EASING_NAMES as readonly string[]).includes(x);
}

// ── Schema ──────────────────────────────────────────────────────────────────
export interface Track {
  readonly target: string; // the binding OBJECT (e.g. "sprite", "bar", "stage")
  readonly property: string; // the channel on it (e.g. "flashAlpha", "hpProgress")
  readonly channel: string; // `${target}.${property}` — the binding key
  readonly from: number;
  readonly to: number;
  readonly durationFrames: number;
  readonly easing: EasingName;
  readonly delayFrames: number;
  // Which side this track addresses ('player' | 'foe'). ABSENT → the triggering
  // event's subject (today's behavior). Set it to drive a specific side from a
  // SUBJECT-LESS event (e.g. battle-start's entrance choreographs both panels).
  readonly side?: 'player' | 'foe';
}
export interface AnimationDef {
  readonly id: string; // dot-namespaced ("battle.hitFlash")
  readonly tracks: readonly Track[];
  readonly totalFrames: number; // the last frame any track finishes on
}

const ID_RE = /^[a-z][a-zA-Z0-9]*(\.[a-zA-Z0-9]+)+$/; // dot-namespaced

function req(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`animation schema: ${msg}`);
}
function num(x: unknown, what: string): number {
  req(typeof x === 'number' && Number.isFinite(x), `${what} must be a finite number`);
  return x as number;
}

// Validate + normalize one raw JSON object into an AnimationDef. Throws on any
// schema violation (unknown easing, bad id, missing field) — rejected AT LOAD.
export function parseAnimationDef(raw: unknown): AnimationDef {
  req(typeof raw === 'object' && raw !== null, 'def must be an object');
  const o = raw as Record<string, unknown>;
  req(typeof o.id === 'string' && ID_RE.test(o.id), `id "${String(o.id)}" must be dot-namespaced (e.g. battle.hitFlash)`);
  req(Array.isArray(o.tracks) && o.tracks.length > 0, `${o.id}: tracks must be a non-empty array`);
  let totalFrames = 0;
  const tracks: Track[] = (o.tracks as unknown[]).map((rt, i) => {
    req(typeof rt === 'object' && rt !== null, `${o.id}: track ${i} must be an object`);
    const t = rt as Record<string, unknown>;
    req(typeof t.target === 'string' && t.target.length > 0, `${o.id}: track ${i} target`);
    req(typeof t.property === 'string' && t.property.length > 0, `${o.id}: track ${i} property`);
    req(isEasing(t.easing), `${o.id}: track ${i} easing "${String(t.easing)}" not in [${EASING_NAMES.join(', ')}]`);
    const durationFrames = num(t.durationFrames, `${o.id}: track ${i} durationFrames`);
    req(Number.isInteger(durationFrames) && durationFrames > 0, `${o.id}: track ${i} durationFrames must be a positive integer`);
    const delayFrames = t.delayFrames === undefined ? 0 : num(t.delayFrames, `${o.id}: track ${i} delayFrames`);
    req(Number.isInteger(delayFrames) && delayFrames >= 0, `${o.id}: track ${i} delayFrames must be a non-negative integer`);
    req(t.side === undefined || t.side === 'player' || t.side === 'foe', `${o.id}: track ${i} side "${String(t.side)}" must be 'player' | 'foe' (or absent)`);
    totalFrames = Math.max(totalFrames, delayFrames + durationFrames);
    return {
      target: t.target as string,
      property: t.property as string,
      channel: `${t.target as string}.${t.property as string}`,
      from: num(t.from, `${o.id}: track ${i} from`),
      to: num(t.to, `${o.id}: track ${i} to`),
      durationFrames,
      easing: t.easing as EasingName,
      delayFrames,
      ...(t.side !== undefined ? { side: t.side as 'player' | 'foe' } : {}),
    };
  });
  return { id: o.id as string, tracks, totalFrames };
}

// ── Bindings — the host's named presentation handles ────────────────────────
// `subject` is the side an event was about (hit-landed's defender, read-win's
// player), or null for stage-global channels (wipe, shake). `onStart` lets a
// binding CAPTURE runtime state at trigger time (e.g. the HP-drain start/target).
export type Subject = 'player' | 'foe' | null;
export interface AnimBinding {
  set(value: number, subject: Subject): void;
  onStart?(subject: Subject): void;
}

interface Instance {
  readonly def: AnimationDef;
  readonly subject: Subject;
  frame: number;
}

// The runtime: register bindings, feed it events (mapped to ids via DATA), tick
// it each frame with dt SECONDS (→ frames at 60fps). Nothing here draws.
export class AnimRuntime {
  private readonly bindings = new Map<string, AnimBinding>();
  private instances: Instance[] = [];

  constructor(
    private readonly defs: ReadonlyMap<string, AnimationDef>,
    private readonly eventMap: Readonly<Record<string, readonly string[]>>,
  ) {}

  register(channel: string, binding: AnimBinding): void {
    this.bindings.set(channel, binding);
  }

  // Fire the animation(s) an event maps to. Unmapped events are ignored.
  trigger(eventKind: string, subject: Subject = null): void {
    const ids = this.eventMap[eventKind];
    if (!ids) return;
    for (const id of ids) this.play(id, subject);
  }

  // Start one animation by id (replacing any live instance of the same id+subject
  // so rapid re-triggers restart cleanly rather than fight).
  play(id: string, subject: Subject = null): void {
    const def = this.defs.get(id);
    if (!def) return;
    this.instances = this.instances.filter((i) => !(i.def.id === id && i.subject === subject));
    const captured = new Set<string>();
    for (const t of def.tracks) {
      const sub = t.side ?? subject; // a track's explicit side overrides the event subject
      const key = `${t.channel}|${sub ?? ''}`;
      if (captured.has(key)) continue;
      captured.add(key);
      this.bindings.get(t.channel)?.onStart?.(sub);
    }
    const inst: Instance = { def, subject, frame: 0 };
    this.apply(inst); // frame-0 value immediately (no 1-frame gap)
    this.instances.push(inst);
  }

  update(dtSeconds: number): void {
    const df = dtSeconds * 60; // seconds → 60fps frame units
    for (const inst of this.instances) {
      inst.frame += df;
      this.apply(inst);
    }
    this.instances = this.instances.filter((i) => i.frame < i.def.totalFrames);
  }

  private apply(inst: Instance): void {
    for (const t of inst.def.tracks) {
      const local = inst.frame - t.delayFrames;
      if (local < 0) continue; // this track hasn't started
      const p = t.durationFrames > 0 ? Math.min(1, local / t.durationFrames) : 1;
      const v = t.from + (t.to - t.from) * EASINGS[t.easing](p);
      this.bindings.get(t.channel)?.set(v, t.side ?? inst.subject); // per-track side overrides the subject
    }
  }

  isActive(id: string, subject: Subject = null): boolean {
    return this.instances.some((i) => i.def.id === id && i.subject === subject);
  }
  activeCount(): number {
    return this.instances.length;
  }
}

// Build a def map from an array of raw JSON objects (validating each).
export function buildDefs(raws: readonly unknown[]): Map<string, AnimationDef> {
  const map = new Map<string, AnimationDef>();
  for (const raw of raws) {
    const def = parseAnimationDef(raw);
    req(!map.has(def.id), `duplicate animation id "${def.id}"`);
    map.set(def.id, def);
  }
  return map;
}
