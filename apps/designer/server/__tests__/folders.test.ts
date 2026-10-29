import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

import { listFolders, places } from '../folders.js';

const base = mkdtempSync(join(tmpdir(), 'duyo-folders-'));
afterAll(() => rmSync(base, { recursive: true, force: true }));

const make = (path: string, files: Record<string, string> = {}) => {
  mkdirSync(join(base, path), { recursive: true });
  for (const [name, text] of Object.entries(files)) writeFileSync(join(base, path, name), text);
};

describe('folder listing', () => {
  make('shop', { 'package.json': '{}' });
  make('shop/src');
  make('shop/src/.hidden');
  make('shop/node_modules/x');
  make('notes');
  writeFileSync(join(base, 'a-file.txt'), '');
  make('app', { 'duyo.config.json': '{}' });

  it('lists folders only, sorted, with project and git flags', () => {
    const listing = listFolders(base, base);
    expect(listing.path).toBe(resolve(base));
    expect(listing.entries.map((e) => e.name)).toEqual(['app', 'notes', 'shop']);
    expect(listing.entries.find((e) => e.name === 'shop')).toMatchObject({ project: true, git: false });
    expect(listing.entries.find((e) => e.name === 'app')).toMatchObject({ project: true });
    expect(listing.entries.find((e) => e.name === 'notes')).toMatchObject({ project: false });
    expect(listing.parent).toBe(dirname(resolve(base)));
  });

  it('hides dot folders and dependencies, and marks a repository top', () => {
    const names = listFolders(join(base, 'shop'), base).entries.map((e) => e.name);
    expect(names).toEqual(['src']);
    make('repo/.git');
    expect(listFolders(base, base).entries.find((e) => e.name === 'repo')?.git).toBe(true);
  });

  it('says so for a path that is not a folder', () => {
    expect(listFolders(join(base, 'a-file.txt'), base).error).toMatch(/not a folder/);
    expect(listFolders(join(base, 'nope'), base).error).toMatch(/not a folder/);
  });

  it('lists places to start from for an empty path, and leads there from the top of a drive', () => {
    const start = listFolders('', base);
    expect(start.path).toBe('');
    expect(start.parent).toBeUndefined();
    expect(start.entries.length).toBeGreaterThan(0);
    const top = resolve('/');
    expect(listFolders(top, base).parent).toBe('');
    expect(places(base).some((p) => p.path === resolve(base))).toBe(true);
  });
});
