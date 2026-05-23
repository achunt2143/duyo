/**
 * @duyo/runtime
 *
 * ESM entry point for the Enyo 2.7 runtime.
 *
 * Enyo 2.7 is written as a browser global — it attaches itself to
 * `window.enyo` when its source files are executed in a browser context.
 * In a Vite dev/build context the vite-plugin handles loading enyo as a
 * classic <script> (non-strict mode, global scope). This module is the
 * thin ESM shim that re-exports whatever `window.enyo` holds after that
 * classic script has run.
 *
 * At build time (SSR / Node) this file is never actually executed —
 * the vite-plugin resolves `@duyo/runtime` to a virtual module instead.
 *
 * Original framework: https://github.com/enyojs/enyo (2.7)
 * License: Apache-2.0
 */

// In a browser build this is populated by the classic <script> injected
// by the vite-plugin before any module code runs.
const enyo = (typeof window !== 'undefined') ? window.enyo : undefined;

if (!enyo && typeof window !== 'undefined') {
  console.warn(
    '[duyo] window.enyo is not defined. ' +
    'Make sure @duyo/vite-plugin is configured and enyo loaded before this module.'
  );
}

export { enyo };
export default enyo;
