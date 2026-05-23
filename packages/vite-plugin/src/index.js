/**
 * @duyo/vite-plugin
 *
 * Teaches Vite how to build and serve Duyo (Enyo 2.7) applications.
 *
 * Enyo 2.7 relies on non-strict semantics (implicit globals, arguments.callee,
 * shared free variables). Vite treats every virtual module as a strict ES
 * module, so we cannot load Enyo through Vite's module graph at all.
 *
 * Instead, @duyo/runtime builds a single browser-ready IIFE (build/enyo.js)
 * via Rollup. This plugin serves that pre-built file as a classic <script>
 * injected into index.html *before* any module scripts run. Classic scripts
 * execute in sloppy mode — exactly what Enyo needs.
 *
 * The @duyo/runtime ESM shim (index.js) is a thin wrapper that just
 * re-exports window.enyo after the classic script has populated it.
 *
 * Build output expected at:
 *   packages/runtime/build/enyo.js    ← JS bundle (IIFE)
 *   packages/runtime/build/enyo.css   ← CSS bundle
 *
 * Run `npm run build` in packages/runtime to generate these files.
 */

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const RUNTIME_ROOT = resolve(__dirname, '../../runtime');
const BUILD_ROOT   = resolve(RUNTIME_ROOT, 'build');
const BUILT_JS     = resolve(BUILD_ROOT, 'enyo.js');
const BUILT_CSS    = resolve(BUILD_ROOT, 'enyo.css');

const VIRTUAL_APP_ID             = 'virtual:duyo-app';
const RESOLVED_VIRTUAL_APP_ID    = '\0' + VIRTUAL_APP_ID;
const VIRTUAL_RUNTIME_ID         = 'virtual:duyo-runtime';
const RESOLVED_VIRTUAL_RUNTIME_ID = '\0' + VIRTUAL_RUNTIME_ID;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readBuiltJs() {
  if (!existsSync(BUILT_JS)) {
    return [
      '// @duyo/runtime — build/enyo.js not found.',
      '// Run `npm run build` in packages/runtime first.',
      '// See packages/runtime/ENYO_SETUP.md for full instructions.',
      'window.enyo = window.enyo || {};',
      'console.error(',
      '  "[duyo] build/enyo.js not found. " +',
      '  "Run `npm run build` in packages/runtime. " +',
      '  "See packages/runtime/ENYO_SETUP.md."',
      ');',
    ].join('\n');
  }
  return readFileSync(BUILT_JS, 'utf-8');
}

function readBuiltCss() {
  if (!existsSync(BUILT_CSS)) return '';
  return readFileSync(BUILT_CSS, 'utf-8');
}

// ---------------------------------------------------------------------------
// Plugin
// ---------------------------------------------------------------------------

export function duyo(options = {}) {
  const {
    appKind     = null,
    renderTarget = 'root',
    injectCss   = true,
  } = options;

  return {
    name: 'duyo',
    enforce: 'pre',

    // ------------------------------------------------------------------
    // Module resolution
    // ------------------------------------------------------------------
    resolveId(id) {
      if (id === VIRTUAL_APP_ID)    return RESOLVED_VIRTUAL_APP_ID;
      if (id === VIRTUAL_RUNTIME_ID) return RESOLVED_VIRTUAL_RUNTIME_ID;
      if (id === '@duyo/runtime')    return RESOLVED_VIRTUAL_RUNTIME_ID;
    },

    // ------------------------------------------------------------------
    // Virtual module bodies
    // ------------------------------------------------------------------
    load(id) {
      // @duyo/runtime shim — window.enyo is already populated by the
      // classic <script> that the transformIndexHtml hook injects.
      if (id === RESOLVED_VIRTUAL_RUNTIME_ID) {
        return [
          '// @duyo/runtime shim — Enyo loaded via classic <script src="/@duyo/enyo.js">',
          'export var enyo = window.enyo;',
          'export default window.enyo;',
        ].join('\n');
      }

      // virtual:duyo-app — imports runtime then mounts the root kind
      if (id === RESOLVED_VIRTUAL_APP_ID) {
        if (!appKind) return `import '@duyo/runtime';\nexport {};`;
        return [
          `import '@duyo/runtime';`,
          `window.addEventListener('load', function () {`,
          `  var target = document.getElementById('${renderTarget}');`,
          `  if (!target) {`,
          `    console.error('[duyo] Render target #${renderTarget} not found.');`,
          `    return;`,
          `  }`,
          `  try {`,
          `    window.enyo.create({ kind: '${appKind}' }).renderInto(target);`,
          `  } catch (e) {`,
          `    console.error('[duyo] Failed to render ${appKind}:', e);`,
          `  }`,
          `});`,
        ].join('\n');
      }
    },

    // ------------------------------------------------------------------
    // Inject <script src="/@duyo/enyo.js"> as the FIRST tag in <head>.
    // It must run before any <script type="module"> so window.enyo is
    // ready when the module shim captures it.
    // ------------------------------------------------------------------
    transformIndexHtml() {
  const tags = [
    {
      tag: 'script',
      attrs: { src: '/@duyo/enyo.js' },
      injectTo: 'head-prepend'
    }
  ];

  if (injectCss) {
    tags.push({
      tag: 'link',
      attrs: { rel: 'stylesheet', href: '/@duyo/enyo.css' },
      injectTo: 'head'
    });
  }

  if (appKind) {
    tags.push({
      tag: 'script',
      attrs: { type: 'module', src: '/@id/virtual:duyo-app' },
      injectTo: 'body'
    });
  }

  return { tags };
},

    // ------------------------------------------------------------------
    // Dev server — serve the pre-built files from build/
    // ------------------------------------------------------------------
    configureServer(server) {
      server.middlewares.use('/@duyo/enyo.js', (_req, res) => {
        res.setHeader('Content-Type', 'application/javascript');
        res.end(readBuiltJs());
      });

      server.middlewares.use('/@duyo/enyo.css', (_req, res) => {
        res.setHeader('Content-Type', 'text/css');
        res.end(readBuiltCss());
      });
    },

    // ------------------------------------------------------------------
    // Production build — emit enyo.js + enyo.css as static assets
    // ------------------------------------------------------------------
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'enyo.js',
        source: readBuiltJs(),
      });
      if (injectCss) {
        this.emitFile({
          type: 'asset',
          fileName: 'enyo.css',
          source: readBuiltCss(),
        });
      }
    },
  };
}

export default duyo;
