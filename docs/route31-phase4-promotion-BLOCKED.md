# Route 31 Phase 4 (promotion) — BLOCKED, decision needed

> **✅ RESOLVED & DONE (2026-06-29).** Mathias placed the missing content markers (5
> trainers, 4 signs); CC carried the content forward (trainer/sign DEFs, the
> guided-catch + ground-item + PIP-reward code-scripts, canonical flags) and PROMOTED
> the Tiled map to the live `ROUTE31`. The old `route31.json` / `route31.violet.json`
> + `gen_route31.mjs` are retired; the 9 coupled test files were updated (2 obsolete
> ones removed). Suite green. The analysis below is kept as the historical record of
> why the FIRST promotion attempt was correctly blocked.

**Status (historical):** Steps 2–4 were HELD pending a content/scope decision; the
live route was untouched at that time.

## Step 1 — lost-kid quest finalized ✅ (on `__ROUTE31_BIG__`)
- **PIP stays put** at its find-spot (no follower-mon mechanic — `docs/follower-mon-mechanic-BACKLOG.md`); the reunion is narrative (the kid goes to PIP).
- **SUPER POTION ×1 reward** on return: a code-authored step-on script at the kid's
  tile (15,21) — `requiresFlag r31big_pip_found`, `once`, `flag r31big_pip_rewarded`,
  `give-item` — the proven live-route pattern (fires exactly once, no repeat).
  Injected in `buildRoute31Big()` (maps.ts); tested.

## Steps 2–4 — why promotion is BLOCKED (measured, not guessed)

I probed it: pointed `chooseRoute31()` at the Tiled build and ran the suite →
**36 test failures across 9 files.** Then reverted (live route intact). The failures
are NOT just coordinates — they encode real, pinned content the Tiled map **does not
have**:

| Missing on the Tiled map | Evidence (failing tests) | Kind |
|--|--|--|
| **Guided-catch HARD PIN** (`start-tutorial-catch` on §1 grass) | `route31expansion` "guided catch … STILL FIRES", `tutorialCatch` | code-authored script + **hard pin** |
| **4+ trainers** (ROURKE/WREN/PAX/MILO/BRYN) | `firstRoad` "≥3 trainers", `route31expansion` "ROURKE/WREN/PAX keep win-flags" | needs **Tiled markers** (Mathias) |
| **The 4 sections + ~14 signs + detail** (camp/berry/tracks/nest) | `route31expansion` "four sections signposted", "detail layer present" | needs **Tiled markers** + sign defs |
| **2 ground items** (`route31_item_forest/pond`) | `firstRoad` "give-item scripts ≥2", "hidden forest item fires" | code-authored scripts (need spots) |
| **Canonical PIP flags** (`route31_lost_mon_found/reunited`) | `firstRoad`/`firstRoadFixes` lost-mon chain | flag-name mismatch (Tiled uses `r31big_*`) |
| **Data-driven `cells` + tileRef grass** | `route31Grass`, `firstRoad` water-cell check, `layers` props | the Tiled map uses `importedLayers`, not `cells` |
| **Old warp/zone coords** | `spine` (walks to 10,73; Tiled warp at 11,73), `encounterRng` (zone at 2,12), `route31Encounters` (zone 10,19) | coordinate coupling |

**The warps themselves are fine** — they resolve by spawn NAME: Hearthwick→`fromHearthwick`, Violet→`fromViolet` (both present on the Tiled map), and `warp_north`→`HEARTHWICK:fromRoute` / `warp_south`→`VIOLET:fromRoute` (both target spawns exist). The round-trip works mechanically; it's the *content* + test coupling that blocks a clean swap.

## Why I did not bulldoze
Retiring `route31.violet.json` now would **regress the live game** (drop the guided-
catch hard pin, 4 trainers, ground items, the 4 sections/landmark/detail/signs) and
**delete 36 tests' worth of coverage** of pinned, designed content I didn't author —
the task framed Phase 1+2 as "everything works," but the Tiled map is content-LIGHTER
than the live route it would replace. Surfacing beats silently shipping a regression.

## Recommended path (pick one)
1. **Carry the content forward first (preferred).** Mathias places the missing
   **trainer + sign + section markers** in Tiled (the *where*); CC injects the
   code-authored **guided-catch + ground-item + PIP-reward** scripts (the *what*) and
   adopts the **canonical flags** (`route31_trainer_beaten`, `route31_lost_mon_found/
   reunited`). Then promote + update the coordinate-coupled tests (spine, encounterRng,
   route31Encounters) + the `cells`→`importedLayers` test assertions. Clean swap, no
   content loss.
2. **Approve a content-reduced Route 31 now.** Accept dropping the 4 trainers / signs /
   sections for a later paint pass, keep the guided-catch (injected), and authorize a
   coordinated rewrite of the 9 coupled test files. Faster, but a real content
   regression + large test churn.

**winFlag (when promoted):** adopt the canonical `route31_trainer_beaten` for Jay (the
live neighbors/tests expect it) and add it to `CALLS_UNLOCK_ON_WIN` (alongside or
replacing `r31big_jay_beaten`) so the Calls-unlock fires on the live route with no flag
conflict. (Today Jay uses the isolated `r31big_jay_beaten`.)

Until a path is chosen, `__ROUTE31_BIG__` stays the dev hook (`?skip=route31-big`) and
`route31.violet.json` stays the live ROUTE31.
