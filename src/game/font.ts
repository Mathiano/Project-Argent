// UI font loader (text pass). Loads the vendored m3x6 (Daniel Linssen — see
// src/assets/fonts/) into document.fonts so the canvas text pipeline can render
// it. Isolated here (imported ONLY by main.ts) so the binary asset import stays
// out of the test/headless graph — ui.ts holds the font-family STRING.
// (m5x7 + Press Start 2P stay vendored + banked alongside, no longer loaded.)

import fontUrl from '../assets/fonts/m3x6.ttf';

export const UI_FONT_FAMILY = 'm3x6';

let loading: Promise<void> | null = null;

// Idempotent; ALWAYS resolves (never rejects) so the boot loop starts even if
// the font fails — canvas then falls back to monospace. No-op in a non-DOM
// context (tests / headless), where the font isn't needed.
export function loadUiFont(): Promise<void> {
  if (loading) return loading;
  if (typeof document === 'undefined' || typeof FontFace === 'undefined') {
    loading = Promise.resolve();
    return loading;
  }
  const face = new FontFace(UI_FONT_FAMILY, `url(${fontUrl})`);
  loading = face
    .load()
    .then((loaded) => {
      document.fonts.add(loaded);
    })
    .catch((err) => {
      console.warn('Argent: UI font failed to load — using monospace fallback', err);
    });
  return loading;
}
