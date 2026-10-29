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
    it(`@duyo/${name} never mentions Mochi or Remochi`, () => {
      const offenders = sources(join(packages, name, 'src')).filter((file) =>
        /mochi/i.test(readFileSync(file, 'utf8')),
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
      expect(dependencies.filter((d) => /mochi/.test(d))).toEqual([]);
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
});
