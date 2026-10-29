import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

import { clone, cloneSource, commitAll, compareUrl, git, newBranch, parseStatus, push, repoInfo, repoName, validBranch } from '../git.js';

describe('git helpers', () => {
  it('parse status, relative to the project folder, skipping rename sources', () => {
    const text = [' M src/A.view.json', '?? src/B.ts', 'R  src/C.ts', 'src/Old.ts', ''].join('\0');
    expect(parseStatus(text, 'src/')).toEqual([
      { status: ' M', path: 'A.view.json' },
      { status: '??', path: 'B.ts' },
      { status: 'R ', path: 'C.ts' },
    ]);
  });

  it('find the GitHub pull request page for https and ssh remotes', () => {
    expect(compareUrl('https://github.com/achunt2143/duyo.git', 'feat/x')).toBe('https://github.com/achunt2143/duyo/compare/feat%2Fx?expand=1');
    expect(compareUrl('git@github.com:achunt2143/duyo.git', 'main')).toBe('https://github.com/achunt2143/duyo/compare/main?expand=1');
    expect(compareUrl('https://gitlab.com/a/b.git', 'main')).toBeUndefined();
  });

  it('clone only git URLs and local folders, never options or other transports', () => {
    expect(cloneSource('https://github.com/achunt2143/duyo.git')).toBeDefined();
    expect(cloneSource('git@github.com:achunt2143/duyo.git')).toBeDefined();
    expect(cloneSource('--upload-pack=touch /tmp/x')).toBeUndefined();
    expect(cloneSource('ext::sh -c touch% /tmp/pwned')).toBeUndefined();
    expect(cloneSource('http://example.com/x.git')).toBeUndefined();
    expect(repoName('https://github.com/achunt2143/duyo.git')).toBe('duyo');
  });

  it('accept branch names git would, and nothing that reads as an option', () => {
    expect(validBranch('feat/designer-views')).toBe(true);
    for (const bad of ['-f', '--force', 'a..b', 'x.lock', 'x/', '']) expect(validBranch(bad), bad).toBe(false);
  });
});

describe('a project in git, end to end', () => {
  const base = mkdtempSync(join(tmpdir(), 'duyo-git-'));
  afterAll(() => rmSync(base, { recursive: true, force: true }));

  it('clones, sees changes in its folder only, commits, branches and pushes', async () => {
    const remote = join(base, 'remote.git');
    const seed = join(base, 'seed');
    await git(base, ['init', '--bare', '-b', 'main', remote]);
    mkdirSync(join(seed, 'app', 'src'), { recursive: true });
    await git(base, ['init', '-b', 'main', seed]);
    for (const args of [['config', 'user.email', 't@example.com'], ['config', 'user.name', 'T']]) await git(seed, args);
    writeFileSync(join(seed, 'app', 'src', 'A.view.json'), '{}');
    writeFileSync(join(seed, 'README.md'), 'hi');
    await git(seed, ['add', '-A']);
    await git(seed, ['commit', '-m', 'seed']);
    await git(seed, ['remote', 'add', 'origin', remote]);
    expect((await git(seed, ['push', '-u', 'origin', 'main'])).ok).toBe(true);

    const work = join(base, 'work');
    expect((await clone(remote, work)).ok).toBe(true);
    for (const args of [['config', 'user.email', 't@example.com'], ['config', 'user.name', 'T']]) await git(work, args);
    const project = join(work, 'app');

    writeFileSync(join(project, 'src', 'A.view.json'), '{"name":"A"}');
    writeFileSync(join(project, 'src', 'B.ts'), 'x');
    writeFileSync(join(work, 'README.md'), 'changed outside the project');
    const before = await repoInfo(project);
    expect(before.branch).toBe('main');
    expect(before.changes.map((c) => c.path).sort()).toEqual(['src/A.view.json', 'src/B.ts']);

    expect((await newBranch(project, 'feat/a')).ok).toBe(true);
    expect((await commitAll(project, 'Design A')).ok).toBe(true);
    const after = await repoInfo(project);
    expect(after.changes).toEqual([]);
    expect(after.branch).toBe('feat/a');

    expect((await push(project)).ok).toBe(true);
    expect((await git(remote, ['log', '--oneline', 'feat/a'])).out).toContain('Design A');
    // The change outside the project folder was not committed.
    expect((await git(work, ['status', '--porcelain'])).out).toContain('README.md');
  }, 60_000);
});
