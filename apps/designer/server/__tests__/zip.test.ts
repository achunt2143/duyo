import { strToU8, unzipSync, zipSync } from 'fflate';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { nameInZip, unzipProject, zipProject } from '../zip.js';

const temp: string[] = [];
const folder = () => {
  const dir = mkdtempSync(join(tmpdir(), 'duyo-zip-'));
  temp.push(dir);
  return dir;
};
afterEach(() => temp.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true })));

describe('project zips', () => {
  it('pack a project under its name, without dependencies, output or git', () => {
    const root = folder();
    for (const [path, text] of [['package.json', '{"name":"@me/shop"}'], ['src/A.view.json', '{}'], ['node_modules/x/i.js', ''], ['dist/a.js', ''], ['.git/HEAD', '']]) {
      mkdirSync(join(root, path, '..'), { recursive: true });
      writeFileSync(join(root, path), text);
    }
    const names = Object.keys(unzipSync(zipProject(root, 'shop')));
    expect(names.sort()).toEqual(['shop/package.json', 'shop/src/A.view.json']);
  });

  it('round-trip, dropping the single top folder GitHub downloads have', () => {
    const zip = zipSync({ 'repo-main/package.json': strToU8('{"name":"@me/shop"}'), 'repo-main/src/A.view.json': strToU8('{"name":"A"}') });
    const dest = folder();
    expect(unzipProject(zip, dest)).toEqual({ files: 2, skipped: [] });
    expect(readFileSync(join(dest, 'src/A.view.json'), 'utf8')).toBe('{"name":"A"}');
    expect(nameInZip(zip)).toBe('shop');
  });

  it('refuse entries that would land outside the folder', () => {
    const zip = zipSync({ '../evil.txt': strToU8('x'), 'ok.txt': strToU8('y'), 'a/../../evil2.txt': strToU8('z') });
    const dest = join(folder(), 'project');
    mkdirSync(dest);
    const result = unzipProject(zip, dest);
    expect(result.files).toBe(1);
    expect(result.skipped.sort()).toEqual(['../evil.txt', 'a/../../evil2.txt']);
    expect(existsSync(join(dest, '..', 'evil.txt'))).toBe(false);
  });

  it('skip dependencies and git folders inside the zip', () => {
    const zip = zipSync({ 'node_modules/x.js': strToU8(''), '.git/config': strToU8(''), 'src/a.ts': strToU8('') });
    const dest = folder();
    expect(unzipProject(zip, dest).files).toBe(1);
  });
});
