import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

import { describe as describeProject, projectRootFor } from '../project.js';

const base = mkdtempSync(join(tmpdir(), 'duyo-project-'));
afterAll(() => rmSync(base, { recursive: true, force: true }));

describe('projects', () => {
  const app = join(base, 'shop');
  mkdirSync(join(app, 'src', 'views'), { recursive: true });
  writeFileSync(join(app, 'package.json'), '{ "name": "@me/shop" }');
  writeFileSync(join(app, 'duyo.config.json'), '{ "views": "src", "kinds": "src/kinds.ts" }');
  writeFileSync(join(app, 'src', 'kinds.ts'), '');

  it('a folder inside a project opens the project', () => {
    expect(projectRootFor(join(app, 'src', 'views'))).toBe(app);
    expect(projectRootFor(app)).toBe(app);
  });

  it('a folder in no project opens as itself', () => {
    const loose = join(base, 'loose');
    mkdirSync(loose);
    expect(projectRootFor(loose)).toBe(loose);
  });

  it('reads duyo.config.json and the package name', () => {
    const info = describeProject(join(app, 'src'));
    expect(info.root).toBe(app);
    expect(info.name).toBe('@me/shop');
    expect(info.source).toBe(join(app, 'src'));
    expect(info.kindsFile).toBe(join(app, 'src', 'kinds.ts'));
    expect(info.hasConfig).toBe(true);
  });

  it('keeps the views folder and kinds module inside the project', () => {
    const odd = join(base, 'odd');
    mkdirSync(odd);
    writeFileSync(join(odd, 'duyo.config.json'), '{ "views": "../shop/src", "kinds": "../shop/src/kinds.ts" }');
    const info = describeProject(odd);
    expect(info.source).toBe(odd);
    expect(info.kindsFile).toBeUndefined();
  });
});
