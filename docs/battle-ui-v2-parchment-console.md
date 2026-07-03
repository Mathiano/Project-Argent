# TARGET - Battle UI v2: the "parchment console" (CD forest-clearing-classic mockup)
Mathias's call: the typography gap is the opening for the full next-gen dashboard, not just a font bump. The CD mockup is the reference. Nearly everything is DISPLAY OF EXISTING DATA. Fires AFTER the Calls increment lands (same-file). Presentation-only - combat is CLOSED, zero logic change.

## Element inventory (mockup vs current build)
PANELS:
- Type badge chip beside the mon name (GALE / EMBER) - species types exist in data
- Numeric readouts beside bars: HP cur/max, ST cur/max - display data exists
- MOMENTUM as a framed STAR-SOCKET meter (filled/empty sockets in a box) - upgrade of drawMomentum, battle-scoped
- Status chips as prominent top-right tags (DAZ / BRN) - restyle/reposition of the existing chip system
- BREAK bar INTEGRATED into the foe panel + a role tag (GYM LEADER) - kills the separate PHASE/BREAK strip
- BOND bar labeled + housed in the player panel
- Teaching hint line: "STARS POWER CALLS + UNLOCK MOVES"
- OPEN QUESTION: the mockup shows Lv16/Lv15 on panels - see Decision A below
CONSOLE (bottom):
- Vertical menu RAIL visible BESIDE the move grid (FIGHT boxed + breadcrumb arrow). Display-only: rail in move-phase is a breadcrumb, B backs out - NO input-model change
- NARRATION STRIP across the console top: "MOVE | <name> - <effect note>" (context line for the hovered/selected action)
- Move cells: boxed tier badges (T0/T1/T3), TEC cells with effect chips (BURN/DAUNT), locked cell = padlock + "NEEDS <stars>" inline
- Boxed A/G/F stance selector, active one highlighted + named (GUARD)
- Fuller SELECTED detail (name / tier ATTACK - ST / effect line)
ARENA:
- Dappled ground texture, checkered horizon band, styled platforms - the "lively" default arena (NOT the full biome-slot system - that stays 2b-3/deferred; this is the default arena made alive)
TYPOGRAPHY (absorbed from the type-pass brief):
- Two crisp tiers, battle-scoped: 32px primary (2x integer - crisp) / 16px fine-print. NO 24px (1.5x = fuzzy). Global UI_FONT_PX untouched; other scenes byte-identical. Vertical-align nudge re-derived for 32px.

## Build split (risk-seamed, three beats)
1. PANELS + TYPE: the two type tiers + all panel upgrades (badges, numerics, sockets, chips, BREAK integration, bond housing, hints). No console/input touch.
2. CONSOLE RESTRUCTURE: rail-beside-grid breadcrumb, narration strip, cell/stance/detail upgrades. The only beat near input (verify breadcrumb = display-only).
3. ARENA + POLISH TUNE: the lively default arena + the color/border pops, tuned live by Mathias's eye (the palette-pass pattern).
Each beat: bounds harness clean, other scenes untouched, suite green, Mathias eye-gate before the next.

## Decisions needed (Mathias)
A. LEVELS ON PANELS: the mockup shows Lv prominently - but the thesis is trainer-skill-not-levels and evolution is bond-gated NOT level-gated. Show Lv (it exists, gates learnsets), or deliberately OMIT it from the battle panel as a thesis statement (bond bar takes the identity slot instead)?
B. Confirm the three-beat split + that it queues behind the Calls increment.

## EYE-GATE CORRECTIONS (beat-1 tune round 2 -> folded into BEAT 2)
Reference: the ChatGPT "compacted" mock. Its recipe is COMPOSITION not size:
- Menu keywords ~fine-print size with WEIGHT (not 32px): implement as 16px faux-bold (double-draw, 1px offset - crisp). m5x7 vendoring = the banked true-middle-tier escape hatch if the eye wants more.
- Per-item DESCRIPTION column behind a dotted divider: FIGHT "Engage the foe." / CALLS "Use a learned Call." / MONS "Switch your monster." / BALLS "Use an item." / RUN "Escape from battle."
- A/B hints -> framed BUTTON CHIPS bottom-right (A CONFIRM, B BACK).
- Console HEIGHT tightened (rows closer, less dead space).
- Its arena (textured clearing ellipse, grass tufts, pebbles, breathing space) = the BEAT 3 reference.
Fold these into BEAT 2 (they are console work; tuning the rail twice - once alone, once in the restructure - would touch the same rows twice).

## LAYOUT PRINCIPLE (Mathias ruling): THE ARENA IS THE STAGE
The spacious open middle between the two mons is a design PRIORITY, not leftover space - it is the stage where attack/animation traffic will play (the animation lane's staging area). Encode it:
- The corridor assertion GRADUATES: from "panels don't block the sprite-to-sprite line" to "the middle band is a protected STAGE" - panels hug the corners, console stays short, the stage stays open.
- Beat 2 serves it (console tightened = more arena).
- Beat 3 additions: nudge PL_PANEL DOWN toward the console (ChatGPT-mock position - it hugs the console, opening the middle band further); consider the sprite slots slightly larger (the mock's mons breathe); then paint the stage (textured clearing ellipse, grass tufts, pebbles).
- Forward tie: this is the layout half of the animation pipeline plan - the event-driven animations (hit flash, lunge, projectile travel) land ON this stage. Spacious now = the animation lane lands well later.
