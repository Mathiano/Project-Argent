# Intent Tells — design note (DESIGN ONLY, do not build)

**Status:** design canon, logged for the **Phase 8 information-hiding tier**. Until that phase lands, the current plain "FOE INTENT: G LT ATTACK" label in `battle.ts` stands as-is. This note exists so the eventual info-hiding sprint has a target to render against — tells, not a blank box.

---

## Intent

Combat 2.0's read pillar depends on the player making an informed prediction about the foe's coming turn. Today the renderer surfaces this as a literal label (stance badge + move tier). That works as scaffolding but **flattens the read into a sticker**: there's no observation skill, no growth curve, no asymmetry between a Pewter trainer and the Champion.

The canonical long-term presentation of foe intent is **body-language tells** — the foe's sprite (and small environmental cues) telegraph the intended action, and the player learns to read them. **Reliability is the difficulty knob**: easy foes broadcast cleanly, hard foes muddy the signal, the final ladder lies on purpose.

This is the *information* layer the read pillar earns. The combat math doesn't change; how the player *sees* the upcoming turn does.

---

## The reliability ramp

Three difficulty tiers, mapped to gym progression and the AI behavior layer.

### Normal — honest 1:1 tells

The foe's intent is true and unambiguous. Each stance + tier combination has its own readable animation / pose; the player learns the vocabulary by watching it. **Tells never lie.** A player who learns the alphabet by Gym 2 can predict every Normal foe's turn before pressing FIGHT.

Mapped to: wild encounters, route trainers, Gyms 1–4 (Falkner through Morty).

### Hard — ambiguous tells

Tells become **set-shaped, not point-shaped**: the same animation might cover two or three plausible intents. The player can narrow it (e.g., "this is *either* Aggressive heavy *or* Fluid mid") but cannot uniquely identify. The stance triangle is still resolvable through other reads (stamina state, history, telegraph round on bosses) — the tell is one input, not the answer.

Mapped to: Gyms 5–7 trainers, the Rocket arc rivals, the rival's later Phase 8 form.

### Champion — opaque / lying

Tells deliberately misdirect. The Champion's mons may show a "GUARD" tell and Aggressive-attack, or feint an Aggressive wind-up and rest. **The player has to read past the tell** — use stamina math, momentum history, and prior-round patterns to predict in spite of the sprite. This is the final read curriculum; only Phase 8 endgame opponents qualify.

Mapped to: Elite Four, Champion, Mt. Silver fights, the Gauntlet bosses.

---

## Tell vocabulary (sketch, not contract)

The vocabulary needs design ownership before implementation — these are illustrative examples to anchor the discussion:

| Stance     | Tell family                                                                        |
|------------|------------------------------------------------------------------------------------|
| Aggressive | Forward lean, wind-up frame, color flicker red. Heavier tiers = bigger wind-up.    |
| Guard      | Lowered stance, brace pose, color flicker blue. Heavier guard = deeper crouch.     |
| Fluid      | Side-step / weight-shift idle, color flicker green. Heavier fluid = wider arc.     |
| Rest       | Eyes closed / slumped pose. No color cue (state, not intent).                      |
| Catch ★    | A momentum-pip-shaped glint near the head.                                         |

Tier is read off the wind-up's intensity / duration, not a separate badge. Animations should be 2–3 frames each so the language fits the 320×180 pixel canvas without becoming busy.

---

## What ships with the info-hiding sprint

When Phase 8's info-hiding work lands, the existing intent box becomes:

- **Normal foes:** stance + tier rendered as a 2–3 frame sprite animation. Same data, prettier (and more readable at speed) than the current text label.
- **Hard foes:** the same animation system, but the foe's animation comes from a *set* of possible intents (chosen so the visible cue is non-distinguishing within the set). The actual chosen intent is still committed at engine level pre-resolve — only the renderer hides which one.
- **Champion foes:** animations may be drawn from a *different* set than the actual intent. The lie is data: a per-boss-card `tellPolicy` field declares which animations to show for which committed actions.

In all three tiers, **the engine still receives the foe's true action at commit time** — this is purely a rendering / communication layer. The sim gate is untouched.

---

## What does NOT happen this sprint

- No animation system work. The intent box keeps rendering "FOE INTENT: G LT ATTACK" until Phase 8.
- No `tellPolicy` field on BossCard. The schema stays as-is.
- No animation art commissioning. Design owns the tell vocabulary first; art commissions follow once the vocabulary is locked.
- No engine work. This whole note is a renderer/communication layer.

---

## When it lands

Per `BUILD-ROADMAP.md`: **Phase 8** (information-hiding tier, scale-to-full-game phase). Specifically, it interleaves with the gym 5–7 and Elite Four content sprints, where the reliability ramp becomes load-bearing. The Phase 8 kickoff should reference this note.

---

## Anti-goals (what the design must avoid)

- **Tells as a separate badge.** If the player ends up reading a small icon that says "AGGRESSIVE HEAVY" alongside the animation, the animation is decorative and the badge is the truth. Fold the badge into the animation; don't double-render.
- **Animations that demand pixel-perfect attention.** The read should be possible at a glance — colorblind-safe, sub-100ms identifiable at Normal tier.
- **Random tells.** Reliability is a *design knob* per encounter, not a per-roll randomization. A Normal foe is honest *every time*; a Champion foe lies *consistently per pattern*. Predictability of the unreliability is part of the read.
- **Punishing inexperienced players.** The Normal-tier honesty exists precisely so a new player can learn the vocabulary in a low-stakes environment. Hard / Champion only kick in once the curriculum has been delivered.

---

## Cross-references

- `combat-2-0-spec.md` — the read pillar (what tells *are*).
- `combat-depth-types-status.md` Part 5, Issue A — playtest found this ramp is **NOT enforced** (intent is fully honest everywhere, including Falkner, so "read → hard-counter → always win" solves the triangle). Enforcing the ramp designed here is pulled to **near-term** (BUILD-ROADMAP Phase 6.7-A), ahead of the Phase 8 info-hiding sprint. Also: the **Daze** status (SPARK/BRAWN) makes a tell actively unreliable — a per-battle expression of this note's reliability knob.
- `BUILD-ROADMAP.md` Phase 8 — when the full info-hiding tiers ship (Phase 6.7-A enforces the trainer/leader AMBIGUOUS tier sooner).
- `project-argent-scope.md` — Champion-tier read curriculum.
- `WORKING-AGREEMENT.md` — the feel gate; tells are a feel surface, not a correctness one.

**This note is design canon.** The Phase 8 info-hiding sprint reads from here; the kickoff for that sprint will translate this into a build scope.
