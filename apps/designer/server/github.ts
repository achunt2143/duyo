import { execFile } from 'node:child_process';

import { cloneSource } from './git.js';

/**
 * Lists the user's GitHub repositories, so one can be picked instead of its URL typed.
 *
 * It asks the git already on this machine for the login it already has (`git credential
 * fill`, the same call `git clone` makes), and uses it for one read-only request to GitHub's
 * API. The token is held in memory for that request: it is never written anywhere, logged, or
 * sent to the page. If git has no login for GitHub, the list is simply unavailable and the
 * repository's URL can still be pasted.
 */

const API = () => process.env['DUYO_DESIGNER_GITHUB_API'] ?? 'https://api.github.com';

export interface Repo {
  fullName: string;
  description: string;
  private: boolean;
  fork: boolean;
  pushedAt: string;
  cloneUrl: string;
}

/** `username=…\npassword=…` as `git credential fill` prints it. */
export function parseCredential(text: string): { username?: string; password?: string } {
  const fields: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const at = line.indexOf('=');
    if (at > 0) fields[line.slice(0, at)] = line.slice(at + 1);
  }
  return { ...(fields['username'] ? { username: fields['username'] } : {}), ...(fields['password'] ? { password: fields['password'] } : {}) };
}

/** The token git holds for github.com, if it holds one; never prompts. */
export function githubToken(host = 'github.com'): Promise<string | undefined> {
  return new Promise((done) => {
    const child = execFile(
      'git',
      ['credential', 'fill'],
      { timeout: 15_000, windowsHide: true, env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'never', GIT_ASKPASS: '', SSH_ASKPASS: '' } },
      (error, stdout) => done(error ? undefined : parseCredential(String(stdout)).password),
    );
    child.stdin?.end(`protocol=https\nhost=${host}\n\n`);
  });
}

export class GithubError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}

/** What GitHub's repository objects look like, as far as listing needs. */
interface ApiRepo {
  full_name?: unknown;
  description?: unknown;
  private?: unknown;
  fork?: unknown;
  pushed_at?: unknown;
  clone_url?: unknown;
}

export function toRepo(raw: ApiRepo): Repo | undefined {
  if (typeof raw.full_name !== 'string' || typeof raw.clone_url !== 'string') return undefined;
  if (!cloneSource(raw.clone_url)) return undefined;
  return {
    fullName: raw.full_name,
    description: typeof raw.description === 'string' ? raw.description : '',
    private: raw.private === true,
    fork: raw.fork === true,
    pushedAt: typeof raw.pushed_at === 'string' ? raw.pushed_at : '',
    cloneUrl: raw.clone_url,
  };
}

const nextPage = (link: string | null) => /<([^>]+)>;\s*rel="next"/.exec(link ?? '')?.[1];

/** The signed-in user's repositories, most recently pushed first, up to `limit`. */
export async function listRepos(token: string | undefined, limit = 300, fetchImpl: typeof fetch = fetch): Promise<Repo[]> {
  if (!token) throw new GithubError('git has no GitHub login on this computer. Sign in with git (for example, push to GitHub once, or install Git Credential Manager), or paste the repository URL instead.');
  const repos: Repo[] = [];
  let url: string | undefined = `${API()}/user/repos?per_page=100&sort=pushed&affiliation=owner,collaborator,organization_member`;
  for (let pages = 0; url && pages < 5 && repos.length < limit; pages++) {
    const response: Response = await fetchImpl(url, {
      headers: { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json', 'user-agent': 'duyo-designer', 'x-github-api-version': '2022-11-28' },
    });
    if (response.status === 401) throw new GithubError('GitHub did not accept the login git holds (it may have expired). Sign in again with git, or paste the repository URL.', 401);
    if (response.status === 403) throw new GithubError('GitHub refused: the login git holds may not be allowed to list repositories, or the rate limit was reached. Paste the repository URL instead.', 403);
    if (!response.ok) throw new GithubError(`GitHub answered ${response.status}.`, response.status);
    const page = (await response.json()) as ApiRepo[];
    for (const raw of Array.isArray(page) ? page : []) {
      const repo = toRepo(raw);
      if (repo) repos.push(repo);
    }
    url = nextPage(response.headers.get('link'));
  }
  return repos.slice(0, limit);
}
