'use strict';

/**
 * @duyo/vite-plugin — CommonJS build
 *
 * Mirror of index.js for toolchains that load vite configs via require().
 */

const { readFileSync, existsSync, readdirSync, statSync } = require('fs');
const { resolve, dirname, join, extname } = require('path');

const RUNTIME_ROOT = resolve(__dirname, '../../runtime');
const FRAMEWORK_ROOT = resolve(RUNTIME_ROOT, 'framework');
const SRC_ROOT = resolve(FRAMEWORK_ROOT, 'src');

const VIRTUAL_APP_ID = 'virtual:duyo-app';
const RESOLVED_VIRTUAL_APP_ID = '\0' + VIRTUAL_APP_ID;
const VIRTUAL_RUNTIME_ID = 'virtual:duyo-runtime';
const RESOLVED_VIRTUAL_RUNTIME_ID = '\0' + VIRTUAL_RUNTIME_ID;

function collectSrcFiles(dir, files = []) {
  if (!existsSync(dir)) return files;
  for (const entry of readdirSync(dir).sort()) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      collectSrcFiles(full, files);
    } else if (extname(entry) === '.js') {
      files.push(full);
    }
  }
  return files;
}

function buildEnyoScript() {
  const files = collectSrcFiles(SRC_ROOT);

  if (files.length === 0) {
    return [
      '// @duyo/runtime — Enyo 2.7 source not found.',
      '// Run the setup commands in packages/runtime/ENYO_SETUP.md first.',
      'window.enyo = window.enyo || {};',
      'console.error("[duyo] Enyo 2.7 source not found. See ENYO_SETUP.md.");',
    ].join('\n');
  }

  const parts = [
    '// @duyo/runtime — Enyo 2.7, served as classic script (non-strict)',
    '',
    'window.enyo = window.enyo || {};',
    'var enyo = window.enyo;',
    '',
  ];

  for (const filePath of files) {
    parts.push(`// === ${filePath.replace(SRC_ROOT, '')} ===`);
    parts.push(readFileSync(filePath, 'utf-8'));
    parts.push('');
  }

  return parts.join('\n');
}

function buildEnyoCss() {
  function collectCss(dir, files = []) {
    if (!existsSync(dir)) return files;
    for (const entry of readdirSync(dir).sort()) {
      const full = join(dir, entry);
      const stat = statSync(full);
      if (stat.isDirectory()) collectCss(full, files);
      else if (extname(entry) === '.css') files.push(full);
    }
    return files;
  }
  return collectCss(SRC_ROOT).map(f => readFileSync(f, 'utf-8')).join('\n');
}

function duyo(options = {}) {
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
        return [
          '// @duyo/runtime shim — Enyo 2.7 loaded as a classic script',
          'export var enyo = window.enyo;',
          'export default window.enyo;',
        ].join('\n');
      }
      if (id === RESOLVED_VIRTUAL_APP_ID) {
        if (!appKind) return `import '@duyo/runtime';\nexport {};`;
        return [
          `import '@duyo/runtime';`,
          `window.addEventListener('load', function() {`,
          `  var target = document.getElementById('${renderTarget}');`,
          `  if (!target) { console.error('[duyo] Render target #${renderTarget} not found.'); return; }`,
          `  try {`,
          `    var app = window.enyo.create({ kind: '${appKind}' });`,
          `    app.renderInto(target);`,
          `  } catch (e) {`,
          `    console.error('[duyo] Failed to render ${appKind}:', e);`,
          `  }`,
          `});`,
        ].join('\n');
      }
    },

    transformIndexHtml(html) {
      let inject = `\n    <script src="/@duyo/enyo.js"></script>`;
      if (injectCss) inject += `\n    <link rel="stylesheet" href="/@duyo/enyo.css">`;
      return html.replace(/(<head[^>]*>)/i, '$1' + inject);
    },

    configureServer(server) {
      server.middlewares.use('/@duyo/enyo.js', (_req, res) => {
        res.setHeader('Content-Type', 'application/javascript');
        res.end(buildEnyoScript());
      });
      server.middlewares.use('/@duyo/enyo.css', (_req, res) => {
        res.setHeader('Content-Type', 'text/css');
        res.end(buildEnyoCss());
      });
    },

    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'enyo.js', source: buildEnyoScript() });
      if (injectCss) {
        this.emitFile({ type: 'asset', fileName: 'enyo.css', source: buildEnyoCss() });
      }
    },
  };
}

module.exports = { duyo };
module.exports.default = duyo;
