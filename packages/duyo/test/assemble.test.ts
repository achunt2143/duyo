import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// @ts-expect-error: a plain script, shared with `prepack`
import { assemble, derivedBin, derivedDependencies, derivedExports, derivedPeers, filesUnder, includes, manifest, rewrite, root } from '../scripts/assemble.mjs';

const REWRITTEN = /\.(ts|tsx|js|mjs)$/;

describe('the duyo package', () => {
  let lib: string;
  let files: string[];
  beforeAll(() => {
    lib = assemble(mkdtempSync(join(tmpdir(), 'duyo-assemble-')));
    files = filesUnder(lib);
  });
  afterAll(() => rmSync(lib, { recursive: true, force: true }));

  it('is the one package: the libraries of the repository, in the order of their layers', () => {
    expect(includes()).toEqual(['core', 'layout', 'react', 'views', 'remochi', 'onyx']);
    expect(manifest().name).toBe('duyo');
  });

  it('names the libraries as the package itself: @duyo/core is duyo, and the others are subpaths', () => {
    expect(rewrite("import { kind } from '@duyo/core';")).toBe("import { kind } from 'duyo';");
    expect(rewrite("import { adapt } from '@duyo/react';")).toBe("import { adapt } from 'duyo/react';");
    expect(rewrite("import '@duyo/onyx/css';")).toBe("import 'duyo/onyx/css';");
    expect(rewrite("declare module '@duyo/core' {}")).toBe("declare module 'duyo' {}");
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
