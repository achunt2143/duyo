import { defineConfig } from 'vite';

export default defineConfig({
  // The Duyo packages ship TypeScript/TSX source during development.
  esbuild: { jsx: 'automatic' },
  server: { port: 5190 },
});
