# Archetype base-stat template — PROPOSAL for approval (2026-09-24)

**Status: PROPOSED, not canon.** Nothing in the game or the engine reads it. It answers ruling **C1** in `docs/gym2-rulings-packet.md`, the blocker with the most downstream work behind it: `ch1-batch-sheet.md:23` derives every CH1 stat line from an "archetype base table", and `mon-commission-kit.md:76` from "archetype template + stage band ± statFlavor nudge (capped ±8%)". **The table itself was never written down**, so no CH2 species can be authored without inventing its stats.

Code: `src/sim/statTemplate.ts` (the generator), `src/sim/runStatTemplate.ts` (the evidence; `npx tsx src/sim/runStatTemplate.ts`), `src/sim/statTemplate.test.ts`.

**One-line summary.** The template below regenerates the shipped CH1 mons within the kit's own ±8% statFlavor band. That makes it the rule the CH1 sheet was already using, so I recommend approving it as the *derivation rule*. **Before it's used for CH2**, though, it surfaces a combat-math problem that needs its own ruling (§3): at equal budget, the outcome is fully determined by `hp × atk × dfn`, and speed is worth close to nothing.

---

## 1. What you'd be approving

### 1a. Shape — each archetype's share of the budget `[HP, ATK, DFN, SPD]`

| archetype | HP | ATK | DFN | SPD | source |
|---|---|---|---|---|---|
| Wall | .20 | .26 | .37 | .17 | **fitted**: KINDRAKE line |
| Counter-tank | .19 | .28 | .33 | .20 | **fitted**: SILTSKIP line |
| Dodger | .16 | .27 | .20 | .37 | **fitted**: GRUBLEAF line |
| Glass nuke | .16 | .31 | .17 | .36 | **fitted**: FLITPECK line |
| Trickster | .19 | .26 | .26 | .29 | **fitted**: GRITHOAX line |
| Brawler | .19 | .35 | .25 | .21 | **fitted**: MARSHMASH |
| Pacer | .184 | .289 | .262 | .265 | **derived**: the mean of the six fitted shapes |
| Drainer | .199 | .274 | .262 | .265 | **derived**: the mean of the six, +8% HP paid from ATK |

- **Fitted.** Within each CH1 line the shares vary by at most 0.037 across stages, so the sheet was clearly generated from per-archetype shapes. For starter stage 1 I used the **v1 sheet** values (the archetype-true shapes), not the post-rebalance 330 lines. Those were bent on purpose by `starter-trio-rebalance.md`, so they aren't a template.
- **Pacer** — `pilot-exit-decisions.md:50`: "Stamina war | balanced, regen perk". "Balanced" is read as the **roster mean**, not 25/25/25/25, because HP runs on a smaller scale. Its identity comes from stamina (110) and the regen perk. The perk is unbuilt: that's ruling C3.
- **Drainer** — `pilot-exit-decisions.md:51` says "mid stats", and the stamina doc says "sustain/toxic attrition (long game)". It's the roster mean, leaned toward HP by exactly the maximum statFlavor nudge (+8%, paid from ATK: attrition over burst). So a Drainer never leans further than any mon's flavor adjective already could.
- ⚠️ **Pacer and Drainer come out almost identical in stats.** Both docs describe them as balanced or mid. If they should be stat-distinct, that's a design call, and it's listed as ruling (iv) below.

### 1b. Budget — HP+ATK+DFN+SPD. Archetype never moves it.

`mon-design-template.md` pillar #2: *"stat SHAPE with a tradeoff, never raw total."*

| stage-1 budget | value | fitted from |
|---|---|---|
| common | **270** | GRITHOAX 264 · MARSHMASH 300 ÷ 1.10 (a single) |
| uncommon | **285** | FLITPECK 286 |
| starter | **330** | the shared starter budget (`starter-trio-rebalance.md`) |
| rare, legendary | *not proposed* | no CH1 data, and CH2 needs neither |

