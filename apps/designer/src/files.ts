import type { ViewDiagnostic } from '@duyo/views/spec';

import type { Json } from './model.js';

/**
 * The designer's side of the dev server's file API (see `server/files.ts`). File paths are
 * relative to the current project's views folder.
 */

const BASE = '/__designer';

/** The session key the dev server put in this page; every request carries it. */
export const KEY = document.querySelector<HTMLMetaElement>('meta[name="duyo-designer-key"]')?.content ?? '';

/** `fetch` with the session key. */
const send = (input: string, init: RequestInit = {}) =>
  fetch(input, { ...init, headers: { ...(init.headers as Record<string, string> | undefined), 'x-duyo-designer': KEY } });

export interface TreeEntry {
  path: string;
  type: 'dir' | 'view' | 'code' | 'generated';
}

export interface SaveResult {
  ok: boolean;
  diagnostics: ViewDiagnostic[];
  /** The generated `.view.gen.ts` changed: the code-behind will be checked against the new spec. */
  typesChanged: boolean;
}

async function call<T>(response: Response): Promise<T> {
  const text = await response.text();
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    body = undefined;
  }
  if (!response.ok && response.status !== 422) {
    const error = body && typeof body === 'object' && 'error' in body ? String((body as { error: unknown }).error) : text;
    throw new Error(error);
  }
  return body as T;
}

const post = <T>(route: string, body: unknown = {}) =>
  send(`${BASE}/${route}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).then(call<T>);

const query = (path: string) => `path=${encodeURIComponent(path)}`;

export const listTree = () => send(`${BASE}/tree`).then(call<{ root: string; entries: TreeEntry[] }>);

export async function readText(path: string): Promise<string> {
  const response = await send(`${BASE}/file?${query(path)}`);
  if (!response.ok) await call(response);
  return response.text();
}

export const readView = async (path: string): Promise<Json> => JSON.parse(await readText(path)) as Json;

export const writeText = (path: string, text: string) =>
  send(`${BASE}/file?${query(path)}`, { method: 'PUT', body: text }).then(call<SaveResult>);

export const writeView = (path: string, spec: Json) => writeText(path, JSON.stringify(spec));

/** The view's code-behind if it has one, and where a new one would go. */
export const companionOf = (path: string) => send(`${BASE}/companion?${query(path)}`).then(call<{ path: string | null; suggested: string }>);

export const createView = (path: string) => post<{ ok: boolean; path: string; code: string }>('create-view', { path });
export const renameView = (from: string, to: string) => post<{ ok: boolean; path: string; code: string | null }>('rename-view', { from, to });
export const deleteView = (path: string, code: boolean) => post<{ ok: boolean }>('delete-view', { path, code });
export const makeFolder = (path: string) => post<{ ok: boolean }>('mkdir', { path });
/** Makes the next run load the project's modules afresh. */
export const reloadProject = () => post<{ ok: boolean }>('invalidate', {});

// --- Projects --------------------------------------------------------------------------

export interface Project {
  root: string;
  name: string;
  /** Absolute folder of the project's views and code. */
  source: string;
  config: { views: string; kinds?: string };
  kindsFile?: string;
  hasConfig: boolean;
  recent: string[];
  /** Where cloned and imported projects go. */
  workspace: string;
}

export const currentProject = () => send(`${BASE}/project`).then(call<Project>);
export const openProject = (path: string) => post<Project>('project/open', { path });
export const configureProject = (views: string, kinds: string) => post<Project>('project/config', { views, kinds });
export const cloneProject = (url: string, name?: string) => post<Project>('project/clone', { url, ...(name ? { name } : {}) });

export async function importProject(zip: ArrayBuffer, name: string): Promise<Project & { imported: { files: number; skipped: string[] } }> {
  return send(`${BASE}/project/import?name=${encodeURIComponent(name)}`, { method: 'POST', headers: { 'content-type': 'application/zip' }, body: zip }).then(call<Project & { imported: { files: number; skipped: string[] } }>);
}

/** Starts the browser downloading the project as a zip. */
export function downloadProject() {
  const link = document.createElement('a');
  link.href = `${BASE}/project/export.zip?key=${encodeURIComponent(KEY)}`;
  link.download = '';
  document.body.append(link);
  link.click();
  link.remove();
}

/**
 * Imports the project's kinds module, so views built on its kinds can be drawn. Returns why
 * it could not, if it could not: the designer still works with the packs' kinds.
 */
/** The URL Vite serves a file outside the designer at: the same one a project import gets. */
export const fsUrl = (absolute: string) => `/@fs/${absolute.replace(/\\/g, '/').replace(/^\/+/, '')}`;

export async function loadProjectKinds(project: Project): Promise<string | undefined> {
  if (!project.kindsFile) return undefined;
  try {
    await import(/* @vite-ignore */ fsUrl(project.kindsFile));
    return undefined;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

// --- Git -------------------------------------------------------------------------------

export interface ChangedFile {
  path: string;
  status: string;
}

export interface GitState {
  repo: boolean;
  repository?: string;
  branch?: string;
  remote?: string;
  ahead?: number;
  behind?: number;
  pullRequestUrl?: string;
  changes: ChangedFile[];
  ok?: boolean;
  error?: string;
}

export const gitState = () => send(`${BASE}/git`).then(call<GitState>);
const gitCall = (route: string, body?: unknown) =>
  send(`${BASE}/git/${route}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body ?? {}) }).then(async (r) => (await r.json()) as GitState);
export const gitInit = () => gitCall('init');
export const gitCommit = (message: string) => gitCall('commit', { message });
export const gitPush = () => gitCall('push');
export const gitPull = () => gitCall('pull');
export const gitBranch = (name: string) => gitCall('branch', { name });
