import {
  COMBAT,
  MOMENTUM_REQ_BY_TIER,
  TIERS,
  activeMon,
  attackPool,
  forcedAction,
  hasBenchSurvivor,
  isTeamWiped,
  isTechnique,
  lookupMove,
  moveLegal,
  mulberry32,
  resolveRound,
  techniquePool,
  tierMomentumLocked,
} from '../../engine';
import type {
  Action,
  BattleEvent,
  BattleState,
  InfoLevel,
  RNG,
  ReleaseKind,
  Side,
  SideState,
  Species,
  Stance,
  StatusInstance,
  Team,
  TierName,
} from '../../engine';
import { BATTLE_LOGICAL_H, BATTLE_LOGICAL_W } from '../canvas';
import { PALETTE } from '../palette';
import type { InputKey, Scene } from '../scene';
import { monDisplayName } from '../monName';
import { fleeTelegraphed, bondStage } from '../catching';
import type { CatchWindow } from '../catching';
import { drawBondBar } from '../bondBar';
import { BOND_MOMENT_STAGE, BOND_TELL_STAGE, bondAfterFight, powerIndex, stageCeiling } from '../bond';
import type { FightKind } from '../bond';
import {
  TUTORIAL_CORRECTION,
  TUTORIAL_FOE_PROMPT,
  TUTORIAL_WINDOW_PROMPT,
} from '../tutorialCatch';
import { emitGameEvent } from '../gameEvents';
import { drawSpeciesInSlot } from '../sprites';
import {
  STANCE_NAME,
  UI_FONT,
  drawBar,
  drawBattlePanel,
  drawRowHighlight,
  drawStanceBadge,
  drawText,
  drawTextCenter,
  drawTextRight,
  drawWindedNotch,
  hpColor,
  measureUiText,
} from '../ui';

// Battle-text stream speed (chars/sec). Tuned readable, ~modern-Pokémon feel
// (was 56 — over-corrected to "too fast to read"). Each beat's message reveals
// progressively; a press finishes it (see tickResolve / handleResolveInput —
// the consistent one-press-per-message model).
const CHARS_PER_SEC = 38;
// After a ROUTINE beat is fully revealed it holds this long, then auto-advances
// (a gentle rhythm). A press skips the stream / advances now.
const BEAT_HOLD_SEC = 0.7;
// CONSEQUENTIAL beats (KO/faint/break/Call) hold MARKEDLY longer so they LAND
// ("FLITPECK fainted!" must register, not flow past) — but still auto-advance
// eventually, and a press skips the wait immediately.
const CONSEQUENTIAL_HOLD_SEC = 2.2;
const STANCES: readonly Stance[] = ['A', 'G', 'F'];
// FOCUS R2 — the release menu, with a one-line "beats" hint per the rotation
// triangle (HEAVY>Brace, FEINT>Aggressive, HIDE>Fluid).
const RELEASES: readonly { readonly kind: ReleaseKind; readonly name: string; readonly beats: string }[] = [
  { kind: 'heavy', name: 'HEAVY', beats: 'crushes a Brace' },
  { kind: 'feint', name: 'FEINT', beats: 'punishes Aggression' },
  { kind: 'hide', name: 'HIDE', beats: 'catches Fluid' },
];
// Fixed seed for the intent-display feint RNG (Phase 6.7-A). Deliberately
// constant + independent of the engine RNG so degrading the FOE INTENT
// display never touches combat resolution (ladders stay bit-identical).
const INTENT_DISPLAY_SEED = 0x1a7e11;

// DEV TOOL — dev combat-log overlay geometry + buffer size (see BattleSceneOpts
// .devLog). A rolling text overlay: keep the last DEV_LOG_MAX lines, show the
// newest DEV_LOG_VISIBLE. Rendered small (8px monospace) for density — it's a
// debug readout, legibility of the mechanics over aesthetics.
const DEV_LOG_MAX = 400;
const DEV_LOG_VISIBLE = 15;
const DEV_LOG_LINE_CAP = 60; // truncate very long lines to fit the overlay

// DEV TOOL — read the `?log=1` URL hook (mirrors main.ts's `?calls=all`). Read
// here (game layer, DOM allowed) so EVERY battle entry point honours it without
// threading a prop through each createBattleScene call site. Guarded so headless
// / test contexts (no window) simply return false.
function devLogUrlFlag(): boolean {
  if (typeof window === 'undefined' || !window.location) return false;
  try {
    return new URLSearchParams(window.location.search).get('log') === '1';
  } catch {
    return false;
  }
}

// ── Battle HUD layout — the 640×360 layout map (battle-UI rebuild Part 2a) ─────
// The classic Pokémon arrangement, re-authored to FILL the 640×360 battle canvas
// (Part 1 gave the scene its own logical resolution; this fills it). These 6
// blocks are the tuning surface — the draw functions position everything relative
// to them. The FONT stays 16px (m3x6) so the bigger panels read as roomier, not
// bigger-text. Part 2b adds the new elements (status chips, stance selector, 2×3
// move grid) and the warm-parchment / soft-green / silver-inlay skin on top.
//
//   ┌ FOE_PANEL (upper-left) ┐              [ FOE_SLOT ] (upper-right sprite)
//   [ BOSS strip (boss only) ]
//   [ INTENT strip (mid) ]
//   [ PL_SLOT ]              ┌ PL_PANEL (mid-right) ┐
//   (mid-left sprite)        [ bond + bench under-strip ]
//   ┌───────────── BOTTOM (full-width command / narration) ─────────────┐
// Battle-UI v2 (beat 1 TUNE) — panels back to ≈PRE-beat-1 COMPACT footprints so
// they clear the ATTACK CORRIDOR (the diagonal band between the two sprite slots
// that strike animations travel). All panel text is the 16px fine-print tier
// (drawBig came OFF the panels → onto the menu rail); the beat-1 CONTENT is kept,
// rows re-compressed. Beat 2.5 (proportion pass): chrome COMPACTED ~30% at
// IDENTICAL 16px glyphs — thinner bars, tighter row pitches, classic-Pokémon-tight.
// `h` on FOE_PANEL is the NON-boss base; a boss adds FOE_BREAK_EXTRA (the thin
// BREAK line + GYM LEADER/gust strip), so drawFoePanel computes its total.
const FOE_PANEL = { x: 8, y: 8, w: 340, h: 52 } as const; // upper-left (was h74; boss = +FOE_BREAK_EXTRA)
const FOE_BREAK_EXTRA = 13; // a boss adds the compact GYM-LEADER/gust strip + the thin BREAK line
const FOE_SLOT = { x: 472, y: 12 } as const; // upper-right sprite slot
const INTENT = { x: 8, y: 76, w: 340, h: 18 } as const; // mid strip — re-derived UP under the compacted foe panel (ends y60 / y65 boss), clear of the player sprite (y140)
const PL_SLOT = { x: 96, y: 140 } as const; // mid-left sprite slot
// Beat 3 — PL_PANEL NUDGES DOWN to hug the console (y150→196; ends y256, a ~4px
// gap above BOTTOM y260), opening the mock's wide middle STAGE band. The housed
// BOND/bench rows move with it.
const PL_PANEL = { x: 300, y: 196, w: 332, h: 60 } as const; // mid-right (nudged down to hug the console)
// Beat 2.5 — the console (BOTTOM) compacted + BOTTOM-anchored at 356 (a shorter
// bar hugging the screen edge → MORE open stage above it, so the corridor only
// widens). Was y244 h112.
const BOTTOM = { x: 4, y: 260, w: 632, h: 92 } as const; // full-width bottom (bottom edge 352 → shadow clears 360)
// Battle-scaled draw sizes: the sprite slot + the HP/ST bar height. Beat 2.5 —
// the bars THIN to 8px (was 12) as part of the ~30% chrome compaction.
const BATTLE_SLOT = 112; // beat 3 — the CD spec's slot; 2× of the 56px source art (clean integer scale)
const BATTLE_BAR_H = 8;

// ── Battle-UI v2 (beat 2.5) — SINGLE-tier, SINGLE-weight type, battle-SCOPED ───
// The 32px tier retired (beat 1/2); the FAUX-BOLD retired (beat 2.5 eye-gate). ALL
// battle text is now plain 16px m3x6 drawText — hierarchy comes from COLOUR /
// highlight / box only (m5x7 true-bold vendoring stays banked, NOT implemented).
// The global UI_FONT_PX / drawText are UNTOUCHED (every other scene byte-identical).

// ── Console (beat 2) — the menu RAIL data + shared console furniture ───────────
type RailKind = 'fight' | 'pkmn' | 'catch' | 'call' | 'run';
const RAIL_KEYWORD: { readonly [K in RailKind]: string } = {
  fight: 'FIGHT', pkmn: 'MONS', catch: 'BALLS', call: 'CALLS', run: 'RUN',
};
// The description column (menu phase, behind a dotted divider).
const RAIL_DESC: { readonly [K in RailKind]: string } = {
  fight: 'Engage the foe.',
  call: 'Use a learned Call.',
  pkmn: 'Switch your monster.',
  catch: 'Use an item.',
  run: 'Escape from battle.',
};
// One-liners for the narration strip (Call phase) — display-only, battle-local.
const CALL_DESC: { readonly [id: string]: string } = {
  'catch-breath': 'Recover stamina.',
  'get-away': 'Jump clear — a grazing hit.',
  'shake-off': 'Clear the active status.',
  recover: 'Heal half your HP.',
  dodge: 'Fully evade the incoming hit.',
  'full-power': 'Your next attack hits +50%.',
  'read-them': 'Read the foe honestly this round.',
  'throw-off': 'Plant a false stance in history.',
  'come-back': 'Recall + send another — no free hit.',
};

// The NARRATION STRIP — the dark header line across the console top; a context
// line for the hovered thing, phase-aware (the caller supplies the text).
function drawNarration(ctx: CanvasRenderingContext2D, text: string): void {
  const y = BOTTOM.y + 2;
  const h = 12; // compacted (beat 2.5)
  ctx.fillStyle = 'rgba(28,19,11,0.94)'; // dark leather header strip
  ctx.fillRect(BOTTOM.x + 6, y, BOTTOM.w - 12, h);
  ctx.fillStyle = PALETTE.silverDim; // silver base inlay
  ctx.fillRect(BOTTOM.x + 8, y + h - 1, BOTTOM.w - 16, 1);
  drawText(ctx, text, BOTTOM.x + 12, y, PALETTE.paper);
}

// A/B (and phase-specific) hints as small FRAMED BUTTON CHIPS, laid RIGHT-TO-LEFT
// from the console's bottom-right corner. Replaces the old floating hint text.
function drawButtonChips(
  ctx: CanvasRenderingContext2D,
  chips: readonly string[],
): void {
  let rx = BOTTOM.x + BOTTOM.w - 8;
  const y = BOTTOM.y + BOTTOM.h - 17;
  ctx.font = UI_FONT;
  ctx.letterSpacing = '0px';
  for (const label of chips) {
    const w = Math.ceil(ctx.measureText(label).width) + 8;
    const tx = rx - w;
    ctx.fillStyle = PALETTE.frameParchmentDim;
    ctx.fillRect(tx, y, w, 14);
    ctx.strokeStyle = PALETTE.frameWoodDark;
    ctx.lineWidth = 1;
    ctx.strokeRect(tx + 0.5, y + 0.5, w - 1, 13);
    drawText(ctx, label, tx + 4, y + 1, PALETTE.frameInk);
    rx = tx - 5;
  }
}

// A dotted vertical divider (menu rail keyword | description columns).
function drawDottedV(ctx: CanvasRenderingContext2D, x: number, y: number, h: number): void {
  ctx.fillStyle = PALETTE.frameInkSoft;
  for (let yy = y; yy < y + h; yy += 3) ctx.fillRect(x, yy, 1, 1);
}
// Battle-local TYPE-BADGE colours (a copy of sprites.ts TYPE_COLOR — battle-scoped
// per the isolation fence; the shared sprites helper stays untouched). Covers the
// CH1 UPPERCASE vocabulary + the legacy fixture Mixed-case trio.
const TYPE_BADGE_COLOR: { readonly [k: string]: string } = {
  FLAME: '#c2491a', NATURE: '#246b38', AQUA: '#27579c', BASIC: '#a98e5a', GALE: '#9aaecf',
  VENOM: '#7e3f9c', TERRA: '#7a4e2d', SPARK: '#f0c33a', FROST: '#8fc8e8', SPIRIT: '#9d7fcf',
  BRAWN: '#c25a36', FORGE: '#6a6a72', DRAKE: '#3d6b50',
  Flame: '#c2491a', Sprout: '#246b38', Splash: '#27579c',
};

// TYPE BADGE chips beside the mon name (species.types — up to 2; dual-typed mons
// show both). A colour-filled framed chip, 16px fine-print label. Returns the
// x just past the last chip (for laying the name/badges out in a row).
function drawTypeBadges(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  types: readonly string[],
): number {
  let cx = x;
  ctx.font = UI_FONT;
  ctx.letterSpacing = '0px';
  for (const t of types.slice(0, 2)) {
    const label = String(t).toUpperCase();
    const w = Math.ceil(ctx.measureText(label).width) + 8;
    const h = 14;
    ctx.fillStyle = TYPE_BADGE_COLOR[t] ?? PALETTE.frameInkSoft;
    ctx.fillRect(cx, y, w, h);
    ctx.strokeStyle = PALETTE.silverMid;
    ctx.lineWidth = 1;
    ctx.strokeRect(cx + 0.5, y + 0.5, w - 1, h - 1);
    drawText(ctx, label, cx + 4, y + 1, PALETTE.paper); // fine-print, cream on the colour
    cx += w + 4;
  }
  return cx;
}

// MOMENTUM as a compact ★★☆ STAR ROW (beat 2.5 — the framed sockets retired for a
// small, tidy glyph row). Gold fill for held ★, warm-dim for empty. Battle-local
// (the shared drawMomentum/PALETTE.star used by ~15 other scenes stays untouched).
// Returns the x just past the last star.
const STAR_STEP = 9;
function drawStars(ctx: CanvasRenderingContext2D, x: number, y: number, count: number, cap = 3): number {
  ctx.font = '11px monospace';
  ctx.textBaseline = 'top';
  ctx.textAlign = 'start';
  ctx.letterSpacing = '0px';
  for (let i = 0; i < cap; i += 1) {
    ctx.fillStyle = i < count ? PALETTE.momentumGold : PALETTE.momentumOff;
    ctx.fillText('★', x + i * STAR_STEP, y);
  }
  return x + cap * STAR_STEP;
}

// ── Battle-UI v2 (beat 3) — the PAINTED STAGE ────────────────────────────────
// The DEFAULT arena "made alive" (NOT the deferred biome-slot system). Deterministic
// scatter computed ONCE at module load from a fixed seed → the stage never shimmers
// between frames (zero per-frame RNG). Positions sit in the ground band, below the
// horizon + above the console; panels/sprites draw ON TOP.
const ARENA_HORIZON = 150; // sky above, ground below
const ARENA_SCATTER = ((): { tufts: readonly (readonly [number, number])[]; pebbles: readonly (readonly [number, number])[] } => {
  const rng = mulberry32(0xa2e33);
  const tufts: [number, number][] = [];
  const pebbles: [number, number][] = [];
  for (let i = 0; i < 30; i += 1) tufts.push([12 + Math.floor(rng.next() * 616), 160 + Math.floor(rng.next() * 90)]);
  for (let i = 0; i < 20; i += 1) pebbles.push([12 + Math.floor(rng.next() * 616), 166 + Math.floor(rng.next() * 86)]);
  return { tufts, pebbles };
})();

function drawArena(ctx: CanvasRenderingContext2D): void {
  // Sky + ground base.
  ctx.fillStyle = PALETTE.arenaSky;
  ctx.fillRect(0, 0, BATTLE_LOGICAL_W, ARENA_HORIZON);
  ctx.fillStyle = PALETTE.arenaGround;
  ctx.fillRect(0, ARENA_HORIZON, BATTLE_LOGICAL_W, BATTLE_LOGICAL_H - ARENA_HORIZON);
  // The soft horizon transition band (sky meets ground).
  ctx.fillStyle = PALETTE.arenaHorizon;
  ctx.fillRect(0, ARENA_HORIZON - 5, BATTLE_LOGICAL_W, 10);
  // The big soft CLEARING ellipse — a lighter warm-green field under both mons.
  ctx.fillStyle = PALETTE.arenaField;
  ctx.beginPath();
  ctx.ellipse(BATTLE_LOGICAL_W / 2, 214, 300, 78, 0, 0, Math.PI * 2);
  ctx.fill();
  // Grass tufts (small 3px clusters) + pebbles (2px) — sparse, deterministic.
  ctx.fillStyle = PALETTE.arenaGrass;
  for (const [tx, ty] of ARENA_SCATTER.tufts) {
    ctx.fillRect(tx, ty + 1, 1, 2);
    ctx.fillRect(tx + 1, ty, 1, 3);
    ctx.fillRect(tx + 2, ty + 1, 1, 2);
  }
  ctx.fillStyle = PALETTE.arenaPebble;
  for (const [px, py] of ARENA_SCATTER.pebbles) ctx.fillRect(px, py, 2, 2);
}

// A restyled PLATFORM ellipse sitting IN the clearing (lit top + shaded rim),
// rather than a flat disc floating on green.
function drawPlatform(ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number): void {
  ctx.fillStyle = PALETTE.platformSide;
  ctx.beginPath();
  ctx.ellipse(cx, cy + 2, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = PALETTE.platformTop;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}

// A HP/ST STAT ROW — a 32px primary LABEL, the value bar, and a fine-print
// cur/max numeric readout right-aligned in the panel margin. `notchFrac` draws
// the winded threshold on the ST bar (null = no notch). Shared by both panels.
function drawStatRow(
  ctx: CanvasRenderingContext2D,
  panelX: number,
  panelW: number,
  rowY: number,
  label: string,
  labelColor: string,
  cur: number,
  max: number,
  barColor: string,
  notchFrac: number | null,
): void {
  drawText(ctx, label, panelX + 10, rowY, labelColor); // 16px fine-print label
  const barX = panelX + 32;
  const barW = panelW - 32 - 60; // leave the right margin for the numeric
  const barY = rowY + 2;
  drawBar(ctx, barX, barY, barW, cur, max, barColor, BATTLE_BAR_H);
  if (notchFrac !== null) drawWindedNotch(ctx, barX, barY, barW, BATTLE_BAR_H, notchFrac);
  // Fine-print cur/max (rounded — cur ceils so a living mon never shows 0).
  drawTextRight(
    ctx,
    `${Math.max(0, Math.ceil(cur))}/${Math.round(max)}`,
    panelX + panelW - 10,
    barY - 1,
    PALETTE.frameInkSoft,
  );
}

// STATUS TAGS — the combat-state indicator (FOCUS/DAZE/STAG/EXH) + the effect
// chips (BRN/BULWARK…) as prominent framed tags, laid RIGHT-TO-LEFT from rightX
// along the panel header. Restyle+reposition of the old drawStatusChips.
function drawPanelTags(
  ctx: CanvasRenderingContext2D,
  rightX: number,
  y: number,
  tags: ReadonlyArray<{ readonly label: string; readonly color: string }>,
): void {
  let rx = rightX;
  ctx.font = UI_FONT;
  ctx.letterSpacing = '0px';
  for (const tag of tags) {
    const w = Math.ceil(ctx.measureText(tag.label).width) + 8;
    const h = 15;
    const tx = rx - w;
    ctx.fillStyle = tag.color;
    ctx.fillRect(tx, y, w, h);
    ctx.strokeStyle = PALETTE.silverMid;
    ctx.lineWidth = 1;
    ctx.strokeRect(tx + 0.5, y + 0.5, w - 1, h - 1);
    drawText(ctx, tag.label, tx + 4, y + 1, PALETTE.paper);
    rx = tx - 4;
  }
}

// ── CD-format move grid + status chips (battle-UI rebuild Part 2b-1) ──────────
// Tier → the compact grid badge (Combat 2.0 tiers light/mid/heavy/nuke) and a
// one-word descriptor for the detail panel. Plain colors here; the 2b-2 skin
// (warm/silver/gold) recolours these later.
const TIER_BADGE: { readonly [k in TierName]: string } = {
  light: 'T0',
  mid: 'T1',
  heavy: 'T2',
  nuke: 'T3',
};
const TIER_WORD: { readonly [k in TierName]: string } = {
  light: 'quick',
  mid: 'solid',
  heavy: 'heavy',
  nuke: 'devastating',
};
// Jewel tones per tier for the grid badges (2b-2 skin) — escalating: teal →
// sapphire → purple → velvet as the tier climbs.
const TIER_BADGE_COLOR: { readonly [k in TierName]: string } = {
  light: PALETTE.jewelTeal,
  mid: PALETTE.jewelSapphire,
  heavy: PALETTE.jewelPurple,
  nuke: PALETTE.velvet,
};
// Short chip labels for the effect-layer statuses (the debuff/buff `kind` strings
// from engine data.ts). Display-only abbreviations — the exact wording is a 2b-2
// tuning detail; unknown kinds fall back to an uppercase truncation.
const STATUS_CHIP_LABEL: { readonly [k: string]: string } = {
  burn: 'BURN', daze: 'DAZE', drain: 'DRAIN', entangle: 'ROOT', updraft: 'GALE',
  attunement: 'ATTN', bulwark: 'GUARD', frozen: 'FROZE', inception: 'INCP',
  taunt: 'TAUNT', drained: 'DRND', sap: 'SAP', corrode: 'CORR', silence: 'SLNC',
  echo: 'ECHO', callLock: 'CLOCK', doubt: 'DOUBT', secondWind: 'WIND',
  amplify: 'AMP', sapFocus: 'SAPF', tideMend: 'MEND',
};
function statusChipLabel(kind: string): string {
  return STATUS_CHIP_LABEL[kind] ?? kind.slice(0, 5).toUpperCase();
}

interface MoveCellInfo {
  readonly name: string;
  readonly badge: string;
  readonly tier: TierName;
  readonly cost: number;
  readonly isTech: boolean;
  readonly effectTag: string | null; // technique status label (e.g. BURN)
  readonly type: string | null;
  readonly legal: boolean;
  readonly lockLabel: string | null; // e.g. 'NEEDS ★★' / 'WINDED' / 'LOW ST'
}

// Everything the move grid + detail panel needs for one move, read from engine
// truth (moveLegal / tierMomentumLocked / TIERS / MOMENTUM_REQ_BY_TIER) so the
// locked-state shown matches what the engine will actually allow.
function moveCellInfo(side: SideState, name: string): MoveCellInfo {
  const move = lookupMove(name);
  const tier = move.tier;
  const isTech = move.effect !== undefined;
  const legal = moveLegal(side, name);
  let lockLabel: string | null = null;
  if (!legal) {
    if (side.st <= COMBAT.winded && (tier === 'heavy' || tier === 'nuke')) lockLabel = 'WINDED';
    else if (tierMomentumLocked(side, move)) lockLabel = `NEEDS ${'★'.repeat(MOMENTUM_REQ_BY_TIER[tier])}`;
    else lockLabel = 'LOW ST';
  }
  return {
    name,
    badge: TIER_BADGE[tier],
    tier,
    cost: TIERS[tier].cost,
    isTech,
    effectTag: isTech && move.effect ? statusChipLabel(move.effect.status) : null,
    type: move.type,
    legal,
    lockLabel,
  };
}

// A tiny PADLOCK glyph (m3x6 has none) — a 6×8 code-drawn lock, for a locked cell.
function drawPadlock(ctx: CanvasRenderingContext2D, x: number, y: number, color: string): void {
  ctx.fillStyle = color;
  ctx.fillRect(x, y + 3, 6, 5); // body
  ctx.fillRect(x + 1, y, 1, 4); // shackle left
  ctx.fillRect(x + 4, y, 1, 4); // shackle right
  ctx.fillRect(x + 1, y, 4, 1); // shackle top
}

// A small framed chip (tier badge / effect tag) — a colour box + silver trim +
// cream label. Returns the x just past it. Battle-local console furniture.
function drawChip(ctx: CanvasRenderingContext2D, x: number, y: number, label: string, fill: string): number {
  ctx.font = UI_FONT;
  ctx.letterSpacing = '0px';
  const w = Math.ceil(ctx.measureText(label).width) + 7;
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, w, 12);
  ctx.strokeStyle = PALETTE.silverDim;
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, 11);
  drawText(ctx, label, x + 3, y, PALETTE.paper);
  return x + w;
}

