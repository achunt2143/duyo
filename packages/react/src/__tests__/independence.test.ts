import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const packages = resolve(__dirname, '../../..');

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (entry === '__tests__' || entry === 'node_modules') return [];
    return statSync(path).isDirectory() ? sources(path) : [path];
  });
}

/**
 * A UI library is a pack. The framework must not know any particular one exists, so that
 * anyone can add their own on equal terms.
 */
describe('the framework packages know no particular UI library', () => {
  for (const name of ['core', 'layout', 'react']) {
    it(`@duyo/${name} never mentions Mochi, Remochi or Onyx`, () => {
      const offenders = sources(join(packages, name, 'src')).filter((file) =>
        /mochi|onyx/i.test(readFileSync(file, 'utf8')),
      );
      expect(offenders).toEqual([]);
    });

    it(`@duyo/${name} does not depend on any pack`, () => {
      const manifest = JSON.parse(readFileSync(join(packages, name, 'package.json'), 'utf8'));
      const dependencies = Object.keys({
        ...manifest.dependencies,
        ...manifest.peerDependencies,
        ...manifest.devDependencies,
      });
      expect(dependencies.filter((d) => /mochi|onyx/.test(d))).toEqual([]);
    });
  }

  it('@duyo/remochi reaches the framework only through its public exports', () => {
    const files = sources(join(packages, 'remochi', 'src'));
    const imports = files.flatMap((file) =>
      [...readFileSync(file, 'utf8').matchAll(/from '(@duyo\/[^']+)'/g)].map((m) => m[1]!),
    );
    // No deep imports into another package's source.
    expect(imports.filter((i) => /^@duyo\/[^/]+\/.+/.test(i))).toEqual([]);
    expect(new Set(imports)).toEqual(new Set(['@duyo/react', '@duyo/core']));
  });

  it('@duyo/onyx reaches the framework only through its public exports, and knows no other pack', () => {
    const files = sources(join(packages, 'onyx', 'src'));
    const imports = files.flatMap((file) =>
      [...readFileSync(file, 'utf8').matchAll(/from '(@duyo\/[^']+)'/g)].map((m) => m[1]!),
    );
    expect(imports.filter((i) => /^@duyo\/[^/]+\/.+/.test(i))).toEqual([]);
    expect(new Set(imports)).toEqual(new Set(['@duyo/react', '@duyo/core']));
    const text = (list: string[]) => list.map((file) => readFileSync(file, 'utf8')).join('\n');
    expect(text(files)).not.toMatch(/from 'remochi'|@duyo\/remochi/);
    // and the other way round: Remochi's pack does not know Onyx
    expect(text(sources(join(packages, 'remochi', 'src')))).not.toMatch(/@duyo\/onyx|from 'onyx'/);
  });
});

/**
 * A package ships its source, so an app compiles it with the app's own settings, and an app that has not turned on
 * the automatic JSX runtime would compile `<div>` to `React.createElement`, which a file that does not import React
 * then fails on ("React is not defined"). A pragma in each file says how it is compiled, whatever the app does.
 */
describe('the packages that ship JSX say how it is compiled', () => {
  // what the one package is made of (packages/duyo/package.json): the libraries are private, and the package is what is published
  const shipped: string[] = JSON.parse(readFileSync(join(packages, 'duyo', 'package.json'), 'utf8')).duyo.includes;

  it('finds the packages it should', () => {
    expect(shipped).toEqual(expect.arrayContaining(['react', 'remochi', 'onyx']));
  });

  for (const name of shipped) {
    it(`every .tsx file of @duyo/${name} has the automatic JSX runtime pragma`, () => {
      const offenders = sources(join(packages, name, 'src')).filter(
        (file) => file.endsWith('.tsx') && !/@jsxRuntime\s+automatic/.test(readFileSync(file, 'utf8').slice(0, 400)),
      );
      expect(offenders).toEqual([]);
    });
  }
});