| stage position | × stage-1 budget | fitted from |
|---|---|---|
| single-stage line | **× 1.10** | MARSHMASH 300/270. `move-pool.md:57`: singles "compress the ladder" |
| 2-stage, final | **× 1.24** | GALEHAWK 354/286 |
| 3-stage, middle | **× 1.19** | CAVELURE 320/264; starters' stage 2 averages 390/330 |
| 3-stage, final | **× 1.39** (1.19 × 1.17) | CHASMTRAP 382/264; starters' stage 3 averages 453/330 |

### 1c. Stamina — the stamina doc, verbatim, plus its own curve

Stage-1 base (`stat-foundation-stamina-design.md` table): Wall 120 · Counter-tank 115 · Drainer 115 · Pacer 110 · Brawler 105 · Dodger 95 · Trickster 90 · Glass nuke 75.

Stage ratios come from the doc's own Wall example (120 → 132 → 148): **×1.10** at a 3-stage middle, **×1.233** at a 3-stage final. GALEHAWK (75 → 84) gives **×1.12** for a 2-stage final. Singles keep their base. The shipped non-starters match within ±1. The shipped starters use Decision A (108/119/133), which is code-only (ruling C2).

### 1d. statFlavor nudge — the kit's rule plus one proposed detail

The kit says ±8% on the leaned stat, paid from a donor stat. **Proposed detail:** the leaned stat moves by up to 8% of its own value, and the other three pay for it in proportion to their shares, so the budget is unchanged. The kit doesn't say which stat donates. No CH2 row has a statFlavor yet, since that comes from the identity pass (ruling C4), so this detail doesn't affect the table below.

---

## 2. Evidence that this is the rule CH1 already uses

Regenerating all 15 shipped CH1 mons from the template (no flavor nudge):

- **Every non-starter lands within ±8% of the template on every stat.** That's the kit's own flavor cap. The worst single stat is 6.8% (GALEHAWK ATK, 117 vs 109, consistent with its "surging" flavor). `statTemplate.test.ts` pins this.
- **Starter stage 2 and 3** land within 3–7%.
- **Starter stage 1** misses by up to 36% (GRUBLEAF), because those lines were deliberately bent to a shared 330 fast-bruiser by the starter rebalance. That's expected, and it's why they're excluded from the fit.

Full per-mon table: section 1 of `runStatTemplate.ts` output.

---

## 3. ⚠️ What it surfaces — needs a ruling BEFORE CH2 uses it

**Test.** All 8 archetypes at one budget, one neutral kit (the null-typed TACKLE / HEADBUTT plus STAMPEDE, same for everyone), **`reader` on both sides**, every ordered pair, n=400. Only the stats differ.

| aggregate win% at parity | common stage 1 (270) | common 3-stage final (376) | stage 1, flat stamina 100 |
|---|---|---|---|
| Wall | **84.8%** | **84.8%** | 86.4% |
| Counter-tank | 73.3% | 73.9% | 69.5% |
| Brawler | 55.0% | 61.7% | 55.0% |
| Drainer | 52.8% | 61.6% | 44.0% |
| Pacer | 50.3% | 49.6% | 43.7% |
| Trickster | 33.4% | 37.2% | 37.2% |
| Dodger | 29.9% | **19.0%** | 30.5% |
| Glass nuke | **20.6%** | **12.2%** | 33.6% |
| **spread** | **64pp** | **73pp** | 56pp |

**Diagnosis.** The ranking matches `hp × atk × dfn` **exactly** (Spearman rank correlation 1.0), whatever the SPD. Damage is `atk / dfn`, and time-to-KO scales with `hp × dfn / atk`. SPD only orders the two actions within a round, so a point of SPD buys almost nothing. The flat-stamina column shows this is **shape, not stamina**: stamina widens the gap slightly, and it doesn't create it.

**This is not new.** `starter-trio-rebalance.md:14` parked it: *"SPD/ATK buys less than HP/DEF; offense/initiative archetypes (Dodger/Glass-nuke/Pacer) are soft at parity. Revisit deliberately … **only if the pattern holds when those archetypes come online**."* **They come online in CH2**:
- BUZZGRUB → WASPRITE → VESPINE (INSECT Glass nuke, common) and MANTILL → GLAIVEWING (Glass nuke)
- FAWNDLE → STRIDEHART (Pacer)
- L080 (Dodger)

