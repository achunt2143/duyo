import { duyoViews } from '@duyo/views/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  // The Duyo packages ship TypeScript/TSX source during development.
  esbuild: { jsx: 'automatic' },
  // Validates *.view.json specs and keeps their generated types current.
  plugins: [duyoViews()],
  server: { port: 5190 },
});
