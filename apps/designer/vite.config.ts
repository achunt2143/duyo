import { duyoViews } from '@duyo/views/vite';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

import { designerFiles, isProjectFile } from './server/files.js';

/**
 * The designer opens projects while it runs (its Project menu). It starts on the project it
 * had last, or on `DUYO_DESIGNER_ROOT` if that is set, or on the sampler next door.
 */
const sampler = resolve(dirname(fileURLToPath(import.meta.url)), '../sampler');

export default defineConfig({
  esbuild: { jsx: 'automatic' },
  plugins: [duyoViews(), designerFiles({ root: sampler })],
  resolve: {
    // A project's modules import Duyo and React too; they must be the designer's copies, or the
    // project's kinds would register in a registry of their own.
    dedupe: ['@duyo/core', '@duyo/layout', '@duyo/react', '@duyo/remochi', '@duyo/views', 'react', 'react-dom', 'remochi'],
  },
  server: {
    port: 5191,
    // The designer saves into the project; that must not reload the designer itself.
    watch: { ignored: [isProjectFile] },
  },
});
