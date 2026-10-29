import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { folderPath, insideRoot, kindOfFile, readableFile, writableFile } from '../paths.js';

const root = resolve('/project/src');

describe('project paths', () => {
  it('knows views, code and generated files', () => {
    expect(kindOfFile('views/A.view.json')).toBe('view');
    expect(kindOfFile('views/A.ts')).toBe('code');
    expect(kindOfFile('views/A.tsx')).toBe('code');
    expect(kindOfFile('views/A.view.gen.ts')).toBe('generated');
    expect(kindOfFile('types.d.ts')).toBeUndefined();
    expect(kindOfFile('package.json')).toBeUndefined();
    expect(kindOfFile('.env')).toBeUndefined();
  });

  it('stays inside the project', () => {
    expect(insideRoot(root, 'views/A.view.json')).toBe(resolve(root, 'views/A.view.json'));
    for (const path of ['../A.view.json', 'views/../../A.view.json', '/etc/A.view.json', 'C:/A.view.json', 'C:A.view.json', '', '.', 'a\0b', null]) {
      expect(insideRoot(root, path), String(path)).toBeUndefined();
    }
  });

  it('reads views, code and types; writes views and code only', () => {
    expect(readableFile(root, 'views/A.view.gen.ts')).toBeDefined();
    expect(writableFile(root, 'views/A.view.gen.ts')).toBeUndefined();
    expect(writableFile(root, 'views/A.ts')).toBeDefined();
    expect(writableFile(root, 'vite.config.json')).toBeUndefined();
    expect(readableFile(root, '../../secrets.ts')).toBeUndefined();
  });

  it('creates folders inside the project only', () => {
    expect(folderPath(root, 'views/settings')).toBeDefined();
    expect(folderPath(root, '../elsewhere')).toBeUndefined();
    expect(folderPath(root, 'bad|name')).toBeUndefined();
  });
});
