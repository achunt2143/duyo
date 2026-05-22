/**
 * createDuyoConfig(userConfig)
 *
 * A helper that returns a complete vite.config.js for a Duyo app.
 * Users can pass this directly or spread it into their own config.
 *
 * Usage in vite.config.js:
 *
 *   import { createDuyoConfig } from '@duyo/vite-plugin/create-config';
 *   export default createDuyoConfig({ appKind: 'MyApp.Application' });
 *
 */

import { duyo } from './index.js';

/**
 * @param {object} options
 * @param {string} [options.appKind]         - Top-level Enyo kind to render
 * @param {string} [options.renderTarget]    - DOM element ID (default: 'root')
 * @param {string} [options.outDir]          - Build output directory (default: 'dist')
 * @param {string} [options.base]            - Public base path (default: '/')
 * @param {object} [options.vite]            - Additional raw Vite config to merge in
 */
export function createDuyoConfig(options = {}) {
  const {
    appKind,
    renderTarget = 'root',
    outDir = 'dist',
    base = '/',
    vite: extraVite = {}
  } = options;

  return {
    base,
    plugins: [
      duyo({ appKind, renderTarget })
    ],
    build: {
      outDir,
      // Enyo is large — don't warn on chunk size for the runtime bundle
      chunkSizeWarningLimit: 1000,
      rollupOptions: {
        output: {
          // Keep the Enyo runtime as its own named chunk for caching
          manualChunks: {
            'enyo-runtime': ['@duyo/runtime']
          }
        }
      }
    },
    optimizeDeps: {
      // Tell Vite not to try to pre-bundle @duyo/runtime through esbuild
      // since it's a legacy script, not a proper ES module.
      exclude: ['@duyo/runtime']
    },
    ...extraVite
  };
}
