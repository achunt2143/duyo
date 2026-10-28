/**
 * @duyo/vite-plugin
 *
 * Teaches Vite how to build and serve Duyo (Enyo 1.x) applications.
 *
 * Enyo source relies on non-strict semantics (arguments.callee, `this` as
 * global, shared free variables). Vite treats every virtual module as an
 * ES module (always strict), so we cannot load Enyo through Vite's module
 * graph at all.
 *
 * Instead we serve the concatenated Enyo source as a classic <script> tag
 * injected into index.html. Classic scripts run in sloppy (non-strict) mode,
 * which is exactly what Enyo was written for. The @duyo/runtime virtual
 * module is a thin shim that just re-exports window.enyo after it has been
 * populated by the classic script.
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

// Directories / paths to skip — webOS/Palm-only
const SKIP_DIRS = new Set(['g11n', 'palm']);
const SKIP_PATHS = new Set(['../lib/enyo-lib']);

/**
 * Recursively resolve a depends.js, returning ordered { js, css } absolute paths.
 */
function resolveDependencies(dirPath, visited = new Set()) {
  const realDir = resolve(dirPath);
  if (visited.has(realDir)) return { js: [], css: [] };
  visited.add(realDir);

  const dependsPath = join(realDir, 'depends.js');
  if (!existsSync(dependsPath)) return { js: [], css: [] };

  const src = readFileSync(dependsPath, 'utf-8');
  const entries = [];
  const re = /["']([^"']+)["']/g;
  let m;
  while ((m = re.exec(src)) !== null) entries.push(m[1]);

  const js = [];
  const css = [];

  for (const entry of entries) {
    if (SKIP_PATHS.has(entry)) continue;
    const entryName = basename(entry.replace(/\/$/, ''));
    if (SKIP_DIRS.has(entryName)) continue;

    const ext = extname(entry);
    if (entry.endsWith('/') || ext === '') {
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
  }

  return { js, css };
}

/**
 * Build the concatenated Enyo JS for use as a classic <script>.
 * No IIFE wrapper — runs in global (sloppy) scope just like the original
 * webOS build system intended.
 */
function buildEnyoScript() {
  const { js } = resolveDependencies(SOURCE_ROOT);

  const parts = [
    '// @duyo/runtime — Enyo 1.x source, served as classic script (non-strict)',
    '// Built by @duyo/vite-plugin from packages/runtime/framework/source',
    '',
    // Bootstrap: set up window.enyo before any source file runs
    'window.enyo = window.enyo || {};',
    'window.enyo.isBuiltin = false;',
    'window.enyo.args = window.enyo.args || {};',
    'window.enyo.enyoPath = window.enyo.enyoPath || \'\';',
    'window.enyo.depends = function() {};',
    'window.enyo.setPrototype = window.enyo.setPrototype || function(ctor, proto) { ctor.prototype = proto; };',
    'var enyo = window.enyo;',
    '',
    // Palm/webOS stubs
    'if (typeof palmGetResource === \'undefined\') { window.palmGetResource = function() { return undefined; }; }',
    'if (typeof PalmSystem === \'undefined\') { window.PalmSystem = { deviceInfo: \'{}\', locale: \'en_us\', localeRegion: \'us\', timeZone: \'America/New_York\', stageReady: function(){}, getIdentifier: function(){ return \'\'; } }; }',
    'if (typeof Mojo === \'undefined\') { window.Mojo = {}; }',
    '',
  ];

  for (const filePath of js) {
    parts.push(`// === ${filePath.replace(SOURCE_ROOT, '')} ===`);
    parts.push(readFileSync(filePath, 'utf-8'));
    parts.push('');
  }

  return parts.join('\n');
}

function buildEnyoCss() {
  const { css } = resolveDependencies(SOURCE_ROOT);
  return css.map(f => readFileSync(f, 'utf-8')).join('\n');
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
        // Thin ES module shim — window.enyo is already populated by the
        // classic <script src="/@duyo/enyo.js"> injected into index.html.
        return [
          '// @duyo/runtime shim — Enyo was loaded as a classic script',
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
          `  try { var app = window.enyo.create({ kind: '${appKind}' }); app.renderInto(target); }`,
          `  catch (e) { console.error('[duyo] Failed to render ${appKind}:', e); }`,
          `});`,
        ].join('\n');
      }
    },

    /**
     * Inject <script src="/@duyo/enyo.js"> as the FIRST script in <head>.
     * It must come before any module scripts so window.enyo is ready.
     * Also inject the CSS link if injectCss is true.
     */
    transformIndexHtml(html) {
      let inject = `\n    <script src="/@duyo/enyo.js"></script>`;
      if (injectCss) inject += `\n    <link rel="stylesheet" href="/@duyo/enyo.css">`;
      return html.replace(/(<head[^>]*>)/i, '$1' + inject);
    },

    configureServer(server) {
      // Serve the concatenated Enyo source as a classic script
      server.middlewares.use('/@duyo/enyo.js', (req, res) => {
        const js = buildEnyoScript();
        res.setHeader('Content-Type', 'application/javascript');
        res.end(js);
      });

      // Serve collected CSS
      server.middlewares.use('/@duyo/enyo.css', (req, res) => {
        const css = buildEnyoCss();
        res.setHeader('Content-Type', 'text/css');
        res.end(css);
      });
    },

    /**
     * For production builds: emit the Enyo script as a static asset
     * and inject the <script> tag into the HTML output.
     */
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
