'use strict';

/**
 * CJS wrapper for @duyo/vite-plugin
 *
 * The real implementation lives in index.js (ESM). This wrapper re-exports
 * everything needed so that tools like Vite's esbuild config bundler —
 * which resolves the "require" export condition — can load the plugin.
 *
 * We use lazy require of the Node built-ins and reproduce just enough of the
 * plugin surface to be loadable synchronously in CJS context.
 */

const fs   = require('fs');
const path = require('path');

const RUNTIME_ROOT     = path.resolve(__dirname, '../../runtime');
const ENYO_BUILD_JS    = path.join(RUNTIME_ROOT, 'framework/build/enyo-build.js');
const ENYO_BUILD_CSS   = path.join(RUNTIME_ROOT, 'framework/build/enyo-build.css');
const ENYO_PREAMBLE_JS = path.join(RUNTIME_ROOT, 'framework/build/builtin-preamble.js');

const VIRTUAL_APP_ID            = 'virtual:duyo-app';
const RESOLVED_VIRTUAL_APP_ID   = '\0virtual:duyo-app';
const VIRTUAL_RUNTIME_ID        = 'virtual:duyo-runtime';
const RESOLVED_VIRTUAL_RUNTIME_ID = '\0virtual:duyo-runtime';

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

function duyo(options) {
  options = options || {};
  const appKind        = options.appKind        || null;
  const renderTarget   = options.renderTarget   || 'root';
  const stubPalmSystem = options.stubPalmSystem !== false;
  const injectCss      = options.injectCss      !== false;

  return {
    name: 'duyo',
    enforce: 'pre',

    resolveId: function(id) {
      if (id === VIRTUAL_APP_ID)     return RESOLVED_VIRTUAL_APP_ID;
      if (id === VIRTUAL_RUNTIME_ID) return RESOLVED_VIRTUAL_RUNTIME_ID;
      if (id === '@duyo/runtime')    return RESOLVED_VIRTUAL_RUNTIME_ID;
    },

    load: function(id) {
      if (id === RESOLVED_VIRTUAL_RUNTIME_ID) {
        const preamble = fs.readFileSync(ENYO_PREAMBLE_JS, 'utf-8');
        const build    = fs.readFileSync(ENYO_BUILD_JS,    'utf-8');
        return [
          '// @duyo/runtime — Enyo 1.0 pre-built bundle',
          stubPalmSystem ? PALM_STUB : '',
          '// builtin-preamble.js',
          preamble,
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

    transformIndexHtml: function(html) {
      if (!injectCss) return html;
      return html.replace(/(<head[^>]*>)/i, '$1\n    <link rel="stylesheet" href="/@duyo/enyo.css">');
    },

    configureServer: function(server) {
      server.middlewares.use('/@duyo/enyo.css', function(req, res) {
        const css = fs.readFileSync(ENYO_BUILD_CSS, 'utf-8');
        res.setHeader('Content-Type', 'text/css');
        res.end(css);
      });
    }
  };
}

module.exports = { duyo };
module.exports.default = duyo;
