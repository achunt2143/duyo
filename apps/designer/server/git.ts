import { execFile } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';

/**
 * Source control through the git already on this machine, so pushing to GitHub uses the
 * login the user already has; the designer never sees or stores a token. Every command runs
 * without a shell, with arguments passed as data.
 */

export interface GitResult {
  ok: boolean;
  out: string;
  error: string;
}

export function git(cwd: string, args: readonly string[], timeout = 120_000): Promise<GitResult> {
  return new Promise((done) => {
    execFile('git', [...args], { cwd, timeout, maxBuffer: 16 * 1024 * 1024, windowsHide: true, env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } }, (error, stdout, stderr) =>
      done({ ok: !error, out: String(stdout), error: String(stderr || error?.message || '').trim() }),
    );
  });
}

export interface ChangedFile {
  /** Relative to the project folder. */
  path: string;
  /** Two letters as `git status` prints them: ` M`, `A `, `??`, ... */
  status: string;
}

/** `git status --porcelain=v1 -z` output, paths made relative to the project folder. */
export function parseStatus(text: string, prefix: string): ChangedFile[] {
  const files: ChangedFile[] = [];
  const parts = text.split('\0').filter(Boolean);
  for (let i = 0; i < parts.length; i++) {
    const entry = parts[i]!;
    const status = entry.slice(0, 2);
    const path = entry.slice(3);
    // A rename is followed by its original path; skip that.
    if (status.startsWith('R') || status.startsWith('C')) i++;
    files.push({ status, path: prefix && path.startsWith(prefix) ? path.slice(prefix.length) : path });
  }
  return files;
}

/** The GitHub page that opens a pull request for `branch`, if the remote is on GitHub. */
export function compareUrl(remote: string, branch: string): string | undefined {
  const match = /github\.com[:/]([^/\s]+)\/([^/\s]+?)(?:\.git)?\/?$/.exec(remote.trim());
  return match ? `https://github.com/${match[1]}/${match[2]}/compare/${encodeURIComponent(branch)}?expand=1` : undefined;
}

/** Remotes the designer will clone: GitHub-style https and ssh, or a folder on this machine. */
export function cloneSource(url: string): string | undefined {
  const value = url.trim();
  if (/^https:\/\/[\w.-]+(:\d+)?\/[\w./~-]+$/.test(value)) return value;
  if (/^git@[\w.-]+:[\w./~-]+$/.test(value)) return value;
  if (/^ssh:\/\/[\w@.-]+(:\d+)?\/[\w./~-]+$/.test(value)) return value;
  if (existsSync(value) && statSync(value).isDirectory()) return value;
  return undefined;
}

/** `owner/repo.git` -> `repo`: the folder a clone goes into. */
export const repoName = (url: string) =>
  url.trim().replace(/[\\/]+$/, '').replace(/\.git$/, '').split(/[/:\\]/).pop()?.replace(/[^\w.-]/g, '') || 'project';

export interface RepoInfo {
  repo: boolean;
  /** The repository's folder name: commits go to this repository. */
  repository?: string;
  branch?: string;
  remote?: string;
  /** Commits not yet pushed, if the branch tracks one. */
  ahead?: number;
  behind?: number;
  pullRequestUrl?: string;
  changes: ChangedFile[];
}

/** Where the project stands: its branch, its remote, and what has changed in its folder. */
export async function repoInfo(root: string): Promise<RepoInfo> {
  const top = await git(root, ['rev-parse', '--show-prefix', '--show-toplevel']);
  if (!top.ok) return { repo: false, changes: [] };
  const [prefixLine = '', topLine = ''] = top.out.split('\n');
  const prefix = prefixLine.trim();
  const repository = topLine.trim().split(/[\\/]/).pop();
  const [branch, remote, status, counts] = await Promise.all([
    git(root, ['branch', '--show-current']),
    git(root, ['remote', 'get-url', 'origin']),
    git(root, ['status', '--porcelain=v1', '-z', '--untracked-files=all', '--', '.']),
    git(root, ['rev-list', '--left-right', '--count', 'HEAD...@{upstream}']),
  ]);
  const name = branch.out.trim();
  const [ahead, behind] = counts.ok ? counts.out.trim().split(/\s+/).map(Number) : [undefined, undefined];
  const origin = remote.ok ? remote.out.trim() : undefined;
  const pullRequestUrl = origin && name ? compareUrl(origin, name) : undefined;
  return {
    repo: true,
    ...(repository ? { repository } : {}),
    ...(name ? { branch: name } : {}),
    ...(origin ? { remote: origin } : {}),
    ...(ahead !== undefined ? { ahead, behind: behind ?? 0 } : {}),
    ...(pullRequestUrl ? { pullRequestUrl } : {}),
    changes: parseStatus(status.out, prefix),
  };
}

/** Commits everything changed in the project folder, and nothing outside it. */
export async function commitAll(root: string, message: string): Promise<GitResult> {
  const added = await git(root, ['add', '-A', '--', '.']);
  if (!added.ok) return added;
  return git(root, ['commit', '-m', message, '--', '.']);
}

/** Pushes the current branch, setting its upstream the first time. */
export const push = (root: string) => git(root, ['push', '-u', 'origin', 'HEAD']);
export const pull = (root: string) => git(root, ['pull', '--ff-only']);
export const newBranch = (root: string, name: string) => git(root, ['switch', '-c', name]);
export const init = (root: string) => git(root, ['init']);
export const clone = (source: string, dest: string) => git(dest.replace(/[\\/][^\\/]+$/, ''), ['clone', '--', source, dest], 600_000);

/** A branch name git will accept, and nothing that reads as an option. */
export const validBranch = (name: string) =>
  /^[A-Za-z0-9][\w./-]*$/.test(name) && !name.includes('..') && !name.endsWith('.lock') && !name.endsWith('/') && !name.endsWith('.');
