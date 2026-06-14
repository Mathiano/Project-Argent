# Playtest hooks — permanent infrastructure

The `?skip=…` URL parameters are **permanent playtest infrastructure**, not throwaway scaffolding. They let Mathias playtest any slice of the game in isolation without replaying from the start each time.

**Contract — maintained every sprint:**

1. Every scene that lands in the codebase gets a `?skip=` hook the same sprint it ships.
2. When a scene is refactored, its hook moves with it.
3. When a scene is deleted, the hook entry comes out of this table in the same commit.
4. Each hook is exercised by at least one test (or asserted to construct without throw), so the hook table stays alive as the code shifts.

The hooks live in `src/game/main.ts` near the bottom (`const skip = url.get('skip')` chain). Edit there and update this table in the same commit.

---

## Active hooks

URL: `http://localhost:5173/?skip=<value>[&starter=<species>]`

| `?skip=`        | What it loads                                                        | Notes                                                                 |
|-----------------|----------------------------------------------------------------------|-----------------------------------------------------------------------|
| _(none)_        | Title screen, the cold-start                                         | The Phase 0 gate is the cold-start path with no skip.                |
| `title`         | _(same as none, when set explicitly)_                                 | — currently no-op since absence already routes to title.              |
| `starter`       | Starter pick scene                                                    | A picks the cursor-default; advances to overworld(LAB).               |
| `lab`           | Overworld at LAB, default spawn                                       | Player at (6,7) facing down. Door warp at (4,8) → ROUTE31.            |
| `house`         | Overworld at HOUSE, fromRoute spawn                                   | Unreachable in normal play yet; useful for layout review.             |
| `overworld`     | Overworld at ROUTE31, default spawn                                   | Re-skinned tileset (`?graybox=1` toggles legacy).                     |
| `gym`           | Overworld at GYM, fromRoute spawn                                     | Sets the active starter via `?starter` (default GRUBLEAF).            |
| `wild`          | Wild battle vs FUZZLET (legacy SPECIES)                               | Legacy path; reset via end → showTitle.                               |
| **`test-battle`** | **Wild battle vs FLITPECK with a CH1 starter; restarts on end** | **Canonical Phase 0 combat-in-isolation hook.** Sets `?starter`.   |
| `prep`          | Rival prep scene (legacy EMBERCUB vs KAMON-counter)                   | Legacy demo flow.                                                     |
| `rival`         | Rival battle (legacy)                                                  | Legacy demo flow.                                                     |
| `falkner`       | Falkner boss fight (2-mon FLITPECK→GALEHAWK)                          | Sets the active starter via `?starter` (default GRUBLEAF).            |
| `end`           | End scene (won = true)                                                | Used to verify the end → onRestart loop.                              |

### Modifiers

| Parameter           | Effect                                                                                |
|---------------------|---------------------------------------------------------------------------------------|
| `?starter=KINDRAKE` | Pick the cold-start starter for any hook that needs one. Valid: `KINDRAKE` / `GRUBLEAF` / `SILTSKIP`. Default: `GRUBLEAF`. |
| `?graybox=1`        | Force the legacy graybox tilemap for any map that has both a graybox and a data-driven version. Useful for layout-vs-art comparison. |

### Example URLs

- `http://localhost:5173/?skip=test-battle` — drop straight into a wild battle with GRUBLEAF vs FLITPECK.
- `http://localhost:5173/?skip=test-battle&starter=SILTSKIP` — same, but with SILTSKIP.
- `http://localhost:5173/?skip=falkner&starter=KINDRAKE` — jump to the Falkner fight as KINDRAKE.
- `http://localhost:5173/?skip=overworld&graybox=1` — Route 31 in legacy graybox tiles.

---

## When you add a scene

In the sprint that introduces the scene:

1. Wire its show/push helper into `main.ts`.
2. Add a `?skip=<name>` branch in the URL handler at the bottom of `main.ts`.
3. Add a row to the table above.
4. Add a test that constructs the scene (typically by including it in the integration test or a per-scene test).

If a scene needs a non-trivial precondition (a starter pick, a flag set, a party state), prefer either:
- a dedicated `show<Scene>FromSkip` helper that sets up the preconditions, OR
- a new URL modifier that the scene consumes (like `?starter=`).

Don't ship a scene without a hook — the cost is that future bugs in that scene can only be reproduced by replaying the whole game, which is exactly what this file exists to prevent.

---

## Why this is permanent infrastructure

The `BUILD-ROADMAP.md` ruling: we build the real game in dependency order, but Mathias must be able to playtest any slice without replaying from the start. These hooks are how that promise is kept. They are NOT throwaway scaffolding — they get maintained every sprint. A sprint that ships a scene without its hook is incomplete; a sprint that breaks a hook without updating this file is a regression.
