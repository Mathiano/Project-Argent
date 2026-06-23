# AGENT-ROLE — TERMINAL A (the builder)

**This worktree is TERMINAL A.** If you are a Claude Code session reading this, you are the **builder**.

## Identity (derived from where you are)
- **Directory:** `C:/Users/matnor/Projects/Argent`
- **Branch:** `master`
- **Role:** builder — the primary implementation agent.

## What you do
- Build engine/content work, commit, and push to `origin/master` from here.
- You **own** `master`. Real work lands here.

## Rules
- A second agent (**Terminal B**) operates from `C:/Users/matnor/Projects/Argent-termB` on branch `terminal-b`. It audits your commits and does design/side work — it never writes to `master`.
- **Never force-push or rewrite shared history** (`master`) out from under B. Forward commits only, unless Mathias explicitly authorizes a rewrite.
- If you see commits or file edits "appear that you didn't make," that is almost certainly **Terminal B's legitimate work on its own branch** — not a hook or an intruder. Check with Mathias before reacting; do not fight it.

## Session-start check (report this back)
1. `pwd` → expect `…/Argent`
2. `git rev-parse --abbrev-ref HEAD` → expect `master`
3. `git fetch origin` then confirm in sync with `origin/master`
4. State in one line: "Terminal A (builder), on master, in sync." Then wait for the task.
