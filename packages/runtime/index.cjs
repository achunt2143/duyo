/**
 * @duyo/runtime — CommonJS entry point
 *
 * For environments that require CJS (older tooling, Jest, etc.).
 * In a browser build the vite-plugin resolves this to a virtual module.
 * In Node (e.g. test runners) enyo is not meaningful without a DOM,
 * so we export undefined and let the caller handle it gracefully.
 */

'use strict';

const enyo = (typeof window !== 'undefined') ? window.enyo : undefined;

module.exports = enyo;
module.exports.enyo = enyo;
module.exports.default = enyo;
