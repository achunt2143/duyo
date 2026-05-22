/**
 * @duyo/vite-plugin
 *
 * Teaches Vite how to build and serve Duyo (Enyo 1.x) applications.
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const RUNTIME_ROOT = resolve(__dirname, '../../runtime');
const ENYO_BUILD_JS = resolve(RUNTIME_ROOT, 'framework/build/enyo-build.js');
const ENYO_BUILD_CSS = resolve(RUNTIME_ROOT, 'framework/build/enyo-build.css');

const VIRTUAL_APP_ID = 'virtual:duyo-app';
const RESOLVED_VIRTUAL_APP_ID = '\0' + VIRTUAL_APP_ID;
const VIRTUAL_RUNTIME_ID = 'virtual:duyo-runtime';
const RESOLVED_VIRTUAL_RUNTIME_ID = '\0' + VIRTUAL_RUNTIME_ID;

/**
 * Browser-safe Enyo bootstrap preamble.
 *
 * - Sets window.enyo and all properties enyo-build.js expects to already
 *   exist on the global before it starts patching.
 * - enyo.enyoPath must be set so g11n/loadfile.js can resolve "$enyo/g11n"
 *   via enyo.path.rewrite(); without it enyo.Object.subclass / publishEvents
 *   are never reached because the features-loop throws during g11n init.
 * - Uses `var` so the declaration hoists and doesn't clash with any
 *   lexical `const`/`let enyo` Vite may synthesise in the module wrapper.
 */
const BROWSER_PREAMBLE = `
// @duyo/vite-plugin — browser-safe Enyo bootstrap
var __duyoGlobal = globalThis;
__duyoGlobal.enyo = __duyoGlobal.enyo || {};
__duyoGlobal.enyo.isBuiltin = false;
__duyoGlobal.enyo.args = __duyoGlobal.enyo.args || {};
__duyoGlobal.enyo.enyoPath = __duyoGlobal.enyo.enyoPath || '';
__duyoGlobal.enyo.depends = __duyoGlobal.enyo.depends || function() {};
__duyoGlobal.enyo.setPrototype = __duyoGlobal.enyo.setPrototype || function(ctor, proto) { ctor.prototype = proto; };

// old Enyo code expects both a free variable and window.enyo
if (typeof window !== 'undefined') {
  window.enyo = __duyoGlobal.enyo;
}

var enyo = __duyoGlobal.enyo;
`;

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

export function duyo(options = {}) {
  const {
    appKind = null,
    renderTarget = 'root',
    stubPalmSystem = true,
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
        const build = readFileSync(ENYO_BUILD_JS, 'utf-8');

        const wrappedBuild = `
(function() {
  var enyo = globalThis.enyo;
  (0, eval)(${JSON.stringify(build)});
}).call(globalThis);
`;

        return [
          '// @duyo/runtime — Enyo 1.0 pre-built bundle',
          stubPalmSystem ? PALM_STUB : '',
          BROWSER_PREAMBLE,
          '// enyo-build.js (wrapped for real global scope)',
          wrappedBuild,
          'export var enyo = globalThis.enyo;',
          'export default globalThis.enyo;'
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
        const css = readFileSync(ENYO_BUILD_CSS, 'utf-8');
        res.setHeader('Content-Type', 'text/css');
        res.end(css);
      });
    }
  };
}

export default duyo;
