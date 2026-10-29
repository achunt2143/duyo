import type { ViewDiagnostic } from '@duyo/views/spec';

import type { Json } from './model.js';

/**
 * The designer's side of the dev server's file API (see `server/files.ts`). Paths are
 * relative to the project folder the server was started for.
 */

const BASE = '/__designer';

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

const post = <T>(route: string, body: unknown) =>
  fetch(`${BASE}/${route}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).then(call<T>);

const query = (path: string) => `path=${encodeURIComponent(path)}`;

export const listTree = () => fetch(`${BASE}/tree`).then(call<{ root: string; entries: TreeEntry[] }>);

export async function readText(path: string): Promise<string> {
  const response = await fetch(`${BASE}/file?${query(path)}`);
  if (!response.ok) await call(response);
  return response.text();
}

export const readView = async (path: string): Promise<Json> => JSON.parse(await readText(path)) as Json;

export const writeText = (path: string, text: string) =>
  fetch(`${BASE}/file?${query(path)}`, { method: 'PUT', body: text }).then(call<SaveResult>);

export const writeView = (path: string, spec: Json) => writeText(path, JSON.stringify(spec));

/** The view's code-behind if it has one, and where a new one would go. */
export const companionOf = (path: string) => fetch(`${BASE}/companion?${query(path)}`).then(call<{ path: string | null; suggested: string }>);

export const createView = (path: string) => post<{ ok: boolean; path: string; code: string }>('create-view', { path });
export const renameView = (from: string, to: string) => post<{ ok: boolean; path: string; code: string | null }>('rename-view', { from, to });
export const deleteView = (path: string, code: boolean) => post<{ ok: boolean }>('delete-view', { path, code });
export const makeFolder = (path: string) => post<{ ok: boolean }>('mkdir', { path });
/** Makes the next run load the project's modules afresh. */
export const reloadProject = () => post<{ ok: boolean }>('invalidate', {});
