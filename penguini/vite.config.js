// Vite is the tool that bundles the game into plain files a browser can load.
// You almost never need to touch this file.
import { defineConfig } from 'vite';

// "command" is 'build' when we're making the version that goes on the internet,
// and 'serve' when you're running it locally with `npm run dev`.
export default defineConfig(({ command }) => ({
  // "base" is the folder the game lives in once it's published.
  // GitHub Pages serves this repo at https://<username>.github.io/claude-video/
  // so every file the game asks for has to be prefixed with /claude-video/.
  // Locally there's no prefix, so we use plain "/".
  base: command === 'build' ? '/claude-video/' : '/',

  build: {
    outDir: 'dist',
    // Fail loudly if something is broken instead of shipping a half-built game.
    emptyOutDir: true,
  },

  server: {
    // Opens on http://localhost:5173 and lets your phone connect over wifi.
    host: true,
    port: 5173,
  },
}));
