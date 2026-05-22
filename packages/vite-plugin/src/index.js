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
 * Post-build overrides:
 *
 * 1. Force enyo.g11n to "browser" platform so webOS-only g11n code paths
 *    (palmGetResource, MojoLoader, etc.) are never entered.
 *
 * 2. Stub Tellurium.setup to skip the synchronous XHR fetch of
 *    tellurium_config.json from the webOS filesystem. Tellurium is Palm's
 *    automated testing framework and is not needed in a browser build.
 *    We hardcode the single config value (enableUserEvents: true) and
 *    preserve the rest of the setup logic so the object is still safe
 *    to reference if any app code checks for it.
 */
const POST_BUILD = `
// @duyo/vite-plugin — force g11n to browser platform
if (globalThis.enyo && globalThis.enyo.g11n) {
  globalThis.enyo.g11n._platform = 'browser';
  globalThis.enyo.g11n._enyoAvailable = true;
  globalThis.enyo.g11n._initialized = true;
}

// @duyo/vite-plugin — stub Tellurium for browser (skip webOS XHR config load)
if (typeof Tellurium !== 'undefined' && Tellurium.setup) {
  Tellurium.setup = function(a) {
    window.Tellurium = Tellurium;
    Tellurium.enyo = a;
    Tellurium.extend = Tellurium.enyo.mixin;
    Tellurium.isActive = false;
    Tellurium.topSceneName = '';
    Tellurium.metaDown = false;
    Tellurium.inVerifyDialog = false;
    Tellurium.delayedEvents = [];
    Tellurium.serviceAvailable = false;
    // Hardcode the config — skips the sync XHR to $palm-tellurium/tellurium_config.json
    Tellurium.config = { enableUserEvents: true };
    Tellurium.stageType = 'card';
    window.addEventListener('unload', Tellurium.cleanup, false);
    window.addEventListener('resize', Tellurium.handleResize, false);
    // enableUserEvents intentionally not wired up — Tellurium events are webOS-only
  };
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
          '// post-build platform overrides',
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
