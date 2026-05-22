'use strict';

const fs = require('fs');
const path = require('path');

const RUNTIME_ROOT = path.resolve(__dirname, '../../runtime');
const ENYO_BUILD_JS = path.join(RUNTIME_ROOT, 'framework/build/enyo-build.js');
const ENYO_BUILD_CSS = path.join(RUNTIME_ROOT, 'framework/build/enyo-build.css');

const VIRTUAL_APP_ID = 'virtual:duyo-app';
const RESOLVED_VIRTUAL_APP_ID = '\0virtual:duyo-app';
const VIRTUAL_RUNTIME_ID = 'virtual:duyo-runtime';
const RESOLVED_VIRTUAL_RUNTIME_ID = '\0virtual:duyo-runtime';

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

const POST_BUILD = `
// @duyo/vite-plugin — force g11n to browser platform
if (globalThis.enyo && globalThis.enyo.g11n) {
  globalThis.enyo.g11n._platform = 'browser';
  globalThis.enyo.g11n._enyoAvailable = true;
  globalThis.enyo.g11n._initialized = true;
}
`;

function duyo(options) {
  options = options || {};
  const appKind = options.appKind || null;
  const renderTarget = options.renderTarget || 'root';
  const injectCss = options.injectCss !== false;

  return {
    name: 'duyo',
    enforce: 'pre',

    resolveId: function (id) {
      if (id === VIRTUAL_APP_ID) return RESOLVED_VIRTUAL_APP_ID;
      if (id === VIRTUAL_RUNTIME_ID) return RESOLVED_VIRTUAL_RUNTIME_ID;
      if (id === '@duyo/runtime') return RESOLVED_VIRTUAL_RUNTIME_ID;
    },

    load: function (id) {
      if (id === RESOLVED_VIRTUAL_RUNTIME_ID) {
        const build = fs.readFileSync(ENYO_BUILD_JS, 'utf-8');

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

    transformIndexHtml: function (html) {
      if (!injectCss) return html;
      return html.replace(/(<head[^>]*>)/i, '$1\n    <link rel="stylesheet" href="/@duyo/enyo.css">');
    },

    configureServer: function (server) {
      server.middlewares.use('/@duyo/enyo.css', function (req, res) {
        const css = fs.readFileSync(ENYO_BUILD_CSS, 'utf-8');
        res.setHeader('Content-Type', 'text/css');
        res.end(css);
      });
    }
  };
}

module.exports = { duyo };
module.exports.default = duyo;
