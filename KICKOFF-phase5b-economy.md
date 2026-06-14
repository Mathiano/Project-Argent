# Phase 5b — Money + Poké Mart (the economy)

Per `BUILD-ROADMAP.md` Phase 5, split: **5a = healing + items + bag** (shipped); **5b = economy / shops** (this sprint). Completing 5b closes Phase 5 — when it lands the **demo loop is structurally complete**: route → fight → heal → earn → shop → manage → save.

**Gate:** the player can EARN money from battles and SPEND it at a Poké Mart to buy items.

## Scope

### S1 — Money
- `run.money: number`, persisted in `SaveState`. Additive field (`money?: number`) — same back-compat pattern the Phase 5a bag used; version stays `1`. A pre-5b save with no `money` field loads as the starting wallet.
- New Game seeds a small starting wallet (`STARTING_MONEY`).
- Money shown in the bag and Mart screens.

### S2 — Trainer + wild payouts
- Winning a **trainer** battle awards money — a per-trainer reward declared on the `start-trainer-battle` script command (`reward?: number`). Award fires on battle resolve (win) in the game layer (`main.ts`), then autosaves.
- **Wild wins pay nothing** (classic Pokémon: money is a trainer reward only). This is anti-grind-aligned — wild fights stay about catching/training, not farming money.
- Engine untouched — payout is a pure game-layer concern. No engine hook, ladders unaffected.

### S3 — Poké Mart
- A real Mart: a Mart building in **Hearthwick** (door warp → new `HEARTHWICK_MART` interior), with a CLERK NPC behind the counter. The Phase-5a "MART — coming soon" noticeboard in the Center is updated to point at the now-open shop.
- A new `open-mart` script verb (terminal in the script, same pattern as `show-starter-pick`) launches the shop scene.
- **BUY:** a stock list (POTION / SUPER POTION / FULL HEAL) with prices; a quantity selector; buying decrements money + adds to the bag; **affordability enforced — can't overspend**.
- **SELL:** pick a bag item, sell at half price (classic); money up, qty down.
- All of it persists via the Phase 2 save.

### S4 — Bag / economy integration
- The bag (Phase 5a) now reflects purchased items — the Mart feeds `bagAdd` into the same `run.bag`. Money is visible in both the bag and the Mart.

### S5 — Playtest hooks
- `?money=N` seeds a wallet for shop testing. `?skip=mart` drops into the Hearthwick Mart. Update `docs/playtest-hooks.md`.

## Out of scope (later phases)
Held items, item effects beyond healing, balls/catching (Phase 6), berries' effects, the Game Corner (cut per scope doc). In-battle item use stays deferred (its own engine sprint).

## Gate (5b done when)
- Winning a trainer fight awards money that persists.
- A Poké Mart sells items: buy decrements money + fills the bag; sell does the reverse; can't overspend.
- New Game seeds a starting wallet.
- Existing tests green; both ladders bit-identical (engine untouched); CI green.
- Tests: payout on win persists, buy/sell math + affordability, money round-trips in save.

## Report as audit
Feel sign-off: Mathias wins a fight, earns money, walks to the Mart, buys a potion, confirms money + bag persist. AND a full cold-start demo-loop run (intro → route → fight → heal → shop).
