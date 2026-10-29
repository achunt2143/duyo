import type { ViewDiagnostic } from '@duyo/views/spec';

import type { Json } from './model.js';

/**
 * The designer's side of the dev server's file API (see `server/files.ts`). Paths are
 * relative to the project folder the server was started for.
 */

const BASE = '/__designer';

export interface ViewList {
  root: string;
  files: string[];
}

export interface SaveResult {
  ok: boolean;
  diagnostics: ViewDiagnostic[];
  /** The generated `.view.gen.ts` changed: the code-behind will be checked against the new spec. */
  typesChanged: boolean;
}

async function json<T>(response: Response): Promise<T> {
  if (!response.ok && response.status !== 422) throw new Error(`${response.status} ${await response.text()}`);
  return (await response.json()) as T;
}

export const listViews = async (): Promise<ViewList> => json(await fetch(`${BASE}/views`));

export const readView = async (path: string): Promise<Json> =>
  json(await fetch(`${BASE}/view?path=${encodeURIComponent(path)}`));

export const writeView = async (path: string, spec: Json): Promise<SaveResult> =>
  json(
    await fetch(`${BASE}/view?path=${encodeURIComponent(path)}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(spec),
    }),
  );
