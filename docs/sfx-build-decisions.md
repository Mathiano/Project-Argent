# SFX Build — Decisions of Record (first audio slice)

**Status:** DECIDED. The scope + approach for Argent's FIRST audio build. Extends `docs/audio-north-star.md` (the thesis + taxonomy) with the concrete build calls it left open. Drop in `docs/`. Cross-ref `audio-north-star.md` (sonic north star + full SFX event list), `design-risks-and-gaps.md` (gap #8 — the event-bus seam, RESOLVED 9e64fff).

## What this build is

The **first audio in the game** — a small SFX layer that makes moment-to-moment play feel alive (the "lively playtest" goal). Deliberately bounded: UI + combat hit-feedback, synthesized, no music. Music (incl. the battle theme) is a separate, later, IP-sensitive decision.

## The sonic register (settled — reconciled from two framings)

**Gen-2's musical SOUL at 2026 fidelity.** The GBC/Silver era is the *spiritual anchor* (the warm, melancholy, melodic Gen-2 feeling) — NOT a fidelity ceiling. We are in 2026; the Game Boy's hardware limits are inspiration's *home*, not a *constraint*. So:
- **Not pure chiptune** (too lo-fi for the 320×180 modern-retro target).
- **Not orchestral** (too far from the homage).
- **The "enhanced-retro middle"** — the register Undertale / Celeste / Stardew Valley live in. Retro-rooted, modern-craft.
- A UI sound should feel *retro in spirit, clean in production* — a Celeste menu blip, not a Game Boy beep, not a Hollywood whoosh.

(Both Mathias's "GBC as direction not limitation" and the doc's "enhanced-retro middle" agree: Gen-2 soul, freed from the hardware.)

## DECISIONS

### 1. Source = code-synthesized (Web Audio) for this first slice
The doc permits AI-sound-generation OR curated royalty-free packs OR synthesis for SFX (low IP-risk — "a hit-sound carries no melody to infringe"). For the FIRST slice we choose **code-synthesis**, because:
- **No licensing.** AI-SFX-tool commercial terms + royalty-free pack licenses both need per-source verification — the doc explicitly flags this as "mandatory-but-undone" and "genuinely murky." Synthesis sidesteps it entirely: fully owned, zero external files, clean original-IP discipline (same line held for art).
- **The register is reproducible in Web Audio.** Enhanced-retro UI/combat sounds (clean sine/triangle/pulse tones with shaped envelopes) hit the Celeste/Stardew zone natively — synthesis can *reach* this register, not just approximate it.
- **The first slice is exactly synthesis's sweet spot** — simple UI + combat feedback, where licensing-hassle is pure overhead and synthesis shines.
- **The tradeoff, acknowledged:** synthesis is more austere for *rich/complex* sounds (ambience beds, the ~200 distinctive mon cries). **When we reach those, revisit AI-gen / royalty-free** (and do the license verification then) — the heavier tool earns its cost where synthesis genuinely can't deliver. Same principle as everywhere: no-bottleneck path first, heavier tool only when the simple one can't do the job.

### 2. Scope = SFX only (UI + combat hit-feedback). NO music this build.
The doc's "cheap-win slice" bundles "1 battle theme wired to battle-start" — we **split that out**. A battle theme is **music** = the IP-sensitive category (carries melody → needs the composer / AI-draft-with-originality-pass / curated-pack decision). Bundling it drags the hard music decision into the easy SFX build. So:
- **IN this build:** UI SFX + combat hit-feedback SFX + a mute toggle.
- **OUT (deferred):** the battle theme → it becomes the **first MUSIC decision**, made separately, later, from a stable base.
- Also OUT (Phase-7 throughput, per the doc): per-area music, ambience beds, the ~200 mon cries. "Don't block sprints."

### 3. Integration = subscribe to the existing event bus (NO engine work)
The audio seam already exists and is committed: **`src/game/gameEvents.ts`** (a typed game-event bus, gap #8 RESOLVED commit 9e64fff) — emit points fire at battle-start/end, hit-landed, ko, catch-attempt/success, menu-move, stance-selected, move-resolved, evolve (status/wiggle/level reserved). **Zero subscribers today.** So the SFX build = **add a subscriber that plays sounds.** No engine/combat re-plumbing, and it stays clear of any combat-resolution work. Confirm each needed SFX trigger against the *real* emitted event set when building (some combat cues — charge/wind-up, ★-award — may need verifying against what actually emits; "status/wiggle" are reserved-not-emitting).

### 4. Combat SFX are INFORMATION, not decoration (design constraint)
Per the doc: combat audio "carries information, not just flavor." So combat SFX must be *distinguishable and meaningful*, not generic:
- The **charge/wind-up cue telegraphs the Focus** (part of the read).
- **Release impacts are distinct** per Heavy / Feint / Hide.
- **Super-effective / resisted stings carry the type-read.**
This first slice does the core of that (impact-on-damage, a super-effective sting, a KO cue); the fuller per-release-distinct set follows. Design them so a player could (eventually) read the combat state with eyes closed.

## FIRST-SLICE BUILD SCOPE (the brief)
1. A small **audio subscriber** on `gameEvents.ts` + a tiny Web Audio synth layer.
2. **UI SFX** — cursor-move, confirm, cancel, text-blip (enhanced-retro register).
3. **Combat hit-feedback** — impact-on-damage, super-effective sting, KO cue (information-bearing, synthesized).
4. **OPTIONS audio toggle** — mute/unmute (the doc notes OPTIONS audio is currently a stub).
5. **No music, no ambience, no cries.**

## OPEN CALLS (this build must decide; the north-star doc doesn't)
- **Per-cue sound character** — the doc names *which* events + their mood, not the timbre/length/pitch of each (the confirm blip, the impact, the KO). Sound-design happens in the build.
- **Technical spec** — Web Audio node graph, polyphony, mixing/ducking, loudness/normalization, a master gain for the mute toggle.
- **Exact emit-name mapping** — confirm each needed trigger against the real `gameEvents.ts` event set.

## REVISIT TRIGGERS (when this decision's assumptions change)
- **Reaching rich/complex sound** (ambience, the ~200 cries) → revisit AI-gen / royalty-free (with the deferred license verification).
- **The battle theme / any music** → the separate first-MUSIC decision (composer vs AI-draft-with-originality-pass vs curated-retro-pack), per the doc's IP-split. The originality guard ALWAYS applies: "original melodies, nothing Pokémon-adjacent," and verify any AI tool's commercial-use license before committing.
