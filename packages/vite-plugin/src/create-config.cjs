'use strict';

/**
 * CJS wrapper for create-config — needed because Vite bundles vite.config.js
 * via esbuild which resolves the 'require' export condition.
 *
 * We use a dynamic import + synchronous-looking wrapper pattern: since
 * Vite 5+ actually supports async config, we export a function that returns
 * a plain object (no top-level await needed — createDuyoConfig is pure sync).
 */

const { duyo } = require('./index.cjs');

/**
 * @param {object} options
 */
function createDuyoConfig(options) {
  options = options || {};
  const appKind      = options.appKind;
  const renderTarget = options.renderTarget || 'root';
  const outDir       = options.outDir       || 'dist';
  const base         = options.base         || '/';
  const extraVite    = options.vite         || {};

  return Object.assign({
    base,
    plugins: [
      duyo({ appKind, renderTarget })
    ],
    build: {
      outDir,
      chunkSizeWarningLimit: 1000,
      rollupOptions: {
        output: {
          manualChunks: {
            'enyo-runtime': ['@duyo/runtime']
          }
        }
      }
    },
    optimizeDeps: {
      exclude: ['@duyo/runtime']
    }
  }, extraVite);
}

module.exports = { createDuyoConfig };
