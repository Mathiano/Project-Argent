/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import { argentStudioSavePlugin } from './tools/argent_studio/dev-save-plugin';

export default defineConfig({
  // Dev-only: lets Argent Studio persist authored tile sheets into assets/tilesets/
  // and maintain the asset manifest. apply:'serve' → no effect on build/test/prod.
  plugins: [argentStudioSavePlugin(process.cwd())],
  server: {
    port: 5173,
  },
  test: {
    include: ['src/**/*.{test,spec}.ts'],
    environment: 'node',
  },
});