// A move cell in the 2×3 grid (beat-2 richer): a BOXED tier chip (T0/T1…), the
// name, and on the right either an EFFECT chip (BURN/…) + ST for a technique, or
// the ST cost, or a PADLOCK + the lock reason ("NEEDS ★★") for an illegal move.
// Selected cells get the stronger (double gold) border. Velvet stripe marks TEC.
function drawMoveCell(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  info: MoveCellInfo,
  selected: boolean,
): void {
  ctx.fillStyle = PALETTE.frameParchmentDim; // inset parchment cell
  ctx.fillRect(x, y, w, h);
  if (selected) {
    ctx.fillStyle = 'rgba(158,74,58,0.5)'; // velvet selection wash
    ctx.fillRect(x, y, w, h);
  }
  if (info.isTech) {
    ctx.fillStyle = PALETTE.velvet; // TEC accent stripe (the two pools read apart)
    ctx.fillRect(x, y, 3, h);
  }
  ctx.strokeStyle = selected ? PALETTE.momentumGold : PALETTE.frameWoodDark;
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  if (selected) ctx.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3); // stronger (double) border
  const ty = y + Math.round(h / 2) - 6;
  const legal = info.legal;
  // Boxed tier chip.
  drawChip(ctx, x + 6, ty - 1, info.badge, legal ? TIER_BADGE_COLOR[info.tier] : PALETTE.frameInkDim);
  // Name (with the > cursor).
  drawText(ctx, `${selected ? '>' : ' '}${info.name}`, x + 32, ty, legal ? PALETTE.frameInk : PALETTE.frameInkDim);
  // Right side.
  if (info.lockLabel) {
    const lw = Math.ceil(measureUiText(ctx, info.lockLabel));
    drawText(ctx, info.lockLabel, x + w - 5 - lw, ty, PALETTE.hpCrit);
    drawPadlock(ctx, x + w - 5 - lw - 9, ty + 1, PALETTE.hpCrit);
  } else if (info.effectTag) {
    // Effect chip + ST for a technique.
    drawTextRight(ctx, `ST${info.cost}`, x + w - 5, ty, PALETTE.frameInkSoft);
    const ew = Math.ceil(measureUiText(ctx, `ST${info.cost}`));
    drawChip(ctx, x + w - 5 - ew - 4 - (Math.ceil(ctx.measureText(info.effectTag).width) + 7), ty - 1, info.effectTag, PALETTE.brass);
  } else {
    drawTextRight(ctx, `ST${info.cost}`, x + w - 5, ty, PALETTE.frameInkSoft);
  }
}

// Active effect-layer statuses on a side, as chips (the previously-invisible
// combat depth: the debuff + stacking buffs from the effect moves). Read from
// live engine state — the debuff/buff instances.
function sideChips(side: SideState): ReadonlyArray<{ readonly label: string; readonly buff: boolean }> {
  const out: { label: string; buff: boolean }[] = [];
  const debuff: StatusInstance | undefined = side.debuff;
  if (debuff) out.push({ label: statusChipLabel(debuff.kind), buff: false });
  for (const b of side.buffs ?? []) out.push({ label: statusChipLabel(b.kind), buff: true });
  return out;
}

// (The old drawStatusChips — an external horizontal chip pass over the panel
// header — is retired: chips are now the integrated top-right TAGS drawn INSIDE
// each panel via buildTags + drawPanelTags, sharing the sideChips data.)

export interface BattleSceneOpts {
  readonly state: BattleState;
  readonly rng: RNG;
  readonly chooseFoeAction: (state: BattleState, rng: RNG) => Action;
  readonly intro: readonly string[];
  // Gates Catch Breath / Get Away (the Warming bond moment; other Calls gate on bond stage).
  readonly catchBreathUnlocked: boolean;
  // Lane B — the active mon's bond value (0–100), gating the newly-built Calls
  // per CALL_UNLOCK_STAGE (Recover/Dodge/Full Power). Omitted → stage 1 → those
  // Calls stay locked. Read-only (does NOT move bond); independent of Lane A's
  // bond bar so the lanes stay decoupled.
  readonly callBondValue?: number;
  // Lane B — dev/playtest override (?calls=all): unlock every BUILT Call now,
  // bypassing the bond gate, so the effects can be tested. The shipping default
  // is bond-gated (this is false); never ship with it on.
  readonly devUnlockAllCalls?: boolean;
  // DEV TOOL — the toggleable dev combat-log. When true (or the `?log=1` URL
  // hook / the `~` runtime toggle), an overlay narrates the raw BattleEvents
  // (strikes, ★ changes + why, status apply/tick/clear, technique casts, Calls)
  // as they resolve, so the invisible combat depth is legible for playtesting
  // and debugging. OFF by default — it's a dev tool, NOT the shipping
  // player-facing status UI (that arrives with the 640×360 battle-UI upgrade).
  // Pure display: it reads the events the engine already emits and changes no
  // combat logic. Explicit opt for tests; the shipping paths use the URL hook.
  readonly devLog?: boolean;
  readonly canRun: boolean;
  // Intent reliability ramp (Phase 6.7-A) — how truthfully the FOE INTENT
  // bar shows the foe's STANCE. Defaults HONEST (wild mons + every legacy
  // caller). Trainers/leaders are AMBIGUOUS; late bosses OPAQUE. This is
  // PRESENTATION only — the engine always commits the true stance.
  readonly intentReliability?: IntentReliability;
  // Combat Layer 4 Stage 1 — the FOE's information discipline for a FOCUS tell
  // (graduated, Layer 3.5 seam). When a PROFILED trainer Focuses, the Foe
  // Intent narrows which release is coming per this discipline: 'open' → a
  // learnable 2-of-3 narrowing ("focuses to attack/outwit/move fast"); 'vague'
  // → a non-specific tell; 'opaque' → just "FOCUSING". Omitted (wild /
  // unprofiled) → the legacy generic "is focusing". `favoredRelease` predicts
  // the release at focus time (else derived from the focus stance); `salt`
  // (the trainer's name) keeps the 'open' narrowing CONSISTENT per trainer so
  // tells are learnable. PRESENTATION only — no engine effect.
  readonly foeFocusInfo?: FocusIntentInfo;
  // Final BattleState is handed back so the caller can write party
  // hp/st/momentum forward (the Phase 2 writeback). 1v1 callers can
  // ignore `finalState`; team callers extract state.player.members.
  // `participants` = the player member indices that took the field this
  // battle (initial active + every switch/forced-switch-in), so bond is
  // credited to the mon(s) that ACTUALLY fought, not just the lead.
  readonly onResolve: (
    winner: 'player' | 'foe',
    finalState: BattleState,
    participants: readonly number[],
  ) => void;

  // ---- Bond legibility (Lane A) — display only -------------------------
  // Per-player-member current bond value (0–100), index-aligned with
  // state.player.members (≡ run.party). The bond bar under the player panel
  // shows the ACTIVE mon's standing (stage + progress). STATIC during the
  // fight (bond doesn't move mid-round); it advances on the post-fight
  // victory beat, XP-style. Omitted (sim / isolated tests) → no bar drawn.
  // Foe bond is intentionally hidden (bond stays private; the foe's ★ IS now
  // shown — its differential is load-bearing for the behind-penalty/tier-access).
  readonly playerBond?: readonly number[];
  // This fight's challenge context, so the bar can compute its post-win
  // advance via the SAME pure bond pipeline the authoritative award uses
  // (display-only — the real award stays game-side in awardBondForFight).
  // Omitted → the bar stays static even on a win (no advance animation).
  readonly bondContext?: { readonly kind: FightKind; readonly foePower: number };
  // Fleeing (RUN, wild only) is distinct from a loss — it must NOT
  // black out. When wired, RUN calls this instead of onResolve('foe');
  // the caller returns the player to the same overworld tile, no heal.
  readonly onFlee?: (finalState: BattleState) => void;

  // ---- Phase 6a — Catching 2.0 (wild encounters only) -------------------
  // When true, the battle offers catching (the BALL menu row + the
  // Path-2 spare-offer on a foe faint). The catch MATH lives in the
  // callbacks below (game-side); the scene only tracks windows/Wariness
  // and plays the beats.
  readonly canCatch?: boolean;
  // TUTORIAL guard-rails (game-layer UX, NOT a mechanics fork) — set ONLY by
  // the scripted guided catch (the Route 31 first-grass beat). When true the
  // practice mon can't flee and out-of-window throws give a gentle correction
  // instead of raising Wariness; live read/throw prompts surface each turn.
  // Wild/trainer catches leave this undefined and keep the full Catching 2.0
  // rules. The forgiving values live in tutorialCatch.ts. See docs/catching-2-0.md.
  readonly tutorial?: boolean;
  readonly ballCount?: () => number;
  readonly medicineCount?: () => number;
  // Path 1 — throw a ball. The scene passes the window it detected + the
  // foe HP fraction; the caller consumes a ball, rolls the catch, and
  // returns whether it caught.
  readonly onThrowBall?: (window: import('../catching').CatchWindow, foeHpFrac: number) => { readonly caught: boolean };
  // Caught — the caller adds the wild mon to the party/box. `origin`
  // records HOW it was caught (Path 1 = 'read', Path 2 = 'mercy') so the
  // caller can persist provenance (living-world.md Feature 3).
  readonly onCaught?: (finalState: BattleState, origin: import('../catching').CatchOrigin) => void;
  // Path 2 — spare a FAINTED wild mon with medicine. The caller consumes
  // medicine, rolls the willing-join, and returns whether it joined (+ a
  // refusal hint when it didn't).
  readonly onWillingJoin?: () => { readonly joined: boolean; readonly hint: string };
  // The wild mon escaped (Wariness flee, or a spare declined/refused with
  // the foe gone). Returns the player to the overworld, no catch, no
  // black-out (same shape as onFlee).
  readonly onFoeGone?: (finalState: BattleState) => void;
}

// Display carries everything the panel needs about the CURRENTLY-SHOWN
// mon (its species, maxHp, and live hp/st/etc). It LAGS the engine
// across a switch — state.player.active updates synchronously at
// commit, but display.player only catches up when the switchIn event
// applies. Routing the panel through display (not activeMon(state))
// keeps name + bar matched: the HP bar's numerator AND denominator
// always come from the same mon, so the bar can't overflow or appear
// to "regain" on switch-in.
interface DisplaySide {
  hp: number;
  maxHp: number;
  st: number;
  // The mon's max stamina — per-mon now (stat-foundation), so the ST bar scales
  // to the real pool instead of a hardcoded 100 (a Glass nuke's full bar would
  // otherwise read 75%). Static across the battle; carried via the snapshot spread.
  maxSt: number;
  momentum: number;
  exhausted: boolean;
  staggered: boolean;
  // Per-round daze indicator (thrice-repeat). Not on SideState (it's a
  // per-round verdict from history) — set by the `dazed` event, cleared at
  // each roundStart, shown as a panel tag so the player sees the effect.
  dazed: boolean;
  // FOCUS model — this mon is FOCUSING (R1, gathering energy), shown as a
  // GENERIC "FOCUS" HUD tag: the opponent sees that a release is coming, NOT
  // which. Set by `focus`, cleared by `release`; persists across roundStart.
  focusing: boolean;
  species: Species;
  // Player-chosen display nickname (carried so the HUD/log name the player's mon
  // by it). Absent for foe/wild mons → they show their species.
  nickname?: string;
}

interface Display {
  player: DisplaySide;
  foe: DisplaySide;
}

// Build the panel's top-right TAG row: the combat-state indicator (FOCUS/DAZE/
// STAG from the animated display, + EXH) followed by the effect chips (BRN /
// BULWARK… from live engine state). Colours carry meaning (velvet warn / red
// crit / amber stagger / jewel-teal buff). Consumed by drawPanelTags.
function buildTags(disp: DisplaySide, live: SideState): { label: string; color: string }[] {
  const tags: { label: string; color: string }[] = [];
  if (disp.focusing) tags.push({ label: 'FOCUS', color: PALETTE.velvet });
  else if (disp.dazed) tags.push({ label: 'DAZE', color: PALETTE.hpCrit });
  else if (disp.staggered) tags.push({ label: 'STAG', color: PALETTE.hpWarn });
  if (disp.exhausted) tags.push({ label: 'EXH', color: PALETTE.hpCrit });
  for (const c of sideChips(live)) {
    tags.push({ label: c.label, color: c.buff ? PALETTE.jewelTeal : PALETTE.velvet });
  }
  return tags;
}

function snapshot(side: SideState): DisplaySide {
  return {
    hp: side.hp,
    maxHp: side.maxHp,
    st: side.st,
    maxSt: side.maxSt,
    momentum: side.momentum,
    exhausted: side.exhausted,
    staggered: side.staggered,
    dazed: false,
    focusing: side.focus !== undefined,
    species: side.species,
    ...(side.nickname ? { nickname: side.nickname } : {}),
  };
}

function opposite(side: Side): Side {
  return side === 'player' ? 'foe' : 'player';
}

// The ★ credit a read-win carries — appended to the COUNTER/OPENING/DODGE/
// CLASH callout so the player SEES that winning a read charges momentum, and
// (crucially) that LOSING a read charges the FOE's ★. This is the cause/
// effect the playtest couldn't read ("I couldn't tell I was losing reads").
function starTag(winner: Side): string {
  return winner === 'player' ? '  (+★ you!)' : '  (+★ foe)';
}

function computeInit(side: SideState, moveName: string | null, stance: Stance): number {
  if (moveName === null) return -1;
  const tier = lookupMove(moveName).tier;
  const weight = TIERS[tier].weight;
  const base = side.species.spd / weight;
  const stag = side.staggered ? base * COMBAT.staggerInitMult : base;
  void stance; // stance does not affect init; argument kept for completeness
  return stag;
}

// The TRUE turn-order verdict, mirroring the engine's resolveRound order
// logic: Layer 1 — a FLUID move acts first vs any non-Fluid stance (even when
// slower); both-Fluid or neither-Fluid falls to initiative (speed ÷ move
// weight, stagger-halved). This is what the move-menu NEXT preview shows —
// the honest answer to "who acts first". Exported so a test can pin it
// against the engine's actual `first`.
export function orderHint(
  pl: SideState,
  foe: SideState,
  plMove: string | null,
  plStance: Stance,
  foeMove: string | null,
  foeStance: Stance,
): 'YOU > FOE' | 'FOE > YOU' | 'TIE' {
  const plFluid = plMove !== null && plStance === 'F';
  const foeFluid = foeMove !== null && foeStance === 'F';
  if (plFluid && !foeFluid) return 'YOU > FOE';
  if (foeFluid && !plFluid) return 'FOE > YOU';
  const pi = computeInit(pl, plMove, plStance);
  const fi = computeInit(foe, foeMove, foeStance);
  if (pi < 0 && fi < 0) return 'TIE';
  if (pi < 0) return 'FOE > YOU';
  if (fi < 0) return 'YOU > FOE';
  if (pi > fi) return 'YOU > FOE';
  if (fi > pi) return 'FOE > YOU';
  return 'TIE';
}

function actionStance(action: Action): Stance {
  return action.kind === 'move' ? action.stance : 'G';
}

function actionMove(action: Action): string | null {
  return action.kind === 'move' ? action.move : null;
}

// ---- Intent reliability ramp (Phase 6.7-A; honest-partial model 6.7-A') ------
// The foe ALWAYS commits a real stance (foeAction → resolveRound, untouched).
// Intent is shown in PLAIN LANGUAGE and is always HONEST — reliability only
// controls how PRECISE it is: honest = the exact stance; ambiguous = an honest
// hint that narrows the guess to two stances (always one of which is the true
// one — never a lie); opaque = nothing at all (a pure cold read). The narrow
// pick is rng-injected so it's testable and never touches the engine stream.
export type IntentReliability = 'honest' | 'ambiguous' | 'opaque';

export interface ShownIntent {
  // The plain-language intent line to show after "FOE INTENT:", or null for
  // OPAQUE (the renderer shows a blank dash — no read).
  readonly line: string | null;
}

// Present-tense stance phrasing for the live intent bar.
function stanceIntentVerb(stance: Stance): string {
  return stance === 'A' ? 'attacks aggressively' : stance === 'G' ? 'braces' : 'strikes with agility';
}

// Confirmation for the resolution log (the teaching loop — the player learns
// whether their read was right). Names BOTH the stance (the read outcome) AND
// the move (what damage/effect landed), so neither piece of feedback is lost.
function stanceConfirmLine(name: string, stance: Stance, move: string): string {
  if (stance === 'A') return `${name} attacks aggressively with ${move}!`;
  if (stance === 'G') return `${name} braces with ${move}!`;
  return `${name} strikes with agility using ${move}!`;
}

// The AMBIGUOUS hints. Each is HONEST: its `pair` of possible stances always
// CONTAINS the foe's true stance, so the hint halves the guess (a real 50/50)
// without ever deceiving the player.
const NARROW_HINTS: readonly { readonly text: string; readonly pair: readonly Stance[] }[] = [
  { text: 'intends to attack', pair: ['A', 'F'] }, // rules out Guard
  { text: 'looks focused', pair: ['G', 'F'] }, // rules out Aggressive
  { text: 'is hard to read', pair: ['A', 'G'] }, // rules out Fluid
];

