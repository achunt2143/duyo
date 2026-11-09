import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// @ts-expect-error: a plain script, `npm run rename`
import { isPackageName, renameInText, renamedManifest } from '../scripts/rename.mjs';
// @ts-expect-error: a plain script, shared with `prepack` and the smoke test
import { assemble, derivedBin, derivedDependencies, derivedExports, derivedPeers, filesUnder, includes, manifest, readmeExample, rewrite, root } from '../scripts/assemble.mjs';

const REWRITTEN = /\.(ts|tsx|js|mjs)$/;

describe('the README example the smoke test compiles', () => {
  const fence = String.fromCharCode(96).repeat(3);
  const code = ["import { kind } from 'duyo';", "kind({ name: 'A' });"];
  const readme = ['Intro', '', `${fence}sh`, 'npm install duyo', fence, '', `${fence}tsx`, ...code, fence, '', 'After.', ''].join('\n');
  const example = `${code.join('\n')}\n`;

  it('is found in a README with Unix line endings', () => {
    expect(readmeExample(readme)).toBe(example);
  });

  it('is found in a README with Windows line endings, as a checkout on Windows has', () => {
    expect(readmeExample(readme.split('\n').join('\r\n'))).toBe(example);
  });

  it('is the one in the package README, whichever line endings it has', () => {
    const real = readFileSync(join(root, 'README.md'), 'utf8').split('\r\n').join('\n');
    expect(readmeExample(real)).toContain(`from '${manifest().name}/onyx'`);
    expect(readmeExample(real.split('\n').join('\r\n'))).toBe(readmeExample(real));
  });

  it('says so when there is none', () => {
    expect(() => readmeExample('no code here')).toThrow('tsx example');
  });
});

describe('renaming the package', () => {
  const docs = [
    "import { kind } from 'duyojs';",
    "import { renderInto } from 'duyojs/react';",
    "import 'duyojs/onyx/css';",
    "declare module 'duyojs' {}",
    'npm install duyojs react react-dom',
    'npm run smoke -w duyojs',
    'the package `duyojs` and `duyojs/views/vite`',
    '# duyojs',
  ].join('\n');

  it('writes the new name where an app uses the old one', () => {
    expect(renameInText(docs, 'duyojs', '@duyojs/duyo')).toBe(
      [
        "import { kind } from '@duyojs/duyo';",
        "import { renderInto } from '@duyojs/duyo/react';",
        "import '@duyojs/duyo/onyx/css';",
        "declare module '@duyojs/duyo' {}",
        'npm install @duyojs/duyo react react-dom',
        'npm run smoke -w @duyojs/duyo',
        'the package `@duyojs/duyo` and `@duyojs/duyo/views/vite`',
        '# @duyojs/duyo',
      ].join('\n'),
    );
  });

  it('leaves what is not the package alone: the workspaces, the command, the kinds, the config, the folder', () => {
    const same = [
      "import { kind } from '@duyo/core';",
      'the workspace `@duyo/react`, the command `duyo-views`, and duyo.config.json',
      "kind: 'duyo.FittableRows'",
      'see [packages/duyo](../duyo) and packages/duyo/scripts',
      'npm run smoke -w duyojs-other',
      'create-duyo/templates',
    ].join('\n');
    expect(renameInText(same, 'duyo', 'duyojs')).toBe(same);
    expect(renameInText(same, 'duyojs', '@duyojs/duyo')).toBe(same);
  });

  it('goes back and forth, between a scoped name and a plain one', () => {
    const scoped = renameInText(docs, 'duyojs', '@duyojs/duyo');
    expect(renameInText(scoped, '@duyojs/duyo', 'duyojs')).toBe(docs);
  });

  it('knows a valid package name', () => {
    for (const ok of ['duyo', 'duyojs', '@duyojs/duyo', 'duyo-framework']) expect(isPackageName(ok), ok).toBe(true);
    for (const bad of ['', 'Duyo', '@duyojs', '@/duyo', 'du yo', 'duyo/react']) expect(isPackageName(bad), bad).toBe(false);
  });

  it('makes a scoped package public, as npm would otherwise publish it as private, and an unscoped one needs nothing', () => {
    const current = { name: 'duyojs', version: '1.1.0', engines: { node: '>=18' }, bin: { x: 'y' } };
    const scoped = renamedManifest(current, '@duyojs/duyo');
    expect(scoped.name).toBe('@duyojs/duyo');
    expect(scoped.publishConfig).toEqual({ access: 'public' });
    expect(Object.keys(scoped)).toEqual(['name', 'version', 'engines', 'publishConfig', 'bin']);
    const plain = renamedManifest(scoped, 'duyo');
    expect(plain.name).toBe('duyo');
    expect(plain.publishConfig).toBeUndefined();
  });

  it('has public access in package.json if the package is scoped', () => {
    const { name, publishConfig } = manifest();
    if (name.startsWith('@')) expect(publishConfig).toEqual({ access: 'public' });
  });
});