The gap also **widens with stage** (64 → 73pp). The trigger condition that doc named is met.

**Caveat, stated plainly.** This test strips out the identity archetypes carry in their **kits**: Glass nukes learn their heavy 3 levels early, Brawlers are stamina-efficient, and Drainers' stamina-attack moves are unbuilt. CH1 lives with this bias today because types, kits, trainer AI and the boss card cover for it. So "20% at parity" overstates what a player would feel in a real fight. It does not make the bias disappear.

### The options

- **(A) Approve the fitted template as it stands and accept the bias.** Types and kits carry the offense archetypes, as in CH1. Cheapest, and faithful to shipped CH1. **Risk:** the INSECT Glass-nuke line and the Dodger line ship soft, and get softer as they evolve.
- **(B) Compensate in the budget.** Keep the shapes, but raise the total for low-product archetypes. An illustrative run with `hp·atk·dfn` equalized cut the spread **64 → 35pp**, but then **overshot**: Dodger went to 64.6% (once bulk is equal, speed does start to count) and stamina started to decide fights (Drainer 68.5%). Totals ranged 242–319, which **breaks pillar #2**. So B isn't a formula; it would need its own tuning pass.
- **(C) Fix the exchange rate in combat math**, so a point of SPD is worth something. This is the "real combat-math pass with full re-validation" the rebalance doc banked. It **reopens combat** (formally CLOSED, `combat-build-status.md:5`) and re-baselines every ladder.
- **(D) Approve (A) now as the derivation rule, and hold the offense-archetype CH2 lines** (BUZZGRUB, MANTILL, L080) **until (B) or (C) is decided.** The Drainer (MURKIN, PETALISK), Pacer (FAWNDLE), Wall and Brawler lines can be authored straight away. MURKIN, the gym ace, and the slice's Pacer and Drainer are all in that group.

**My recommendation: (D).** It unblocks the Gym-2 slice's own mons today, doesn't invent a compensation rule, and doesn't make the Glass-nuke and Dodger lines permanent before the exchange rate is decided. (C) is the principled long-term fix, but it's your call whether combat reopens.

---

## 4. Rulings requested

1. **Approve §1 as the derivation rule?** Shapes 1a, budgets 1b, stamina 1c.
2. **Which of A / B / C / D** for the parity bias?
3. **The statFlavor donor detail (1d):** proportional, or a named donor stat?
4. **Should Pacer and Drainer be stat-distinct?** As derived, they differ only by +8% HP. If yes, name the lean for each.
5. **Rare and legendary budgets:** not needed for CH2; propose when a chapter needs them.

---

## 5. What approving §1 produces for the CH2 bucket (before any statFlavor)

Unnamed rows are identity-pass slots (ruling C4). ST = stamina.

