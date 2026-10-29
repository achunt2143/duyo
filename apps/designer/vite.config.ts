import { duyoViews } from '@duyo/views/vite';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

import { designerFiles } from './server/files.js';

/**
 * The project the designer edits. By default the sampler next door:
 *
 *   DUYO_DESIGNER_ROOT   folder whose *.view.json files are listed and saved (default ../sampler/src)
 *   DUYO_DESIGNER_KINDS  module that registers the project's own kinds (default <root>/sections.ts)
 */
const root = resolve(process.env['DUYO_DESIGNER_ROOT'] ?? resolve(dirname(fileURLToPath(import.meta.url)), '../sampler/src'));
const kinds = resolve(process.env['DUYO_DESIGNER_KINDS'] ?? resolve(root, 'sections.ts'));

export default defineConfig({
  esbuild: { jsx: 'automatic' },
  plugins: [duyoViews(), designerFiles({ root })],
  resolve: { alias: { '@duyo-designer/project': kinds } },
  server: {
    port: 5191,
    // The designer saves into the project; that must not reload the designer itself.
    watch: { ignored: [`${root.replace(/\\/g, '/')}/**`] },
  },
});