// Combat Layer 4 Stage 1 — the FOCUS tell vocabulary (info-warfare, Layer 3.5).
// Three 2-of-3 LENSES, each pairing two releases, so an 'open' trainer's Focus
// leaks a learnable 50/50 (information without certainty) instead of a blind
// 1/3 guess. The LENS (attack/outwit/move fast) is the learned vocabulary; it
// stays constant across both phases of a Focus. Only the VERB changes per phase
// (wind-up "is charging to…" vs release "focuses to…") so the player can tell
// WHICH phase they're in — and the wind-up verb is a tactical invitation (the
// foe is mid-charge → interruptible with Aggressive). See KICKOFF-focus-tell-
// phase-clarity.md.
// The two phases of a foe Focus: the WIND-UP (R1, committed but not releasing —
// the foe's vulnerability window) and the RELEASE (R2, resolving this round).
export type FocusPhase = 'windup' | 'release';
export interface FocusIntentInfo {
  // The focus-axis info level (open/veiled/opaque) — usually the profile's
  // unified infoLevel, possibly per-axis overridden (Bluffer).
  readonly discipline: InfoLevel;
  // The SET of releases this trainer's Focus can produce (1 for fixed-Heavy, 2
  // for a variable feint-mix). The 'open' tell narrows to the lens that
  // truthfully contains EVERY possible release → a genuine, consistent 50/50.
  readonly releases?: readonly ReleaseKind[];
  readonly salt?: string;
}
const FOCUS_LENSES: readonly { readonly lens: string; readonly pair: readonly ReleaseKind[] }[] = [
  { lens: 'attack', pair: ['heavy', 'feint'] }, // both HIT you
  { lens: 'outwit', pair: ['hide', 'feint'] }, // both DECEIVE
  { lens: 'move fast', pair: ['heavy', 'hide'] }, // both SPEED-of-commit
];

// One unified info level drives BOTH tells (kickoff call #2). The STANCE tell
// uses IntentReliability; map the level onto it (open→honest, veiled→ambiguous,
// opaque→opaque). The FOCUS tell uses the level directly (open/veiled/opaque).
export function infoLevelToReliability(level: InfoLevel): IntentReliability {
  return level === 'open' ? 'honest' : level === 'veiled' ? 'ambiguous' : 'opaque';
}

// A tiny stable hash → an index, so an 'open' trainer's narrowing is CONSISTENT
// across the fight (learnable) yet can differ between trainers for the same
// release (so a phrase never collapses into a perfect tell). No engine RNG.
function saltIndex(salt: string, mod: number): number {
  let h = 0;
  for (let i = 0; i < salt.length; i += 1) h = (h * 31 + salt.charCodeAt(i)) >>> 0;
  return mod <= 0 ? 0 : h % mod;
}

// The Foe Intent line for a FOCUS, graduated by the trainer's info level AND
// phase. R2 (release) phrases are the existing ones; R1 (wind-up) uses the
// "charging / gathering" verbs over the SAME lens. `releases` is the possible
// set (truthful for ALL of them → a real 50/50 for a variable release).
export function focusIntentTell(
  releases: readonly ReleaseKind[],
  name: string,
  info: FocusIntentInfo,
  phase: FocusPhase = 'release',
): string {
  const windup = phase === 'windup';
  if (info.discipline === 'opaque') return windup ? `${name} is gathering...` : `${name} is FOCUSING`;
  if (info.discipline === 'veiled') return windup ? `${name} is gathering intently` : `${name} is focusing intently`;
  // 'open' — the lens whose pair contains EVERY possible release (so it's
  // truthful whichever fires). A 2-release set → exactly one lens (a real
  // 50/50). A 1-release set → two valid lenses → salt-pick (consistent per
  // trainer, never a perfect tell). The lens is identical across phases; only
  // the verb changes ("JAY is charging to attack" → "JAY focuses to attack").
  const set = releases.length > 0 ? releases : (['heavy'] as const);
  const valid = FOCUS_LENSES.filter((h) => set.every((r) => h.pair.includes(r)));
  const lens = (valid[saltIndex(info.salt ?? name, valid.length)] ?? valid[0] ?? FOCUS_LENSES[0]!).lens;
  return windup ? `${name} is charging to ${lens}` : `${name} focuses to ${lens}`;
}

// Honest, full-clarity plain-language line for any foe action.
//
// SEAM (forward design, do not build): an "intent" is "an action being
// telegraphed" — STANCE is just the first kind. This dispatches on action.kind
// already, so a future ENEMY CALL ("the leader reaches for something…",
// narrowed/hidden by the same reliability tier) flows through here as another
// case + its own narrow-hint set — no rewrite of degradeIntent or the renderer.
// See docs/intent-tells-design-note.md ("Call-intent" seam).
function foeActionLine(action: Action, name: string): { stance: Stance | null; line: string } {
  if (action.kind === 'rest') return { stance: null, line: `${name} is resting` };
  if (action.kind === 'catchBreath') return { stance: null, line: `${name} is recovering` };
  if (action.kind === 'switch') return { stance: null, line: `${name} is switching` };
  if (action.kind === 'throwBall') return { stance: null, line: `${name} readies a ball` };
  if (action.kind === 'call') return { stance: null, line: `${name} calls out` };
  // FOCUS R2 (no-info fallback) — releasing this round. (Profiled focusers go
  // through focusIntentTell with a discipline; this is the wild/unprofiled
  // generic, phase-distinguished from the wind-up below.)
  if (action.kind === 'release') return { stance: null, line: `${name} is focusing` };
  // FOCUS R1 (no-info fallback) — winding up. "gathering" mirrors the wind-up
  // verb of the disciplined tells so the phase reads even with no narrowing.
  if (action.commit === true) return { stance: null, line: `${name} is gathering` };
  return { stance: action.stance, line: `${name} ${stanceIntentVerb(action.stance)}` };
}

export function degradeIntent(
  action: Action,
  name: string,
  reliability: IntentReliability,
  rng: RNG,
  foeFocusInfo?: FocusIntentInfo,
): ShownIntent {
  // OPAQUE (Elite Four / Champion) — no indicator at all. Pure cold read.
  if (reliability === 'opaque') return { line: null };
  // FOCUS tell (Layer 4 Stage 1) — a profiled trainer's Focus narrows which
  // release is coming per its info-discipline, PHASE-aware: the focus COMMIT
  // (R1 wind-up, "is charging to…" — telegraphs next round's release AND flags
  // the interrupt window) vs MID-FOCUS (R2 release, "focuses to…" — resolving
  // this round). The lens is consistent across both phases.
  if (foeFocusInfo) {
    const isFocusCommit = action.kind === 'move' && action.commit === true;
    const isRelease = action.kind === 'release';
    if (isFocusCommit || isRelease) {
      const phase: FocusPhase = isRelease ? 'release' : 'windup';
      const releases = foeFocusInfo.releases ?? ['heavy'];
      return { line: focusIntentTell(releases, name, foeFocusInfo, phase) };
    }
  }
  const honest = foeActionLine(action, name);
  // HONEST tier, or a stance-less action (nothing to narrow): full clarity.
  if (reliability === 'honest' || honest.stance === null) return { line: honest.line };
  // AMBIGUOUS — an honest narrow-to-2 hint. Pick uniformly among the hints
  // whose pair contains the true stance so EVERY hint stays a genuine 50/50
  // (a fixed per-stance mapping would collapse one hint into a perfect tell).
  const valid = NARROW_HINTS.filter((h) => h.pair.includes(honest.stance!));
  const hint = valid[Math.floor(rng.next() * valid.length)] ?? valid[0]!;
  return { line: `${name} ${hint.text}` };
}

// Combat legibility (S1) — the explanatory callout for a resolved
// triangle interaction. Names the RULE, not just the event, so the
// player learns the triangle by playing. Returns null when the event
// isn't a triangle teaching moment.
export function stanceCallout(args: {
  readonly kind: 'counter' | 'opening' | 'dodge' | 'punish' | 'strike';
  readonly attackerStance?: Stance | undefined;
  readonly defenderStance?: Stance | undefined;
}): string | null {
  if (args.kind === 'counter') return 'COUNTER! GUARD turns AGGRESSION back';
  if (args.kind === 'opening') return 'OPENING! FLUID slips past GUARD';
  // Layer 1 — AGGRESSIVE beats FLUID: the aggressor catches the dodger.
  if (args.kind === 'punish') return 'PUNISH! AGGRESSION catches FLUID';
  // Legacy (pre-Layer-1): Fluid evaded Aggressive. No longer emitted.
  if (args.kind === 'dodge') return 'DODGE! FLUID evaded — it was faster';
  return null;
}

// Combat legibility (S2) — the player-vs-foe SPEED relationship. Speed
// decides dodges AND turn order; it's the hidden variable that makes
// combat feel random. Surfaced as a persistent readout.
export function speedLabel(
  playerSpd: number,
  foeSpd: number,
): 'YOU FASTER' | 'YOU SLOWER' | 'SPEED EVEN' {
  if (playerSpd > foeSpd) return 'YOU FASTER';
  if (playerSpd < foeSpd) return 'YOU SLOWER';
  return 'SPEED EVEN';
}

// The Call set the submenu reads (Call-menu sprint). DATA-driven so
// adding a Call later is data, not a rewrite. Only Catch Breath is
// BUILT this build (Lane B, docs/call-effects-design.md): Catch Breath, Get
// Away, Recover (heal 50% maxHp), Dodge (full evade), Full Power (+50% on the
// next attack — a two-step: arm it, then pick an attack). `built: false` Calls
// render greyed + cursor-skipped. `{MON}` in the shout is the active mon name.
export interface CallDef {
  readonly id: string;
  readonly name: string;
  readonly starCost: number;
  readonly built: boolean;
  readonly shout: string;
  // FULL POWER is a TWO-STEP Call: confirming it doesn't resolve — it ARMS a
  // +50% buff and returns to the attack menu to pick the move that gets it.
  // Marked here so the menu dispatches to the arm flow instead of fireCall.
  readonly armsAttack?: boolean;
  // THROW THEM OFF is a TWO-STEP Call: confirming opens a stance PLANT picker
  // (which lie to log into history) before it fires.
  readonly picksStance?: boolean;
  // COME BACK is a TWO-STEP Call: confirming opens the PARTY picker (which bench
  // mon to send) before it fires the protected switch.
  readonly picksSwitch?: boolean;
}
export const CALL_SET: readonly CallDef[] = [
  { id: 'catch-breath', name: 'Catch Breath', starCost: 1, built: true, shout: '{MON}, catch your breath!' },
  // Layer 2 — GET AWAY escapes a committed enemy release (1 ★, forgo the strike).
  { id: 'get-away', name: 'Get Away', starCost: 1, built: true, shout: '{MON}, get away!' },
  // The Calls increment — SHAKE IT OFF: the owed CLEANSE, filling the retired
  // Hang In There slot (its survive-at-1HP effect is now the bond-MOMENT). Clears
  // the active debuff via the engine's clearDebuff. Bond-gated (CALL_UNLOCK_STAGE).
  { id: 'shake-off', name: 'Shake It Off', starCost: 1, built: true, shout: '{MON}, shake it off!' },
  // Lane B — newly BUILT. Bond-tier gated (see CALL_UNLOCK_STAGE); each spends ★.
  { id: 'recover', name: 'Recover', starCost: 1, built: true, shout: 'Easy, {MON} — recover!' },
  { id: 'dodge', name: 'Dodge', starCost: 1, built: true, shout: '{MON}, dodge it!' },
  { id: 'full-power', name: 'Full Power', starCost: 2, built: true, shout: 'Now — {MON}, full power!', armsAttack: true },
  // The Calls increment — the INFO-WAR pair + the TEAM-TEMPO lane (all ★1).
  { id: 'read-them', name: 'Read Them', starCost: 1, built: true, shout: '{MON}, read them!' },
  { id: 'throw-off', name: 'Throw Them Off', starCost: 1, built: true, shout: '{MON}, throw them off!', picksStance: true },
  { id: 'come-back', name: 'Come Back', starCost: 1, built: true, shout: '{MON}, come back!', picksSwitch: true },
];

// Lane B — the bond-stage at which each newly-built Call unlocks (the real,
// shipping rule; trainer profiles are balanced against this schedule). Catch
// Breath / Get Away keep their existing Warming-moment gate (opts.catchBreath-
// Unlocked). The escalating ladder gates the stronger Calls later:
//   Recover → Companions (3) · Dodge → In Sync (4) · Full Power → Partners (5).
// PLACEMENT IS A TUNING DETAIL (bond-track-v2 leaves exact stage→Call to
// Mathias) — data here so a retune is a one-line change, not a rewrite.
const CALL_UNLOCK_STAGE: { readonly [id: string]: number } = {
  'shake-off': 3, // the owed cleanse — arrives with the status era
  recover: 3,
  dodge: 4,
  'full-power': 5,
  // The Calls increment — the info-war + team-tempo lanes (placement is a TUNING
  // detail; the info-war pair is the higher-skill spend, the team lane mid-bond).
  'read-them': 4,
  'throw-off': 5,
  'come-back': 4,
};

export function callShout(call: CallDef, monName: string): string {
  return call.shout.replace('{MON}', monName);
}

