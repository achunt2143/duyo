// Proves the package the way an app would meet it. Run it before a release:   npm run smoke -w duyojs
//
// It packs the package, installs the tarball into a new project in the temp folder (outside this repository), and in that project:
//   - writes the code of the README's first example, and a view with its code-behind,
//   - runs `duyo-views` to write the view's types, and again with --check,
//   - compiles everything with TypeScript, strictly, with unused names an error (what a Vite app turns on),
//   - builds it with Vite, using the `<package>/views/vite` plugin.
// It needs the network, to install React, Vite and TypeScript. It prints the folder; --keep leaves it there.
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { manifest, readmeExample } from './assemble.mjs';

const root = resolve(fileURLToPath(import.meta.url), '..', '..');
const keep = process.argv.includes('--keep');
/** The package's name: the one place it is written is package.json. */
const PKG = manifest().name;
const work = mkdtempSync(join(tmpdir(), 'duyo-smoke-'));
const app = join(work, 'app');
const windows = process.platform === 'win32';

function run(command, args, cwd, label) {
  const started = Date.now();
  const result = spawnSync(windows && command !== 'node' ? `${command}.cmd` : command, args, { cwd, encoding: 'utf8', shell: windows, env: { ...process.env, npm_config_audit: 'false', npm_config_fund: 'false' } });
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`.trim();
  if (result.status !== 0) {
    console.error(`FAILED: ${label}\n${output}`);
    throw new Error(label);
  }
  console.log(`ok  ${label} (${((Date.now() - started) / 1000).toFixed(1)}s)`);
  return output;
}

function write(path, text) {
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, text.split('__PKG__').join(PKG));
}

try {
  // 1. the tarball: `npm pack` runs prepack, which assembles lib/
  const packed = run('npm', ['pack', '--pack-destination', work, '--silent'], root, 'npm pack (assembles lib/ and packs it)').split(/\r?\n/).pop().trim();
  const tarball = join(work, packed);

  // 2. a new project that uses it
  const example = readmeExample(readFileSync(join(root, 'README.md'), 'utf8'));
  write(join(app, 'package.json'), JSON.stringify({
    name: 'duyo-smoke', private: true, type: 'module',
    dependencies: { [PKG]: `file:${tarball.replace(/\\/g, '/')}`, react: '^18.3.1', 'react-dom': '^18.3.1', remochi: '^0.4.0' },
    devDependencies: { '@types/react': '^18.3.0', '@types/react-dom': '^18.3.0', typescript: '^5.6.0', vite: '^6.0.0' },
  }, null, 2));
  write(join(app, 'index.html'), '<!doctype html><html><head><meta charset="utf-8"><title>smoke</title><style>html,body,#root{height:100%;margin:0}</style></head><body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body></html>\n');
  write(join(app, 'tsconfig.json'), JSON.stringify({
    compilerOptions: { target: 'ES2022', module: 'ESNext', moduleResolution: 'bundler', jsx: 'react-jsx', lib: ['ES2022', 'DOM', 'DOM.Iterable'], strict: true, noUnusedLocals: true, noUnusedParameters: true, noFallthroughCasesInSwitch: true, resolveJsonModule: true, skipLibCheck: true, noEmit: true, types: ['vite/client'] },
    include: ['src'],
  }, null, 2));
  write(join(app, 'vite.config.mjs'), "import { duyoViews } from '__PKG__/views/vite';\nimport { defineConfig } from 'vite';\nexport default defineConfig({ plugins: [duyoViews()] });\n");
  write(join(app, 'src', 'readme.tsx'), example);
  write(join(app, 'src', 'Hello.view.json'), JSON.stringify({
    name: 'Smoke.Hello', kind: 'duyo.FittableRows', fill: true,
    components: [
      { kind: 'onyx.Header', content: 'Hello' },
      { kind: 'onyx.Item', name: 'row', content: 'A row', ontap: 'tapped', fit: true },
      { kind: 'remochi.Button', name: 'go', content: 'Go', ontap: 'go' },
    ],
  }, null, 2));
  write(join(app, 'src', 'Hello.ts'), "import { view } from '__PKG__';\n\nimport spec from './Hello.view.json';\nimport type { CodeBehind } from './Hello.view.gen.js';\n\nexport default view(spec, {\n  tapped() {\n    this.$.row.setContent('Tapped');\n  },\n  go() {\n    this.$.row.setContent('Go');\n  },\n} satisfies CodeBehind);\n");
  write(join(app, 'src', 'main.tsx'), "import '__PKG__/onyx/css';\nimport '__PKG__/remochi/css';\n\nimport { createRuntime, defaultKindRegistry } from '__PKG__';\nimport { basePack, createRenderer, installPack, renderInto } from '__PKG__/react';\nimport { createOnyxPack } from '__PKG__/onyx';\nimport { createRemochiPack } from '__PKG__/remochi';\n\nimport './Hello.js';\n\nconst packs = [basePack, createRemochiPack({ theme: false }), createOnyxPack({ body: false })];\npacks.forEach((pack) => installPack(defaultKindRegistry, pack));\nrenderInto(createRuntime().create({ kind: 'Smoke.Hello' }), createRenderer(packs), document.getElementById('root')!);\n(window as unknown as { __ok: boolean }).__ok = true;\n");

  run('npm', ['install', '--no-audit', '--no-fund'], app, 'npm install the tarball into a new project');
  const installed = readdirSync(join(app, 'node_modules')).filter((name) => name === PKG || name.startsWith('@duyo'));
  if (installed.join() !== PKG) throw new Error(`expected only ${PKG} to be installed, found: ${installed.join(', ')}`);
  console.log(`ok  only \`${PKG}\` is installed (no @duyo/* packages came with it)`);

  run('npx', ['duyo-views', 'src'], app, 'duyo-views writes the view\'s types');
  run('npx', ['duyo-views', 'src', '--check'], app, 'duyo-views --check');
  run('npx', ['tsc', '--noEmit'], app, 'tsc, strict, with unused names an error');
  run('npx', ['vite', 'build'], app, `vite build, with the ${PKG}/views/vite plugin`);
  console.log(`\nThe package works in a new app. ${keep ? `Kept: ${app}` : ''}`);
} finally {
  if (!keep) rmSync(work, { recursive: true, force: true });
}
