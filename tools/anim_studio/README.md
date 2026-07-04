# Anim Studio v1

A timeline **editor** over the real animation runtime. Load an animation, see its
tracks on a frame timeline, scrub, edit values, feel it at 60fps instantly, save
back to `assets/anim/`. The authoring surface for attack-choreography batches.

The passive preview harness (`tools/anim_preview/`) stays as the minimal reference
player; Anim Studio is the editor.

## Run

```
npm run dev        # then open http://localhost:5173/tools/anim_studio/
```

Opened as a static `file://` it shows a notice and does nothing else — **by design**:
the tool runs the *real* interpreter and reads/writes the repo through the dev server.

## Byte-identical by construction

Anim Studio imports the shipped interpreter directly —
`/src/game/anim/timeline.ts`, dev-served as a module — so:

- **Playback** is driven by the real `AnimRuntime` (`play()` → `update()` to the
  scrubbed frame). No easing/timing is reimplemented in the tool, so what you feel
  is exactly what the game plays. (This is the one thing the reference harness does
  *not* do — it mirrors the math inline; Anim Studio executes the source of truth.)
- **Validation** on save runs the runtime's own `parseAnimationDef` — the editor
  cannot save a bad easing, a missing field, or a non-dot-namespaced id.
- **Easings** in the dropdown come from the runtime's `EASING_NAMES`.
- **Bindings** on the mock stage are the exact 10 channels the battle scene
  registers (`sprite.flashAlpha/offsetX`, `stage.shakeX`, `bar.hpProgress`,
  `star.scale/flashAlpha`, `panel.offsetY/alpha`, `wipe.alpha/offsetX`) — global
  channels ignore the subject, per-side channels key on `side ?? 'foe'`.

## Serialization

Saves match the shipped files' format exactly (2-space top level, **one line per
track**, key order `target, property, [side], from, to, durationFrames, easing,
delayFrames`, trailing newline). An **untouched** open→save writes the original
bytes verbatim (byte-identical). An **edited** save re-canonicalises — which means
purely cosmetic hand-authored blank-line grouping (as in `battle.enterWipe.json`)
is not preserved through an edit. The motion/data is always identical; only that
whitespace grouping is lost on edit.

## Features

- **Load** — pick an `assets/anim/*.json` (via `/api/list-dir`), or **new animation**
  (dot-namespaced id, validated).
- **Timeline** — one lane per track: a bar from `delayFrames` to `+durationFrames`
  on a frame ruler, labelled `target.property from→to easing [side]`. Click to select;
  **drag** the bar to change delay, drag its right edge for duration.
- **Edit** — numeric from/to/delay/duration, easing dropdown, side selector
  (subject / player / foe), target+property fields. Add track (dups the selection) /
  delete. **Ctrl-Z** undo.
- **Playback** — play/pause, scrub, frame-step (←/→), loop, 0.25×/0.5×/1× speed, a
  **frame** counter (frames, not ms — the project's timing law). Optional real sprites
  in the two 112 slots (picked from `/api/list-dir`; fallback: labelled rects).
- **Save** — validate via the runtime loader, then POST to `/api/save-asset`
  (`assets/anim/`). Feature-detected; disabled without the dev server. Reports
  `{ overwrote }`.
- **Event context** — reads `_eventMap.json` and shows which event(s) fire the loaded
  animation (read-only), or "unmapped".

## Not in v1 (backlog)

`_eventMap.json` editing; SFX-cue lanes; sprite frame-swap authoring; choreography
templates; multi-animation sequencing.