export function createBattleScene(opts: BattleSceneOpts): Scene {
  let state: BattleState = opts.state;
  // Player member indices that took the field (initial active + every
  // switch-in). Drives per-mon bond crediting — the mon that fought earns
  // the bond, not whoever happens to be party slot 0.
  const playerParticipated = new Set<number>([opts.state.player.active]);
  const participants = (): number[] => [...playerParticipated].sort((a, b) => a - b);
  let foeAction: Action = { kind: 'rest' };
  // Intent reliability ramp (Phase 6.7-A). `shownIntent` is the (possibly
  // degraded) display recomputed once per turn from the TRUE foeAction; the
  // renderer reads it, never foeAction directly. The feint roll runs on a
  // scene-local RNG seeded independently of opts.rng, so degrading the
  // display cannot perturb the engine stream → ladders stay bit-identical.
  const reliability: IntentReliability = opts.intentReliability ?? 'honest';
  const intentRng: RNG = mulberry32(INTENT_DISPLAY_SEED);
  // ---- BOND-TELLS (Part 1) — your mon helps you read the foe -----------------
  // PRESENTATION ONLY: the intent display never feeds the engine (the feint roll
  // uses INTENT_DISPLAY_SEED, decoupled from opts.rng), and the sim reads the
  // committed foe action directly, so none of this touches the ladders. Gated on
  // the ACTIVE player mon's own bond stage (read live so it tracks switches).
  const activeBondStage = (): number => bondStage(opts.playerBond?.[state.player.active] ?? 0);
  // Stage 4+ ("In Sync"): the partner reads the foe MORE reliably — bump the
  // intent one clarity tier (opaque→ambiguous→honest). Reduces the degradation.
  const bondTellReliability = (base: IntentReliability): IntentReliability => {
    if (activeBondStage() < BOND_TELL_STAGE) return base;
    return base === 'opaque' ? 'ambiguous' : 'honest';
  };
  // Flavour the bond-sourced tell so it reads as YOUR PARTNER reading, not a UI
  // upgrade. Stage 6+ ("Kindred") adds the Focus WARNING — the partner senses a
  // committed Focus (wind-up or release), which the foe's info-discipline might
  // otherwise hide.
  const bondFlavorIntent = (shown: ShownIntent, foeAct: Action): ShownIntent => {
    const stage = activeBondStage();
    if (stage < BOND_TELL_STAGE || shown.line === null) return shown;
    const partner = activeMon(state.player).species.name;
    const focusing = foeAct.kind === 'release' || (foeAct.kind === 'move' && foeAct.commit === true);
    if (stage >= BOND_MOMENT_STAGE && focusing) {
      return { ...shown, line: `${partner} bristles — ${shown.line}` };
    }
    return { ...shown, line: `${partner} reads — ${shown.line}` };
  };
  const bondIntent = (foeAct: Action): ShownIntent =>
    bondFlavorIntent(
      degradeIntent(foeAct, activeMon(state.foe).species.name, bondTellReliability(reliability), intentRng, opts.foeFocusInfo),
      foeAct,
    );
  // READ THEM (the Calls increment) — the HONEST intent line, bypassing BOTH the
  // stance degradation (reliability → 'honest') AND the foe's focus info-discipline
  // (forced 'open') for this one round. Presentation-only: it reads the true
  // committed foeAction, never feeds the engine (the 'readThem' Call is inert).
  const honestIntentLine = (foeAct: Action): string | null => {
    const openFocus = opts.foeFocusInfo
      ? { ...opts.foeFocusInfo, discipline: 'open' as InfoLevel }
      : undefined;
    return degradeIntent(foeAct, activeMon(state.foe).species.name, 'honest', intentRng, openFocus).line;
  };
  let shownIntent: ShownIntent = bondIntent(foeAction);
  let display: Display = {
    player: snapshot(activeMon(state.player)),
    foe: snapshot(activeMon(state.foe)),
  };
  const breakThreshold = state.bossCard?.breakBar ?? 0;
  let displayBreakProgress = state.breakProgress ?? 0;
  let breakFlashT = 0;
  // BUG 3 — boss legibility: a short flash when the break meter ticks up so the
  // metronome boss READS like one. (The PHASE readout was retired with the old
  // strip — beat 1: the integrated BREAK row is label + pips + role tag.)
  let breakPipFlashT = 0;
  // Combat legibility (S1) — the current round's committed stances (so a
  // landed strike can tell an A-vs-F "couldn't evade" from a normal hit)
  // + the explanatory callout banner shown during resolve.
  let roundStance: { player: Stance | null; foe: Stance | null } = { player: null, foe: null };
  let calloutLine: string | null = null;
  // Situation-bar (read-war callout) FADE: instead of a hard jump in/out, the
  // banner fades in when a new line appears, holds for the beat's dwell (which is
  // the readable part), then fades out (lingering) when it clears. situationShown
  // is the text currently displayed (it lingers through the fade-out);
  // situationAlpha is its opacity. Pure presentation/timing.
  let situationShown: string | null = null;
  let situationAlpha = 0;
  const SITUATION_FADE_SEC = 0.18; // fade-in/out speed; the dwell is the beat hold

  let phase: 'text' | 'menu' | 'move' | 'call' | 'release' | 'throwoff' | 'spare' | 'party' | 'resolve' | 'end' = 'text';
  // THROW THEM OFF — the stance-plant picker cursor (indexes STANCES).
  let throwOffCursor = 0;
  // Phase 6a catch state (wild only). pendingReadWindow = a player
  // read-win opened a 1-round window last round; wariness rises on
  // out-of-window throws → flee telegraph; spareCursor drives the
  // Path-2 spare offer.
  let wariness = 0;
  let pendingReadWindow = false;
  let fleeWarned = false;
  let spareCursor: 0 | 1 = 0;
  let textQueue: string[] = [...opts.intro];
  let textNext: (() => void) | null = beginTurn;
  // Party-picker mode. 'voluntary' = opened from FIGHT menu's PKMN row
  // (switch is a turn action; B cancels back to menu). 'forced' = opened
  // by a faint→forcedSwitch event mid-resolve (player MUST pick the
  // next mon — choosing the next survivor is a tactical READ per the
  // Phase 1 ruling, not just a confirmation). On a forced switch we
  // resume the resolve drain after the player confirms.
  let partyMode: 'voluntary' | 'forced' | 'comeback' | null = null;
  let partyCursor = 0;
  let resumeResolveAfterParty = false;
  // Dismissable dialogs (e.g. "Calls unlock", "Too winded") let B back
  // out to the prior phase. Forced/sequential dialogs (intro, end-text,
  // "Got away safely!") MUST be read — B is a no-op on them. Per the
  // working agreement: B dismisses dismissable dialogs only.
  let textDismissable = false;
  let log: string[] = [];
  let pendingEvents: BattleEvent[] = [];
  // Battle-text flow (Presentation 1): the resolve presents one BEAT (a
  // consequential event) at a time. The current beat's message STREAMS
  // (reveal grows over time); once fully shown it HOLDS until the player
  // presses. A press FINISHES the stream if mid-reveal, else ADVANCES to the
  // next beat (draining minor events silently). Consistent, one-press-per-
  // message — no "skip the whole round" flush, no "press did nothing".
  let reveal = 0; // chars revealed of the current beat's message
  let beatMsg = ''; // the message streaming this beat ('' = a no-text beat)
  let resolveHeld = false; // a beat is currently shown (streaming or holding)
  let holdT = 0; // time the fully-revealed beat has been held (auto-advance)
  // A CONSEQUENTIAL beat (KO/faint/break/Call) WAITS for a press once revealed
  // instead of auto-advancing, so the big moments land. Routine beats auto-flow.
  let beatWaits = false;
  let endingWinner: 'player' | 'foe' | null = null;

  let menuCursor = 0;
  let moveCursor = 0;
  // Move list scroll window — kept for the FOCUS release menu / legacy paths;
  // the 2×3 move grid (2b-1) shows all ≤6 moves at once, so it doesn't scroll.
  const MOVES_VISIBLE = 5;
  let moveScroll = 0;
  // The move grid's fixed order: the ATTACK pool (≤4) then the TECHNIQUE pool
  // (≤2), a reordering of species.moves. moveCursor indexes THIS list, and both
  // the input handler and the grid draw read it, so selection stays in sync.
  function gridMoves(): string[] {
    const sp = activeMon(state.player).species;
    return [...attackPool(sp), ...techniquePool(sp)];
  }
  let stanceIdx = 0;
  // FOCUS R2 — the release-selection cursor over [HEAVY, FEINT, HIDE].
  let releaseCursor = 0;
  // Layer 2 — when true, confirming a move INITIATES its two-step (the
  // commit-modifier): the current stance picks which (A→CHARGE, F→HIDE,
  // G→FEINT). Toggled with ←/→ in the move menu; reset each time it opens.
  let committing = false;
  // FULL POWER (Lane B) — armed by the Full Power Call; the next confirmed
  // attack carries `fullPower: true` (+50%, spends 2★). Cleared on commit or on
  // backing out of the move menu. Mutually exclusive with `committing` (Full
  // Power is a direct strike, never a focus).
  let pendingFullPower = false;
  let callCursor = 0;
  let tick = 0;

  // ---- DEV TOOL: dev combat-log ----------------------------------------
  // A rolling record of the raw BattleEvents as they resolve, surfaced in an
  // overlay so the invisible combat depth (statuses, ★ economy, techniques) is
  // legible for playtesting/debugging. Pure display — reads the events the
  // engine already emits, mutates no combat state. Hooks: opts.devLog (tests),
  // `?log=1` (URL, matching ?calls=all), or the `~` runtime toggle.
  let showDevLog = opts.devLog ?? devLogUrlFlag();
  const devLog: string[] = [];
  // The last read-win reason (COUNTER/OPENING/…), consumed by the momentum
  // event that follows it, so a ★ gain names WHY it was earned.
  let devLogMomentumReason: string | null = null;

  // ---- Bond legibility (Lane A) — presentation state -------------------
  // Post-win bond-bar advance (XP-style). On a player win, the active mon's
  // bar fills from its pre-fight value toward the post-fight value (capped at
  // the current stage's ceiling — a real tier-cross is the post-fight beat).
  // bondAdvanceFrom = null when no advance is playing.
  const BOND_ADVANCE_SEC = 0.9;
  let bondAdvanceFrom: number | null = null;
  let bondAdvanceTo = 0;
  let bondAdvanceT = 0;
  // Surface ③ — read-win mon reaction. A short, subtle pulse on the player's
  // mon the moment a read banks a ★ (the felt spark behind the meter ticking
  // up). Pure render; timer counts down. NOT a score/grade popup.
  const READ_REACT_SEC = 0.5;
  let readReactT = 0;

  // Audio seam — a battle began (see gameEvents). Fire-and-forget; no-op
  // until an audio layer subscribes.
  emitGameEvent({ kind: 'battle-start' });

  function clampMoveScroll(): void {
    const n = activeMon(state.player).species.moves.length;
    if (moveCursor < moveScroll) moveScroll = moveCursor;
    else if (moveCursor >= moveScroll + MOVES_VISIBLE) moveScroll = moveCursor - MOVES_VISIBLE + 1;
    moveScroll = Math.max(0, Math.min(moveScroll, Math.max(0, n - MOVES_VISIBLE)));
  }

  let animSide: Side | null = null;
  let animKind: 'strike' | 'dodge' | 'opening' | 'counter' | 'clash' | null = null;
  let animT = 0;

  function pushLog(line: string): void {
    log.push(line);
    if (log.length > 3) log.shift();
  }

  function setText(
    lines: readonly string[],
    then: () => void,
    options: { dismissable?: boolean } = {},
  ): void {
    phase = 'text';
    textQueue = [...lines];
    textNext = then;
    textDismissable = options.dismissable ?? false;
  }

  function foeGone(): void {
    const cb = opts.onFoeGone ?? opts.onFlee;
    if (cb) cb(state);
    else opts.onResolve('foe', state, participants());
  }

  function beginTurn(): void {
    // Phase 6a — Wariness flee (wild catch only). One telegraph turn,
    // then the mon escapes — never instant-poof. The tutorial practice mon
    // is exempt: it never flees (a forgiving guard-rail, scripted only).
    if (opts.canCatch && !opts.tutorial) {
      if (fleeWarned) {
        setText([`The wild ${activeMon(state.foe).species.name} fled!`], foeGone);
        return;
      }
      if (fleeTelegraphed(wariness)) {
        fleeWarned = true;
        setText([`The ${activeMon(state.foe).species.name} is looking for an escape!`], beginTurnInner);
        return;
      }
    }
    beginTurnInner();
  }

  function beginTurnInner(): void {
    // Commit the foe's TRUE action first, then snapshot the (possibly
    // degraded) display for this turn. forcedAction draws no RNG, so moving
    // the choose ahead of the forced check leaves the engine stream intact.
    foeAction = opts.chooseFoeAction(state, opts.rng);
    shownIntent = bondIntent(foeAction);
    const forced = forcedAction(activeMon(state.player));
    if (forced) {
      // EXHAUSTED / softlock: the player CAN'T input this round. Explain WHY
      // before the forced rest auto-resolves (Mathias: "I could do nothing,
      // no idea what's happening"), so a skipped turn reads as a mechanic,
      // not a frozen game. The EXH panel tag stays up as the indicator.
      if (forced.kind === 'rest') {
        const me = activeMon(state.player);
        const line = me.exhausted
          ? `${monDisplayName(me)} is EXHAUSTED — it must recover stamina before it can act!`
          : `${monDisplayName(me)} has no stamina for a move — it must catch its breath.`;
        setText([line], () => commit(forced));
        return;
      }
      commit(forced);
      return;
    }
    const me = activeMon(state.player);
    if (me.focus !== undefined) {
      // FOCUS R2 — the player now CHOOSES the release (the read is made here,
      // not predetermined by R1). Open the release menu.
      phase = 'release';
      releaseCursor = 0;
      return;
    }
    phase = 'menu';
    menuCursor = 0;
  }

  function commit(action: Action): void {
    log = [];
    roundStance = { player: null, foe: null };
    calloutLine = null;
    // A read window lasts exactly one round — consumed/lost the moment
    // the player commits their next action.
    pendingReadWindow = false;
    const result = resolveRound(state, action, foeAction, opts.rng);
    state = result.state;
    pendingEvents = [...result.events];
    reveal = 0;
    beatMsg = '';
    resolveHeld = false;
    // Display state is reseated by the first roundStart event's snapshot.
    phase = 'resolve';
  }

  // Display name for a side: the player's bare species name; the foe prefixed
  // "Foe" (so callouts read naturally — "Foe FLITPECK took the bait").
  const monName = (side: Side): string =>
    side === 'player' ? monDisplayName(display.player) : `Foe ${display.foe.species.name}`;
  // Flipped-triangle verb for the winning release over the loser (HIDE slips
  // the HEAVY, HEAVY crushes the FEINT, FEINT catches the HIDE).
  const FLIP_VERB: { readonly [k in ReleaseKind]: string } = {
    hide: 'slips',
    heavy: 'crushes',
    feint: 'catches',
  };

  // ---- DEV TOOL: dev combat-log recorder -------------------------------
  // Format ONE BattleEvent into a dev-log line (or null to skip pure noise),
  // then push it to the rolling buffer. Reads-only — it never touches combat
  // state. Called from the top of applyEvent so every event the engine emits
  // flows through here while the log is on. `damage`/heal amounts are rounded
  // for readability (the underlying floats are unchanged).
  function devLogPush(line: string): void {
    devLog.push(line.length > DEV_LOG_LINE_CAP ? line.slice(0, DEV_LOG_LINE_CAP - 1) + '…' : line);
    if (devLog.length > DEV_LOG_MAX) devLog.shift();
  }
  function devEff(e: number): string {
    return e > 1 ? ' [super]' : e < 1 ? ' [resist]' : '';
  }
  function formatDevEvent(ev: BattleEvent): string | null {
    const r = Math.round;
    switch (ev.kind) {
      case 'roundStart':
        return `— round ${ev.round} —`;
      case 'commit': {
        const who = monName(ev.side);
        const a = ev.action;
        if (a.kind === 'move') return `${who} commits ${a.move} [${a.stance}]`;
        if (a.kind === 'focus') return `${who} FOCUS (winds up — release hidden)`;
        if (a.kind === 'release') return `${who} releases ${a.release.toUpperCase()}`;
        if (a.kind === 'call') return `${who} CALL ${a.call}`;
        if (a.kind === 'rest') return `${who} rest (${a.reason})`;
        if (a.kind === 'catchBreath') return `${who} catch breath`;
        if (a.kind === 'throwBall') return `${who} throws ball`;
        return `${who} commits`;
      }
      case 'initiative':
        return `init: you ${r(ev.playerInit)} vs foe ${r(ev.foeInit)} → first ${ev.first ?? 'tie'}`;
      case 'catchBreath':
        return `${monName(ev.side)} catches breath (+${ev.restored} ST, −1★)`;
      case 'clash':
        devLogMomentumReason = 'clash';
        return `CLASH — ${monName(ev.winner)} breaks through`;
      case 'strike':
        return `${monName(ev.side)} → ${ev.move}: ${r(ev.damage)} dmg${devEff(ev.effectiveness)}`;
      case 'dodge':
        return `${monName(ev.side)} DODGE (legacy)`;
      case 'punish':
        devLogMomentumReason = 'punish A>F';
        return `${monName(ev.side)} PUNISH (A>F): ${r(ev.damage)} dmg${devEff(ev.effectiveness)}`;
      case 'dazed':
        return `${monName(ev.side)} DAZED (predictable → takes extra dmg)`;
      case 'opening':
        devLogMomentumReason = 'opening F>G';
        return `${monName(ev.side)} OPENING (F>G): ${r(ev.damage)} dmg${devEff(ev.effectiveness)}`;
      case 'counter':
        devLogMomentumReason = 'counter G>A';
        return `${monName(ev.side)} COUNTER (G>A): ${r(ev.damage)} reflected`;
      case 'focus':
        return `${monName(ev.side)} FOCUS (gathering; took ${r(ev.costDamage)})`;
      case 'release': {
        if (ev.outcome === 'win') devLogMomentumReason = `release ${ev.release}`;
        const ctx = ev.vsFocus ? ' vs focus' : ev.vsStance ? ` vs ${ev.vsStance}` : '';
        return `${monName(ev.side)} RELEASE ${ev.release.toUpperCase()} → ${ev.outcome}: ${r(ev.damage)} dmg${devEff(ev.effectiveness)}${ctx}`;
      }
      case 'flipResolve':
        if (ev.winner && ev.winnerRelease && ev.loserRelease) {
          devLogMomentumReason = 'flip win';
          return `FLIP: ${monName(ev.winner)} ${ev.winnerRelease.toUpperCase()} ${FLIP_VERB[ev.winnerRelease]} ${ev.loserRelease.toUpperCase()}`;
        }
        return 'FLIP: mirror — clash cancels';
      case 'call':
        return `${monName(ev.side)} CALL ${ev.call} (−1★)`;
      case 'recover':
        return `${monName(ev.side)} RECOVER heals ${r(ev.healed)}`;
      case 'fullPower':
        return `${monName(ev.side)} FULL POWER (+50%, −${COMBAT.fullPowerCost}★)`;
      case 'statusApply':
        return `${monName(ev.side)} +STATUS ${ev.status} (${ev.duration} turns)`;
      case 'statusTick':
        return `${monName(ev.side)} status ${ev.status} ticks${ev.damage ? `, ${r(ev.damage)} dmg` : ''} (${ev.remaining} left)`;
      case 'statusClear':
        return `${monName(ev.side)} status ${ev.status} expired`;
      case 'statusBreak':
        return `${monName(ev.side)} status ${ev.status} BROKEN`;
      case 'statusResist':
        return `${monName(ev.side)} RESISTED ${ev.status} (diminishing returns)`;
      case 'staggered':
        return `${monName(ev.side)} staggered (next init ×0.5)`;
      case 'momentum': {
        const delta = ev.total - display[ev.side].momentum;
        const sign = delta >= 0 ? `+${delta}` : `${delta}`;
        const why = devLogMomentumReason ? ` (${devLogMomentumReason})` : '';
        devLogMomentumReason = null;
        return `${monName(ev.side)} ★ ${sign} → ${ev.total}${why}`;
      }
      case 'bondJumpstart':
        devLogMomentumReason = 'bond jumpstart';
        return `${monName(ev.side)} bond JUMPSTART — free ★`;
      case 'stamina':
        return `${monName(ev.side)} ST ${r(ev.before)}→${r(ev.after)} (${ev.netDelta >= 0 ? '+' : ''}${r(ev.netDelta)})`;
      case 'winded':
        return `${monName(ev.side)} WINDED (heavy/nuke locked)`;
      case 'exhausted':
        return `${monName(ev.side)} EXHAUSTED (forced rest next round)`;
      case 'ko':
        return `${monName(ev.side)} KO'd`;
      case 'bondMoment':
        return `${monName(ev.side)} BOND-MOMENT — survives at 1 HP!`;
      case 'breakProgress':
        return `BREAK meter ${ev.progress}/${ev.threshold}`;
      case 'break':
        return `BREAK! → phase ${ev.newPhase}`;
      case 'switchOut':
        return `${ev.side === 'player' ? 'You' : 'Foe'} withdrew ${ev.species}`;
      case 'switchIn':
        return `${ev.side === 'player' ? 'You' : 'Foe'} sent ${ev.species}`;
      case 'faint':
        return `${ev.side === 'player' ? '' : 'Foe '}${ev.species} fainted`;
      case 'forcedSwitch':
        return `${ev.side === 'player' ? 'You' : 'Foe'} forced switch → ${ev.species}`;
      default:
        return null;
    }
  }
  function recordDevLog(ev: BattleEvent): void {
    if (!showDevLog) return; // OFF by default → zero cost
    const line = formatDevEvent(ev);
    if (line !== null) devLogPush(line);
  }

  // A line is "consequential" when it carries information the player
  // needs to actually read before the round resolves: which move was
  // committed, type-effective hits, the read-vs-read events (dodge,
  // opening, counter, clash), and faints/breaks. tickResolve pauses
  // after applying one of these until the player presses A/Start.
  function isConsequential(ev: BattleEvent): boolean {
    if (ev.kind === 'commit' && ev.action.kind === 'move') return true;
    // EVERY strike holds — gives the player a visible beat between the
    // faster and slower mon's actions. Initiative is computed by the
    // engine; the renderer surfaces "who acted now" by pausing between
    // each strike.
    if (ev.kind === 'strike') return true;
    if (ev.kind === 'dodge') return true;
    if (ev.kind === 'punish') return true; // A>F read-win — a damage beat to read
    if (ev.kind === 'dazed') return true; // pause so the player reads the daze + its effect
    // Layer 2 — each two-step beat holds so the player reads the commitment.
    if (ev.kind === 'focus') return true;
    if (ev.kind === 'release') return true;
    if (ev.kind === 'flipResolve') return true;
    if (ev.kind === 'call') return true;
    if (ev.kind === 'recover') return true; // Lane B — hold so the heal lands
    if (ev.kind === 'fullPower') return true; // Lane B — hold so the buff reads
    if (ev.kind === 'opening') return true;
    if (ev.kind === 'counter') return true;
    if (ev.kind === 'clash') return true;
    if (ev.kind === 'faint') return true;
    if (ev.kind === 'bondMoment') return true; // the survival beat MUST land
    if (ev.kind === 'break') return true;
    // S4 — hold on Catch Breath so the player reads the restore + sees
    // the ST bar at its new value (it used to flash past).
    if (ev.kind === 'catchBreath') return true;
    return false;
  }

  function applyEvent(ev: BattleEvent): void {
    // DEV TOOL — narrate the event first (reads-only; must run BEFORE the
    // handler mutates `display`, so the momentum-delta line reads the pre-event
    // ★ total). No effect when the dev log is off.
    recordDevLog(ev);
    if (ev.kind === 'roundStart') {
      // roundStart's snapshot is of the PRE-resolve active mon — before
      // any in-round switch fires. Preserve display.species (which is
      // also the pre-resolve mon) so the panel name + hp/maxHp stay
      // consistent. switchIn / forcedSwitch fire later in the event
      // stream and reseat species too.
      display.player = {
        ...display.player,
        hp: ev.player.hp,
        maxHp: ev.player.maxHp,
        st: ev.player.st,
        momentum: ev.player.momentum,
        exhausted: ev.player.exhausted,
        staggered: ev.player.staggered,
        dazed: false, // daze is per-round — cleared as the new round opens
      };
      display.foe = {
        ...display.foe,
        hp: ev.foe.hp,
        maxHp: ev.foe.maxHp,
        st: ev.foe.st,
        momentum: ev.foe.momentum,
        exhausted: ev.foe.exhausted,
        staggered: ev.foe.staggered,
        dazed: false,
      };
      pushLog(`— round ${ev.round} —`);
      return;
    }
    if (ev.kind === 'initiative') {
      // Reserved for the action-timeline strip (Combat 2.0 spec).
      // No log/animation here yet — order is implicit in the strike sequence.
      return;
    }
    if (ev.kind === 'stamina') {
      display[ev.side].st = ev.after;
      return;
    }
    if (ev.kind === 'commit') {
      // Remember each side's committed stance so a landed strike can be
      // labelled (A-vs-F that DIDN'T dodge = "too slow").
      if (ev.action.kind === 'move') {
        roundStance[ev.side] = ev.action.stance;
        emitGameEvent({ kind: 'move-resolved', side: ev.side, move: ev.action.move });
      }
      if (ev.action.kind === 'rest') {
        const who = ev.side === 'player' ? monDisplayName(activeMon(state.player)) : activeMon(state.foe).species.name;
        const note = ev.action.reason === 'exhaustion' ? 'is spent — resting.' : 'has no moves — resting.';
        pushLog(`${who} ${note}`);
      } else if (ev.action.kind === 'catchBreath') {
        const who = ev.side === 'player' ? monDisplayName(activeMon(state.player)) : activeMon(state.foe).species.name;
        pushLog(`${who}: catch your breath!`);
      } else if (ev.action.kind === 'throwBall') {
        pushLog('You hurled a ball!');
      } else if (ev.action.kind === 'focus' || ev.action.kind === 'release' || ev.action.kind === 'call') {
        // FOCUS — the dedicated focus/release/call events carry the text; the
        // commit announce stays quiet for these so it doesn't double up.
      } else if (ev.side === 'foe' && ev.action.kind === 'move') {
        // Resolution confirmation (the teaching loop, all tiers): name the
        // foe's committed STANCE *and* MOVE in plain language so the player
        // learns whether their read was right AND what landed — even when
        // intent was ambiguous/opaque.
        pushLog(stanceConfirmLine(display.foe.species.name, ev.action.stance, ev.action.move));
      } else {
        const who = ev.side === 'player' ? monDisplayName(activeMon(state.player)) : `Foe ${activeMon(state.foe).species.name}`;
        pushLog(`${who} used ${ev.action.move}.`);
      }
      return;
    }
    if (ev.kind === 'catchBreath') {
      // S4 — surface the effect: the ST bar visibly jumps (display.st
      // updates here) AND a held callout names the restore amount, so
      // the player can SEE what Catch Breath did.
      display[ev.side].st = Math.min(100, display[ev.side].st + ev.restored);
      display[ev.side].momentum = Math.max(0, display[ev.side].momentum - 1);
      const who =
        ev.side === 'player' ? monDisplayName(activeMon(state.player)) : `Foe ${activeMon(state.foe).species.name}`;
      calloutLine = `${who} catches its breath — stamina +${ev.restored}!`;
      pushLog(`${who} catches its breath — +${ev.restored} ST!`);
      return;
    }
    if (ev.kind === 'clash') {
      animKind = 'clash';
      animSide = ev.winner;
      animT = 0.3;
      if (ev.winner === 'player') pendingReadWindow = true; // read window
      const cw = ev.winner === 'player' ? monDisplayName(activeMon(state.player)) : 'Foe';
      calloutLine = `CLASH! ${cw} broke through.${starTag(ev.winner)}`;
      pushLog(`CLASH! ${cw} broke through.`);
      return;
    }
    if (ev.kind === 'strike') {
      const def = opposite(ev.side);
      display[def].hp = Math.max(0, display[def].hp - ev.damage);
      emitGameEvent({ kind: 'hit-landed', side: ev.side, effectiveness: ev.effectiveness });
      animSide = ev.side;
      animKind = 'strike';
      animT = 0.25;
      if (ev.effectiveness > 1) pushLog('It hit hard!');
      else if (ev.effectiveness < 1) pushLog('Not very effective…');
      // S1 — an Aggressive strike that LANDED on a Fluid defender means
      // the dodge check failed: the attacker was faster. Name the rule.
      const c = stanceCallout({
        kind: 'strike',
        attackerStance: roundStance[ev.side] ?? undefined,
        defenderStance: roundStance[def] ?? undefined,
      });
      if (c) {
        calloutLine = c;
        pushLog('Too slow to evade!');
      }
      return;
    }
    if (ev.kind === 'dodge') {
      // S1 — FLUID dodged an Aggressive strike because it was faster.
      const who = ev.side === 'player' ? monDisplayName(display.player) : 'Foe ' + display.foe.species.name;
      if (ev.side === 'player') pendingReadWindow = true; // read window
      calloutLine = (stanceCallout({ kind: 'dodge' }) ?? 'DODGE!') + starTag(ev.side);
      pushLog(`DODGE! ${who}'s FLUID was faster.`);
      animSide = ev.side;
      animKind = 'dodge';
      animT = 0.25;
      return;
    }
    if (ev.kind === 'opening') {
      // S1 — FLUID slipped past a GUARD stance (acts first, no counter).
      const def = opposite(ev.side);
      display[def].hp = Math.max(0, display[def].hp - ev.damage);
      emitGameEvent({ kind: 'hit-landed', side: ev.side, effectiveness: ev.effectiveness });
      if (ev.side === 'player') pendingReadWindow = true; // read window (the cleanest catch opener)
      calloutLine = (stanceCallout({ kind: 'opening' }) ?? 'OPENING!') + starTag(ev.side);
      pushLog('OPENING! FLUID slips past GUARD.');
      animSide = ev.side;
      animKind = 'opening';
      animT = 0.25;
      return;
    }
    if (ev.kind === 'punish') {
      // Layer 1 — AGGRESSIVE caught a FLUID dodger (the A>F read-win). The
      // aggressor (ev.side) charges ★; the Fluid defender takes the punish.
      const def = opposite(ev.side);
      display[def].hp = Math.max(0, display[def].hp - ev.damage);
      emitGameEvent({ kind: 'hit-landed', side: ev.side, effectiveness: ev.effectiveness });
      if (ev.side === 'player') pendingReadWindow = true; // read window
      calloutLine = (stanceCallout({ kind: 'punish' }) ?? 'PUNISH!') + starTag(ev.side);
      pushLog('PUNISH! Aggression catches the dodge.');
      animSide = ev.side;
      animKind = 'strike';
      animT = 0.25;
      return;
    }
    if (ev.kind === 'focus') {
      // FOCUS R1 — a GENERIC commitment (release HIDDEN). ev.costDamage is what
      // the focuser took (informational; the cost was already applied via the
      // opponent's strike event, so don't subtract it again). Set the HUD tag.
      display[ev.side].focusing = true;
      const who = monName(ev.side);
      calloutLine = `${who} is FOCUSING — gathering energy!`;
      pushLog(`${who} is FOCUSING — a release is coming (but not which).`);
      animSide = ev.side;
      animKind = 'strike';
      animT = 0.2;
      return;
    }
    if (ev.kind === 'release') {
      // FOCUS R2 — the chosen release lands. ev.damage is the ACTUAL applied
      // amount (0 if a Call negated it). Clear the focus tag; name the OUTCOME.
      const def = opposite(ev.side);
      display[def].hp = Math.max(0, display[def].hp - ev.damage);
      display[ev.side].focusing = false;
      emitGameEvent({ kind: 'hit-landed', side: ev.side, effectiveness: ev.effectiveness });
      if (ev.side === 'player' && ev.outcome === 'win') pendingReadWindow = true;
      const rel = ev.release.toUpperCase();
      const defName = monName(def);
      let line: string;
      if (ev.vsFocus) {
        // F.4 timing mismatch — released into a focusing foe.
        line =
          ev.outcome === 'win'
            ? `${rel} CATCHES ${defName} MID-FOCUS!`
            : ev.outcome === 'lose'
              ? `${rel} GLANCES OFF — ${defName} kept gathering.`
              : `${rel} released.`;
      } else if (ev.release === 'heavy') {
        line = ev.outcome === 'win' ? 'HEAVY CRUSHES THE BRACE!' : ev.outcome === 'lose' ? `HEAVY DODGED — ${defName} slipped it!` : 'HEAVY traded.';
      } else if (ev.release === 'feint') {
        line = ev.outcome === 'win' ? `FEINT! ${defName} took the bait!` : ev.outcome === 'lose' ? `FEINT WHIFFED — ${defName} didn't bite.` : 'FEINT — both landed.';
      } else {
        // hide
        line = ev.outcome === 'win' ? `HIDE SLIPS IN — caught ${defName}!` : ev.outcome === 'lose' ? `HIDE FLUSHED OUT by ${defName}!` : 'HIDE — stalemate.';
      }
      calloutLine = line + (ev.outcome === 'win' ? starTag(ev.side) : '');
      pushLog(line);
      animSide = ev.side;
      animKind = 'strike';
      animT = 0.25;
      return;
    }
    if (ev.kind === 'flipResolve') {
      // Both released → name the winner by what its release did to the other
      // ("HIDE slips the HEAVY!"). The winner's ★ arrives via a momentum event.
      if (ev.winner !== null && ev.winnerRelease && ev.loserRelease) {
        if (ev.winner === 'player') pendingReadWindow = true;
        const line = `${ev.winnerRelease.toUpperCase()} ${FLIP_VERB[ev.winnerRelease]} the ${ev.loserRelease.toUpperCase()}!`;
        calloutLine = line + starTag(ev.winner);
        pushLog(`${monName(ev.winner)}: ${line}`);
      } else {
        calloutLine = 'Both released — the clash cancels out.';
        pushLog('Both released — the clash cancels out.');
      }
      return;
    }
    if (ev.kind === 'call') {
      // Layer 2 / Lane B — a ★-Call override fired (the ★ is spent; the momentum
      // readout updates here since no `momentum` event accompanies a Call). The
      // RECOVER heal arrives in the separate `recover` event right after.
      display[ev.side].momentum = Math.max(0, display[ev.side].momentum - 1);
      const who = ev.side === 'player' ? monDisplayName(display.player) : 'Foe';
      const label =
        ev.call === 'getAway' ? 'GET AWAY'
        : ev.call === 'hangInThere' ? 'HANG IN THERE'
        : ev.call === 'recover' ? 'RECOVER'
        : ev.call === 'resolve' ? 'RESOLVE'
        : ev.call === 'shakeOff' ? 'SHAKE IT OFF'
        : ev.call === 'readThem' ? 'READ THEM'
        : ev.call === 'throwOff' ? 'THROW THEM OFF'
        : ev.call === 'comeBack' ? 'COME BACK'
        : 'DODGE';
      calloutLine = `${label}!`;
      pushLog(`${who}: ${label}! (★ spent)`);
      return;
    }
    if (ev.kind === 'recover') {
      // Lane B — RECOVER healed the caller. Raise the hp bar (the bar shows the
      // amount visually). The text states NO number — RSE register, and ev.healed
      // is a raw float (maxHp/hp are fractional; near-full it clamps to a long
      // decimal). "recovers!" reads clean; the heal math is unchanged (Fix 2).
      display[ev.side].hp = Math.min(display[ev.side].maxHp, display[ev.side].hp + ev.healed);
      const who = ev.side === 'player' ? monDisplayName(display.player) : `Foe ${display.foe.species.name}`;
      calloutLine = `${who} recovers!`;
      pushLog(`${who} recovers!`);
      return;
    }
    if (ev.kind === 'fullPower') {
      // Lane B — FULL POWER buffed the caller's attack +50% (2★ spent; no
      // `momentum` event accompanies the spend, so update the readout here).
      display[ev.side].momentum = Math.max(0, display[ev.side].momentum - COMBAT.fullPowerCost);
      const who = ev.side === 'player' ? monDisplayName(display.player) : `Foe ${display.foe.species.name}`;
      calloutLine = `FULL POWER! ${who}'s attack +50%!`;
      pushLog(`${who}: FULL POWER! (+50%, ★★ spent)`);
      return;
    }
    if (ev.kind === 'dazed') {
      // Layer 1 — same stance 3 rounds running: predictability punished. Show
      // a panel tag (DAZE) + name the EFFECT so the player knows what it does.
      display[ev.side].dazed = true;
      const who = ev.side === 'player' ? monDisplayName(activeMon(state.player)) : 'Foe';
      calloutLine = `${who} is DAZED — takes extra damage this round!`;
      pushLog(`${who} is DAZED — predictable! It takes extra damage this round.`);
      return;
    }
    if (ev.kind === 'counter') {
      // S1 — GUARD turned an Aggressive strike back (reflect + stagger).
      const att = opposite(ev.side);
      display[att].hp = Math.max(0, display[att].hp - ev.damage);
      emitGameEvent({ kind: 'hit-landed', side: ev.side, effectiveness: 1 });
      const who = ev.side === 'player' ? monDisplayName(display.player) : 'Foe';
      if (ev.side === 'player') pendingReadWindow = true; // read window
      calloutLine = (stanceCallout({ kind: 'counter' }) ?? 'COUNTER!') + starTag(ev.side);
      pushLog(`COUNTER! ${who}'s GUARD turns it back.`);
      animSide = ev.side;
      animKind = 'counter';
      animT = 0.25;
      return;
    }
    if (ev.kind === 'staggered') {
      display[ev.side].staggered = true;
      return;
    }
    if (ev.kind === 'momentum') {
      display[ev.side].momentum = ev.total;
      pushLog(`★ Momentum +1 (${ev.total}).`);
      // Surface ③ — the read landed and banked YOUR ★. A subtle, diegetic
      // acknowledgment beyond the pip ticking up: a soft reaction pulse on the
      // mon + a presentation event a soft ping can ride. Player side only (the
      // foe's ★ stays hidden — no tell that the foe won a read).
      if (ev.side === 'player') {
        readReactT = READ_REACT_SEC;
        emitGameEvent({ kind: 'read-win', side: 'player' });
      }
      return;
    }
    if (ev.kind === 'bondJumpstart') {
      // B5 — the bond jumpstart fired: a Familiar-tier mon's first read-win
      // banked a free ★. A subtle in-battle cue so the player FEELS the bond
      // do something (the momentum event already moved the ★ readout).
      const who = ev.side === 'player' ? monDisplayName(activeMon(state.player)) : 'Foe';
      pushLog(`${who}'s bond sparks — a free ★!`);
      return;
    }
    if (ev.kind === 'winded') {
      pushLog(`${ev.side === 'player' ? monDisplayName(activeMon(state.player)) : 'Foe'} is winded — heavy moves locked.`);
      return;
    }
    if (ev.kind === 'exhausted') {
      display[ev.side].exhausted = true;
      const who = ev.side === 'player' ? monDisplayName(activeMon(state.player)) : 'Foe';
      // Name the mechanic, not just the state: it's out of stamina and must
      // spend a turn recovering before it can act (the EXH tag shows it's
      // still in effect).
      pushLog(`${who} is EXHAUSTED — out of stamina, must recover before acting!`);
      return;
    }
    if (ev.kind === 'breakProgress') {
      displayBreakProgress = ev.progress;
      breakPipFlashT = 0.6; // BUG 3 — flash the meter as it fills
      pushLog(`★ BREAK ${ev.progress}/${ev.threshold} — read landed!`);
      return;
    }
    if (ev.kind === 'break') {
      displayBreakProgress = 0;
      breakFlashT = 0.6;
      pushLog(`BREAK! ${display.foe.species.name} reels — PHASE ${ev.newPhase}!`);
      animKind = 'clash';
      animT = 0.5;
      return;
    }
    if (ev.kind === 'ko') {
      // Hide the active sprite (hp=0) but do not end the battle here —
      // 'faint' handles the narrative, and team-wipe is detected in
      // finishResolve via isTeamWiped.
      display[ev.side].hp = 0;
      emitGameEvent({ kind: 'ko', side: ev.side });
      return;
    }
    if (ev.kind === 'bondMoment') {
      // THE BOND-MOMENT (stage-6+): the mon just survived an otherwise-lethal hit
      // at 1 HP. This MUST land — the big center callout + a distinct log line,
      // and route it to the SFX/animation lanes. The engine already clamped hp to
      // 1; reflect it on the display bar. (Player-only — the flag is never armed
      // foe-side.)
      const who = display[ev.side].species.name;
      display[ev.side].hp = 1;
      calloutLine = `${who} refuses to fall!`;
      pushLog(`${who} refuses to fall!`);
      animKind = 'clash';
      animT = 0.5;
      emitGameEvent({ kind: 'bondMoment', side: ev.side });
      return;
    }
    if (ev.kind === 'switchOut') {
      const who = ev.side === 'player' ? ev.species : `Foe ${ev.species}`;
      pushLog(`${who} withdrew.`);
      return;
    }
    if (ev.kind === 'switchIn') {
      const who = ev.side === 'player' ? ev.species : `Foe ${ev.species}`;
      if (ev.side === 'player') playerParticipated.add(ev.toIndex);
      pushLog(`${who} took the field!`);
      // The active mon swapped on the state side. Reseat display so HP/ST
      // bars reflect the new active's values immediately.
      const fresh = activeMon(state[ev.side]);
      display[ev.side] = snapshot(fresh);
      return;
    }
    if (ev.kind === 'faint') {
      const who = ev.side === 'player' ? ev.species : `Foe ${ev.species}`;
      // The KO reaction must LAND prominently — set the big center callout, not
      // just the log line. Without this, a one-shot (esp. a flashy HEAVY-release
      // KO) left the callout stuck on the strike verb ("HEAVY CRUSHES THE
      // BRACE!") while the faint only whispered in the log — it read as "no
      // reaction that round" (KICKOFF-focus-damage-bugfix.md, Bug 2). Every
      // other consequential beat sets calloutLine; the faint must too.
      calloutLine = `${who} fainted!`;
      pushLog(`${who} fainted!`);
      return;
    }
    if (ev.kind === 'forcedSwitch') {
      const who = ev.side === 'player' ? ev.species : `Foe sent out ${ev.species}`;
      if (ev.side === 'player') playerParticipated.add(ev.toIndex);
      pushLog(`${who}!`);
      const fresh = activeMon(state[ev.side]);
      display[ev.side] = snapshot(fresh);
      // PLAYER side: open the party picker so the player CHOOSES the
      // next mon. The engine's auto-pick (ev.toIndex) becomes the
      // default highlight; the player can confirm or override. This is
      // the Phase 1 ruling — picking the next mon is a tactical read,
      // not a confirmation. Resume the resolve drain after the choice.
      if (ev.side === 'player' && state.player.members.length > 1) {
        partyMode = 'forced';
        partyCursor = ev.toIndex;
        phase = 'party';
        resumeResolveAfterParty = true;
      }
      return;
    }
  }

  function finishResolve(): void {
    // Snap display to engine final state for stamina/momentum settle that the
    // event stream did not cover (stamina costs, regen).
    display = {
      player: snapshot(activeMon(state.player)),
      foe: snapshot(activeMon(state.foe)),
    };
    // Team-wipe is the only end-of-battle condition now. Individual KOs
    // are handled by the engine via forced-switch unless the team is out.
    if (isTeamWiped(state.player)) endingWinner = 'foe';
    else if (isTeamWiped(state.foe)) {
      // Phase 6a Path 2 — a fainted wild mon can be SPARED with medicine
      // (the willing-join). Offer it before declaring victory; otherwise
      // it's a normal win.
      if (opts.canCatch && (opts.medicineCount?.() ?? 0) > 0) {
        phase = 'spare';
        spareCursor = 0;
        return;
      }
      endingWinner = 'player';
    }
    if (endingWinner !== null) {
      phase = 'end';
      emitGameEvent({ kind: 'battle-end', winner: endingWinner });
      // Bond legibility (Lane A) — the post-fight bar advance. On a player
      // win, fill the ACTIVE mon's bond bar from its pre-fight value toward
      // the post-fight value, computed via the SAME pure pipeline the
      // authoritative game-side award uses (so the displayed target matches
      // run.partyBond after the win). Cap at the current stage's ceiling: the
      // bar fills to 100% and a genuine tier-cross becomes the post-fight beat
      // (createBondStageScene), never snapping the bar mid-fill.
      if (endingWinner === 'player' && opts.playerBond && opts.bondContext) {
        const active = state.player.active;
        const from = opts.playerBond[active] ?? 0;
        const mon = activeMon(state.player);
        const target = bondAfterFight(from, {
          monPower: powerIndex(mon.species),
          foePower: opts.bondContext.foePower,
          kind: opts.bondContext.kind,
          hpFracRemaining: mon.hp / Math.max(1, mon.maxHp),
        });
        const capped = Math.min(target, stageCeiling(from));
        if (capped > from + 1e-6) {
          bondAdvanceFrom = from;
          bondAdvanceTo = capped;
          bondAdvanceT = 0;
        }
      }
      const msg =
        endingWinner === 'player'
          ? ['You won the battle!', 'Press A to continue.']
          : ['Your team fell.', 'Press A to continue.'];
      setText(msg, () => {
        opts.onResolve(endingWinner!, state, participants());
      });
      return;
    }
    beginTurn();
  }

  // Begin a beat: stream its message (the newest log line if this event
  // added one; else a no-text beat that still holds for its animation/HP
  // tick). The beat HOLDS once fully revealed, until the player presses.
  // The "this matters — acknowledge it" beats that WAIT for a press once shown
  // (vs routine hits/stances that auto-flow): a faint/KO, a phase Break, and a
  // Call firing.
  function isKeyBeat(ev: BattleEvent): boolean {
    return (
      ev.kind === 'faint' ||
      ev.kind === 'ko' ||
      ev.kind === 'bondMoment' ||
      ev.kind === 'break' ||
      ev.kind === 'call' ||
      // FOCUS outcomes LAND — the read moments the player must see.
      ev.kind === 'focus' ||
      ev.kind === 'release' ||
      ev.kind === 'flipResolve'
    );
  }

  function beginBeat(grewLog: boolean, ev: BattleEvent): void {
    beatMsg = grewLog && log.length > 0 ? log[log.length - 1]! : '';
    reveal = 0;
    holdT = 0;
    resolveHeld = true;
    beatWaits = isKeyBeat(ev);
  }

  // Drain events until the next BEAT (a consequential event) — applying the
  // minor events (state/momentum/etc.) silently along the way — then hold +
  // stream it. No more events → end the round. May hand off to the party
  // picker (forcedSwitch flips phase); we stop draining if so.
  function advanceToNextBeat(): void {
    while (pendingEvents.length > 0) {
      const ev = pendingEvents.shift()!;
      const before = log.length;
      applyEvent(ev);
      if (phase !== 'resolve') return; // forcedSwitch → party picker; resume later
      if (isConsequential(ev)) {
        beginBeat(log.length > before, ev);
        return;
      }
    }
    finishResolve();
  }

  function tickResolve(dt: number): void {
    if (animT > 0) animT = Math.max(0, animT - dt);
    // No beat active (initial, or just advanced) → fetch the next one. Fall
    // through so this same tick also starts streaming it (so one update both
    // shows the beat AND begins its reveal).
    if (!resolveHeld) advanceToNextBeat();
    if (!resolveHeld) return; // round ended or handed off to the party picker
    // Stream the current beat's text.
    if (reveal < beatMsg.length) {
      reveal = Math.min(beatMsg.length, reveal + CHARS_PER_SEC * dt);
      return;
    }
    // Fully revealed → hold, then auto-advance. A CONSEQUENTIAL beat holds
    // markedly longer so it LANDS (the blink indicator shows a press advances
    // now); a routine beat holds a gentle rhythm.
    holdT += dt;
    if (holdT >= (beatWaits ? CONSEQUENTIAL_HOLD_SEC : BEAT_HOLD_SEC)) resolveHeld = false;
  }

  // Menu rows in DISPLAY order. The `enabled` flag controls whether the
  // cursor can rest on this row — disabled rows render greyed and are
  // skipped during up/down navigation. Keeping the row visible (not
  // collapsing it) preserves a stable visual layout as state changes.
  type MenuKind = 'fight' | 'pkmn' | 'catch' | 'call' | 'run';
  function menuItems(): ReadonlyArray<{ readonly kind: MenuKind; readonly enabled: boolean }> {
    // Order: FIGHT / CALLS / MONS / BALLS / RUN (the CD menu order — 2b-1).
    // The menu dispatches by `kind`, so the order is display-only.
    return [
      { kind: 'fight', enabled: true },
      { kind: 'call', enabled: opts.catchBreathUnlocked },
      // MONS enabled only when the bench has a non-fainted non-active mon (so
      // voluntary switching is meaningful). Single-mon teams see it greyed;
      // the cursor skips it.
      { kind: 'pkmn', enabled: hasBenchSurvivor(state.player) },
      // BALLS (Phase 6a) — wild encounters only, when the player has balls.
      { kind: 'catch', enabled: !!opts.canCatch && (opts.ballCount?.() ?? 0) > 0 },
      // RUN row stays enabled even when canRun is false — confirming it
      // surfaces the "No running from a rival!" dialog (intentional UX).
      { kind: 'run', enabled: true },
    ];
  }

  // Phase 6a — the catch window at the moment of a throw. Exhausted is a
  // standing window; a read-win opened a 1-round 'read' window last
  // round; otherwise none (out of window → auto-fail). (A guarding foe
  // that was never opened stays 'none' — you must expose it first.)
  function currentWindow(): CatchWindow {
    if (activeMon(state.foe).exhausted) return 'exhausted';
    if (pendingReadWindow) return 'read';
    return 'none';
  }

  function throwBall(): void {
    const foe = activeMon(state.foe);
    const window = currentWindow();
    const hpFrac = foe.hp / Math.max(1, foe.maxHp);
    emitGameEvent({ kind: 'catch-attempt' });
    const result = opts.onThrowBall ? opts.onThrowBall(window, hpFrac) : { caught: false };
    if (result.caught) {
      emitGameEvent({ kind: 'catch-success' });
      setText([`Gotcha! ${foe.species.name} was caught!`], () => opts.onCaught?.(state, 'read'));
      return;
    }
    if (window === 'none') {
      // Out-of-window throw — auto-fail. Wild: raise Wariness (→ flee spiral).
      // Tutorial: a gentle correction, no Wariness (forgiving, scripted only).
      if (opts.tutorial) {
        setText([TUTORIAL_CORRECTION], () => commit({ kind: 'throwBall' }));
      } else {
        wariness += 1;
        setText([`The ${foe.species.name} wasn't exposed — missed!`], () => commit({ kind: 'throwBall' }));
      }
    } else {
      setText([`Aww — the ${foe.species.name} broke free!`], () => commit({ kind: 'throwBall' }));
    }
  }

  function stepCursor(start: number, dir: 1 | -1): number {
    const items = menuItems();
    let i = start;
    for (let n = 0; n < items.length; n += 1) {
      i = (i + dir + items.length) % items.length;
      if (items[i]!.enabled) return i;
    }
    return start;
  }

  function confirmMenu(): void {
    const items = menuItems();
    const focus = items[menuCursor];
    if (!focus || !focus.enabled) return;
    if (focus.kind === 'fight') {
      phase = 'move';
      moveCursor = 0;
      moveScroll = 0;
      committing = false; // the commit-modifier resets each time the menu opens
      return;
    }
    if (focus.kind === 'pkmn') {
      // Voluntary switch — switching is a turn action. Open party
      // picker with the first selectable bench mon highlighted; A
      // confirms (commits {kind:'switch'}); B cancels back to menu.
      partyMode = 'voluntary';
      partyCursor = stepPartyCursor(state.player.active, 1);
      phase = 'party';
      return;
    }
    if (focus.kind === 'catch') {
      // Phase 6a — throw a ball at the wild foe (Path 1).
      throwBall();
      return;
    }
    if (focus.kind === 'call') {
      // Call-menu sprint — open the Call SUBMENU (mirror FIGHT → moves),
      // never instant-fire. Land the cursor on the first unlocked Call.
      callCursor = firstSelectableCall();
      phase = 'call';
      return;
    }
    // RUN
    if (opts.canRun) {
      // Forced — leaves the battle, no take-backs. Fleeing is NOT a
      // loss: a dedicated onFlee returns the player to the SAME tile,
      // no heal/black-out. Falls back to onResolve('foe') only if a
      // caller didn't wire onFlee (legacy/test paths).
      setText(['Got away safely!'], () => {
        if (opts.onFlee) opts.onFlee(state);
        else opts.onResolve('foe', state, participants());
      });
    } else {
      setText(
        ['No running from', 'a rival!'],
        () => {
          phase = 'menu';
        },
        { dismissable: true },
      );
    }
  }

  function handleMenuInput(key: InputKey): void {
    if (key === 'up') { menuCursor = stepCursor(menuCursor, -1); emitGameEvent({ kind: 'menu-move' }); }
    else if (key === 'down') { menuCursor = stepCursor(menuCursor, 1); emitGameEvent({ kind: 'menu-move' }); }
    // START acts as a second confirm — no auto-jump to CALL (that
    // shortcut used to fire CALL even when the user thought they were
    // confirming the FIGHT row, which is the bug this guards against).
    else if (key === 'a' || key === 'start') confirmMenu();
  }

  // Party-picker — used for both voluntary switching (PKMN menu) and
  // forced switching (faint with bench survivor). In voluntary mode the
  // cursor skips the currently-active mon (you can't switch to yourself)
  // and B cancels back to menu. In forced mode the cursor lands on the
  // engine's auto-pick (firstSurvivor) by default but the player can
  // pick any survivor; B is a no-op (must choose someone).
  function isPartySelectable(idx: number): boolean {
    const team = state.player;
    const m = team.members[idx];
    if (!m) return false;
    if (m.hp <= 0) return false;
    if ((partyMode === 'voluntary' || partyMode === 'comeback') && idx === team.active) return false;
    return true;
  }

  function stepPartyCursor(start: number, dir: 1 | -1): number {
    const n = state.player.members.length;
    let i = start;
    for (let k = 0; k < n; k += 1) {
      i = (i + dir + n) % n;
      if (isPartySelectable(i)) return i;
    }
    return start;
  }

  // Phase 6a Path 2 — the spare offer (a fainted wild foe + medicine).
  function endWithWin(): void {
    setText(['You won the battle!', 'Press A to continue.'], () => opts.onResolve('player', state, participants()));
  }
  function handleSpareInput(key: InputKey): void {
    if (key === 'up' || key === 'down') spareCursor = spareCursor === 0 ? 1 : 0;
    else if (key === 'b') endWithWin(); // decline = claim the normal win
    else if (key === 'a' || key === 'start') {
      if (spareCursor === 1) {
        endWithWin();
        return;
      }
      // YES — show mercy: spend medicine on the fallen foe, roll the join.
      const foeName = activeMon(state.foe).species.name;
      const r = opts.onWillingJoin ? opts.onWillingJoin() : { joined: false, hint: '' };
      if (r.joined) {
        emitGameEvent({ kind: 'catch-success' });
        setText([`You tend the fallen ${foeName} — it chose to join you!`], () => opts.onCaught?.(state, 'mercy'));
      } else {
        setText([r.hint], endWithWin);
      }
    }
  }

  function handlePartyInput(key: InputKey): void {
    if (key === 'up') partyCursor = stepPartyCursor(partyCursor, -1);
    else if (key === 'down') partyCursor = stepPartyCursor(partyCursor, 1);
    else if (key === 'b') {
      // Voluntary switches can be cancelled. Forced switches require a
      // pick — B is a no-op (per the working agreement, B is no-op on
      // forced/sequential prompts the player must answer).
      if (partyMode === 'voluntary') {
        partyMode = null;
        phase = 'menu';
      } else if (partyMode === 'comeback') {
        partyMode = null;
        phase = 'call'; // back out to the Call submenu
      }
    } else if (key === 'a' || key === 'start') {
      if (!isPartySelectable(partyCursor)) return;
      const mode = partyMode;
      partyMode = null;
      if (mode === 'voluntary') {
        // Switching is a turn action — commit it and the round resolves.
        commit({ kind: 'switch', toIndex: partyCursor });
        return;
      }
      if (mode === 'comeback') {
        // COME BACK — the PROTECTED switch (a ★-Call). Shout (recalling the
        // OUTGOING mon), then commit; the incoming mon eats no free hit (engine-
        // negated). toIndex is the chosen bench mon.
        const cb = CALL_SET.find((c) => c.id === 'come-back')!;
        const toIndex = partyCursor;
        playerParticipated.add(toIndex); // the mon brought in fought
        setText([callShout(cb, monDisplayName(activeMon(state.player)))], () =>
          commit({ kind: 'call', call: 'comeBack', toIndex }),
        );
        return;
      }
      if (mode === 'forced') {
        // Override the engine's auto-pick if the player chose otherwise.
        const team = state.player;
        if (partyCursor !== team.active) {
          const nextTeam: Team = { ...team, active: partyCursor };
          state = { ...state, player: nextTeam };
          display.player = snapshot(activeMon(nextTeam));
          playerParticipated.add(partyCursor); // the overridden pick also fought
        }
        if (resumeResolveAfterParty) {
          resumeResolveAfterParty = false;
          // Resume the beat drain cleanly: clear the held beat so tickResolve
          // advances to the next one.
          beatMsg = '';
          reveal = 0;
          resolveHeld = false;
          phase = 'resolve';
        } else {
          // Out-of-round forced (rare path): fall back to beginTurn.
          beginTurn();
        }
      }
    }
  }

  function handleMoveInput(key: InputKey): void {
    const moves = gridMoves();
    if (key === 'up') {
      moveCursor = (moveCursor + moves.length - 1) % moves.length;
      clampMoveScroll();
      emitGameEvent({ kind: 'menu-move' });
    } else if (key === 'down') {
      moveCursor = (moveCursor + 1) % moves.length;
      clampMoveScroll();
      emitGameEvent({ kind: 'menu-move' });
    } else if (key === 'select') {
      stanceIdx = (stanceIdx + 1) % 3;
      emitGameEvent({ kind: 'stance-selected', stance: STANCES[stanceIdx]! });
    } else if (key === 'left' || key === 'right') {
      // FULL POWER is a direct strike — the focus commit-modifier is disabled
      // while it's armed (the two are mutually exclusive).
      if (pendingFullPower) return;
      // A TECHNIQUE cannot enter the two-step: the Focus path is rawHit-only and
      // silently discards the technique's status effect (the documented deferred
      // two-pool limitation). So the charge toggle no-ops on a technique — the
      // player still casts it single-step (A), which applies its effect correctly.
      if (isTechnique(moves[moveCursor]!)) return;
      // Layer 2 — toggle the COMMIT modifier: confirm now initiates the
      // current stance's two-step (CHARGE/HIDE/FEINT) instead of a single step.
      committing = !committing;
      emitGameEvent({ kind: 'menu-move' });
    }
    else if (key === 'b') {
      // Backing out of the move menu CANCELS a pending Full Power (the ★ was
      // never spent — it's spent only when the buffed attack resolves).
      pendingFullPower = false;
      phase = 'menu';
    }
    else if (key === 'a' || key === 'start') {
      const moveName = moves[moveCursor]!;
      const move = lookupMove(moveName);
      if (activeMon(state.player).st <= COMBAT.winded && (move.tier === 'heavy' || move.tier === 'nuke')) {
        setText(
          ['Too winded for', 'heavy moves!'],
          () => {
            phase = 'move';
          },
          { dismissable: true },
        );
        return;
      }
      if (activeMon(state.player).st < TIERS[move.tier].cost) {
        setText(
          ['Not enough stamina!'],
          () => {
            phase = 'move';
          },
          { dismissable: true },
        );
        return;
      }
      // FULL POWER takes priority over the focus commit (they're exclusive; the
      // UI already blocks committing while armed). The engine spends the 2★ +
      // applies +50% when this strike resolves.
      // A technique can never carry the commit modifier (guard: even if `committing`
      // was toggled ON for an attack and the cursor then moved to a technique, the
      // technique casts single-step so its effect isn't discarded).
      const chargeable = committing && !isTechnique(moveName);
      const modifier = pendingFullPower
        ? { fullPower: true as const }
        : chargeable
          ? { commit: true as const }
          : {};
      pendingFullPower = false;
      commit({ kind: 'move', move: moveName, stance: STANCES[stanceIdx]!, ...modifier });
    }
  }

  // ---- FOCUS R2 release menu -------------------------------------------------
  // The focusing mon picks its HIDDEN release now (HEAVY/FEINT/HIDE). It resolves
  // vs the foe's simultaneous single-step via the rotation triangle.
  function handleReleaseInput(key: InputKey): void {
    if (key === 'up') {
      releaseCursor = (releaseCursor + RELEASES.length - 1) % RELEASES.length;
      emitGameEvent({ kind: 'menu-move' });
    } else if (key === 'down') {
      releaseCursor = (releaseCursor + 1) % RELEASES.length;
      emitGameEvent({ kind: 'menu-move' });
    } else if (key === 'a' || key === 'start') {
      commit({ kind: 'release', release: RELEASES[releaseCursor]!.kind });
    }
    // No 'b' — a committed Focus MUST release (the commitment is locked).
  }

  // ---- Call submenu (Call-menu sprint) -------------------------------------
  // A Call is UNLOCKED (cursor can land) when it's built AND unlocked for
  // this run. Catch Breath is the only built Call; it unlocks via the run
  // flag. The others are design-only → locked → cursor-skipped + greyed.
  // NOTE (later pass): make locked Calls invisible-until-unlocked rather
  // than greyed — for now they're greyed so the player sees the set.
  function callUnlocked(call: CallDef): boolean {
    if (!call.built) return false;
    // Dev/playtest override (?calls=all) — unlock every built Call now.
    if (opts.devUnlockAllCalls) return true;
    // Catch Breath + Get Away unlock together (the run's Calls-unlocked gate ≈
    // the Warming bond moment); they each still cost ★. Everything else gates on
    // the active mon's bond STAGE (CALL_UNLOCK_STAGE below).
    if (call.id === 'catch-breath' || call.id === 'get-away') {
      return opts.catchBreathUnlocked;
    }
    // Lane B — the newly-built Calls gate on the active mon's bond STAGE
    // (the real, sim-balanced schedule). Absent bond → stage 1 → locked.
    const gate = CALL_UNLOCK_STAGE[call.id];
    if (gate !== undefined) return bondStage(opts.callBondValue ?? 0) >= gate;
    return false;
  }
  function callAffordable(call: CallDef): boolean {
    return activeMon(state.player).momentum >= call.starCost;
  }
  function firstSelectableCall(): number {
    for (let i = 0; i < CALL_SET.length; i += 1) {
      if (callUnlocked(CALL_SET[i]!)) return i;
    }
    return 0;
  }
  function stepCallCursor(start: number, dir: 1 | -1): number {
    let i = start;
    for (let n = 0; n < CALL_SET.length; n += 1) {
      i = (i + dir + CALL_SET.length) % CALL_SET.length;
      if (callUnlocked(CALL_SET[i]!)) return i;
    }
    return start;
  }
  // Fire a Call: shout FIRST (the trainer command beat — a Call is never
  // silent), then the effect. Full Power is the exception (armsAttack) — it
  // doesn't resolve here; it arms a buff and returns to the move menu.
  function fireCall(call: CallDef): void {
    const monName = monDisplayName(activeMon(state.player));
    setText([callShout(call, monName)], () => {
      if (call.id === 'catch-breath') commit({ kind: 'catchBreath' });
      else if (call.id === 'get-away') commit({ kind: 'call', call: 'getAway' });
      else if (call.id === 'shake-off') commit({ kind: 'call', call: 'shakeOff' });
      else if (call.id === 'recover') commit({ kind: 'call', call: 'recover' });
      else if (call.id === 'dodge') commit({ kind: 'call', call: 'dodge' });
      else if (call.id === 'read-them') {
        // READ THEM — buy the truth: reveal the foe's HONEST intent this round
        // (bypassing degradeIntent's degradation AND the foe info-discipline),
        // then the KNOW-vs-ACT Call resolves (forgoes the strike). Presentation
        // only — the engine 'readThem' Call is inert (see types.ts).
        const honest = honestIntentLine(foeAction) ?? `${activeMon(state.foe).species.name} — nothing hidden.`;
        setText([honest], () => commit({ kind: 'call', call: 'readThem' }));
      }
      else phase = 'menu';
    });
  }
  // FULL POWER (Lane B) — the two-step arm: shout, then return to the ATTACK
  // menu with the +50% buff pending. The player picks one of the 4 attacks; the
  // ★★ is spent when that buffed strike resolves (engine), not here.
  function armFullPower(call: CallDef): void {
    const monName = monDisplayName(activeMon(state.player));
    setText([callShout(call, monName)], () => {
      pendingFullPower = true;
      committing = false; // Full Power is a direct strike, never a focus
      moveCursor = 0;
      moveScroll = 0;
      phase = 'move';
    });
  }
  function handleCallInput(key: InputKey): void {
    if (key === 'up') callCursor = stepCallCursor(callCursor, -1);
    else if (key === 'down') callCursor = stepCallCursor(callCursor, 1);
    else if (key === 'b') phase = 'menu'; // exit the submenu (fixes misclick trap)
    else if (key === 'a' || key === 'start') {
      const call = CALL_SET[callCursor];
      if (!call) return;
      if (!callUnlocked(call)) {
        // Defensive — the cursor skips locked Calls, so this is only hit
        // if somehow landed (e.g. nothing unlocked). Small toast, no fire.
        setText(['That Call is not', 'unlocked yet.'], () => { phase = 'call'; }, { dismissable: true });
        return;
      }
      if (!callAffordable(call)) {
        setText(
          [`Not enough ★ for ${call.name}.`, `Needs ★${call.starCost} — win reads to charge.`],
          () => { phase = 'call'; },
          { dismissable: true },
        );
        return;
      }
      if (call.armsAttack) armFullPower(call);
      else if (call.picksStance) openThrowOff(call);
      else if (call.picksSwitch) openComeBack(call);
      else fireCall(call);
    }
  }

  // THROW THEM OFF — the two-step plant: pick WHICH stance to log into history
  // (the lie a history-reading foe consults), then fire.
  function openThrowOff(_call: CallDef): void {
    throwOffCursor = 0;
    phase = 'throwoff';
  }
  function handleThrowOffInput(key: InputKey): void {
    if (key === 'up') { throwOffCursor = (throwOffCursor + STANCES.length - 1) % STANCES.length; emitGameEvent({ kind: 'menu-move' }); }
    else if (key === 'down') { throwOffCursor = (throwOffCursor + 1) % STANCES.length; emitGameEvent({ kind: 'menu-move' }); }
    else if (key === 'b') phase = 'call';
    else if (key === 'a' || key === 'start') {
      const call = CALL_SET.find((c) => c.id === 'throw-off')!;
      const plant = STANCES[throwOffCursor]!;
      setText([callShout(call, monDisplayName(activeMon(state.player)))], () =>
        commit({ kind: 'call', call: 'throwOff', plantStance: plant }),
      );
    }
  }

  // COME BACK — the two-step protected switch: pick WHICH bench mon to send, then
  // fire (the incoming mon eats no free hit — engine-negated). Needs a bench
  // survivor (its value is the swap, not a universal evade).
  function openComeBack(_call: CallDef): void {
    if (!hasBenchSurvivor(state.player)) {
      setText(['No other mon', 'to bring in!'], () => { phase = 'call'; }, { dismissable: true });
      return;
    }
    partyMode = 'comeback';
    partyCursor = stepPartyCursor(state.player.active, 1);
    phase = 'party';
  }

  function handleTextInput(key: InputKey): void {
    if (key === 'b') {
      // Only dismissable dialogs back out — sequential/forced dialogs
      // (intro, end-text, "Got away safely!") must be read with A/Start.
      if (!textDismissable) return;
      const next = textNext;
      textNext = null;
      textQueue = [];
      textDismissable = false;
      if (next) next();
      return;
    }
    if (key !== 'a' && key !== 'start') return;
    textQueue.shift();
    if (textQueue.length === 0) {
      const next = textNext;
      textNext = null;
      textDismissable = false;
      if (next) next();
    }
  }

  function handleResolveInput(key: InputKey): void {
    if (key !== 'a' && key !== 'start') return;
    // ONE press finishes the current message's stream (reveal it fully);
    // the NEXT press advances to the next beat. Predictable, one message at
    // a time — never flushes the whole round.
    if (reveal < beatMsg.length) {
      reveal = beatMsg.length;
      return;
    }
    resolveHeld = false;
    advanceToNextBeat();
  }

  function spriteOffset(side: Side): number {
    if (animSide !== side || animT <= 0) return 0;
    if (animKind === 'strike' || animKind === 'opening' || animKind === 'clash') {
      return side === 'player' ? 4 : -4;
    }
    if (animKind === 'dodge') return side === 'player' ? -6 : 6;
    return 0;
  }

  // ---------- draw ----------

  function drawFoePanel(ctx: CanvasRenderingContext2D): void {
    const boss = breakThreshold > 0;
    const h = FOE_PANEL.h + (boss ? FOE_BREAK_EXTRA : 0); // a boss adds the thin BREAK strip
    const px = FOE_PANEL.x;
    const pw = FOE_PANEL.w;
    const py = FOE_PANEL.y;
    drawBattlePanel(ctx, px, py, pw, h);
    // Header — mon name (16px), type badge chip(s), combat-state / effect TAGS.
    const name = display.foe.species.name;
    drawText(ctx, name, px + 10, py + 3, PALETTE.stanceG);
    drawTypeBadges(ctx, px + 10 + measureUiText(ctx, name) + 6, py + 2, display.foe.species.types);
    drawPanelTags(ctx, px + pw - 10, py + 2, buildTags(display.foe, activeMon(state.foe)));
    // HP / ST rows — 16px labels + THIN bars + fine-print cur/max numerics.
    drawStatRow(ctx, px, pw, py + 15, 'HP', PALETTE.hpOk, display.foe.hp, display.foe.maxHp, hpColor(display.foe.hp, display.foe.maxHp), null);
    drawStatRow(ctx, px, pw, py + 27, 'ST', PALETTE.stamina, display.foe.st, display.foe.maxSt, PALETTE.stamina, COMBAT.winded / display.foe.maxSt);
    // MOMENTUM — a compact ★★☆ star row (the load-bearing ★ differential; display-
    // only — reads the foe's existing momentum, no logic change).
    drawText(ctx, 'MOMENTUM', px + 10, py + 40, PALETTE.stanceG);
    drawStars(ctx, px + 10 + measureUiText(ctx, 'MOMENTUM') + 8, py + 40, display.foe.momentum);
    // BOSS: the thin BREAK line + GYM LEADER / gust strip. Regular foes lack it.
    if (boss) drawBossBreak(ctx, px, pw, py, h);
    else drawBenchIndicators(ctx, px + 12, py + h + 3, state.foe);
  }

  // BOSS BREAK — a slim progress LINE along the foe panel's bottom inner edge (gold
  // fill over a dim track), with the GYM LEADER tag + gust cue on the compact strip
  // just above it. Replaces the old pip row.
  function drawBossBreak(ctx: CanvasRenderingContext2D, x: number, w: number, py: number, h: number): void {
    const stripY = py + FOE_PANEL.h; // the +FOE_BREAK_EXTRA strip
    // GYM LEADER role tag — RIGHT-ALIGNED to the panel's right inner edge (the
    // mock's position; beat-3 eye-gate fix). CH1 bosses are gym leaders (a static
    // default; reversible to a bossCard title field). Fine-print framed tag.
    drawPanelTags(ctx, x + w - 6, stripY, [{ label: 'GYM LEADER', color: PALETTE.velvet }]);
    drawText(ctx, 'BREAK', x + 8, stripY + 1, breakPipFlashT > 0 ? PALETTE.momentumGoldHi : PALETTE.frameInkSoft);
    // Gust cue (Falkner) — to the LEFT (beside BREAK), keeping clear of the
    // right-anchored role tag.
    const arena = state.bossCard?.arenaSchedule;
    if (arena && arena.rhythmEveryN > 0) {
      const anchor = state.rhythmAnchor ?? 0;
      const activeRound = phase === 'resolve' ? state.round - 1 : state.round;
      const currentIsGust = (activeRound - anchor) % arena.rhythmEveryN === 0;
      const nextIsGust = (state.round + 1 - anchor) % arena.rhythmEveryN === 0;
      if (currentIsGust || nextIsGust) {
        const gustW = 72;
        const gustX = x + 58; // beside the BREAK label, clear of the right tag
        const pulse = currentIsGust ? 0.55 + 0.4 * Math.sin(tick * 6) : 0.5;
        ctx.fillStyle = currentIsGust ? `rgba(70,150,230,${pulse})` : 'rgba(80,140,210,0.5)';
        ctx.fillRect(gustX, stripY, gustW, 11);
        ctx.strokeStyle = PALETTE.frameInk;
        ctx.lineWidth = 1;
        ctx.strokeRect(gustX + 0.5, stripY + 0.5, gustW - 1, 10);
        drawText(ctx, currentIsGust ? 'GUST NOW' : 'GUST NEXT', gustX + 5, stripY, PALETTE.paper);
      }
    }
    // The thin BREAK progress line along the panel's bottom inner edge.
    const lineY = py + h - 5;
    const lineX = x + 5;
    const lineW = w - 10;
    ctx.fillStyle = PALETTE.momentumOff; // dim track
    ctx.fillRect(lineX, lineY, lineW, 3);
    const frac = breakThreshold > 0 ? Math.min(1, displayBreakProgress / breakThreshold) : 0;
    ctx.fillStyle = breakPipFlashT > 0 ? PALETTE.momentumGoldHi : PALETTE.momentumGold; // gold fill
    ctx.fillRect(lineX, lineY, Math.round(lineW * frac), 3);
  }

  function drawPlayerPanel(ctx: CanvasRenderingContext2D): void {
    const px = PL_PANEL.x;
    const pw = PL_PANEL.w;
    const py = PL_PANEL.y;
    drawBattlePanel(ctx, px, py, pw, PL_PANEL.h);
    // Header — name (16px), type badges, top-right tags.
    const name = monDisplayName(display.player);
    drawText(ctx, name, px + 10, py + 3, PALETTE.stanceG);
    drawTypeBadges(ctx, px + 10 + measureUiText(ctx, name) + 6, py + 2, display.player.species.types);
    drawPanelTags(ctx, px + pw - 10, py + 2, buildTags(display.player, activeMon(state.player)));
    // HP / ST rows + numerics (thin bars).
    drawStatRow(ctx, px, pw, py + 15, 'HP', PALETTE.hpOk, display.player.hp, display.player.maxHp, hpColor(display.player.hp, display.player.maxHp), null);
    drawStatRow(ctx, px, pw, py + 27, 'ST', PALETTE.stamina, display.player.st, display.player.maxSt, PALETTE.stamina, COMBAT.winded / display.player.maxSt);
    // MOMENTUM — a compact ★★☆ star row + the single teaching hint (fine-print),
    // beside the stars. Replaces the old "win a read to charge ★" hint (one hint).
    drawText(ctx, 'MOMENTUM', px + 10, py + 38, PALETTE.stanceG);
    const sockEnd = drawStars(ctx, px + 10 + measureUiText(ctx, 'MOMENTUM') + 8, py + 38, display.player.momentum);
    drawText(ctx, 'STARS POWER CALLS + UNLOCK MOVES', sockEnd + 8, py + 38, PALETTE.frameInkDim);
    // BOND — LABELED + HOUSED inside the panel frame (it used to float below).
    // Static during the fight; animates on the post-win advance (bondAdvanceFrom/To).
    const bondY = py + 49;
    drawText(ctx, 'BOND', px + 10, bondY, PALETTE.bond);
    const bondX = px + 10 + measureUiText(ctx, 'BOND') + 6;
    const benchShown =
      state.player.members.length > 1 && phase !== 'resolve' && phase !== 'end' && phase !== 'text';
    const benchW = benchShown ? state.player.members.length * 10 + 6 : 0;
    if (opts.playerBond) {
      const base = opts.playerBond[state.player.active] ?? 0;
      let value = base;
      if (bondAdvanceFrom !== null) {
        const t = Math.min(1, bondAdvanceT / BOND_ADVANCE_SEC);
        const eased = 1 - (1 - t) * (1 - t); // ease-out — the bar settles in
        value = bondAdvanceFrom + (bondAdvanceTo - bondAdvanceFrom) * eased;
      }
      drawBondBar(ctx, bondX, bondY + 2, px + pw - 10 - bondX - benchW, value);
    }
    // Team bench dots — right end of the BOND row (no-op for ≤1 mon / resolve).
    drawBenchIndicators(ctx, px + pw - 10 - state.player.members.length * 10, bondY + 1, state.player);
  }

  // Surface ③ — the read-win mon reaction. A soft, brief bond-tinted spark
  // rising off the player's mon + a faint ring, the moment a read banks a ★.
  // Subtle and diegetic (NOT a score/grade popup) — it just says "the read
  // landed." Pure render; the testable signal is the 'read-win' game event.
  function drawReadReaction(ctx: CanvasRenderingContext2D): void {
    if (readReactT <= 0) return;
    const t = 1 - readReactT / READ_REACT_SEC; // 0→1 across the reaction
    const alpha = Math.max(0, 1 - t);
    const cx = PL_SLOT.x + BATTLE_SLOT / 2 + spriteOffset('player');
    const topY = PL_SLOT.y + 4;
    ctx.globalAlpha = alpha * 0.45;
    ctx.strokeStyle = PALETTE.bond;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(cx, topY + 12, 6 + t * 9, 3 + t * 5, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = PALETTE.bond;
    ctx.fillRect(Math.round(cx - 1), Math.round(topY - t * 8), 2, 2);
    ctx.globalAlpha = 1;
  }

  // Bench dots (one per team member) tinted by status. Suppressed
  // during resolve to keep focus on the strike. Only draws when the
  // team has >1 mon — solo "teams" leave the strip empty.
  function drawBenchIndicators(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    team: Team,
  ): void {
    if (team.members.length <= 1) return;
    if (phase === 'resolve' || phase === 'end' || phase === 'text') return;
    for (let i = 0; i < team.members.length; i += 1) {
      const mon = team.members[i]!;
      const fainted = mon.hp <= 0;
      const isActive = i === team.active;
      let fill: string;
      if (fainted) fill = '#1d1d28';
      else if (isActive) fill = PALETTE.hpOk;
      else fill = PALETTE.frameInkDim;
      ctx.fillStyle = fill;
      ctx.fillRect(x + i * 10, y, 6, 6);
      ctx.strokeStyle = PALETTE.frameInk;
      ctx.lineWidth = 1;
      ctx.strokeRect(x + i * 10 + 0.5, y + 0.5, 5, 5);
    }
  }

  function drawIntent(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = 'rgba(46,32,20,0.92)'; // warm leather strip (2b-2)
    ctx.fillRect(INTENT.x, INTENT.y, INTENT.w, INTENT.h);
    ctx.fillStyle = PALETTE.silverDim; // silver inlay line
    ctx.fillRect(INTENT.x + 2, INTENT.y, INTENT.w - 4, 1);
    const intentLabelX = INTENT.x + 8;
    drawText(ctx, 'FOE INTENT:', intentLabelX, INTENT.y + 4, PALETTE.hpWarn);
    // Plain-language intent (honest, precision degraded per the reliability
    // ramp). A null line = OPAQUE: show a blank dash, no read. The SPD readout
    // below stays honest — speed isn't hidden, the foe's STANCE intent is.
    // Text pass: place the value AFTER the MEASURED label width (+ gap) so the
    // proportional font can't collide label and value (the old fixed x+60 did).
    ctx.font = UI_FONT;
    const intentValueX = Math.round(intentLabelX + ctx.measureText('FOE INTENT:').width + 6);
    drawText(ctx, shownIntent.line ?? '———', intentValueX, INTENT.y + 4, PALETTE.paper);
    // (2b-1) The BASE SPD readout was removed — speed is settled; the honest
    // per-move "NEXT:" turn-order preview in the move view carries what matters.
    // TUTORIAL live prompt — surface the read while the player is deciding.
    // An opening exists -> "NOW — throw!"; otherwise the read tell ("Brace to
    // force an opening"). Scripted guided catch only (opts.tutorial); a single
    // additive line, so wild/trainer battles are untouched.
    if (opts.tutorial && (phase === 'menu' || phase === 'move')) {
      const prompt = currentWindow() !== 'none' ? TUTORIAL_WINDOW_PROMPT : TUTORIAL_FOE_PROMPT;
      drawText(ctx, prompt, INTENT.x + 8, INTENT.y + INTENT.h + 4, PALETTE.hpOk);
    }
  }

  // S1 — the explanatory callout banner. Shown during resolve (the intent
  // bar's slot is free then), naming the rule behind what just happened.
  function drawCallout(ctx: CanvasRenderingContext2D): void {
    // Use the FADED display state (situationShown/Alpha), not calloutLine, so the
    // banner fades in/out instead of jumping.
    if (situationShown === null || situationAlpha <= 0) return;
    const h = 20;
    const y = INTENT.y;
    // Text pass re-fit (m3x6): SIZE the banner to the now-proportional text via
    // measureUiText (+ padding, capped to the screen), CENTER it, and draw with
    // drawTextCenter (applies the UI vertical offset + renders the inline ★ from
    // starTag small). Was a fixed 300px box + raw center fillText → off after the
    // font swap (text sat low, the box was too wide, the ★ towered).
    const cx = BATTLE_LOGICAL_W / 2;
    const textW = measureUiText(ctx, situationShown);
    const w = Math.min(BATTLE_LOGICAL_W - 8, Math.ceil(textW) + 16);
    const x = Math.round(cx - w / 2);
    const prevA = ctx.globalAlpha;
    ctx.globalAlpha = prevA * situationAlpha; // fade the whole banner
    ctx.fillStyle = 'rgba(255, 215, 90, 0.94)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = PALETTE.frameInk;
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    drawTextCenter(ctx, situationShown, cx, y + 6, PALETTE.frameInk);
    ctx.globalAlpha = prevA;
  }

  function drawBottomDialog(ctx: CanvasRenderingContext2D, lines: readonly string[]): void {
    drawBattlePanel(ctx, BOTTOM.x, BOTTOM.y, BOTTOM.w, BOTTOM.h);
    for (let i = 0; i < Math.min(4, lines.length); i += 1) {
      drawText(ctx, lines[i]!, BOTTOM.x + 16, BOTTOM.y + 14 + i * 20);
    }
    if (Math.floor(tick * 2) % 2 === 0) {
      drawText(ctx, '▼', BOTTOM.x + BOTTOM.w - 22, BOTTOM.y + BOTTOM.h - 20, PALETTE.frameInk);
    }
  }

  // The CALLS-row note (ball count / Call ★ or lock reason), used by the rail.
  function railNote(kind: RailKind): string {
    const me = activeMon(state.player);
    if (kind === 'catch') return opts.canCatch ? `x${opts.ballCount?.() ?? 0}` : '-';
    if (kind === 'call') {
      return !opts.catchBreathUnlocked ? 'locked' : me.momentum < 1 ? 'needs ★' : `★${me.momentum}`;
    }
    return '';
  }

  // The MENU RAIL — plain 16px keywords, notes beside them, and (in
  // 'full' mode) a DESCRIPTION column behind a dotted divider. In 'breadcrumb'
  // mode (move/call phases) it renders COMPACT + DIMMED with the drilled-in item
  // BOXED + a ◄ marker — a "you are here" trail beside the active list. DISPLAY-
  // ONLY: the rail in a drilled phase is not interactive (B backs out as always).
  function drawRail(ctx: CanvasRenderingContext2D, x: number, yTop: number, mode: 'full' | 'breadcrumb', boxedKind?: RailKind): void {
    const me = activeMon(state.player);
    const items = menuItems();
    const pitch = 14; // compacted (beat 2.5)
    const kwX = x + 12;
    if (mode === 'full') drawDottedV(ctx, x + 82, yTop, pitch * items.length - 3);
    items.forEach((it, i) => {
      let dim = !it.enabled;
      if (it.kind === 'call' && (!opts.catchBreathUnlocked || me.momentum < 1)) dim = true;
      const rowY = yTop + i * pitch;
      const cursorHere = mode === 'full' && menuCursor === i;
      const boxedHere = mode === 'breadcrumb' && it.kind === boxedKind;
      // In breadcrumb mode the drilled item is bright; the rest are dim context.
      const color = boxedHere ? PALETTE.frameInk : mode === 'breadcrumb' ? PALETTE.frameInkDim : dim ? PALETTE.frameInkDim : PALETTE.frameInk;
      if (cursorHere) drawRowHighlight(ctx, x + 6, rowY - 1, mode === 'full' ? 76 : 72, 15);
      if (boxedHere) {
        const bw = Math.ceil(measureUiText(ctx, RAIL_KEYWORD[it.kind])) + 7;
        ctx.strokeStyle = PALETTE.momentumGold;
        ctx.lineWidth = 1;
        ctx.strokeRect(kwX - 3.5, rowY - 0.5, bw, 15);
        drawText(ctx, '◄', kwX + bw, rowY, PALETTE.momentumGold);
      }
      const marker = cursorHere ? '>' : ' ';
      const kwLabel = `${marker} ${RAIL_KEYWORD[it.kind]}`;
      drawText(ctx, kwLabel, kwX, rowY, color);
      // The note + description columns render in 'full' (menu) mode only — the
      // breadcrumb stays compact/narrow so the active list has room beside it.
      if (mode === 'full') {
        const note = railNote(it.kind);
        if (note) {
          drawText(ctx, note, kwX + Math.ceil(measureUiText(ctx, kwLabel)) + 6, rowY, dim ? PALETTE.frameInkDim : PALETTE.frameInkSoft);
        }
        drawText(ctx, RAIL_DESC[it.kind], x + 90, rowY, PALETTE.frameInkSoft);
      }
    });
  }

  // A short one-liner for the narration strip (move phase).
  function moveOneLiner(info: MoveCellInfo): string {
    if (info.lockLabel) return `Locked — needs ${info.lockLabel.replace('NEEDS ', '')}`;
    if (info.isTech && info.effectTag) {
      const move = lookupMove(info.name);
      return move.effect?.polarity === 'buff' ? `Self-buff: grants ${info.effectTag}.` : `Inflicts ${info.effectTag} on a read-win.`;
    }
    return `A ${TIER_WORD[info.tier]} ${(info.type ?? 'neutral').toLowerCase()} strike.`;
  }

  // The NARRATION strip's text for the current console phase.
  function narrationText(): string {
    const side = activeMon(state.player);
    if (phase === 'move') {
      const moves = gridMoves();
      const name = moves[moveCursor];
      return name ? `MOVE  |  ${moveCellInfo(side, name).name} — ${moveOneLiner(moveCellInfo(side, name))}` : 'MOVE';
    }
    if (phase === 'call') {
      const call = CALL_SET[callCursor];
      return call ? `CALL  |  ${call.name} — ${CALL_DESC[call.id] ?? ''}` : 'CALL';
    }
    if (phase === 'release') {
      const r = RELEASES[releaseCursor]!;
      return `RELEASE  |  ${r.name} — ${r.beats}`;
    }
    if (phase === 'throwoff') return 'THROW THEM OFF  |  plant a false read';
    if (phase === 'party') return partyMode === 'forced' ? 'SEND OUT WHO?' : 'SWITCH  |  choose a monster';
    if (phase === 'spare') return 'SPARE  |  the fallen foe?';
    return `${monDisplayName(display.player)} — what will you do?`; // menu
  }

  function drawBottomMenu(ctx: CanvasRenderingContext2D): void {
    drawBattlePanel(ctx, BOTTOM.x, BOTTOM.y, BOTTOM.w, BOTTOM.h);
    drawNarration(ctx, narrationText());
    const me = activeMon(state.player);
    // The full rail (keyword · note · dotted divider · description).
    drawRail(ctx, BOTTOM.x + 4, BOTTOM.y + 16, 'full');
    // When the player has no ★, teach what charges it (a micro-hint, top-right).
    if (me.momentum === 0) {
      drawText(ctx, 'win a read to charge ★', BOTTOM.x + BOTTOM.w - 190, BOTTOM.y + 16, PALETTE.frameInkDim);
    }
    drawButtonChips(ctx, ['A CONFIRM', 'B BACK']);
  }

  function drawBottomParty(ctx: CanvasRenderingContext2D): void {
    drawBattlePanel(ctx, BOTTOM.x, BOTTOM.y, BOTTOM.w, BOTTOM.h);
    drawNarration(ctx, narrationText());
    const team = state.player;
    team.members.forEach((side, i) => {
      const isActive = i === team.active;
      const fainted = side.hp <= 0;
      const selectable = isPartySelectable(i);
      const color = !selectable ? PALETTE.frameInkDim : PALETTE.frameInk;
      const cursor = partyCursor === i ? '>' : ' ';
      const hpStr = `HP ${Math.round(side.hp)}/${side.maxHp}`;
      const tag = fainted ? 'FNT' : isActive ? 'ACT' : '';
      const row = `${cursor}${monDisplayName(side).padEnd(10, ' ')} ${hpStr.padEnd(10, ' ')} ${tag}`;
      drawText(ctx, row, BOTTOM.x + 16, BOTTOM.y + 20 + i * 15, color);
    });
    drawButtonChips(ctx, partyMode === 'forced' ? ['A SEND OUT'] : ['A SWITCH', 'B BACK']);
  }

  // The CD-format move view (2b-1): a 2×3 grid — 4 ATTACKS (2 columns) + 2
  // TECHNIQUES (a row), the two purposeful pools visually separated — with a
  // move-detail panel + the A/G/F stance selector in the right column. Plain
  // colors (2b-2 skins it). Reads the two-pool + tier-gate engine truth.
  function drawBottomMoves(ctx: CanvasRenderingContext2D): void {
    drawBattlePanel(ctx, BOTTOM.x, BOTTOM.y, BOTTOM.w, BOTTOM.h);
    drawNarration(ctx, narrationText());
    const side = activeMon(state.player);
    const attacks = attackPool(side.species);
    const techs = techniquePool(side.species);
    const moves = [...attacks, ...techs]; // == gridMoves(); moveCursor indexes this

    // ── LEFT: the breadcrumb RAIL (FIGHT boxed) — display-only trail ──────────
    drawRail(ctx, BOTTOM.x + 4, BOTTOM.y + 16, 'breadcrumb', 'fight');

    // ── MIDDLE: the 2×3 grid, BESIDE the rail (compacted cells) ───────────────
    const gx = BOTTOM.x + 92;
    const cellW = 148;
    const cellGX = 152;
    drawText(ctx, 'ATTACKS', gx, BOTTOM.y + 14, PALETTE.frameInkSoft);
    for (let i = 0; i < attacks.length; i += 1) {
      const col = i % 2;
      const row = Math.floor(i / 2);
      drawMoveCell(ctx, gx + col * cellGX, BOTTOM.y + 24 + row * 16, cellW, 14, moveCellInfo(side, attacks[i]!), moveCursor === i);
    }
    drawText(ctx, 'TECHNIQUES', gx, BOTTOM.y + 56, PALETTE.frameInkSoft);
    for (let j = 0; j < techs.length; j += 1) {
      drawMoveCell(ctx, gx + j * cellGX, BOTTOM.y + 64, cellW, 14, moveCellInfo(side, techs[j]!), moveCursor === attacks.length + j);
    }

    // Divider between the grid and the detail/stance column.
    ctx.fillStyle = PALETTE.frameInkSoft;
    ctx.fillRect(BOTTOM.x + 398, BOTTOM.y + 16, 1, BOTTOM.h - 24);

    // ── RIGHT: SELECTED detail + stance selector ─────────────────────────────
    const rx = BOTTOM.x + 406;
    const sel = moves[moveCursor] ? moveCellInfo(side, moves[moveCursor]!) : null;
    drawText(ctx, 'SELECTED', rx, BOTTOM.y + 14, PALETTE.frameInkSoft);
    if (sel) {
      drawText(ctx, sel.name, rx, BOTTOM.y + 25, sel.legal ? PALETTE.frameInk : PALETTE.frameInkDim);
      drawText(
        ctx,
        `${sel.badge} ${sel.isTech ? 'TECHNIQUE' : 'ATTACK'} · ${sel.type ?? 'NEUTRAL'} · ST${sel.cost}`,
        rx,
        BOTTOM.y + 37,
        PALETTE.frameInkSoft,
      );
      const move = lookupMove(sel.name);
      let eff: string;
      if (sel.lockLabel) eff = `Locked: ${sel.lockLabel}.`;
      else if (sel.isTech && move.effect) {
        eff = move.effect.polarity === 'buff' ? `Self-buff — grants ${sel.effectTag}.` : `Read-win → inflicts ${sel.effectTag}.`;
      } else eff = `A ${TIER_WORD[sel.tier]} ${(sel.type ?? 'neutral').toLowerCase()} strike.`;
      drawText(ctx, eff, rx, BOTTOM.y + 47, sel.legal ? PALETTE.frameInk : PALETTE.hpCrit);
    }

    // NEXT — the honest turn-order preview for THIS move.
    const stance = STANCES[stanceIdx]!;
    const foeSt = actionStance(foeAction);
    const order = orderHint(side, activeMon(state.foe), moves[moveCursor]!, stance, actionMove(foeAction), foeSt);
    const fluidFirst = (stance === 'F' && foeSt === 'G') || (foeSt === 'F' && stance === 'G');
    drawText(ctx, `NEXT: ${order}${fluidFirst ? ' ·FLUID' : ''}`, rx, BOTTOM.y + 58, fluidFirst ? PALETTE.stanceF : PALETTE.frameInkSoft);

    // Stance selector — boxed A/G/F badges, active highlighted + NAMED (e.g. GUARD).
    const sy = BOTTOM.y + 69;
    for (let i = 0; i < STANCES.length; i += 1) {
      const bx = rx + i * 18;
      if (STANCES[i] === stance) {
        ctx.fillStyle = 'rgba(201,162,39,0.5)'; // highlight the active badge
        ctx.fillRect(bx - 2, sy - 2, 13, 13);
      }
      drawStanceBadge(ctx, bx, sy, STANCES[i]!);
    }
    drawText(ctx, STANCE_NAME[stance], rx + 60, sy, PALETTE.frameInk);
    if (pendingFullPower) drawText(ctx, '▶FULL+50%', rx + 118, sy, PALETTE.momentumGold);
    // ▶FOCUS only shows for a chargeable move — a technique can't Focus.
    else if (committing && sel && !sel.isTech) drawText(ctx, '▶FOCUS', rx + 118, sy, PALETTE.hpCrit);

    // Move-specific controls (fine-print, left of the chips) + the A/B button chips.
    drawText(ctx, 'SEL stance · L/R commit', gx, BOTTOM.y + BOTTOM.h - 14, PALETTE.frameInkDim);
    drawButtonChips(ctx, ['A CONFIRM', 'B BACK']);
  }

  // FOCUS R2 — the release picker (the hidden release is chosen NOW).
  // Layout (KICKOFF-focus-damage-bugfix.md, Bug 3): the "RELEASE:" header sits
  // on its own line; the three release rows start BELOW it (left column) and the
  // selected release's rotation hint sits in the RIGHT column, aligned with the
  // rows. Previously the header (y+4) and the first row (y+5) drew on the same
  // line at the same x — "RELEASE:" collided with ">HEAVY" and its hint.
  function drawBottomRelease(ctx: CanvasRenderingContext2D): void {
    drawBattlePanel(ctx, BOTTOM.x, BOTTOM.y, BOTTOM.w, BOTTOM.h);
    drawNarration(ctx, narrationText());
    RELEASES.forEach((r, i) => {
      const y = BOTTOM.y + 20 + i * 16;
      const marker = releaseCursor === i ? '>' : ' ';
      const color = releaseCursor === i ? PALETTE.frameInk : PALETTE.frameInkSoft;
      if (releaseCursor === i) drawRowHighlight(ctx, BOTTOM.x + 12, y - 1, 260, 15);
      // "HEAVY ATTACK" (not bare "HEAVY") — YOUR charged attack delivered that way.
      drawText(ctx, `${marker}${r.name} ATTACK`, BOTTOM.x + 18, y, color);
    });
    // Right column — the CHARGED ATTACK carried through this release (its type/
    // tier/ST all carry via focus.move → rawHit; Heavy/Feint/Hide is the read
    // multiplier on top). Mirrors the move view's SELECTED detail. Display-only.
    const rx = BOTTOM.x + 320;
    const chargedName = activeMon(state.player).focus?.move;
    if (chargedName) {
      const info = moveCellInfo(activeMon(state.player), chargedName);
      drawText(ctx, 'RELEASING:', rx, BOTTOM.y + 18, PALETTE.frameInkSoft);
      drawText(ctx, info.name, rx, BOTTOM.y + 30, PALETTE.frameInk);
      drawText(
        ctx,
        `${info.badge} ${info.isTech ? 'TECHNIQUE' : 'ATTACK'} · ${info.type ?? 'NEUTRAL'} · ST${info.cost}`,
        rx,
        BOTTOM.y + 42,
        PALETTE.frameInkSoft,
      );
    }
    const sel = RELEASES[releaseCursor]!;
    drawText(ctx, `${sel.name}: ${sel.beats}`, rx, BOTTOM.y + 58, PALETTE.frameInkSoft);
    drawButtonChips(ctx, ['A RELEASE']);
  }

  function drawBottomCall(ctx: CanvasRenderingContext2D): void {
    drawBattlePanel(ctx, BOTTOM.x, BOTTOM.y, BOTTOM.w, BOTTOM.h);
    drawNarration(ctx, narrationText());
    // The CALLS breadcrumb rail + the 9-slot list BESIDE it (2 columns). Locked +
    // unaffordable render greyed; the cursor skips locked rows.
    drawRail(ctx, BOTTOM.x + 4, BOTTOM.y + 16, 'breadcrumb', 'call');
    const perCol = Math.ceil(CALL_SET.length / 2); // 5 left, 4 right
    const listX = BOTTOM.x + 92;
    const colW = 268;
    CALL_SET.forEach((call, i) => {
      const unlocked = callUnlocked(call);
      const greyed = !unlocked || !callAffordable(call);
      const color = greyed ? PALETTE.frameInkDim : PALETTE.frameInk;
      const col = i < perCol ? 0 : 1;
      const row = i < perCol ? i : i - perCol;
      const x = listX + col * colW;
      const y = BOTTOM.y + 16 + row * 14;
      if (callCursor === i) drawRowHighlight(ctx, x - 4, y - 1, colW - 8, 14);
      const marker = callCursor === i ? '>' : ' ';
      const tag = !unlocked ? ' ·LOCKED' : '';
      drawText(ctx, `${marker}${call.name}${tag}`, x, y, color);
      drawTextRight(ctx, `★${call.starCost}`, x + colW - 16, y, color);
    });
    drawText(ctx, `Your ★${activeMon(state.player).momentum}`, listX, BOTTOM.y + BOTTOM.h - 16, PALETTE.frameInkDim);
    drawButtonChips(ctx, ['A USE', 'B BACK']);
  }

  // THROW THEM OFF — the stance-plant picker. The player chooses which STANCE to
  // log into history as a lie (the surface a history-reading foe consults).
  function drawBottomThrowOff(ctx: CanvasRenderingContext2D): void {
    drawBattlePanel(ctx, BOTTOM.x, BOTTOM.y, BOTTOM.w, BOTTOM.h);
    drawNarration(ctx, narrationText());
    drawText(ctx, 'Which stance should they THINK you played?', BOTTOM.x + 16, BOTTOM.y + 18, PALETTE.frameInkSoft);
    const labels: { readonly [k in Stance]: string } = {
      A: 'AGGRESSIVE', G: 'GUARD', F: 'FLUID',
    };
    STANCES.forEach((s, i) => {
      const y = BOTTOM.y + 38 + i * 16;
      const on = throwOffCursor === i;
      if (on) drawRowHighlight(ctx, BOTTOM.x + 12, y - 1, 300, 15);
      drawText(ctx, `${on ? '>' : ' '}Feign ${labels[s]}`, BOTTOM.x + 16, y, on ? PALETTE.frameInk : PALETTE.frameInkSoft);
    });
    drawButtonChips(ctx, ['A PLANT', 'B BACK']);
  }

  function drawBottomSpare(ctx: CanvasRenderingContext2D): void {
    drawBattlePanel(ctx, BOTTOM.x, BOTTOM.y, BOTTOM.w, BOTTOM.h);
    drawNarration(ctx, narrationText());
    const foeName = display.foe.species.name;
    drawText(ctx, `The wild ${foeName} fell. Tend it — show mercy?`, BOTTOM.x + 16, BOTTOM.y + 20, PALETTE.frameInkSoft);
    drawText(
      ctx,
      `${spareCursor === 0 ? '>' : ' '} YES — spare it`,
      BOTTOM.x + 20,
      BOTTOM.y + 44,
      spareCursor === 0 ? PALETTE.frameInk : PALETTE.frameInkDim,
    );
    drawText(
      ctx,
      `${spareCursor === 1 ? '>' : ' '} NO — claim the win`,
      BOTTOM.x + 320,
      BOTTOM.y + 44,
      spareCursor === 1 ? PALETTE.frameInk : PALETTE.frameInkDim,
    );
    drawButtonChips(ctx, ['A CHOOSE', 'B DECLINE']);
  }

  function drawBottomLog(ctx: CanvasRenderingContext2D): void {
    drawBattlePanel(ctx, BOTTOM.x, BOTTOM.y, BOTTOM.w, BOTTOM.h);
    for (let i = 0; i < log.length; i += 1) {
      let line = log[i]!;
      // Stream the current beat's line (the newest): reveal it progressively.
      if (i === log.length - 1 && line === beatMsg && reveal < beatMsg.length) {
        line = line.slice(0, Math.floor(reveal));
      }
      drawText(ctx, line, BOTTOM.x + 16, BOTTOM.y + 14 + i * 18);
    }
    // The "press to continue" prompt — only once the current beat is fully
    // revealed (so the player knows a press now advances, not skips text).
    if (resolveHeld && reveal >= beatMsg.length && Math.floor(tick * 2) % 2 === 0) {
      drawText(ctx, '▼', BOTTOM.x + BOTTOM.w - 22, BOTTOM.y + BOTTOM.h - 20, PALETTE.frameInk);
    }
  }

  // ---- DEV TOOL: dev combat-log overlay --------------------------------
  // The rolling log, drawn LAST (over the HUD) so nothing occludes it. Bounded
  // to a FIXED on-screen box: the visible line count is derived from the box
  // geometry (clamped to the 320×180 viewport), so the log can NEVER grow off
  // the bottom — as events arrive, the oldest scroll out the top and the newest
  // stay pinned at the bottom (always visible). Deliberately drawn with a raw
  // small monospace font (not the 16px UI font) for density — a debug readout.
  function drawDevLog(ctx: CanvasRenderingContext2D): void {
    if (!showDevLog) return;
    const pad = 3;
    const lh = 9;
    const x = 6;
    const top = 96;
    const bottom = BATTLE_LOGICAL_H - 6; // hard stop inside the 360px battle viewport
    const w = 460;
    const headerH = lh;
    // How many event lines fit the FIXED box (after the header). The display is
    // bounded by the BOX, not the buffer — capped at DEV_LOG_VISIBLE but never
    // more than the viewport allows, so it can't overflow off-screen.
    const fit = Math.floor((bottom - top - pad * 2 - headerH) / lh);
    const maxLines = Math.max(1, Math.min(DEV_LOG_VISIBLE, fit));
    const lines = devLog.slice(-maxLines); // rolling: only the newest that fit
    const h = pad * 2 + headerH + lines.length * lh;
    ctx.fillStyle = 'rgba(0,0,0,0.82)';
    ctx.fillRect(x, top, w, h);
    ctx.strokeStyle = '#57e08a';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, top + 0.5, w - 1, h - 1);
    ctx.font = '8px monospace';
    ctx.letterSpacing = '0px';
    ctx.textAlign = 'start';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#57e08a';
    // Header notes the buffer total so it's clear older lines rolled off-window.
    ctx.fillText(`DEV COMBAT-LOG (\` toggle) · ${devLog.length} events`, x + pad, top + pad);
    ctx.fillStyle = '#d6f5e2';
    for (let i = 0; i < lines.length; i += 1) {
      ctx.fillText(lines[i]!, x + pad, top + pad + headerH + i * lh);
    }
  }

  // DEV TOOL — the `~`/backtick runtime toggle. Registered on the window (game
  // layer, DOM allowed) and torn down in exit() so it never leaks past the
  // battle. Guarded so headless/test contexts (no window) simply skip it. The
  // URL hook (?log=1) and opts.devLog seed the initial state above.
  const onDevLogKey = (e: KeyboardEvent): void => {
    if (e.key === '`' || e.key === '~') showDevLog = !showDevLog;
  };
  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('keydown', onDevLogKey);
  }

  // No-intro mode: jump straight into the first turn.
  if (textQueue.length === 0) {
    textNext = null;
    beginTurn();
  }

  return {
    // Battle-UI rebuild (Part 1): the battle scene runs at 640×360. The shared
    // canvas swaps to this size while the battle is on top and restores the base
    // 320×180 on exit. NOTE: the HUD draw code below is still authored in 320×180
    // coordinates, so at 640×360 it renders in the top-left quarter — that's
    // expected for Part 1 (the layout re-authoring is Part 2); nothing crashes.
    logicalSize: { width: BATTLE_LOGICAL_W, height: BATTLE_LOGICAL_H },
    update(dt) {
      tick += dt;
      if (breakFlashT > 0) breakFlashT = Math.max(0, breakFlashT - dt);
      if (breakPipFlashT > 0) breakPipFlashT = Math.max(0, breakPipFlashT - dt);
      if (readReactT > 0) readReactT = Math.max(0, readReactT - dt);
      if (bondAdvanceFrom !== null && bondAdvanceT < BOND_ADVANCE_SEC) {
        bondAdvanceT = Math.min(BOND_ADVANCE_SEC, bondAdvanceT + dt);
      }
      if (phase === 'resolve') tickResolve(dt);
      // Situation-bar fade (after tickResolve, so calloutLine reflects the
      // current beat). Fade IN a new/changed line during resolve; otherwise fade
      // OUT the lingering one (on clear or when resolve ends).
      if (phase === 'resolve' && calloutLine !== null) {
        if (calloutLine !== situationShown) {
          situationShown = calloutLine;
          situationAlpha = 0;
        }
        situationAlpha = Math.min(1, situationAlpha + dt / SITUATION_FADE_SEC);
      } else if (situationShown !== null) {
        situationAlpha = Math.max(0, situationAlpha - dt / SITUATION_FADE_SEC);
        if (situationAlpha <= 0) situationShown = null;
      }
    },

    input(key) {
      if (phase === 'text') {
        handleTextInput(key);
        return;
      }
      if (phase === 'menu') {
        handleMenuInput(key);
        return;
      }
      if (phase === 'move') {
        handleMoveInput(key);
        return;
      }
      if (phase === 'call') {
        handleCallInput(key);
        return;
      }
      if (phase === 'release') {
        handleReleaseInput(key);
        return;
      }
      if (phase === 'throwoff') {
        handleThrowOffInput(key);
        return;
      }
      if (phase === 'spare') {
        handleSpareInput(key);
        return;
      }
      if (phase === 'party') {
        handlePartyInput(key);
        return;
      }
      if (phase === 'resolve') {
        handleResolveInput(key);
        return;
      }
    },

    draw(ctx) {
      // Beat 3 — the PAINTED STAGE (sky · horizon band · ground · clearing ellipse
      // · deterministic grass/pebbles). Replaces the flat sky + ground strip.
      drawArena(ctx);

      // Restyled platforms IN the clearing under each fighter (grown to the 112
      // slot). Lit top + shaded rim, so the mons stand on the field, not float.
      drawPlatform(ctx, FOE_SLOT.x + BATTLE_SLOT / 2, FOE_SLOT.y + BATTLE_SLOT, 58, 10);
      drawPlatform(ctx, PL_SLOT.x + BATTLE_SLOT / 2, PL_SLOT.y + BATTLE_SLOT, 64, 12);

      // Sprites — fillSlot upscales real 56px art by the largest INTEGER factor
      // that fits (2× → 112, pixel-crisp); placeholders already scale to the slot.
      drawSpeciesInSlot(
        ctx,
        { name: display.foe.species.name, type: display.foe.species.types[0] ?? null },
        FOE_SLOT.x + spriteOffset('foe'),
        FOE_SLOT.y,
        { facing: 'left', slotSize: BATTLE_SLOT, fillSlot: true },
      );
      drawSpeciesInSlot(
        ctx,
        { name: monDisplayName(display.player), type: display.player.species.types[0] ?? null },
        PL_SLOT.x + spriteOffset('player'),
        PL_SLOT.y,
        { facing: 'right', slotSize: BATTLE_SLOT, fillSlot: true },
      );

      drawReadReaction(ctx); // surface ③ — over the mon, under the HUD panels
      // Battle-UI v2 (beat 1) — the panels now OWN their sub-elements: the foe
      // panel integrates the BREAK row (boss) + status tags; the player panel
      // houses BOND + bench + tags. The separate boss strip / under-panel /
      // external status-chip passes are gone (folded in, no double-render).
      drawFoePanel(ctx);
      drawPlayerPanel(ctx);

      if (phase === 'menu' || phase === 'move' || phase === 'call' || phase === 'release' || phase === 'throwoff') drawIntent(ctx);
      // S1 — the read-war callout occupies the intent slot during resolve. Drawn
      // whenever it's visible (situationAlpha > 0) so its fade-out completes even
      // a beat or two after resolve ends; drawCallout no-ops when faded out.
      drawCallout(ctx);

      if (breakFlashT > 0) {
        const a = breakFlashT / 0.6;
        ctx.fillStyle = `rgba(255,240,200,${0.6 * a})`;
        ctx.fillRect(0, 0, BATTLE_LOGICAL_W, BATTLE_LOGICAL_H);
      }

      if (phase === 'text') drawBottomDialog(ctx, textQueue);
      else if (phase === 'menu') drawBottomMenu(ctx);
      else if (phase === 'move') drawBottomMoves(ctx);
      else if (phase === 'call') drawBottomCall(ctx);
      else if (phase === 'release') drawBottomRelease(ctx);
      else if (phase === 'throwoff') drawBottomThrowOff(ctx);
      else if (phase === 'spare') drawBottomSpare(ctx);
      else if (phase === 'party') drawBottomParty(ctx);
      else if (phase === 'resolve' || phase === 'end') drawBottomLog(ctx);

      drawDevLog(ctx); // DEV TOOL — over everything; no-op when off
    },

    exit() {
      // DEV TOOL — tear down the runtime-toggle listener so it never leaks
      // past this battle.
      if (typeof window !== 'undefined' && typeof window.removeEventListener === 'function') {
        window.removeEventListener('keydown', onDevLogKey);
      }
    },
  };
}
