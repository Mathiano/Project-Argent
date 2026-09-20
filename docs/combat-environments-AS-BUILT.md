# Combat Layer 3 — Environments (AS-BUILT, code-truth)

**Status:** SHIPPED (engine + sim gate). Companion to `combat-enrichment-roadmap.md` §LAYER 3, which holds the DESIGN. This file is **code-truth**: the live knobs, and the findings that changed the design during the build. Where this and the roadmap disagree, this is what the engine does — and the disagreements below are deliberate, with reasons.

Sim gate: `src/sim/environmentBalance.test.ts`. Data: `src/engine/environment.ts`.

---

## What an environment is

Data on the battle (`BattleState.environment`, absent → `open`). It tilts three things and carries a meta-read:

| Field | Effect |
|---|---|
| `stanceDealt` | × on damage dealt while holding that stance |
| `stanceTaken` | × on damage taken while holding that stance |
| `release` | × on a FOCUS release's damage (heavy / feint / hide) |
| `stanceStamina` | **flat ST per round** for that stance — the primary lever |
| `favors` / `avoids` | the META-READ: how a trainer who claims this ground plays |

Absent environment → `open`, whose every multiplier is 1 and every stamina delta 0. **Every pre-Layer-3 battle and ladder is bit-identical** (asserted: `OPEN ground reproduces the untilted baseline exactly`).

## The live table

| Env | dealt | taken | release | stamina | favors / avoids |
|---|---|---|---|---|---|
| open | — | — | — | — | — / — |
| forest | F 1.10 | — | heavy .88 · hide 1.12 | A −3 · F +3 | F / — |
| fog | A .88 · F 1.08 | — | — | A −4 · F +2 | F / A |
| ice | A 1.10 | G 1.12 | — | A +3 · G −6 | A / G |
| rocky | G .92 · F .90 | — | hide 1.10 | F −2 | G / F |
| cliff | A 1.10 | — | heavy 1.10 · hide .85 | A +3 · F −3 | A / — |
| mud | G .92 · F .88 | — | heavy .92 | A −2 · F −3 | G / F |

Meta-read strength: `TERRAIN_LEAN` 1.6 / `TERRAIN_SHUN` 0.5 — a balanced trainer on its home ground goes from 33% to ~44% on the favoured stance. Readable across a fight, not a one-note spam.

---

## Findings that changed the design

### 1. The roadmap's terrain table was calibrated against a balance that no longer exists
The table taxes **Fluid** in two of six biomes (rocky, mud). It was written when the Monte Carlo had Fluid as a **dominant** strategy (~99.7%). Layer 1 fixed that, and in the shipped engine **Fluid is the WEAKEST pure stance (26%)**. Taxing the weakest stance further pushes toward a dead stance and — see finding 3 — inflates Guard.

**Resolution as built:** the flavour is kept (rocky and mud do disfavour the flowing line) but the tax is small and paired with a compensating cut to Guard's conversion. **A full re-derivation of the table against post-Layer-1 balance is a design call, not a build call — flagged for Mathias, not silently done here.**

### 2. Raw damage is a WEAK lever in this engine
Measured during the build: doubling every damage tilt — fog cutting Aggressive damage **24%** — moved PureAGG's win rate by **2pp**. Fights are decided by the triangle's structural effects (punish, counter-reflect, stagger, daze) and the stamina economy, not marginal damage.

Two consequences, both load-bearing:
- **Stamina is the lever that bites.** A flat ±3–6 ST/round against a +8 base regen changes which stances are sustainable, which is what terrain should do. It is also what the design doc actually describes ("slows mobility", "no room to wind up").
- **Damage is weak GLOBALLY but strong when AIMED.** Cutting Fluid's damage 10% barely registers league-wide, yet it measurably protects Guard, because Fluid is Guard's only losing matchup. Aimed damage tilts are a sharper tool than they look.

### 3. In a triangle, you cannot tax one stance without paying another
A>F>G>A. Fluid is Guard's **only** counter, so **any ground that hurts Fluid protects Guard exactly where it is weakest.** Measured: the first working build put PureGUARD at **68% (rocky) / 70% (mud)**, above Balanced — a textbook in-biome dominant strategy, the precise thing the roadmap's Monte Carlo TODO exists to prevent.

Two fixes were tried and **rejected by measurement** before the third worked:
- Removing Guard's extra mitigation: 68 → 65. Not the driver.
- Removing Guard's stamina bonus entirely: 65 → 66. **Not the driver either** — feeding Guard was never the problem.
- **Cutting Guard's damage conversion** (`stanceDealt.G` 0.92): Balanced back on top in every biome. Guard holds better on hard ground but converts worse — the knock-on cancelled at its source.

### 4. A field-by-field state rebuild silently dropped the environment
`resolveRound` constructs the next `BattleState` by listing fields, not spreading. `environment` was not listed, so **terrain applied in round 1 and vanished from round 2 onward.** One round looked perfect; the effect simply never compounded. Caught only because the mechanism test asserted the tax over **three** rounds, not one. The sim gate's compounding assertion is there to keep it caught.

---

## The gate

`environmentBalance.test.ts` runs the Layer-1 round-robin in every biome and asserts:
- **no stance dies** (>8%) and **none swings more than 8pp from its neutral-ground rate** — terrain colours, never transforms. The ceiling is measured against OPEN rather than as an absolute, because Guard legitimately sits at 60% in the open while 60% for Fluid would be alarming.
- **Balanced beats every pure spam, in every biome** — the load-bearing one. This is what caught rocky and mud.
- OPEN is bit-identical to no environment at all.
- the mechanism directly (stamina taxed every round, damage tilted in the stated direction, unnamed stances untouched).
- the meta-read (a local leans; a visitor does not).

## Not built yet
- **Game wiring.** No map or encounter sets `environment` — the engine supports it and nothing uses it. Wiring routes/arenas to biomes is the next increment.
- **Player-facing tell.** Every environment carries a `blurb` for the battle open; nothing renders it yet. The tilt must never be hidden — Layer 3.5 hides *resources*, not the rules of the ground.