| line | s | name | types | archetype | rarity | HP | ATK | DFN | SPD | ST | total |
|---|---|---|---|---|---|---|---|---|---|---|---|
| L009 | 1 | MURKIN | VENOM | Drainer | uncommon | 56 | 78 | 75 | 76 | 115 | 285 |
| L009 | 2 | SLUDGNATH | VENOM | Drainer | uncommon | 69 | 97 | 93 | 94 | 129 | 353 |
| L043 | 1 | (unnamed) | VENOM | Brawler | uncommon | 54 | 100 | 71 | 60 | 105 | 285 |
| L043 | 2 | (unnamed) | VENOM | Brawler | uncommon | 67 | 124 | 88 | 74 | 118 | 353 |
| L057 | 1 | (unnamed) | BASIC | Wall | uncommon | 57 | 74 | 106 | 48 | 120 | 285 |
| L057 | 2 | (unnamed) | BASIC | Wall | uncommon | 70 | 92 | 131 | 60 | 134 | 353 |
| L071 | 1 | (unnamed) | BASIC/AQUA | Trickster | common | 52 | 70 | 70 | 78 | 90 | 270 |
| L071 | 2 | (unnamed) | BASIC/AQUA | Trickster | common | 64 | 87 | 87 | 97 | 101 | 335 |
| L074 | 1 | (unnamed) | BASIC | Counter-tank | common | 57 | 83 | 98 | 59 | 115 | 297 |
| L079 | 1 | (unnamed) | AQUA | Trickster | uncommon | 54 | 74 | 74 | 83 | 90 | 285 |
| L079 | 2 | (unnamed) | AQUA | Trickster | uncommon | 65 | 88 | 88 | 98 | 99 | 339 |
| L079 | 3 | (unnamed) | AQUA | Trickster | uncommon | 76 | 103 | 103 | 115 | 111 | 397 |
| L080 | 1 | (unnamed) | BASIC | Dodger | common | 43 | 73 | 54 | 100 | 95 | 270 |
| L080 | 2 | (unnamed) | BASIC | Dodger | common | 54 | 90 | 67 | 124 | 106 | 335 |
| L081 | 1 | (unnamed) | DRAKE/FLAME | Wall | uncommon | 57 | 74 | 106 | 48 | 120 | 285 |
| L081 | 2 | (unnamed) | DRAKE/FLAME | Wall | uncommon | 70 | 92 | 131 | 60 | 134 | 353 |
| L123 | 1 | BRAMBLEKIT | NATURE | Brawler | uncommon | 54 | 100 | 71 | 60 | 105 | 285 |
| L123 | 2 | THORNJACK | NATURE | Brawler | uncommon | 64 | 119 | 85 | 71 | 116 | 339 |
| L123 | 3 | BRIARFANG | NATURE | Brawler | uncommon | 76 | 139 | 99 | 83 | 130 | 397 |
| L124 | 1 | MANTILL | INSECT/NATURE | Glass nuke | uncommon | 46 | 88 | 48 | 103 | 75 | 285 |
| L124 | 2 | GLAIVEWING | INSECT/NATURE | Glass nuke | uncommon | 57 | 109 | 60 | 127 | 84 | 353 |
| L125 | 1 | ACORNTLE | NATURE/STONE | Wall | common | 54 | 70 | 100 | 46 | 120 | 270 |
| L125 | 2 | OAKWARD | NATURE/STONE | Wall | common | 64 | 83 | 119 | 55 | 132 | 321 |
| L125 | 3 | TIMBERHIDE | NATURE/STONE | Wall | common | 75 | 98 | 139 | 64 | 148 | 376 |
| L126 | 1 | FAWNDLE | NATURE | Pacer | common | 49 | 78 | 71 | 72 | 110 | 270 |
| L126 | 2 | STRIDEHART | NATURE | Pacer | common | 61 | 97 | 88 | 89 | 123 | 335 |
| L128 | 1 | BUZZGRUB | INSECT | Glass nuke | common | 43 | 84 | 46 | 97 | 75 | 270 |
| L128 | 2 | WASPRITE | INSECT | Glass nuke | common | 51 | 99 | 55 | 116 | 83 | 321 |
| L128 | 3 | VESPINE | INSECT | Glass nuke | common | 60 | 117 | 64 | 135 | 93 | 376 |
| L129 | 1 | MOSSPAW | NATURE/TERRA | Brawler | uncommon | 54 | 100 | 71 | 60 | 105 | 285 |
| L129 | 2 | LUMBROCK | NATURE/TERRA | Brawler | uncommon | 67 | 124 | 88 | 74 | 118 | 353 |
| L130 | 1 | PETALISK | NATURE | Drainer | common | 53 | 74 | 71 | 72 | 115 | 270 |
| L130 | 2 | BLOOMAW | NATURE | Drainer | common | 66 | 92 | 88 | 89 | 129 | 335 |
These numbers are generated, not hand-authored. If the template changes, re-run `npx tsx src/sim/runStatTemplate.ts` and this table changes with it. Per the kit, the batch still goes through Mathias's veto and then the batch sim before anything enters `docs/`.
