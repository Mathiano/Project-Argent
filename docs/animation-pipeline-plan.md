# PLAN — Animation pipeline: Claude Design ↔ Argent/CC (banked, post-#5)
Source: another chat's plan; CORE CLAIM VERIFIED against the repo by Claude (the gameEvents.ts seam is real). Banked for AFTER tuning pass #5.

## The core reality (why animations can't copy-paste)
Claude Design speaks web-native motion (CSS keyframes/SVG/DOM); Argent speaks immediate-mode canvas draw calls (grep confirms NO tween/animation runtime in code today). So animations transfer as EITHER hand-re-implemented params (lossy, won't scale to "a lot") OR as DATA both sides play. For volume → data: make animations data, make CD author that data.

## The seam — VERIFIED to exist
src/game/gameEvents.ts is a real typed event bus (GameEvent, ~18 kinds: battle-start/end, menu-move, ui-cancel, stance-selected, move-resolved, door-enter, dialogue-*, hit-landed, ko, catch-*, status-applied, evolve, bond-stage-cross). Header states: game-layer only, engine stays pure/headless + emits nothing. So an ANIMATION subscriber is additive + presentation-only → the bit-identical audit gate holds automatically. SFX is planned subscriber #1; animations = subscriber #2 on the same bus.

## The pipeline — three pieces
1. CC builds ONCE — a timeline interpreter: tracks of {target, property, from→to, duration-in-frames, easing, delay}, composable into named sequences, triggered by event→animationId mappings. ~one kickoff-sized increment.
2. The contract — animation JSON in assets/anim/. THIS is the CD↔CC language.
3. The preview harness — one HTML file that loads any animation JSON + plays it at logical resolution, image-rendering:pixelated, argent palette. CD authors JSON → Mathias feel-gates in the harness → the SAME JSON ships. Kills the "looked different in the mockup" gap (approval + runtime read ONE artifact).

## Honest CD lanes (what CD can/can't own)
- UI / procedural motion (HP-bar drain, ★ pip pop, panel slides, screen shake, battle-enter wipe, BREAK flash): CD FULL author → animation JSON.
- Sprite-frame animation (mon idles, attack poses): CD does TIMING/choreography ONLY — frames CANNOT come from CD (the proven pixel-art finding); frames go through the sprite pipeline → frames + a timing JSON.
- Battle choreography (a move impact = lunge+flash+shake+frame-swap+SFX cue): CD is motion director → sequence JSON (+ SFX cue ids).
- Terrain (grass/water shimmer/sway): NOT CD — Tiled native tile-animation data, importer reads it (.tmj).
Design constraint (from SFX decisions): combat feedback is INFORMATION not decoration — Heavy/Feint/Hide impacts must be visually distinct (same as their sounds must be).

## Per-batch protocol
1. Claude writes the CD brief (v3-style): constraints block (res, palette hexes, easing whitelist, frame-count timing, integer pixels, NO blur/AA) + the animation list (each tagged with its real emitted event) + deliverable = JSONs + harness renders.
2. Mathias feel-gates in the harness.
3. Approved JSONs → CC commits to assets/anim/ + wires event→id mappings AS DATA. (Repo = single channel: an uncommitted CD artifact doesn't exist.)
4. Headless tests pin schema/durations; Claude's audit gate confirms the diff is presentation-only.

## Sequencing
- Dependency "after combat systems locked" = satisfied by tuning pass #5.
- The 640×360 rebuild (an animation-target dependency) is ALREADY DONE this session (the plan's note assuming it's pending is stale).
- So: post-#5 → build the runtime + a 3-5 animation PROOF batch (hit flash, HP drain, ★ pop, battle wipe) → the big choreography batches after.
- Don'ts: no hand-porting CSS per animation; no approving motion in smooth/AA previews; nothing animation-related inside engine/; no hardcoded timelines in the battle.ts monolith (extract literals first — already flagged).

## STATUS: banked, post-#5. Not now (mid-#5). Real + verified + ready when the animation lane opens.
