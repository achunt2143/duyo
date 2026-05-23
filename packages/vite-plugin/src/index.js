/**
 * @duyo/vite-plugin
 *
 * Teaches Vite how to build and serve Duyo (Enyo 1.x) applications.
 * Builds the runtime directly from source instead of using the pre-built bundle.
 */

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname, join, extname, basename } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const RUNTIME_ROOT = resolve(__dirname, '../../runtime');
const SOURCE_ROOT = resolve(RUNTIME_ROOT, 'framework/source');

const VIRTUAL_APP_ID = 'virtual:duyo-app';
const RESOLVED_VIRTUAL_APP_ID = '\0' + VIRTUAL_APP_ID;
const VIRTUAL_RUNTIME_ID = 'virtual:duyo-runtime';
const RESOLVED_VIRTUAL_RUNTIME_ID = '\0' + VIRTUAL_RUNTIME_ID;

// Directories to skip entirely — webOS/Palm-only, not needed in browser
const SKIP_DIRS = new Set(['g11n', 'palm']);
// Also skip the lib reference (enyo-lib is webOS only)
const SKIP_PATHS = new Set(['../lib/enyo-lib']);

/**
 * Recursively resolve a depends.js file, returning an object:
 *   { js: string[], css: string[] }
 * where each entry is an absolute path to a source file, in load order.
 */
function resolveDependencies(dirPath, visited = new Set()) {
  const realDir = resolve(dirPath);
  if (visited.has(realDir)) return { js: [], css: [] };
  visited.add(realDir);

  const dependsPath = join(realDir, 'depends.js');
  if (!existsSync(dependsPath)) return { js: [], css: [] };

  const src = readFileSync(dependsPath, 'utf-8');
  // Extract the string arguments from enyo.depends("a", "b", ...)
  const entries = [];
  const re = /["']([^"']+)["']/g;
  let m;
  while ((m = re.exec(src)) !== null) entries.push(m[1]);

  const js = [];
  const css = [];

  for (const entry of entries) {
    // Skip webOS-only paths
    if (SKIP_PATHS.has(entry)) continue;
    const entryName = basename(entry.replace(/\/$/, ''));
    if (SKIP_DIRS.has(entryName)) continue;

    const ext = extname(entry);

    if (entry.endsWith('/') || ext === '') {
      // Directory reference — recurse into it
      const subDir = resolve(realDir, entry);
      if (existsSync(subDir)) {
        const sub = resolveDependencies(subDir, visited);
        js.push(...sub.js);
        css.push(...sub.css);
      }
    } else if (ext === '.js') {
      const absPath = resolve(realDir, entry);
      if (existsSync(absPath)) js.push(absPath);
    } else if (ext === '.css') {
      const absPath = resolve(realDir, entry);
      if (existsSync(absPath)) css.push(absPath);
    }
    // Ignore .html, .json, and other non-JS/CSS files
  }

  return { js, css };
}

/**
 * Build the full Enyo runtime JS by concatenating all source files
 * in depends.js order, wrapped in a non-strict IIFE so that legacy
 * Enyo features like arguments.callee work correctly.
 */
function buildRuntimeJs() {
  const { js } = resolveDependencies(SOURCE_ROOT);

  const parts = [
    '// @duyo/runtime — built from source by @duyo/vite-plugin',
    '(function() {',
    '// --- Enyo global bootstrap ---',
    `var enyo = (typeof globalThis !== 'undefined' ? globalThis : window).enyo = (typeof globalThis !== 'undefined' ? globalThis : window).enyo || {};`,
    `enyo.isBuiltin = false;`,
    `enyo.args = enyo.args || {};`,
    `enyo.enyoPath = enyo.enyoPath || '';`,
    `enyo.depends = function() {};`,
    `enyo.setPrototype = enyo.setPrototype || function(ctor, proto) { ctor.prototype = proto; };`,
    // Palm/webOS stubs so any remaining references don't throw
    `if (typeof palmGetResource === 'undefined') { var palmGetResource = function() { return undefined; }; }`,
    `if (typeof PalmSystem === 'undefined') { var PalmSystem = { deviceInfo: '{}', locale: 'en_us', localeRegion: 'us', timeZone: 'America/New_York', stageReady: function(){}, getIdentifier: function(){ return ''; } }; }`,
    `if (typeof Mojo === 'undefined') { var Mojo = {}; }`,
    '// --- Source files ---',
  ];

  for (const filePath of js) {
    parts.push(`\n// === ${filePath.replace(SOURCE_ROOT, '')} ===`);
    parts.push(readFileSync(filePath, 'utf-8'));
  }

  parts.push('})();');

  return parts.join('\n');
}

/**
 * Collect all CSS files referenced in depends.js trees.
 */
function buildRuntimeCss() {
  const { css } = resolveDependencies(SOURCE_ROOT);
  return css.map(f => readFileSync(f, 'utf-8')).join('\n');
}

const BROWSER_PREAMBLE = `
// @duyo/vite-plugin — expose enyo on globalThis after IIFE runs
if (typeof window !== 'undefined' && !window.enyo) {
  window.enyo = (typeof globalThis !== 'undefined' ? globalThis.enyo : undefined) || {};
}
`;

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
        const runtimeJs = buildRuntimeJs();
        return [
          BROWSER_PREAMBLE,
          runtimeJs,
          'export var enyo = (typeof globalThis !== "undefined" ? globalThis : window).enyo;',
          'export default (typeof globalThis !== "undefined" ? globalThis : window).enyo;'
        ].join('\n');
      }

      if (id === RESOLVED_VIRTUAL_APP_ID) {
        if (!appKind) return `import '@duyo/runtime';\nexport {};`;
        return [
          `import '@duyo/runtime';`,
          `window.addEventListener('load', function() {`,
          `  var target = document.getElementById('${renderTarget}');`,
          `  if (!target) { console.error('[duyo] Render target #${renderTarget} not found.'); return; }`,
          `  try { var app = window.enyo.create({ kind: '${appKind}' }); app.renderInto(target); }`,
          `  catch (e) { console.error('[duyo] Failed to render ${appKind}:', e); }`,
          `});`
        ].join('\n');
      }
    },

    transformIndexHtml(html) {
      if (!injectCss) return html;
      return html.replace(/(<head[^>]*>)/i, '$1\n    <link rel="stylesheet" href="/@duyo/enyo.css">');
    },

    configureServer(server) {
      server.middlewares.use('/@duyo/enyo.css', (req, res) => {
        const css = buildRuntimeCss();
        res.setHeader('Content-Type', 'text/css');
        res.end(css);
      });
    }
  };
}

export default duyo;
