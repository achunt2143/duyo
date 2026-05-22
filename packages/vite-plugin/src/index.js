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
 * Sets globalThis.enyo and all properties enyo-build.js expects before it
 * executes. Does NOT define PalmSystem — that is handled by PALM_STUB so
 * that g11n._init() can detect "browser" platform correctly after we force
 * it below in POST_BUILD.
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

/**
 * Minimal Palm/webOS stubs.
 *
 * Always injected regardless of any option because:
 * - palmGetResource is a bare global called by g11n loadfile on the "device"
 *   platform path — it must exist even if we override the platform below.
 * - PalmSystem methods (stageReady, setWindowOrientation, etc.) are called
 *   during widget boot before our POST_BUILD g11n override fires.
 * - Keeping PalmSystem fully stubbed is safer than removing it because some
 *   Enyo internals guard on typeof PalmSystem after g11n init.
 */
const PALM_STUB = `
// @duyo/vite-plugin — Palm/webOS stubs for browser environment
if (typeof palmGetResource === 'undefined') {
  window.palmGetResource = function() { return undefined; };
}
if (typeof PalmSystem === 'undefined') {
  window.PalmSystem = {
    deviceInfo: '{}',
    locale: 'en_us',
    localeRegion: 'us',
    phoneRegion: 'us',
    timeFormat: 'HH12',
    timeZone: 'America/New_York',
    useSimulatedMouseClicks: function() {},
    simulateMouseClick: function() {},
    paste: function() {},
    runTextIndexer: function(t) { return t; },
    setWindowOrientation: function() {},
    stageReady: function() {},
    getIdentifier: function() { return ''; },
    activate: function() {},
    deactivate: function() {},
    addBannerMessage: function() {},
    removeBannerMessage: function() {},
    clearBannerMessages: function() {},
    playSoundNotification: function() {},
    launchApplication: function() {},
    getResource: function() { return ''; }
  };
}
if (typeof Mojo === 'undefined') {
  window.Mojo = {};
}
`;

/**
 * Post-build override: force enyo.g11n to "browser" platform.
 *
 * enyo.g11n._init() checks typeof PalmSystem to pick the platform.
 * Even with a stub, it may have already run and selected "device".
 * We override _platform and _initialized here so any subsequent call
 * to enyo.g11n.getPlatform() returns "browser" and does not re-enter
 * the webOS-only code paths (palmGetResource, MojoLoader, etc.).
 */
const POST_BUILD = `
// @duyo/vite-plugin — force g11n to browser platform
if (globalThis.enyo && globalThis.enyo.g11n) {
  globalThis.enyo.g11n._platform = 'browser';
  globalThis.enyo.g11n._enyoAvailable = true;
  globalThis.enyo.g11n._initialized = true;
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
        const build = readFileSync(ENYO_BUILD_JS, 'utf-8');

        const wrappedBuild = `
(function() {
  var enyo = globalThis.enyo;
  (0, eval)(${JSON.stringify(build)});
}).call(globalThis);
`;

        return [
          '// @duyo/runtime — Enyo 1.0 pre-built bundle',
          PALM_STUB,
          BROWSER_PREAMBLE,
          '// enyo-build.js (wrapped for real global scope)',
          wrappedBuild,
          '// post-build platform override',
          POST_BUILD,
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
