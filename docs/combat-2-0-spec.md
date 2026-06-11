# PROJECT ARGENT — Combat 2.0 Spec v0.2 (sim-validated)

**Format contract:** 160×144 screen, sprites + text box, D-pad/A/B/SELECT/START. No new buttons, no twitch inputs.
**Budget rule:** every new system costs ≤1 bar or ≤1 glyph on screen. If it can't fit, it's cut.
**Untouched:** type chart, 4 move slots, 6v6, full-turn commit. The soul stays.

---

## Screen layout

```
┌──────────────────────────────┐
│ NEXT▸ [YOU][FOE][YOU][FOE]   │ ← action timeline
│ MILTANK ♀ L20      ⚔?        │ ← foe: stance/intent glyph
│ HP ████████░░  ST ██████░░   │ ← foe stamina bar
│              ┌────────┐      │
│  ~pool~      │  FOE   │      │
│              └────────┘      │
│  ┌────────┐        ▓pillar▓  │ ← terrain as sprites
│  │  YOU   │                  │
│  └────────┘  QUILAVA L19     │
│        HP ██████░ ST ████░ ★ │ ← ★ = Call ready
│┌────────────────────────────┐│
││ FIGHT  PKMN    SEL: stance ││
││ PACK   RUN     STA: call ★ ││
│└────────────────────────────┘│
└──────────────────────────────┘
```

**Input grammar:** D-pad navigate · A confirm · B back · **SELECT cycles stance** on the move screen · **START fires a Trainer Call** when ★ is lit. The entire combat fits the original control surface.

---

## Turn resolution (if/then order)

1. **Commit:** pick Move + Stance (+ Call if ★)
2. **Reveal:** stance triangle resolves → modifiers set
3. **Timeline:** actions execute by action speed (move weight, stance-adjusted)
4. **Clash check:** colliding attacks trigger a Clash
5. **Execute:** hits land with terrain hooks; counters fire
6. **Settle:** stamina, fatigue states, Momentum/★, Break bar, timeline repost

---

## Stances — the anime verbs

The stance layer IS the show's vocabulary: *"Dodge it!" / "Brace!" / "Press the attack!"* — declared with your move, one SELECT press.

| Stance | Glyph | Your move | You take | Stamina |
|---|---|---|---|---|
| **Aggressive** | ⚔ | 1.25× damage | 1.15× | move cost ×1.15 |
| **Guard** | 🛡 | 0.75× damage | 0.6× | +6 bonus regen |
| **Fluid** | 〜 | 1.0× | evade chance (below) | +12 flat — dodging is tiring |

**Triangle:** Guard > Aggressive > Fluid > Guard. Two hard edges, one contested:

| Matchup | Result |
|---|---|
| Guard vs Aggressive | **Counter** — attacker eats 0.5× reflected, staggered (timeline push) |
| Fluid vs Guard | **Opening** — act first, their counter whiffs, your hit lands at 1.15× through a degraded guard (0.85× instead of 0.6×) |
| Aggressive vs Fluid | **Speed contest** — dodge succeeds only with a real Speed edge; slow mons cannot dodge the big hit, fast ones can. The anime rule, made mechanical |
| Mirror | No bonus exchange, base effects only |

---

## Stamina (replaces PP)

Pool: 100 base, species-modified ±20. One bar under HP, both sides.

| Action | Cost |
|---|---|
| Status move | 8 |
| Light (≤60 BP) | 12 |
| Mid (61–90) | 22 |
| Heavy (91–120) | 35 |
| Nuke (>120) | 55 + next action delayed |
| Regen | +8 per action · Guard +6 · full rest +25 |

> Sim note v0.2: regen cut from 12 — at +12, light moves were stamina-free and Guard was an infinite engine (turtle won every matchup). At +8/+6 even light spam slowly drains, exhaustion appears ~1 in 2 battles, and stall dies to the Opening.

**Fatigue states (scenic + mechanical):**
- ≤25% — **Winded:** panting sprite frame; heavy/nuke moves locked. *No Hyper Beam while gasping.*
- 0% — **Exhausted:** loses the action, forced rest, takes +25% this turn.

Sprites visibly tire: idle → panting → one-knee. The show's exhaustion arc, on a Game Boy.

---

## Action timeline

Top strip shows the next 4–5 actions as face chips. Heavy moves visibly push your chip right; light moves bring it back sooner. Staggers (counters, clash losses) shove a chip backward in real time — every read-win is *seen* on the strip.

---

## Clash (beam struggles)

**Trigger:** both sides Aggressive + both damaging moves land in the same timeline window.
**Resolution:** power × current stamina% × move-type matchup. No mashing.
**Result:** winner's move pushes through at 0.7×; loser staggers + chip damage.
**Presentation:** center-screen collision, screen shake, palette flash.
**Tactic:** higher stamina wins ties → bait clashes while fresh, refuse them tired.

---

## Trainer Calls (START, requires ★)

Momentum fills from read-wins, dodges, super-effective hits, clash wins → ★ lights. One charge held at a time.

