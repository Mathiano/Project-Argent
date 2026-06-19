# Follower-Mon — designed beat for the PRESENTATION-LAYER phase (banked, not yet built)

**Status:** designed, DEFERRED to the presentation-layer phase (when animations/transitions land). Banked here so it's not lost. Connects to living-world.md (mon-reacts-to-world), the-concord (the bond thesis), and the JAY opening hook. Build alongside the other meaningful presentation-layer changes, NOT now.

## The concept
The player's lead mon (starter) **follows them in the overworld, out of its ball**, from the first town onward — a visible companion actor walking behind the player (the classic HG/SS / Let's Go follower-mon).

## Why it matters (the connections)
The follower-mon is a NODE where several deferred goals meet:
- **Living-world** (living-world.md): the mon visibly REACTS to the world — a concrete expression of the "mon reacts to its environment/situation" concept.
- **The bond thesis**: seeing your mon beside you, always present, makes the bond TANGIBLE (it's not an abstract meter — it's a creature walking with you).
- **NPC presence / world aliveness**: a companion in the overworld makes the world feel inhabited.
- **The JAY opening hook** (the immediate payoff — see below).

## The JAY relent beat (the killer use-case)
JAY (Route 31 robber-trainer) already has the relent dialogue in the build: *"It stepped in front of you. Took the hit FOR you. You two watch each other. …Keep it."* — the moment the player's BOND visibly saves their mon, introducing the whole "bonds over strength" thesis.

**Currently this is NARRATED only (text). With the follower-mon, it becomes SHOWN:**
- When JAY moves to take the mon, the follower-mon (out of its ball, already walking with the player) visibly **steps in front of the player** — puts itself between the player and JAY, takes the threat.
- THAT is what makes JAY relent — and the player SEES it, doesn't just read it.
- This turns the opening hook from a told beat into a witnessed one — the single most important emotional moment of the early game, dramatized.

**This is why the follower-mon should land BEFORE/WITH the JAY presentation pass** — JAY's relent is the showcase for why the follower-mon exists. (JAY's unmissability is fixed NOW separately; the follower-mon VISUAL of the relent is this deferred beat.)

## Scope notes for when it's built
- Starter follows out of ball from the first town (overworld follower actor).
- It should be able to react/emote (ties to living-world — reacting to terrain, threats, etc.).
- The JAY relent: the follower steps between player and JAY at the relent moment (a scripted overworld beat).
- Likely wants the animation/transition layer to land first (so the "steps in front, takes the hit" reads with weight — a follower that teleports awkwardly would undercut the moment).

## Implementation Plan (ready to build)
**Pre-scoped 2026-06-19 so the presentation-layer build is turnkey. STILL BANKED — do not build until the animation/transition layer lands (the relent reads at half-impact without it, per the Sequencing note below).** Scope: `src/game` only — the engine never learns about a follower, so **no sim / no ladder re-run**; combat is untouched. Ships as the type-tinted placeholder silhouette (the same path PIP the lost FLITPECK uses), and upgrades for free when registered overworld art lands.

### Two phases
- **Phase A — the follower trails the player** (roaming, HG/SS-style). This alone makes JAY work — the theft has a visible victim.
- **Phase B — the scripted "steps in front of you" beat** at JAY. Cheap once A animates; it's the showcase payoff this doc exists for.

### The data seam (the one new wire)
`src/game/scenes/overworld.ts` is pure scene code and can't import `main.ts` (cycle); the party lives in `main.ts` (`run.party`, lead = `party[0]`, `partyLead()` at `main.ts:253`). So add one optional opt to `OverworldOptions` (near `overworld.ts:31-75`):
```ts
// The lead party mon to trail the player, or null when the player has no mon
// yet (pre-starter). A getter so a mid-game swap/faint reflects without rebuild.
readonly leadFollower?: () => { name: string; type: ElementType | null } | null;
```
`main.ts` (scene build at `main.ts:1433`) passes `leadFollower: () => { const s = run.party[0]?.species; return s ? { name: s.name, type: s.types[0] ?? null } : null; }`. Render reuses `drawSpeciesInSlot(ctx, {name, type}, …)` (`sprites.ts:304`) — the type-tinted placeholder (`overworld.ts:984`). No art dependency.

