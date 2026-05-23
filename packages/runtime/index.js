/**
 * @duyo/runtime — ESM shim
 *
 * The real Enyo 2.7 runtime is loaded as a classic <script> by
 * @duyo/vite-plugin, which injects /@duyo/enyo.js (built from
 * packages/runtime/build/enyo.js) into index.html before any
 * module scripts run.
 *
 * This file exists solely so that `import enyo from '@duyo/runtime'`
 * works in app source files. At runtime the vite-plugin resolves
 * this import to a virtual module that just re-exports window.enyo,
 * so this file is never actually executed in the browser.
 *
 * In non-Vite contexts (unit tests, Node scripts) this shim returns
 * whatever window.enyo holds, or undefined.
 */

const enyo = (typeof window !== 'undefined') ? window.enyo : undefined;

export { enyo };
export default enyo;