| Call | Effect |
|---|---|
| "Hang on!" | Survive this action at 1 HP |
| "Now — full power!" | Next move +50%, ignores stance modifiers |
| "Catch your breath!" | Skip move, +40 stamina |
| "Get back!" | Free pivot switch that evades the incoming move |

Leaders have Calls too — with bark-line tells (*"Miltank, wear them down..."*) that double as readable boss telegraphs.

---

## Arenas — terrain as strategy and scenery

Every arena renders 1–2 features as field sprites with real hooks.

| Gym | Feature | Hook |
|---|---|---|
| Falkner | Rooftop gusts | Fluid rides gusts: free evade charge; airborne mons drift on the timeline |
| Bugsy | Web lines | Fluid is slowed through webs; Fire moves burn them away (arena alter) |
| Whitney | Pillar floor | Guard behind a pillar upgrades the counter; Rollout smashes pillars — arena degrades turn by turn |
| Morty | Candle dark | Intents hidden while candles are out; Fire/Electric moves relight them |
| Pryce | Ice floor | Aggressive overshoots (self-stagger); Fluid skates (evade buff) |
| Clair | Den pool + mist | Electric chains off the pool; mist phases hide stance glyphs |

---

## Intent & difficulty

| Difficulty | Foe intent | Foe stance | Foe bars | AI |
|---|---|---|---|---|
| Normal | Move category + target | Visible | Visible | Honest |
| Hard | Category glyph only | Hidden until reveal | Visible | Predicts, baits |
| Champion | None | Hidden | **Hidden — read fatigue frames and tells, like the show** | Full Fable, tells vary between rematches |

---

## Boss layer (gym aces, E4, legendaries)

- **Break bar:** fills only on your read-wins and dodges; full = Break → long stagger + phase shift. Bosses are beaten by reads, not raw damage.
- **Phases:** arena feature changes per phase (Whitney's last pillar falls; Morty's candles all die).
- **Ace entry:** letterbox bars + leader face cut-in. Signature move has a unique tell line.
- Leaders hold 2 Calls and use them like players do.

---

## Boss card — Whitney's ace (sim-tuned, ~50k fights)

**Stats vs player ace:** HP ×1.4 · Def ×1.25 · Spd ×0.64 (the wall: can never dodge, can always be dodged)

**Kit:**
| Move | Numbers |
|---|---|
| Rollout | 40 power, ×1.5 per consecutive hit, cap 4 stacks (40→135). *Relentless:* halves dodge chance. Chain breaks on counter, dodge, or Break |
| Body Slam | 80 power — and her stomp when she's read your Guard habit (Fluid stance, punches through) |
| Defense Curl | Next chain starts pre-stacked |
| Milk Drink ×2 | Heals 45% |

**She reads you:** 30% of turns in phase 1, 75% in phase 2 — answering your modal stance (Guard habit → Fluid stomp · Aggression → brace-and-counter · dodging → relentless Rollout). Her 2 Calls: *Hang on* below 20%, *Full Power* on a built chain or a phase-2 stomp.

**Arena:** 2 pillars — Guard in cover takes ×0.55 and reflects ×0.65; a chained Rollout landing on your Guard smashes one. **Break bar: 4** read-wins → she loses a round, chain resets, phase up. Tuning assumes a bag of 2 potions (30%).

**Validated win-rate ladder (3000 fights/cell):**
| Player | Normal | Hard (stances hidden, same stats) |
|---|---|---|
| Button-masher | 15% | 16% |
| Brute force (heavy spam) | **3%** | 4% |
| Simple read-rule | 94% | 85% |
| Mixed/optimal play | 89% | 84% |

The difficulty gap is *pure information* — identical stats both columns. Open lever: stomp power, to pull predictable players on Hard toward ~75%.

---

## Worked turn — Whitney's ace, pillar arena

Foe intent: ⚔ physical (Rollout building). You: Quilava, 62 ST, behind a pillar.

1. You commit **Guard** + counter-class move. Triangle: Guard > Aggressive → **Counter fires**, pillar bonus stacks it.
2. Miltank eats 0.5× reflected, staggers — her timeline chip shoves back; Rollout chain resets.
3. Read-win lights ★. Next turn: **"Now — full power!"** + Aggressive heavy while she's slow.
4. Her player would have Fluid-dodged turn 2 — but Miltank is slow: Aggressive-vs-Fluid speed contest fails her. The wall has a weakness and it's tempo.

---

## Presentation kit (the cinematic language, sprite-native)

- Sprites physically move: melee lunges cross the field, knockback hops, dodge afterimages
- 4 body-language frames per mon: idle / winded / staggered / triumphant
- Palette weather shifts, letterbox reveals, trainer face cut-ins on Calls
- Clash collision animation; finisher slow-flash on the last hit
- Champion mode = "anime mode": no enemy numbers, pure body language

---

## P2 parking lot

- **Range lanes** (close/far per side; push/pull moves; melee cheap close, ranged cheap far) — prototype in the vertical slice, cut if it muddies
- Doubles ladder inherits all systems unchanged

## Deliberately not doing

- No twitch/reaction inputs — Fluid is a declared read, never a reflex test
- No combo strings, no super meters beyond ★
- No 5th move slot, no stamina items spam (one Ether-class item per battle, cap enforced)
