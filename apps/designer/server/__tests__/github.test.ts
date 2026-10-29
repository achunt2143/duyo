import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { GithubError, githubToken, listRepos, parseCredential, toRepo } from '../github.js';

describe('credential output', () => {
  it('is read as fields, whatever the line endings', () => {
    expect(parseCredential('protocol=https\nhost=github.com\nusername=me\npassword=tok=en\n')).toEqual({ username: 'me', password: 'tok=en' });
    expect(parseCredential('username=me\r\npassword=x\r\n')).toEqual({ username: 'me', password: 'x' });
    expect(parseCredential('')).toEqual({});
  });
});

describe('repository objects', () => {
  const good = { full_name: 'me/shop', description: 'A shop', private: true, fork: false, pushed_at: '2026-10-01T00:00:00Z', clone_url: 'https://github.com/me/shop.git' };

  it('are reduced to what the picker shows', () => {
    expect(toRepo(good)).toEqual({ fullName: 'me/shop', description: 'A shop', private: true, fork: false, pushedAt: '2026-10-01T00:00:00Z', cloneUrl: 'https://github.com/me/shop.git' });
  });

  it('are dropped when they are incomplete or their clone URL is not one git would clone safely', () => {
    expect(toRepo({ ...good, full_name: undefined })).toBeUndefined();
    expect(toRepo({ ...good, clone_url: '--upload-pack=touch x' })).toBeUndefined();
    expect(toRepo({ ...good, clone_url: 'ext::sh -c id' })).toBeUndefined();
  });
});

describe('listing through the GitHub API', () => {
  let server: Server;
  let origin = '';
  const seen: Array<{ url: string; auth: string | undefined }> = [];
  let mode: 'ok' | 'paged' | 'unauthorized' | 'forbidden' = 'ok';

  const repo = (n: number) => ({ full_name: `me/repo${n}`, description: null, private: n % 2 === 0, fork: false, pushed_at: '2026-10-01T00:00:00Z', clone_url: `https://github.com/me/repo${n}.git` });

  beforeAll(async () => {
    server = createServer((request, response) => {
      seen.push({ url: request.url ?? '', auth: request.headers.authorization });
      if (mode === 'unauthorized') return void response.writeHead(401).end('{}');
      if (mode === 'forbidden') return void response.writeHead(403).end('{}');
      const url = new URL(request.url ?? '/', origin);
      response.setHeader('content-type', 'application/json');
      if (mode === 'paged' && url.searchParams.get('page') !== '2') {
        response.setHeader('link', `<${origin}/user/repos?page=2>; rel="next"`);
        return void response.end(JSON.stringify([repo(1), repo(2)]));
      }
      response.end(JSON.stringify(mode === 'paged' ? [repo(3)] : [repo(1), repo(2), { nonsense: true }]));
    });
    await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
    origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    process.env['DUYO_DESIGNER_GITHUB_API'] = origin;
  });
  afterAll(() => {
    delete process.env['DUYO_DESIGNER_GITHUB_API'];
    server.close();
  });
  afterEach(() => {
    seen.length = 0;
    mode = 'ok';
  });

  it('asks for the signed-in user\'s repositories with the token, and skips what it cannot use', async () => {
    const repos = await listRepos('tok123');
    expect(repos.map((r) => r.fullName)).toEqual(['me/repo1', 'me/repo2']);
    expect(repos[1]!.private).toBe(true);
    expect(seen[0]!.url).toContain('/user/repos?per_page=100&sort=pushed');
    expect(seen[0]!.auth).toBe('Bearer tok123');
  });

  it('follows pages', async () => {
    mode = 'paged';
    expect((await listRepos('t')).map((r) => r.fullName)).toEqual(['me/repo1', 'me/repo2', 'me/repo3']);
    expect(seen).toHaveLength(2);
  });

  it('explains a missing login without calling GitHub', async () => {
    await expect(listRepos(undefined)).rejects.toThrow(/no GitHub login/);
    expect(seen).toHaveLength(0);
  });

  it('explains a rejected or refused login', async () => {
    mode = 'unauthorized';
    await expect(listRepos('t')).rejects.toMatchObject({ status: 401, message: expect.stringContaining('did not accept') });
    mode = 'forbidden';
    await expect(listRepos('t')).rejects.toBeInstanceOf(GithubError);
  });
});

describe('the login git holds', () => {
  const base = mkdtempSync(join(tmpdir(), 'duyo-credential-'));
  const saved = { ...process.env };
  afterAll(() => {
    for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key];
    Object.assign(process.env, saved);
    rmSync(base, { recursive: true, force: true });
  });

  /** A credential helper that is a stand-in: git runs it exactly as it would a real one. */
  const useHelper = (script: string) => {
    const file = join(base, 'helper.cjs');
    writeFileSync(file, script);
    Object.assign(process.env, {
      GIT_CONFIG_COUNT: '2',
      GIT_CONFIG_KEY_0: 'credential.helper',
      GIT_CONFIG_VALUE_0: '',
      GIT_CONFIG_KEY_1: 'credential.helper',
      GIT_CONFIG_VALUE_1: `!node "${file.replace(/\\/g, '/')}"`,
    });
  };

  it('is read through git credential fill', async () => {
    useHelper(`if (process.argv[2] === 'get') process.stdout.write('username=me\\npassword=stand-in-token\\n');`);
    expect(await githubToken()).toBe('stand-in-token');
  });

  it('is absent when git holds none, and never prompts', async () => {
    useHelper(`/* knows nothing */`);
    expect(await githubToken('example.invalid')).toBeUndefined();
  });
});
