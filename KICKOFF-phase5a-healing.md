# Phase 5a — Healing + items + bag (the survival loop)

Per `BUILD-ROADMAP.md` Phase 5, split: **5a = healing + items + bag**; **5b = economy / shops** (next sprint).

**Gate:** the player can heal a damaged party AND use a healing item from the bag.

## Scope

### S1 — Item system (data-driven, like moves/dex)
- `items.json`: id, name, category (medicine / items / berries / keyitems / balls — pockets), description, effect descriptor (e.g. `heal-hp:20`, `heal-hp:full`, `cure-status:all`).
- Start SMALL: basic POTION (heal-hp), stronger POTION (heal-hp more), FULL-HEAL placeholder. Balls and berries get pockets defined but can be empty (Phase 6 fills balls; berries later).
- Engine stays clean: item EFFECTS that touch battle apply through the same event pipeline as moves where possible. **Flag if an item effect needs an engine hook and STOP** rather than reaching in.

### S2 — Bag UI (the deferred Phase 4 screen, now with contents)
- Bag opens from the pause menu (un-grey the BAG row). Pockets as tabs/sections. Each item: name, qty, description on focus.
- Use item from the bag in the overworld → pick a target party mon → apply effect (heal). HP updates and persists (Phase 2 writeback).
- In-battle bag access can wait for 5b or a later pass IF it adds engine risk — flag the call. **Overworld item use is the 5a requirement.**

### S3 — Pokémon Center (the heal loop)
- Center building in Hearthwick (and the existing town(s)) — enter, talk to the counter NPC, party fully restored (HP + ST + status), with the classic heal beat (a line + a pause). Persists via save.
- This is the route→town→heal rhythm. Mart/buying is 5b.

### S4 — Seed a starting bag
- New Game gives a few potions so the bag isn't empty and healing is testable immediately. Until shops exist (5b), this + the Center is how you stay alive.

### S5 — Playtest hooks
- `?bag=potion3` (or similar) seeds a test bag. `?skip=` into a town with a Center for heal-testing. Update `docs/playtest-hooks.md`.

## Out of scope (5b or later)
Money, Poké Mart, buying/selling, trainer payouts, in-battle item use IF it needs engine work, berries' effects, catching/balls (Phase 6).

## Gate (5a done when)
- Damaged party fully healed at a Pokémon Center.
- Healing item used from the bag in the overworld; HP persists.
- Bag shows real items in pockets.
- New Game seeds starting potions.
- All existing tests green; both ladders bit-identical (flag any engine hook needed for item effects); CI green.
- Tests: item effect applies + persists, Center heals full party, bag reflects inventory.

## Report as audit
Feel sign-off: Mathias damages a mon, heals it both ways (Center + bag potion), confirms HP persists.
