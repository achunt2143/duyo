/**
 * @duyo/runtime
 *
 * ESM entry point for the Enyo 1.x runtime.
 *
 * Enyo was originally written as a browser global — it attaches itself to
 * `window.enyo` when loaded. This module loads the pre-built Enyo source
 * into a sandboxed scope, captures the resulting `enyo` global, and
 * re-exports it as a named ESM export so modern bundlers (Vite, Rollup,
 * esbuild) can consume it without modification.
 *
 * Classic Enyo app code is unchanged — this is purely packaging.
 *
 * Original framework: https://github.com/enyojs/enyo-1.0
 * License: Apache 2.0
 */

import { createRequire } from 'module';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load the pre-built Enyo source as a string
const enyoBuildPath = resolve(__dirname, 'framework/build/enyo-build.js');
const enyoSource = readFileSync(enyoBuildPath, 'utf-8');

// Execute Enyo in a scope that provides the globals it expects.
// Enyo attaches to `window` in a browser. In Node/build contexts,
// we provide a minimal shim so the bootstrap completes cleanly.
const scope = {
  window: typeof window !== 'undefined' ? window : {},
  document: typeof document !== 'undefined' ? document : null,
  navigator: typeof navigator !== 'undefined' ? navigator : { userAgent: '' },
  enyo: undefined
};

// Wrap and execute
const fn = new Function(
  'window', 'document', 'navigator',
  `${enyoSource}\nreturn typeof enyo !== 'undefined' ? enyo : window.enyo;`
);

const enyo = fn(scope.window, scope.document, scope.navigator);

export { enyo };
export default enyo;
