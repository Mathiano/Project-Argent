# KICKOFF — Combat turn-order + resolution (a ruling + a bug hunt)

Two playtest observations suggest turn order doesn't match the design: (1) **"SLOWER" shows but the player sometimes acts FIRST**; (2) **the player attacks, the foe loses all HP, then the player loses HP afterwards** — a mutual-KO where a fainted mon seems to hit back. This touches the **engine**, so **sim-gate carefully** and report ladder impact + whether the bug was **engine or display**.

## THE RULING — sequential resolution (Mathias, Option A)
- Turn order within a round is by **SPEED** (initiative): the faster mon acts first.
- If the first mon's action **KOs** the foe, the KO'd mon does **NOT** act — its committed move does **not** execute. **No mutual KO** from a lethal first hit. (Both sides still **COMMIT** before resolution — the read-war commit model is preserved — but resolution executes in speed order, and a KO cancels the dead mon's pending move.)
- This makes the SPD indicator's promise true (faster = acts first), rewards winning the read+speed with a clean KO, and avoids feel-bad mutual KOs.

## THE KNOWN LEGITIMATE EXCEPTION — Fluid
- **FLUID** is designed to "act first" (its slippery identity). The full rule: "faster acts first, **EXCEPT** a Fluid turn-order effect may let a mon act first regardless of raw speed."
- This may be the source of symptom (1): a slower mon in Fluid acting first could be **correct by design** — but if the SPD indicator / turn-order preview isn't surfacing it, it reads as "slower acted first = bug." Determine: is the slower-acts-first case (a) Fluid (or move-weight) working as designed but not shown, or (b) an actual speed-comparison bug?

## THE INVESTIGATION (find where code diverges from the ruling)
1. **Symptom 1 (slower acts first):** trace the turn-order logic. Is the speed comparison correct? Is a stance effect (Fluid) or move weight overriding raw speed in a way that's not surfaced? Is the SPD indicator computing the wrong thing? Report the **root cause**, then fix so turn order matches the ruling AND the indicator reflects the **true** order (incl. any Fluid effect — the player must SEE it).
2. **Symptom 2 (mutual KO / fainted mon hits back):** trace resolution. Does a round resolve BOTH committed moves even when the first is lethal? Fix so a KO from the first action **cancels** the KO'd mon's pending move (sequential, no posthumous attack).

## SIM-GATE (this may change resolution → ladders may move)
- Sequential-with-KO-cancel changes outcomes only where a mon currently gets a **posthumous hit**. Run **both ladders**, report the diff (win% + length). If they move, it's an **intentional correctness re-baseline** (the old behavior was a bug) — re-lock with disclosure. **If the sim already resolves sequentially** (the bug may be display/scene-only), the ladders won't move — confirm which.
- **Critically: report whether the bug was in the ENGINE (sim affected) or the SCENE/display (sim clean)** — that tells us if the sim was modeling the wrong thing.
- Confirm the speed RELATIONSHIPS still hold (faster still wins order; Fluid's effect still works).

## LEGIBILITY
After the fix, the SPD indicator + turn-order preview must **honestly** show who acts first (incl. Fluid's effect), so the player can trust it — the whole point of the speed-legibility work.

## GATE
Turn order matches the ruling (faster first, Fluid exception surfaced); a lethal first hit **cancels** the KO'd mon's pending move (no posthumous attack / no mutual KO from one lethal hit); the SPD/preview honestly reflects true order; root causes of both symptoms reported; ladders re-locked with disclosure IF they moved (and whether the bug was engine or display).
**Tests:** faster mon acts first; Fluid acts first vs a faster non-Fluid (and the indicator shows it); a lethal first hit prevents the foe's pending move; no mutual KO from one lethal hit; the order readout matches actual resolution order.

## Report as audit + root-cause of both symptoms + ladder impact + whether the bug was engine or display.
