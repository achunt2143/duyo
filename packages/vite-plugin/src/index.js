/**
 * @duyo/vite-plugin
 *
 * Teaches Vite how to build and serve Duyo (Enyo 1.x) applications.
 *
 * What this plugin does:
 *  1. Injects a browser-safe Enyo bootstrap preamble so `window.enyo`
 *     is available when app modules execute. The original builtin-preamble.js
 *     is intentionally NOT used — it contains V8-native intrinsics (%FunctionSetPrototype)
 *     that only work inside webOS's V8 builtin context, not in a browser.
 *  2. Resolves `@duyo/runtime` imports to the pre-built enyo-build.js.
 *  3. Injects the Enyo stylesheet automatically.
 *  4. Provides a virtual module (`virtual:duyo-app`) for auto-bootstrapping.
 *  5. Stubs out Palm/webOS-only APIs.
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const RUNTIME_ROOT  = resolve(__dirname, '../../runtime');
const ENYO_BUILD_JS  = resolve(RUNTIME_ROOT, 'framework/build/enyo-build.js');
const ENYO_BUILD_CSS = resolve(RUNTIME_ROOT, 'framework/build/enyo-build.css');

const VIRTUAL_APP_ID              = 'virtual:duyo-app';
const RESOLVED_VIRTUAL_APP_ID     = '\0' + VIRTUAL_APP_ID;
const VIRTUAL_RUNTIME_ID          = 'virtual:duyo-runtime';
const RESOLVED_VIRTUAL_RUNTIME_ID = '\0' + VIRTUAL_RUNTIME_ID;

/**
 * Browser-safe Enyo bootstrap preamble.
 *
 * Replaces builtin-preamble.js entirely. That file was written to run inside
 * the webOS V8 builtin context (no window, no document, V8 %intrinsics).
 * In a browser we just need window.enyo to exist before enyo-build.js runs,
 * and enyo.setPrototype to use standard JS prototype assignment.
 */
const BROWSER_PREAMBLE = `
// @duyo/vite-plugin — browser-safe Enyo bootstrap
// Replaces builtin-preamble.js (webOS V8-native only).
window.enyo = window.enyo || {};
enyo = window.enyo;
enyo.isBuiltin = false;
enyo.args = {};
enyo.depends = function() {};

// Standard JS prototype setter — replaces the V8-native %FunctionSetPrototype intrinsic
enyo.setPrototype = function(ctor, proto) {
  ctor.prototype = proto;
};
`;

/**
 * PalmSystem / webOS API stub for browser environments.
 */
const PALM_STUB = `
if (typeof PalmSystem === 'undefined') {
  window.PalmSystem = {
    deviceInfo: '{}',
    locale: 'en_us',
    localeRegion: 'us',
    phoneRegion: 'us',
    timeFormat: 'HH12',
    useSimulatedMouseClicks: function() {},
    simulateMouseClick: function() {},
    paste: function() {},
    runTextIndexer: function(t) { return t; }
  };
}
if (typeof Mojo === 'undefined') {
  window.Mojo = {};
}
`;

/**
 * duyo(options)
 *
 * @param {object} options
 * @param {string}  [options.appKind]        - Top-level kind name to render
 * @param {string}  [options.renderTarget]   - DOM element ID (default: 'root')
 * @param {boolean} [options.stubPalmSystem] - Inject PalmSystem stub (default: true)
 * @param {boolean} [options.injectCss]      - Auto-inject enyo-build.css (default: true)
 */
export function duyo(options = {}) {
  const {
    appKind        = null,
    renderTarget   = 'root',
    stubPalmSystem = true,
    injectCss      = true
  } = options;

  return {
    name: 'duyo',
    enforce: 'pre',

    resolveId(id) {
      if (id === VIRTUAL_APP_ID)     return RESOLVED_VIRTUAL_APP_ID;
      if (id === VIRTUAL_RUNTIME_ID) return RESOLVED_VIRTUAL_RUNTIME_ID;
      if (id === '@duyo/runtime')    return RESOLVED_VIRTUAL_RUNTIME_ID;
    },

    load(id) {
      if (id === RESOLVED_VIRTUAL_RUNTIME_ID) {
        const build = readFileSync(ENYO_BUILD_JS, 'utf-8');
        return [
          '// @duyo/runtime — Enyo 1.0 pre-built bundle',
          stubPalmSystem ? PALM_STUB : '',
          BROWSER_PREAMBLE,
          '// enyo-build.js',
          build,
          'export const enyo = window.enyo;',
          'export default window.enyo;'
        ].join('\n');
      }

      if (id === RESOLVED_VIRTUAL_APP_ID) {
        if (!appKind) return `import '@duyo/runtime';\nexport {};`;
        return [
          `import '@duyo/runtime';`,
          `window.addEventListener('load', function() {`,
          `  var target = document.getElementById('${renderTarget}');`,
          `  if (!target) { console.error('[duyo] Render target #${renderTarget} not found.'); return; }`,
          `  try { var app = enyo.create({ kind: '${appKind}' }); app.renderInto(target); }`,
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
        const css = readFileSync(ENYO_BUILD_CSS, 'utf-8');
        res.setHeader('Content-Type', 'text/css');
        res.end(css);
      });
    }
  };
}

export default duyo;
