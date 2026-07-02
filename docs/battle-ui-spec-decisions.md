# Battle-UI spec decisions (v1) — append to combat-build-status.md / feeds the 640×360 UI work

## The layout is CLASSIC (v1), read-war-forward is a PLANNED SECOND OPTION (not a fork)
- **v1 = Pokémon-classic layout:** combatants upper (foe upper-right, yours lower-left), action panel bottom. Familiar, proven. Build this FIRST.
- **The read-war-forward layout** (momentum/stance duel CENTER stage, mons in corners — the alternative sketched this session) is NOT a pivot-or-die fork. Since the battle UI is a LAYER over the game logic, BOTH layouts can co-exist as a PLAYER OPTION (classic vs. read-war-forward, toggleable — player picks their preferred view). Build classic v1 now; add the read-war-forward option LATER. De-risks the alternative (no bet-the-farm pivot) AND makes it a feature (familiar OR read-war-forward, player's choice).

## The overworld/battle resolution BOUNDARY
- **Overworld: strict GBA 320×180 — this is the IDENTITY, non-negotiable.**
- **Battle scene: 640×360, and sprites can be HIGHER-RES than GBA** — the battle UI is allowed to look genuinely better/upgraded, not just "GBA at 2×". Battle sprites aren't bound to GBA pixel-density. (Battle = the place to improve visual fidelity; overworld = the place that stays classic.)

## The locked classic-v1 spec (from D1-D4)
- Layout: Pokémon-classic (D1).
- Moves: 2×3 matrix — 4 attacks in two pillars (top 2 rows) + 2 techniques as a 3rd row underneath; all 6 visible in the Fight submenu (D2).
- Top-level flow: classic menu FIGHT / CALLS / MONS / BALLS / RUN; FIGHT → the 2×3 matrix, CALLS → the Call options. Keeps top level clean; info shows within submenus. THE ELEGANCE CHALLENGE: surface momentum/status/locked-tiers without overcrowding (D3).
- Visual: higher-res GBA-pixel aesthetic; argent-master palette (locked); font m3x6 first → fall back m3x7 → or CD designs new if m3x6 doesn't scale to 640×360 (D4).
- Must fit: both 112×112 (or higher-res) sprites, both HP+stamina bars, BOTH momentum ★ meters, status indicators ON the mons (the invisible-status fix), Falkner's Break bar (legible as a stagger/cadence meter), locked-attack greying (with ★-requirement shown), battle narration, the toggleable dev-log region.

## The battle UI has its OWN palette — "a warm artifact, silver-inlaid" (2b-2)
The battle scene is skinned in its OWN palette, **distinct from the overworld terrain palette (argent-master)**. This **supersedes D4's "argent-master palette (locked)" line _for the battle UI_**: the overworld keeps argent-master (its identity); the battle UI carries its own warm skin. Mood: warm, cozy, ancient, legendary — **NOT the overworld terrain palette, NOT cold silver, NOT muddy brown.**

The organizing logic (hexes are live-tuned; the AS-BUILT keys live in `src/game/palette.ts` under the "Battle-UI skin" block):
- **Warm structural base** — parchment / aged-wood / leather as the frames + panels (the "cabinet"). Warm + inviting; aimed warmer/brighter/playful, not dusty.
- **Silver = INLAY / TRIM / RIVETS only** — never a surface fill. Thin inlay lines, corner rivets, the lock/trim. **"Jewelry on warm leather, not a metal box."**
- **Gold for the momentum ★ ONLY** — the legendary-treasure accent. (Also the BREAK pips — unifying the "precious" language; ruby read as brown on the warm frame, so BREAK went gold.)
- **Soft-green arena** — the battle background stays green/living, **"not a desert"** — NOT brown.
- **Velvet-red / brass** — technique cells + the selection highlight.
- **Jewel tones (teal / sapphire / purple)** — tier badges, boss aura.
- **SEMANTIC bars UNTOUCHED** — HP green/amber/red, ST blue, bond rose, stance A/G/F red/blue/green. Players learn these; they stay exactly as they are.

Why a separate battle palette works: the battle UI is a **LAYER over the game logic** (the same property that makes the read-war-forward layout a player-option, not a fork), so it carries its own look without touching the overworld identity. **AS-BUILT:** `ui.ts` `drawBattlePanel` (battle-only — the shared `drawPanel` is untouched, so every menu/overworld box is unchanged) + warm colours at the battle call sites; `drawMomentum` (battle-only caller) draws the ★ gold. Every skin value is a named key in `palette.ts` → live-tunable in a one-file edit.

## Status: the classic-v1 spec above is BUILT (640×360, Parts 1 / 2a / 2b-1 / 2b-2)
See `combat-build-status.md` → "The 640×360 battle UI — BUILT" for the part-by-part rebuild record + commit hashes and the 2b-3 deferrals (swappable background; folding the DAZE/STAG/EXH/FOCUS header tags into the chip system; the Q2 "HEAVY ATTACK" release label). The read-war-forward center-duel layout (§ above) remains banked as a future player-selectable option.