### Phase A — roaming follower
**State** (mirror the player's movement model at `overworld.ts:106-122`): `fTx, fTy, fPrevTx, fPrevTy, fMoveT, fMoving, fFacing`, plus `fVisible` (true once emerged).
**Init:** place the follower on the player's spawn tile (overlapping, `fVisible=false`); it emerges onto the vacated tile on the first step (no walkability question).
**Movement — the trail-by-one-tile rule:** the follower always occupies the tile the player just left. When the player commits a step (`tryStartMove`, `overworld.ts:371-384`, where `prevTx/prevTy` is captured), set the follower target = player's `prevTx/prevTy`, its own prev = current, `fMoving=true`, `fFacing` toward the step; advance `fMoveT` in lockstep with the player's `moveT` (same `MOVE_DURATION`) so they glide together. Collision-free by construction — the follower only ever steps onto a tile the player just stood on.
**Render** (`overworld.ts:712-749`, right after `drawPlayer`): compute `fpx/fpy` with the same `lerp(prevTx, tx, moveT)` math and blit `drawSpeciesInSlot`. Y-sort player vs. follower (draw the lower-on-screen one last) so vertical overlap reads correctly.
**Edge cases:** warps/map change → re-seed onto the new spawn tile (`fVisible=false`) so it doesn't teleport-slide across a load; no party → `leadFollower()` null → not drawn/updated (the pre-lab opening has no follower, correctly); tap-turn in place → follower idles (optionally turns to keep facing the player); battle entry is a scene swap, untouched.

### Phase B — JAY "steps in front of you"
Reuse the existing cutscene machinery. When JAY's approach completes and his `interact` fires (`overworld.ts:229-236`), trigger a one-shot `poseFollower(targetX, targetY, facing)` that lerps the follower from its heel tile to the tile **between the player and JAY**, facing JAY (defiant interposition), *then* the dialog opens — mechanically the same lerp the `approach` object already uses (`overworld.ts:222-252`, draw at `726-740`). Pre-battle: follower steps forward as JAY threatens → battle. Post-battle relent (`interactAfterFlag`, auto-played via `runNpcFollowup`): follower stays forward while "…Keep it" plays, then returns to heel. Now "It stepped in front of you" describes something the player **watched**.

### Tests (headless-friendly — state + render hooks; follow `overworld.test.ts` patterns: `stubCtx`, `walkOne`, `tickStep`)
1. **Trails by one** — walk 3 tiles; follower tile == player's tile from one step ago, each step.
2. **Lockstep** — mid-step, follower `fMoveT` tracks player `moveT`.
3. **No party → no follower** — `leadFollower` null; `drawSpeciesInSlot` not invoked / follower never updates.
4. **Warp re-seed** — after a warp the follower sits on the new spawn tile, not sliding from the old map.
5. **JAY interposition (Phase B)** — on JAY's approach firing, follower ends on the between-tile facing JAY before the dialog's battle command runs.

### Scope discipline
`src/game` only. No engine / no sim / no ladder. Ships as placeholder silhouette (art slots in later, zero code change). Does NOT touch the JAY trigger logic already shipped (`approachOnEnter`) — it layers a visual over the existing approach/relent flow. **Recommended build unit: Phase A + B together** (A is most of the work; B is cheap once the follower animates and is the actual reason the feature exists).

## Sequencing
- JAY UNMISSABILITY: fixed now (forced encounter, separate sprint).
- FOLLOWER-MON + the SHOWN relent: this doc — build in the presentation-layer phase, alongside animations/transitions and the other deferred meaningful changes (Witcher-3 dialogue, NPC movement, distinct building roofs, dex animations, scout-report diegesis).
- Cross-ref: living-world.md, the-concord.md, and the JAY encounter (route31).
