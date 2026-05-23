/**
 * @duyo/runtime — Rollup build config
 *
 * Bundles Enyo 2.7 source (framework/) + Duyo custom components (src/)
 * into a single browser IIFE at build/enyo.js.
 *
 * The output is served by @duyo/vite-plugin as a classic <script> tag,
 * which runs in sloppy (non-strict) mode — required by Enyo's internals.
 *
 * Usage:
 *   npm run build        (from packages/runtime)
 *
 * Output:
 *   build/enyo.js        browser-ready IIFE, assigns to window.enyo
 *   build/enyo.css       concatenated enyo + custom CSS
 */

import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import alias from '@rollup/plugin-alias';
import { existsSync, readdirSync, statSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, extname, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// CSS build (side-effect — runs via generateBundle hook below)
// ---------------------------------------------------------------------------
function collectCssFiles(dir, files = []) {
  if (!existsSync(dir)) return files;
  for (const entry of readdirSync(dir).sort()) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) collectCssFiles(full, files);
    else if (extname(entry) === '.css') files.push(full);
  }
  return files;
}

function buildCss() {
  const frameworkCss = collectCssFiles(resolve(__dirname, 'framework/src'));
  const customCss    = collectCssFiles(resolve(__dirname, 'src'));
  return [...frameworkCss, ...customCss]
    .map(f => readFileSync(f, 'utf-8'))
    .join('\n');
}

// ---------------------------------------------------------------------------
// Plugin: write build/enyo.css as a side-effect of the JS build
// ---------------------------------------------------------------------------
function writeCss() {
  return {
    name: 'write-enyo-css',
    generateBundle() {
      const css = buildCss();
      const outDir = resolve(__dirname, 'build');
      if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
      writeFileSync(join(outDir, 'enyo.css'), css, 'utf-8');
      console.log('[duyo] build/enyo.css written (' + css.length + ' bytes)');
    }
  };
}

// ---------------------------------------------------------------------------
// Main config
// ---------------------------------------------------------------------------
export default {
  input: 'build-entry.js',

  output: {
    file: 'build/enyo.js',

    // Use IIFE format so the code executes immediately in global scope.
    // Do NOT set `name` or `extend` — Enyo assigns window.enyo itself
    // internally as a side effect. If Rollup also assigns the IIFE return
    // value to window.enyo, it overwrites the real object with `undefined`
    // because Enyo's index.js returns nothing.
    format: 'iife',

    // Do NOT add 'use strict' — Enyo uses arguments.callee and other
    // sloppy-mode-only features.
    strict: false,

    // Keep the output readable during development.
    // Flip to true (or add @rollup/plugin-terser) for production.
    compact: false,
  },

  plugins: [
    // Redirect bare require('enyo') calls — used by every file in framework/src/ —
    // to our local bootstrap shim that creates and returns window.enyo.
    // This MUST come before nodeResolve so the alias wins.
    alias({
      entries: [
        {
          find: 'enyo',
          replacement: resolve(__dirname, 'framework/src/_enyo-global.js')
        }
      ]
    }),

    // Resolve bare `require('...')` paths inside Enyo source
    nodeResolve({ browser: true }),

    // Convert Enyo's CommonJS require() calls to Rollup-compatible imports
    commonjs({
      // Enyo registers everything onto `window.enyo`, not via module.exports,
      // so we don't need named exports from individual files.
      ignoreDynamicRequires: true,
    }),

    // Write CSS as a side-effect
    writeCss(),
  ],

  // Suppress circular dependency warnings — Enyo has intentional
  // circular refs between Component, Control, and UiComponent.
  onwarn(warning, warn) {
    if (warning.code === 'CIRCULAR_DEPENDENCY') return;
    warn(warning);
  },
};
