# Sprint 1 — battle presentation at 320×180

(Paste as the kickoff prompt after the corrected sim baseline is committed.)

Read CLAUDE.md, docs/pilot-exit-decisions.md §1 (art direction), and docs/argent-demo.html (UX reference) first.

Goal: a playable battle presentation layer that **replays engine events**. No overworld. No new mechanics. No engine changes — if the renderer needs something the engine doesn't expose, stop and flag it; do not reach into engine internals.

## Tasks (commit after each)

### 1. Canvas bootstrap
320×180 backing canvas, scaled to the largest integer fit in the window, letterboxed, `imageSmoothingEnabled = false`. Master palette module (single source for all colors; start from the demo's panel/ink palette, extended).

### 2. Minimal scene framework
A tiny scene stack (boot → prep → battle). No framework dependencies. Scenes get `update(dt)`, `draw(ctx)`, `input(key)`.

### 3. Sprite system + placeholders
Load the demo's pixel-grid sprite format (rows of palette chars). Render existing 14×14 sprites at ×3 nearest-neighbor (42px) inside 56×56 battle slots. Implement the placeholder generator from pilot-exit-decisions §2: any species without art gets an auto-generated silhouette (archetype shape + type palette + "?" marking). Gameplay never blocks on art.

### 4. Battle scene — event replay
Render battles by consuming `BattleEvent[]` with timed steps (~400ms cadence, skippable with A). Port the demo's battle UX to the new canvas space:
- HP + ST bars with winded notch, ★ Momentum pips, name plates
- Foe intent strip (stance badge + tier) during selection
- Turn-order preview that updates as the player highlights moves
- Stance selector: SELECT key cycles, badge always visible
- Move menu with stamina costs, greyed unaffordable/winded-locked entries
- CALL menu (START shortcut) with locked/no-★/ready states
- Battle log, coach-tip boxes, dialog boxes — the demo's panel style at 4px grid
The renderer never mutates battle state. One-way: actions in, events out, replay.

### 5. Prep card scene
Port the demo's scout report to the new layout space: foe sprite, SPD comparison, habit line, plan lines, ★ note. Shown before the rival fight.

### 6. Input
Keyboard (arrows, Z=A, X=B, C=SELECT, Enter=START) + pointer/touch on on-screen buttons sized for mobile. Same dispatcher feeds both.

### 7. Wire the playable flow
Starter pick (simple panel UI) → wild FUZZLET tutorial fight → prep card → rival fight, with the rival AI at demo parameters (0.85 scale, 10% read, 55A/35G/10F) driven through the engine. Win/lose → end card → restart.

## Acceptance
- `npm run dev` → all three starter matchups playable in the browser
- Zero commits touching src/engine
- All existing tests still green
- Report back: screenshots, any UX decisions made, anything the event stream couldn't express (those become engine API requests for design review)