describe('the scripts of the one package', () => {
  it('start with no shebang: with Windows line endings its carriage return breaks them under the test runner, and they are run as node scripts/<name>.mjs', () => {
    for (const script of ['assemble.mjs', 'smoke.mjs']) {
      expect(readFileSync(join(root, 'scripts', script), 'utf8').startsWith('#!'), script).toBe(false);
    }
  });
});

describe('the one package', () => {
  let lib: string;
  let files: string[];
  beforeAll(() => {
    lib = assemble(mkdtempSync(join(tmpdir(), 'duyo-assemble-')));
    files = filesUnder(lib);
  });
  afterAll(() => rmSync(lib, { recursive: true, force: true }));

  it('is the one package: the libraries of the repository, in the order of their layers', () => {
    expect(includes()).toEqual(['core', 'layout', 'react', 'views', 'remochi', 'onyx']);
    expect(manifest().name).toMatch(/^(@[a-z0-9][\w.-]*\/)?[a-z0-9][\w.-]*$/);
  });

  it('names the libraries as the package itself: @duyo/core is the package, and the others are subpaths', () => {
    const pkg = manifest().name;
    expect(rewrite("import { kind } from '@duyo/core';")).toBe(`import { kind } from '${pkg}';`);
    expect(rewrite("import { adapt } from '@duyo/react';")).toBe(`import { adapt } from '${pkg}/react';`);
    expect(rewrite("import '@duyo/onyx/css';")).toBe(`import '${pkg}/onyx/css';`);
    expect(rewrite("declare module '@duyo/core' {}")).toBe(`declare module '${pkg}' {}`);
    // the name is a parameter, so a package under another name is written under that one
    expect(rewrite("import { kind } from '@duyo/core';", undefined, 'other')).toBe("import { kind } from 'other';");
    // a name that only starts like one of them is left alone
    expect(rewrite('@duyo/coreish and @duyo/vite-plugin')).toBe('@duyo/coreish and @duyo/vite-plugin');
  });

  it('leaves no name of the old packages in the code it ships', () => {
    const left = files.filter((file) => REWRITTEN.test(file) && /@duyo\//.test(readFileSync(file, 'utf8')));
    expect(left).toEqual([]);
  });

  it('ships no tests, and every library\'s source', () => {
    expect(files.filter((file) => /__tests__|\.test\./.test(file))).toEqual([]);
    for (const name of includes()) expect(existsSync(join(lib, name, 'src'))).toBe(true);
    expect(existsSync(join(lib, 'views', 'bin', 'duyo-views.js'))).toBe(true);
  });

  it('exports what the libraries export, each pointing at a file that is there', () => {
    const exported = manifest().exports as Record<string, unknown>;
    expect(exported).toEqual(derivedExports());
    const targets = (value: unknown): string[] => (typeof value === 'string' ? [value] : Object.values(value as object).flatMap(targets));
    for (const target of Object.values(exported).flatMap(targets)) {
      if (target === './package.json') continue;
      expect(existsSync(join(lib, target.replace(/^\.\/lib\//, ''))), target).toBe(true);
    }
    expect(Object.keys(exported)).toEqual(expect.arrayContaining(['.', './react', './layout', './views', './views/vite', './remochi', './remochi/css', './onyx', './onyx/css']));
  });

  it('has the commands of the libraries', () => {
    expect(manifest().bin).toEqual(derivedBin());
    expect(Object.keys(manifest().bin)).toEqual(['duyo-views']);
  });

  it('asks the app for React, and for Remochi and Vite only if it uses them, and installs nothing else', () => {
    expect(manifest().peerDependencies).toEqual(derivedPeers());
    expect(Object.keys(manifest().peerDependencies)).toEqual(['react', 'react-dom', 'remochi', 'vite']);
    expect(manifest().peerDependenciesMeta).toEqual({ remochi: { optional: true }, vite: { optional: true } });
    expect(derivedDependencies()).toEqual({});
    expect(manifest().dependencies).toBeUndefined();
  });

  it('ships its licence and the notice for what Onyx is made from', () => {
    for (const file of ['LICENSE', 'NOTICE', 'README.md', 'CHANGELOG.md']) expect(existsSync(join(root, file))).toBe(true);
    expect(manifest().files).toEqual(expect.arrayContaining(['lib/', 'NOTICE']));
    expect(readFileSync(join(root, 'NOTICE'), 'utf8')).toMatch(/enyojs\/onyx[\s\S]*enyojs\/enyo-1\.0/);
  });

  it('is not one of the packages it is made of: those are the repository\'s, and are not published', () => {
    for (const name of includes()) {
      const library = JSON.parse(readFileSync(join(root, '..', name, 'package.json'), 'utf8'));
      expect(library.private, `@duyo/${name} should be private`).toBe(true);
    }
  });
});
