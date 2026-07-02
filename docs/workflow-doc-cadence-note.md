# Workflow note — doc cadence (the three-way flow between Mathias / Claude-coordinator / CC)

## The loop (works — the failure was cadence, not the pattern)
1. Claude (coordinator) produces/updates a doc in its workspace capturing decisions.
2. Claude SURFACES it (present_files) — Mathias downloads it — Mathias uploads it to CC / the Argent repo docs + adds it to the project.
3. Now canonical everywhere (workspace / repo / project agree).

## The rule (what was getting skipped)
**Every banking is "write + hand off," never "write and keep."** When Claude banks a meaningful decision into a doc, it SURFACES the updated doc in the SAME turn for Mathias to upload — bankings must not accumulate unshared. A doc is only "saved" once Mathias has uploaded it (or CC has committed it) — NOT when Claude writes it in its workspace. Claude's workspace = draft staging, not source of truth.

## Two valid channels for landing a doc
- **CC-active:** hand CC a small append/edit to commit directly (clean when a terminal is live; CC has the repo + context + writes correct hashes/filenames). Prefer small appends over large pastes (large content transmits unreliably).
- **Three-way:** Claude produces the doc, present_files it, Mathias uploads to repo + project.

## What went wrong (2026 combat session) + the fix
Claude kept appending decisions to its workspace copy of combat-build-status.md WITHOUT re-surfacing → the workspace copy drifted to ~193 lines while the repo/project copy stayed stale. The append-accumulation also made the doc messy (repeated "UPDATE —" sections). CC ultimately re-authored a clean consolidated 93-line version (committed a33ea04) — which is BETTER (dropped cruft, cross-refs the roadmap). CANONICAL BASE = the repo's committed version; Claude's longer workspace draft is superseded/discarded. New findings append to the COMMITTED doc (via CC or the three-way flow), keeping it clean.

## Standing docs (keep current via the cadence above)
- docs/combat-build-status.md — the what/why/banked companion (canonical: committed version).
- docs/combat-roadmap.md — the ordered plan (committed 4014dc1).
- docs/combat-design-canonical.md — the design spec / canon.

## The two-way sync rule (adopted 2026-07-03, doc-audit Card 6)
Docs drift when the project plane and the repo plane diverge (the doc-audit found 6 such collisions). Standing practice — **keep the two planes in sync, both directions, same session:**
- **Project → repo:** every project-plane `*-decision` / `*-spec` / `*-verdict` doc gets a **same-session CC commit** into `docs/` (so the repo is canon, not a stale mirror).
- **Repo → project:** every repo *canon* doc that changes gets **mirrored back to project knowledge** (so the project plane isn't stale).
- The two-way file-list reconciliation itself can be a follow-up (CC generates the lists); the RULE is the standing discipline. Repo canon wins on any conflict.

## Standing post-increment reporting items (doc-audit Cards 3 + 6)
Add to every increment's close-out report:
- **Refresh the CLAUDE.md combat lines** — CLAUDE.md's combat summary (Calls toolkit, canon constants, cap/Catch-Breath) goes stale as systems ship. Re-check + refresh it whenever an increment changes the combat surface (e.g. Card 3: line 58's Calls list was stale after Lane B shipped Recover/Dodge/Full Power).
- **Two-way doc sync** — list any project↔repo docs this increment touched that need mirroring (per the rule above).
