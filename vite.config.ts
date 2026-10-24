import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';

const { version } = JSON.parse(readFileSync('package.json', 'utf8')) as { version: string };

// Tauri drives the dev server on a fixed port and serves the built assets
// from the webview, so the config stays deliberately small.
export default defineConfig({
  clearScreen: false,
  define: {
    __APP_VERSION__: JSON.stringify(version),
    // The store build is made for a store, which owns the updates of what it
    // hands out. The flag tells the reader that it must not try to update
    // itself.
    __STORE_BUILD__: JSON.stringify(process.env.VITE_STORE_BUILD === '1'),
  },
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      ignored: ['**/src-tauri/**'],
    },
  },
  envPrefix: ['VITE_', 'TAURI_'],
  build: {
    target: 'es2021',
    minify: process.env.TAURI_ENV_DEBUG ? false : 'esbuild',
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
  },
});
