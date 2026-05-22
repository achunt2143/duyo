/**
 * @duyo/runtime — CommonJS entry point
 *
 * For environments that require CJS (older tooling, Jest, etc.).
 * Loads the same pre-built Enyo source and exposes it as module.exports.enyo.
 */

'use strict';

const { readFileSync } = require('fs');
const { resolve } = require('path');

const enyoBuildPath = resolve(__dirname, 'framework/build/enyo-build.js');
const enyoSource = readFileSync(enyoBuildPath, 'utf-8');

const scope = {
  window: typeof window !== 'undefined' ? window : {},
  document: typeof document !== 'undefined' ? document : null,
  navigator: typeof navigator !== 'undefined' ? navigator : { userAgent: '' }
};

const fn = new Function(
  'window', 'document', 'navigator',
  `${enyoSource}\nreturn typeof enyo !== 'undefined' ? enyo : window.enyo;`
);

const enyo = fn(scope.window, scope.document, scope.navigator);

module.exports = enyo;
module.exports.enyo = enyo;
module.exports.default = enyo;
