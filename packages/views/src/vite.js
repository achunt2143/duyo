// @ts-check
import { resolve } from 'node:path';

import { findViews, formatDiagnostic, syncViewTypes } from './index.js';

/**
 * Keeps view specs valid and their generated types current while you work.
 *
 * - On start, validates every `*.view.json` under `dir` and writes its `.view.gen.ts`.
 * - On every change to a spec, does the same for that file. A spec error is shown in the
 *   browser overlay in development and fails a production build.
 *
 * @param {{ dir?: string }} [options] where views live, relative to the Vite root. Default `src`.
 * @returns {import('vite').Plugin}
 */
export function duyoViews(options = {}) {
  let dir = '';
  let isBuild = false;

  /** @param {ReturnType<typeof syncViewTypes>} result */
  const errorsOf = (result) =>
    result.diagnostics
      .filter((d) => d.severity === 'error')
      .map((d) => formatDiagnostic(d, result.viewFile))
      .join('\n');

  return {
    name: 'duyo-views',
    enforce: 'pre',

    configResolved(config) {
      dir = resolve(config.root, options.dir ?? 'src');
      isBuild = config.command === 'build';
    },

    buildStart() {
      for (const file of findViews(dir)) {
        const errors = errorsOf(syncViewTypes(file));
        if (!errors) continue;
        // A broken spec should not stop the dev server from starting; it is reported again,
        // in the overlay, when the page loads it.
        if (isBuild) this.error(errors);
        else this.warn(errors);
      }
    },

    transform(code, id) {
      const file = id.split('?')[0] ?? id;
      if (!file.endsWith('.view.json')) return null;
      const errors = errorsOf(syncViewTypes(file, { source: code }));
      if (errors) this.error(errors);
      return null;
    },
  };
}

export default duyoViews;
