# Audio North-Star — what Argent should sound like (VISION; cheap-win slice soon, full score Phase 7+)

**Status:** the audio companion to `visual-north-star.md` — same logic, the other sense. Thesis + taxonomy frozen here now; the cheap-win SFX slice is the next CC-touch experience beat; the full score + 200 cries are Phase-7 throughput. Everything routes through the existing event bus (emit points exist, **zero subscribers**) — so audio is a data/subscriber add, no engine re-architecture.

## The thesis
**Gen-2's musical soul at a fidelity the Game Boy never allowed.** Not orchestral (too far from the homage), not pure GB-chiptune (too lo-fi for the 320×180 target) — the enhanced-retro middle HGSS hit remaking the Silver tracks, the register Undertale / Celeste / Stardew live in. Retro-*rooted*, modern-*craft* — the visual rule, for the ear.

## Mood map
- **Towns:** warm, a little melancholy — the autumnal "last game" feeling, in sound.
- **Routes:** light, travelling, hopeful.
- **Battle:** tense, driving — the read-war's pulse. Distinct wild / trainer / gym-boss / rival themes.
- **Victory:** earned, brief.
- **Set-pieces:** the theft (KAMON), the bond-saves-your-mon beat (JAY), evolution — each its own cue.
- **Title:** the thesis in 30 seconds.

## Taxonomy (what the game needs)
- **Music (BGM):** town / route / battle (wild·trainer·gym·rival) / victory / lab / gym / title + the theft & bond beats. Per-biome as the world extends.
- **UI SFX:** cursor, confirm/cancel, text blip, save chime, menu open/close.
- **Combat SFX** — *systems, not decoration (see below).*
- **Overworld SFX:** footsteps (per terrain), grass rustle, door/warp, ledge hop, heal machine, item pickup, encounter trigger.
- **Ambience:** per-biome beds (forest, water, wind, cave) — the "living world" breathing.
- **Mon cries:** ~200, distinctive — a throughput pipeline, same shape as sprites.

## Combat audio is a SYSTEM (it reinforces the read)
The legibility built in text → now also in sound:
- A distinct **charge / wind-up** cue telegraphs the focus.
- The **Call** gets a trainer-shout cut-in.
- **Heavy / Feint / Hide** releases land with distinct impacts.
- **Super-effective / resisted** stings; **KO**, **catch**, **★-award** cues.

Spec these alongside the combat docs — they carry information, not just flavor.

## Sourcing — the real fork (split by IP-sensitivity)
- **SFX, UI, cries:** AI sound-generation or curated royalty-free packs. Cheap, low-stakes — a hit-sound carries no melody to infringe.
- **Hero music** (battle/town themes, title, the set-pieces): where the homage's *soul* lives, where AI is riskiest. Best→cheapest: **human composer** (owns identity + IP cleanly) → **AI-draft + a hard human originality pass** (treat the draft like a Gemini mockup — reference only) → curated retro packs. Personal-project pragmatic path = the middle, *with discipline.*
- **The guard (all of it):** AI music will gladly hand you a Pokémon-sounding town theme — IP risk + generic-ness risk (the Pidgey/Pokéball lesson, for the ear). **Original melodies, nothing Pokémon-adjacent.** And **verify the commercial-use license** before committing to any AI tool — it's tool-specific and genuinely murky.

## The cheap-win first slice (highest feel-per-effort move in the project)
Because the event-bus hooks already fire with zero subscribers, the first move (with CC) is a *handful* of sounds on existing emit points — near-zero effort, instant feel:
1. **UI SFX** — cursor / confirm / cancel / text-blip (the menus stop feeling silent).
2. **Combat hit-feedback** — a basic impact on damage, a super-effective sting, a KO cue.
3. **One battle theme** — wired to the battle-start emit.

That alone transforms the feel. Everything else (full per-area music, ambience, the 200 cries) is Phase-7 throughput — don't block sprints.

## Sequencing
- **Now:** thesis + taxonomy frozen (this doc). No CC action yet — CC's on combat/content.
- **Next CC-touch experience beat:** the cheap-win slice (the 3 items above) — small, high-impact, uses hooks that already exist.
- **Phase 7+:** the full score + ambience + 200 cries (throughput, like sprites), authored against the frozen game.

## Cross-ref
`visual-north-star.md` (the parallel vision + five-layer model), `design-journal-session-combat.md` (audio flagged as highest feel-per-effort), `combat-2-0-spec.md` / `intent-tells-design-note.md` (the read the combat SFX reinforce), `world-scope-skeleton.md` (the biomes that get per-area music/ambience).
