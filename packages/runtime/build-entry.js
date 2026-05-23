/**
 * Duyo runtime build entry point
 *
 * This file is the Rollup entry for building build/enyo.js.
 * Load order:
 *   1. Enyo 2.7 core   — establishes window.enyo and all built-in kinds
 *   2. Duyo custom src — your own kinds, layered on top of Enyo core
 *
 * To add more of your own source files, require() them from src/index.js.
 */

// 1. Enyo 2.7 core
require('./framework/index.js');

// 2. Duyo custom components
// require('./src/index.js');
