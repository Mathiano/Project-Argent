# Vendored fonts

## m3x6 (`m3x6.ttf`) — the UI font (current)

- **Designer:** **Daniel Linssen** (managore). *Attribution required — honored here.*
- **License:** CC0-style free / attribution — original proportional pixel font
  (not a Nintendo trace), fully commercial-OK.
- **Source:** managore.itch.io/m3x6, via `docs/art-reference/m3x6.ttf`.
- **Metrics (parsed):** unitsPerEm 1024 (64 units/px) → **crisp at 16px** (8px is
  sub-pixel). ~6px caps, **~4.0px avg advance** (proportional) — narrower than the
  old monospace (4.8) and m5x7 (5.7), so it fits the 320×180 boxes. Lacks
  `★ ♥ ▼ ▶ ₽` (has `·`) → those render small via the symbol pass (ui.ts).
- **Usage:** `UI_FONT` (ui.ts), loaded by font.ts at boot. m5x7's smaller sibling
  (same family/look); m5x7 was too big for the boxes at its 16px crisp size.

## m5x7 (`m5x7.ttf`) — banked (was trialled as the UI font)

- **Designer:** **Daniel Linssen** (managore). *Credit appreciated (not required).*
- **License:** **CC0 1.0 / public domain** — no restrictions, fully commercial-OK,
  redistributable, embeddable. An original proportional pixel font (not a Nintendo
  trace). The author calls it a free-to-use pixel font.
- **Source:** vendored from `docs/art-reference/m5x7.ttf` into the assets dir.
- **Metrics (parsed):** unitsPerEm 1024 (64 units/px) → **renders crisp at 16px**
  (and 32px); 8px is sub-pixel. ~7px caps, ~5.7px avg advance (proportional). Does
  NOT include `★ ♥ ▼ ▶ ► ₽` (has `·`) — those fall back to monospace.
- **Usage:** `UI_FONT` (ui.ts), loaded by font.ts at boot.



## Press Start 2P (`PressStart2P-Regular.woff2`)

- **Designer:** CodeMan38 (cody@zone38.net) — The Press Start 2P Project Authors.
- **License:** SIL Open Font License 1.1 — see `OFL.txt` (it travels with the font, as the OFL requires). Fully commercial-OK, redistributable, embeddable.
- **Source:** self-hosted from the Fontsource mirror of Google Fonts
  (`@fontsource/press-start-2p`, the `latin-400-normal` woff2). Vendored into the
  repo (NOT hot-linked) so the build is offline-safe + version-pinned.
- **Usage:** loaded via the FontFace API at boot (`src/game/main.ts`) and used
  by the canvas text pipeline (`src/game/ui.ts`, `UI_FONT`). Best at 8px / 16px.
  The font covers basic Latin + punctuation only — `★`/`♥` are NOT in it, so the
  font stack falls back to `monospace` for those glyphs per-glyph.

Do not edit the binary or `OFL.txt`. To update, re-pull from the same source and
keep the license alongside.
