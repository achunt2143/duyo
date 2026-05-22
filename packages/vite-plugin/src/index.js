/**
 * @duyo/vite-plugin
 *
 * Teaches Vite how to build and serve Duyo (Enyo 1.x) applications.
 *
 * What this plugin does:
 *  1. Injects the Enyo global preamble before any app code so `window.enyo`
 *     is available when app modules execute.
 *  2. Resolves `@duyo/runtime` imports to the pre-built enyo-build.js so
 *     Vite does not try to parse the legacy source through its own module
 *     system.
 *  3. Injects the Enyo stylesheet automatically.
 *  4. Provides a virtual module (`virtual:duyo-app`) that bootstraps a
 *     standard Duyo app entry point (calls enyo.kind + renderInto).
 *  5. Stubs out Palm/webOS-only APIs so the browser console stays clean
 *     when running outside webOS.
 */

import { readFileSync } from 'fs';
import { createRequire } from 'module';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Locate the runtime package root so we can resolve paths into it.
const RUNTIME_ROOT = resolve(__dirname, '../../runtime');
const ENYO_BUILD_JS = resolve(RUNTIME_ROOT, 'framework/build/enyo-build.js');
const ENYO_BUILD_CSS = resolve(RUNTIME_ROOT, 'framework/build/enyo-build.css');
const ENYO_PREAMBLE_JS = resolve(RUNTIME_ROOT, 'framework/build/builtin-preamble.js');

// Virtual module IDs
const VIRTUAL_APP_ID = 'virtual:duyo-app';
const RESOLVED_VIRTUAL_APP_ID = '\0' + VIRTUAL_APP_ID;

const VIRTUAL_RUNTIME_ID = 'virtual:duyo-runtime';
const RESOLVED_VIRTUAL_RUNTIME_ID = '\0' + VIRTUAL_RUNTIME_ID;

/**
 * The webOS / PalmSystem stub.
 * Prevents "PalmSystem is not defined" errors in browser environments.
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
 * @param {string} [options.appRoot]       - Path to the app root (default: process.cwd())
 * @param {string} [options.appKind]       - Top-level kind name to render (e.g. 'MyApp.Application')
 * @param {string} [options.renderTarget]  - DOM element ID to render into (default: 'root')
 * @param {boolean} [options.stubPalmSystem] - Inject PalmSystem stub (default: true)
 * @param {boolean} [options.injectCss]    - Auto-inject enyo-build.css (default: true)
 */
export function duyo(options = {}) {
  const {
    appRoot = process.cwd(),
    appKind = null,
    renderTarget = 'root',
    stubPalmSystem = true,
    injectCss = true
  } = options;

  let viteConfig;

  return {
    name: 'duyo',
    enforce: 'pre',

    // ----------------------------------------------------------------
    // Store vite config for later use
    // ----------------------------------------------------------------
    configResolved(config) {
      viteConfig = config;
    },

    // ----------------------------------------------------------------
    // Resolve virtual modules and @duyo/runtime imports
    // ----------------------------------------------------------------
    resolveId(id) {
      if (id === VIRTUAL_APP_ID) return RESOLVED_VIRTUAL_APP_ID;
      if (id === VIRTUAL_RUNTIME_ID) return RESOLVED_VIRTUAL_RUNTIME_ID;

      // Redirect @duyo/runtime to the pre-built JS so Vite treats it
      // as an opaque external chunk, not a parsed ES module.
      if (id === '@duyo/runtime') return RESOLVED_VIRTUAL_RUNTIME_ID;
    },

    // ----------------------------------------------------------------
    // Load virtual module content
    // ----------------------------------------------------------------
    load(id) {
      if (id === RESOLVED_VIRTUAL_RUNTIME_ID) {
        // Load the full Enyo build as a self-executing script that
        // attaches to window.enyo. We wrap it so Vite treats the
        // entire thing as one module side-effect.
        const preamble = readFileSync(ENYO_PREAMBLE_JS, 'utf-8');
        const build = readFileSync(ENYO_BUILD_JS, 'utf-8');

        return [
          '// @duyo/runtime — Enyo 1.0 pre-built bundle',
          stubPalmSystem ? PALM_STUB : '',
          '// builtin-preamble.js',
          preamble,
          '// enyo-build.js',
          build,
          '// Export enyo for ESM consumers',
          'export const enyo = window.enyo;',
          'export default window.enyo;'
        ].join('\n');
      }

      if (id === RESOLVED_VIRTUAL_APP_ID) {
        if (!appKind) {
          // No appKind specified — just import the runtime and leave
          // bootstrapping to the user's own entry file.
          return `import '@duyo/runtime';\nexport {};`;
        }

        // Auto-bootstrap: import runtime, wait for DOM, render.
        return [
          `import '@duyo/runtime';`,
          ``,
          `// Auto-generated by @duyo/vite-plugin`,
          `// Renders ${appKind} into #${renderTarget}`,
          `window.addEventListener('load', function() {`,
          `  var target = document.getElementById('${renderTarget}');`,
          `  if (!target) {`,
          `    console.error('[duyo] Render target #${renderTarget} not found in DOM.');`,
          `    return;`,
          `  }`,
          `  try {`,
          `    var app = enyo.create({ kind: '${appKind}' });`,
          `    app.renderInto(target);`,
          `  } catch (e) {`,
          `    console.error('[duyo] Failed to render ${appKind}:', e);`,
          `  }`,
          `});`
        ].join('\n');
      }
    },

    // ----------------------------------------------------------------
    // Inject Enyo CSS into the HTML entry point automatically
    // ----------------------------------------------------------------
    transformIndexHtml(html) {
      if (!injectCss) return html;

      // Vite will handle the CSS file as a static asset.
      // We add a <link> pointing to the virtual CSS path.
      const linkTag = `<link rel="stylesheet" href="/@duyo/enyo.css">`;

      return html.replace(
        /(<head[^>]*>)/i,
        `$1\n    ${linkTag}`
      );
    },

    // ----------------------------------------------------------------
    // Serve enyo-build.css as a static asset in dev mode
    // ----------------------------------------------------------------
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
