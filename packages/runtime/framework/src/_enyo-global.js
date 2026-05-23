/**
 * _enyo-global.js — Rollup shim for bare require('enyo') calls
 *
 * Every file in framework/src/ begins with require('enyo'). In the original
 * Enyo 2.7 npm distribution this resolves to the published 'enyo' package
 * which bootstraps window.enyo. Since we vendor the source directly, Rollup
 * has no 'enyo' package to resolve — so we provide this shim.
 *
 * This file is aliased via @rollup/plugin-alias in rollup.config.mjs:
 *   { find: 'enyo', replacement: '.../framework/src/_enyo-global.js' }
 *
 * It creates window.enyo (and global.enyo) if they don't exist yet and
 * returns the object, so all downstream require('enyo') calls receive the
 * same shared namespace.
 */

/* jshint node:true */
'use strict';

var g = (typeof window !== 'undefined') ? window : (typeof global !== 'undefined' ? global : this);

if (!g.enyo) {
  g.enyo = { options: {} };
}

module.exports = g.enyo;
