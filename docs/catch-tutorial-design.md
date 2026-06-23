# Catch-Tutorial — design note (the professor's lesson)

**Status:** design LOCKED — the full tell→show→equip→do version, with the in-lab demonstration. Build is the immediate next content task. It sits entirely on already-green systems (Catching 2.0 shipped Phase 6), so it's a scripting/UX build, **not** engine work. Teaches Path 1 hands-on; seeds Path 2 as a concept only. Cross-ref: `catching-2-0.md` (the two-path system this teaches), `opening-design.md` (the lab/theft beat it inserts into), `main-story.md` / `the-concord.md` (the bond thesis the professor's framing plants), the info-discipline layer (the tutorial mon is maximally legible).

## The beat & its emotional core

The lesson lands in the calm right after KAMON bolts from the lab with a stolen starter. He took power and ran — he never stayed for the craft. The professor turns to the player, the one who *stayed*, and teaches the real thing. **That contrast is the bond-vs-strength thesis dramatized in the first ten minutes**, and the professor names it without a speech.

Draft voice (restrained — placeholder name/lines; final voice is set in the rename/script pass):

> *"He didn't wait for the most important part."*
>
> *"There are two ways to earn a creature's place beside you. You can out-read it in a fight — or you can spare it, and let it choose you. Most trainers only ever learn the first."*

Three lines plant the two-path system, the KAMON foil, and the thesis at once. Restraint is the rule (per the tone targets): a flinch and two quiet lines, never a monologue.

## What's taught — and what's only seeded

| Path | Taught how | Why |
|---|---|---|
| **Path 1 — The Read Window** | **Hands-on, fully guided** | It's *the same skill as battling*, which the player just learned and (now) feel-validated as fun. Teaching it here reinforces combat instead of adding a new system. It's also the primary/optimal catch route. |
| **Path 2 — The Willing Join** | **Seeded as a concept** (the professor's line above); practiced in the wild later | It's badge-gated and most relevant when you *can't* make a window; the spec already makes refusal self-teaching. Forcing mercy-path practice now is premature and confusing. |

Teach the read window by doing; let the mercy path land as a promise the player discovers later.

## The flow — tell → show → equip → do

1. **Tell (lab):** the professor frames the *why* + the two paths (the thesis seed above).
2. **Show (lab):** the professor demonstrates one Path-1 catch on a contained practice mon — the player *watches* the read → window → throw before trying it, with the same prompts they'll later use. No player input; a watch-the-mentor beat.
3. **Equip (lab):** first Bands/Balls granted; the ball pocket (live since Phase 5) populates.
4. **Do (Route 31, first grass):** a one-time scripted, forgiving guided catch — the player's own first read window, with live prompts.

Honors the beat (the *professor* teaches, at the lab) while putting hands-on practice where catching naturally lives.

## The tutorial UX — making an invisible read visible

The guided catch (and the demonstration) must surface the read that's normally hidden:

- The tutorial mon is **maximally legible** — open info-discipline, every tell shown (the opposite of an elite's opacity).
- **Prompts surface the read live:** *"It's gathering to lunge — Brace to force an opening!"* → window opens → *"NOW — throw!"*
- **Forgiving guard-rails, isolated to the scripted encounters only:** the tutorial mon can't flee and can't punish; a throw outside the window gives a gentle correction (*"Too soon — wait for the opening you create"*), **not** the real Wariness spiral. Wild catching keeps full rules.

## Locked choices / open tuning

- **Full version with the in-lab demonstration** — locked. No Pokémon muscle-memory to lean on, so showing once earns its thirty seconds.
- **Practice mon = FLITPECK** (common CH1 species).
- **Forgiving tutorial values** (window duration, no-flee, no-Wariness, gentle early-throw correction) — set at build, **isolated to the scripted encounters**; they must never leak into wild rules.
- **Path 2** is seeded by the professor's line only — no Path-2 practice in the tutorial.

## Sequencing / hand-off

- **Design: locked now** (this doc).
- **Build: immediate** — the next content task, *before* KAMON's first-fight integration.
- A scripting/UX build on green systems; Fable's only check is confirming the forgiving values are isolated (low risk).
