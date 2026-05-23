/**
 * @duyo/vite-plugin
 *
 * Teaches Vite how to build and serve Duyo (Enyo 2.7) applications.
 *
 * Enyo 2.7 source relies on non-strict semantics (implicit globals,
 * `arguments.callee`, shared free variables via `var enyo = window.enyo`).
 * Vite treats every virtual module as a strict ES module, so we cannot load
 * Enyo through Vite's module graph at all.
 *
 * Instead we concatenate the enyo 2.7 source files in dependency order and
 * serve the result as a classic <script> tag injected into index.html.
 * Classic scripts run in sloppy (non-strict) mode — exactly what Enyo needs.
 * The @duyo/runtime virtual module is a thin shim that just re-exports
 * window.enyo after it has been populated by that classic script.
 *
 * Enyo 2.7 source layout (inside packages/runtime/framework/):
 *   src/         ← individual source files (Component.js, Control/, etc.)
 *   index.js     ← lists the load order via require() calls (CommonJS-style)
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { resolve, dirname, join, extname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const RUNTIME_ROOT = resolve(__dirname, '../../runtime');
const FRAMEWORK_ROOT = resolve(RUNTIME_ROOT, 'framework');
const SRC_ROOT = resolve(FRAMEWORK_ROOT, 'src');

const VIRTUAL_APP_ID = 'virtual:duyo-app';
const RESOLVED_VIRTUAL_APP_ID = '\0' + VIRTUAL_APP_ID;
const VIRTUAL_RUNTIME_ID = 'virtual:duyo-runtime';
const RESOLVED_VIRTUAL_RUNTIME_ID = '\0' + VIRTUAL_RUNTIME_ID;

/**
 * Collect all .js files from the enyo 2.7 src/ tree in filesystem order.
 * Enyo 2.7 registers kinds onto window.enyo as each file executes, and
 * the files are written to be order-independent at the kind level (each
 * kind looks up its superclass by name at instantiation time, not at
 * definition time). A simple recursive walk is therefore sufficient.
 *
 * If you ever need a specific load order, maintain an ordered list here.
 */
function collectSrcFiles(dir, files = []) {
  if (!existsSync(dir)) return files;
  for (const entry of readdirSync(dir).sort()) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      collectSrcFiles(full, files);
    } else if (extname(entry) === '.js') {
      files.push(full);
    }
  }
  return files;
}

/**
 * Build the concatenated Enyo 2.7 JS for use as a classic <script>.
 * Runs in global sloppy scope — no IIFE, no 'use strict'.
 */
function buildEnyoScript() {
  const files = collectSrcFiles(SRC_ROOT);

  if (files.length === 0) {
    return [
      '// @duyo/runtime — Enyo 2.7 source not found.',
      '// Run the setup commands in packages/runtime/ENYO_SETUP.md first.',
      'window.enyo = window.enyo || {};',
      'console.error("[duyo] Enyo 2.7 source not found in packages/runtime/framework/src/. " +',
      '  "See packages/runtime/ENYO_SETUP.md for setup instructions.");',
    ].join('\n');
  }

  const parts = [
    '// @duyo/runtime — Enyo 2.7, served as classic script (non-strict)',
    '// Concatenated by @duyo/vite-plugin from packages/runtime/framework/src/',
    '',
    // Enyo 2.7 bootstrap: it reads/sets these globals
    'window.enyo = window.enyo || {};',
    'var enyo = window.enyo;',
    '',
  ];

  for (const filePath of files) {
    parts.push(`// === ${filePath.replace(SRC_ROOT, '')} ===`);
    parts.push(readFileSync(filePath, 'utf-8'));
    parts.push('');
  }

  return parts.join('\n');
}

/**
 * Collect .css files from enyo 2.7 src/ tree.
 */
function buildEnyoCss() {
  const allFiles = collectSrcFiles(SRC_ROOT);
  const cssFiles = allFiles
    .map(f => f.replace(/\.js$/, '.css'))
    .filter(f => existsSync(f));
  // Also grab any standalone .css in subdirs
  function collectCss(dir, files = []) {
    if (!existsSync(dir)) return files;
    for (const entry of readdirSync(dir).sort()) {
      const full = join(dir, entry);
      const stat = statSync(full);
      if (stat.isDirectory()) collectCss(full, files);
      else if (extname(entry) === '.css') files.push(full);
    }
    return files;
  }
  const directCss = collectCss(SRC_ROOT);
  const unique = [...new Set([...directCss])];
  return unique.map(f => readFileSync(f, 'utf-8')).join('\n');
}

export function duyo(options = {}) {
  const {
    appKind = null,
    renderTarget = 'root',
    injectCss = true
  } = options;

  return {
    name: 'duyo',
    enforce: 'pre',

    resolveId(id) {
      if (id === VIRTUAL_APP_ID) return RESOLVED_VIRTUAL_APP_ID;
      if (id === VIRTUAL_RUNTIME_ID) return RESOLVED_VIRTUAL_RUNTIME_ID;
      if (id === '@duyo/runtime') return RESOLVED_VIRTUAL_RUNTIME_ID;
    },

    load(id) {
      if (id === RESOLVED_VIRTUAL_RUNTIME_ID) {
        // Thin ES module shim — window.enyo is populated by the classic
        // <script src="/@duyo/enyo.js"> injected into index.html before
        // any module scripts run.
        return [
          '// @duyo/runtime shim — Enyo 2.7 loaded as a classic script',
          'export var enyo = window.enyo;',
          'export default window.enyo;',
        ].join('\n');
      }

      if (id === RESOLVED_VIRTUAL_APP_ID) {
        if (!appKind) return `import '@duyo/runtime';\nexport {};`;
        return [
          `import '@duyo/runtime';`,
          `window.addEventListener('load', function() {`,
          `  var target = document.getElementById('${renderTarget}');`,
          `  if (!target) { console.error('[duyo] Render target #${renderTarget} not found.'); return; }`,
          `  try {`,
          `    var app = window.enyo.create({ kind: '${appKind}' });`,
          `    app.renderInto(target);`,
          `  } catch (e) {`,
          `    console.error('[duyo] Failed to render ${appKind}:', e);`,
          `  }`,
          `});`,
        ].join('\n');
      }
    },

    /**
     * Inject <script src="/@duyo/enyo.js"> as the FIRST script in <head>.
     * Must come before any module scripts so window.enyo is ready.
     */
    transformIndexHtml(html) {
      let inject = `\n    <script src="/@duyo/enyo.js"></script>`;
      if (injectCss) inject += `\n    <link rel="stylesheet" href="/@duyo/enyo.css">`;
      return html.replace(/(<head[^>]*>)/i, '$1' + inject);
    },

    configureServer(server) {
      server.middlewares.use('/@duyo/enyo.js', (_req, res) => {
        res.setHeader('Content-Type', 'application/javascript');
        res.end(buildEnyoScript());
      });

      server.middlewares.use('/@duyo/enyo.css', (_req, res) => {
        res.setHeader('Content-Type', 'text/css');
        res.end(buildEnyoCss());
      });
    },

    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'enyo.js',
        source: buildEnyoScript(),
      });
      if (injectCss) {
        this.emitFile({
          type: 'asset',
          fileName: 'enyo.css',
          source: buildEnyoCss(),
        });
      }
    },
  };
}

export default duyo;
