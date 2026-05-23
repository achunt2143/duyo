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
 * tag injected into index.html *before* any module scripts run.
 *
 * If build/enyo.js does not exist (e.g. fresh checkout), the plugin runs
 * the Rollup build automatically from the runtime's rollup.config.mjs so
 * developers never need a manual build step.
 *
 * Build output expected at:
 *   packages/runtime/build/enyo.js    <- JS bundle (IIFE)
 *   packages/runtime/build/enyo.css   <- CSS bundle
 */

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));

const RUNTIME_ROOT = resolve(__dirname, '../../runtime');
const BUILD_ROOT   = resolve(RUNTIME_ROOT, 'build');
const BUILT_JS     = resolve(BUILD_ROOT, 'enyo.js');
const BUILT_CSS    = resolve(BUILD_ROOT, 'enyo.css');

const VIRTUAL_APP_ID              = 'virtual:duyo-app';
const RESOLVED_VIRTUAL_APP_ID     = '\0' + VIRTUAL_APP_ID;
const VIRTUAL_RUNTIME_ID          = 'virtual:duyo-runtime';
const RESOLVED_VIRTUAL_RUNTIME_ID = '\0' + VIRTUAL_RUNTIME_ID;

// ---------------------------------------------------------------------------
// Build helpers
// ---------------------------------------------------------------------------

/**
 * Run `rollup -c` inside packages/runtime to produce build/enyo.js.
 * Uses the locally installed rollup binary from the monorepo root.
 */
function buildRuntime() {
  console.log('[duyo] build/enyo.js not found — running rollup build...');
  const monorepoRoot = resolve(RUNTIME_ROOT, '../..');
  const rollupBin = resolve(monorepoRoot, 'node_modules/.bin/rollup');
  const bin = existsSync(rollupBin) ? rollupBin : 'rollup';
  try {
    execFileSync(bin, ['-c', 'rollup.config.mjs'], {
      cwd: RUNTIME_ROOT,
      stdio: 'inherit',
    });
    console.log('[duyo] rollup build complete.');
  } catch (e) {
    console.error('[duyo] rollup build failed:', e.message);
  }
}

function readBuiltJs() {
  if (!existsSync(BUILT_JS)) buildRuntime();
  if (!existsSync(BUILT_JS)) {
    return [
      '// @duyo/runtime — build/enyo.js not found and auto-build failed.',
      '// Run `npm run build` manually in packages/runtime.',
      'window.enyo = window.enyo || {};',
      'console.error("[duyo] build/enyo.js missing. Run `npm run build` in packages/runtime.");',
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
    appKind      = null,
    renderTarget = 'root',
    injectCss    = true,
  } = options;

  return {
    name: 'duyo',
    enforce: 'pre',

    // ------------------------------------------------------------------
    // Module resolution
    // ------------------------------------------------------------------
    resolveId(id) {
      if (id === VIRTUAL_APP_ID)     return RESOLVED_VIRTUAL_APP_ID;
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
    // ready when module scripts execute.
    // ------------------------------------------------------------------
    transformIndexHtml(html) {
      let inject = `\n    <script src="/@duyo/enyo.js"></script>`;
      if (injectCss) inject += `\n    <link rel="stylesheet" href="/@duyo/enyo.css">`;
      return html.replace(/(<head[^>]*>)/i, '$1' + inject);
    },

    // ------------------------------------------------------------------
    // Dev server — serve the built files (auto-building if needed)
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
