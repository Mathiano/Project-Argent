# KICKOFF — Make JAY (the robber) unmissable

JAY, the Route 31 thief-trainer at (7,4), is the opening EMOTIONAL HOOK —
the bond-saves-your-mon beat that introduces the whole "bonds over strength"
thesis. Right now he's skippable (single-tile block, no LoS, walk-around-
able). Make him FORCED. SCOPE: just the unmissability — NOT the follower-mon
visual (banked for the presentation phase).

## THE FIX — make JAY unavoidable (pick A or B by geometry)
Player enters Route 31 at (4,2) heading south; JAY at (7,4); south exit to
Violet at the bottom. Force the encounter via ONE of:

**OPTION A — ENTRY-TRIGGER (scripted approach):** stepping onto Route 31 (or
crossing a line just past the entrance) → JAY WALKS UP and starts his
dialogue + battle. Guaranteed, story-important, impossible to miss (like the
grunts who stop you on entry).

**OPTION B — LINE-OF-SIGHT covering the path:** give JAY a sight cone that
covers the ONLY route forward — if the player takes the natural path south,
he spots them, walks up, forces the battle. CRITICAL: verify the sightline
covers EVERY walkable path past him (no slip-by). Use the existing gym LoS
system.

Either way:
- GUARANTEED — no walking around, no skipping.
- Existing dialogue ("hand it over, or I TAKE it!") → battle → the existing
  "…Keep it" relent line (auto-plays post-win) all stay as-is. Purely about
  the APPROACH/trigger.
- Once beaten (winFlag), done — no re-trigger.

Report which approach (A or B) and why.

## GATE
JAY's theft encounter is unmissable (forced on entry OR a path-covering LoS
— no walk-around); dialogue→battle→"Keep it" relent intact + auto-plays; no
re-trigger once beaten. Existing tests green + a test that the player cannot
reach the south exit without triggering JAY.
