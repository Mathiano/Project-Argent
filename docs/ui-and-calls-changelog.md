# Change Log — UI Overhaul + Call Economy + Bond Legibility (this session)

**Purpose:** Record of what shipped this session so CC has ground-truth for future work. Drop in `docs/`. Covers: bond-legibility UI, Call effects, three combat fixes, and the full UI-quality overhaul (the font journey especially — so the next person doesn't re-walk it).

---

## 1. Bond Legibility UI (Lane A) — SHIPPED (commit edef1a3)
The bond *system* was already live (per-mon 0–100, 7 stages, grows post-fight via `awardBondForFight`, persists in save/box/evolution, sim-gated). This added the **legibility layer**:
- **Bond bar under the player's mon** in combat — shows current stage + progress. **Static during the fight** (bond is awarded post-fight, like XP — NOT a live mid-combat fill). Threaded via `playerBond?`/`bondContext?` into `BattleSceneOpts`; new `src/game/bondBar.ts`. Advances on the post-fight victory beat via the pure `bondAfterFight` (no state mutation in the scene).
- **Tier-up beat ENHANCED** (not rebuilt) — the existing `createBondStageScene`/`bond-stage-cross` now reads as a reward: "YOUR BOND DEEPENED" headline, bond-tinted rings, ★ bloom, bar sweep.
- **Read-win reaction** — pure render on the existing momentum event: a subtle bond-tinted spark off the mon when ★ is granted. Emits a new `read-win` GameEvent (hook for a future sound). NOT a grade-card (tone guard).
- **Model decided:** ONE loop (read-win → bond), the bond bar IS the spine (fills, never drops — horizontal-bond protected). **NO separate read-accuracy meter** — the consequence of misreading IS the feedback.

## 2. Call Effects (Lane B) — SHIPPED (commit 2ce440a)
Wired real effects into 3 previously-locked Calls (`CALL_SET`, battle.ts:467). The `CallDef.built` flag is the single source of "built vs design-only."
| Call | ★ | Effect | Status |
|---|---|---|---|
| Catch Breath | 1 | +50 stamina | built (unchanged) |
| Get Away | 1 | escape, **25% graze** (see fix #3) | built |
| Recover | 1 | **heal 50% max HP** (clamped, pre-strike) | NEWLY built |
| Dodge | 1 | **full evade** (0 damage) | NEWLY built |
| Full Power | 2 | **+50% next attack** (two-step: arm → pick attack) | NEWLY built |
| Shake It Off (was Hang In There) | 1 | clear status | **LOCKED — needs status system** |
- **Full Power flow:** CALL → Full Power → returns to attack menu armed (▶FULL+50%) → pick attack → +50% (×1.5 in resolveStrike, stacks with triangle). Flows into preMit, so Full Power INTO a Guard amplifies the counter-reflect you eat (high-risk). ★2 spent when the buffed strike resolves.
- **Hang In There / Shake It Off:** the old "survive-at-1HP" effect is BAD DESIGN (no rest period in continuous combat → surviving one round just loses the next). Slot is to be repurposed to "Shake It Off (clear status)" — but BLOCKED until the status-effect system exists. Left as locked placeholder; do NOT wire survive-at-1HP. When status lands, repurpose + update battle.test.ts:690-709.
- **Unlock gating (REAL vs DEV):** Calls unlock at bond tiers (`CALL_UNLOCK_STAGE`): Catch Breath/Get Away → stage 2; Recover → stage 3; Dodge → stage 4; Full Power → stage 5. **Trainer profiles are balanced against the bond-gated toolkit — the real gating MUST hold for sim/balance.** Dev override: `?calls=all` unlocks everything for playtesting. **NEVER ship with everything unlocked.** Placement is a tuning detail (flagged, retunable).
- **⚠️ SIM NOTE:** ladders are bit-identical because no sim bot USES the new Calls (guarded to action variants no sim emits). This proves ISOLATION, not BALANCE. The new Calls' real balance (Recover stall, Full Power burst) is UNMEASURED by sim → **Mathias's playtest is the balance gate.** Today's throttle is the ★ economy (cap, earn-by-reads). A hard cooldown is banked if Recover stalls.

## 3. Three Combat/Display Fixes — SHIPPED (commits 2ec870f + 0f4c793)
- **Fix 1 (bond beat):** `pushRivalGateFight` (KAMON gate) discarded bond crossings → tier-up beat was swallowed by the post-win dialogue. Fixed: routed through `showBondBeats` callback → **bond beat first, then dialogue.** (Other 3 award sites already sequenced right.)
- **Fix 2 (Recover display):** healed a raw float ("23.499…") → now "[mon] recovers!" (no number, RSE register). Heal math untouched.
- **Fix 3 (Get Away nerf — SIM-GATED):** Get Away now takes **25% of the incoming hit** (graze-and-go) instead of full evade. Distinguishes it from Dodge (clean 0-damage evade): Get Away (stage 2, early) = graze; Dodge (stage 4) = clean. **The getAway-using cell is reader-vs-jay = 46.8%** (was the sim cell that measures it). Fair-but-distinct confirmed. NOTE: the bond call-greedy probe (81.8/31.3/86.8) does NOT use Get Away (it spends ★ on Catch Breath) — so it's unchanged.

## 4. UI QUALITY OVERHAUL — SHIPPED (multiple commits)
The big one. Went from flat/faint monospace to a real designed pixel UI. **Recorded in detail because the font journey was long — don't re-walk it.**

### Frames (committed fd484a7)
- **Drop-shadow under panels** (two-layer, offset down-right) → panels float (Emerald box cue).
- **Rounded corners** — pixel-perfect 3px (`PANEL_RADIUS=3`), via row-by-row inset, NOT `ctx.roundRect` (which anti-aliases/fuzzes — wrong for crisp pixel art).
- **Taller bars** — HUD bars 6px (`BAR_HEIGHT_TALL`); menu bars stay 4px (optional height param, no menu reflow).

### Text — the font journey (THE IMPORTANT RECORD)
The lesson: **RSE-quality text is an ART problem (a designed font), not a code problem.** Code renders any font well; it can't author a good one. The path walked:
1. **Code-tier styling** (bevels, highlights) — too subtle to read at 320×180. Strengthened, still not enough — because the gap was the FONT, not the styling.
2. **Press Start 2P** (OFL, commercial-clean) — tried, but it's **blocky NES-arcade, not GBA-proportional** = wrong retro flavor. Also 8px was ~1.6× too wide → overflowed. **Banked, not used** (still vendored as a blocky-retro option).
3. **Text drop-shadow** — discovered it makes light-panel text look **double/blurry** (dark shadow on cream = visible doubled edge; only looks good on DARK panels where it's invisible). **Shadow is OFF by default** (`TEXT_SHADOW_ON=false`); one-line re-enable kept (use SOLID palette color, NOT alpha, if ever re-enabled — alpha = modern-web smudge).
4. **m5x7** (Daniel Linssen, **CC0**, proportional) — looked great (real designed proportional pixel font) but glyphs too big for the boxes; can't shrink below 16px without going fuzzy (pixels only land clean at 16/32px).
5. **m3x6** (Daniel Linssen, **CC0/attribution**, the smaller sibling) — **THE ANSWER.** Same family/look, narrower (~4.0px avg advance vs m5x7's 5.7, vs old monospace 4.8), renders crisp at 16px, fits the boxes. **This is the shipped UI font.**

### Current font facts (m3x6 — ground truth for CC)
- **`UI_FONT = '16px m3x6, monospace'`** — vendored at `src/assets/fonts/m3x6.ttf`, CC0/credit-Daniel-Linssen in the fonts README. m5x7 + Press Start 2P also vendored + banked (NOT loaded).
- **Renders ONLY at 16/32/48px** (crisp); 8px = fuzzy. This is a hard constraint of the font.
- **Proportional** — use `ctx.measureText` for width-sensitive placement, NOT fixed char-width math. (Old `BOND_LABEL_W`/`MONO_CHAR_W` fixed-width constants removed/deprecated.)
- **Vertical offset `UI_TEXT_DY = -4`** — m3x6's 16px em is taller than its ~6px glyph; -4 pulls caps to where the old 8px text sat. Eye-check-tunable.
- **Inline symbols (★ ♥ ▼ ▲ ▶ ► ₽) are NOT in m3x6** — `drawText`/`drawTextRight` split strings into m3x6 runs + symbol runs, drawing symbols at fixed 8px monospace (`SYMBOL_DY=4` to baseline-align) so they don't tower over the ~6px caps.
- **Loaded via `font.ts` FontFace** (awaited before first frame, monospace fallback, no-ops headless).

### Color (within the locked palette)
- HP label → green (`hpOk`), ST label → blue (stamina), MOMENTUM → gold (star), intent label → amber (`hpWarn`) as a header, mon names → tinted (slate/deep). Purposeful, not rainbow. No new colors.

---

## Banked / pending (future lanes — see also combat-backlog)
- **Status-effect system** — gates Shake It Off (clear-status), `statusTendencies`, Resolve. Reserved/designed-only.
- **Call cooldown/throttle** — prevent Recover (or any Call) >1× per 2–3 rounds; likely needed if Recover stalls in playtest.
- **Dodge counter-window** — the future distinguisher (evade + punish) vs Get Away's graze.
- **Unevadable attacks** — counterplay to full-evade.
- **Stronger-attack access** (soft/medium/hard, possibly progressive in-encounter, gated by reads/Calls).
- **A Call-using sim archetype** — needed to actually MEASURE the new Calls' balance (current sim only proves isolation).
- **Momentum cap 2→3** — IN PROGRESS this session (sim-gated; the 3-star triangle UI reflects it).
- **The font is DONE** — m3x6. If anyone wants a different look later, it's an art decision, and the banked options (m5x7 bigger, Press Start 2P blocky) are vendored.
