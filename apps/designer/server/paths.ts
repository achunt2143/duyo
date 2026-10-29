import { isAbsolute, relative, resolve, sep } from 'node:path';

import { isCodeFile, isGenerated } from '../src/codebehind.js';

/**
 * Which project files the designer may touch. Everything is relative to the project folder;
 * nothing outside it, and only views and code, never anything else on disk.
 */

export type FileKind = 'view' | 'code' | 'generated';

export function kindOfFile(path: string): FileKind | undefined {
  if (path.endsWith('.view.json')) return 'view';
  if (isGenerated(path)) return 'generated';
  if (isCodeFile(path)) return 'code';
  return undefined;
}

/**
 * The absolute file for a project-relative path, or undefined if the path is absolute,
 * leaves the folder, or is the folder itself.
 */
export function insideRoot(root: string, path: string | null | undefined): string | undefined {
  if (typeof path !== 'string' || path === '' || isAbsolute(path) || /^[a-zA-Z]:/.test(path) || path.includes('\0')) return undefined;
  const file = resolve(root, path);
  const back = relative(root, file);
  if (back === '' || back.startsWith('..') || isAbsolute(back)) return undefined;
  return file.startsWith(root.endsWith(sep) ? root : root + sep) ? file : undefined;
}

/** A file the designer may read: views, code-behinds and their generated types. */
export const readableFile = (root: string, path: string | null | undefined) =>
  typeof path === 'string' && kindOfFile(path) !== undefined ? insideRoot(root, path) : undefined;

/** A file the designer may write: views and code, never generated files. */
export function writableFile(root: string, path: string | null | undefined): string | undefined {
  const kind = typeof path === 'string' ? kindOfFile(path) : undefined;
  return kind === 'view' || kind === 'code' ? insideRoot(root, path) : undefined;
}

/** A folder the designer may create. */
export const folderPath = (root: string, path: string | null | undefined) =>
  typeof path === 'string' && !/[<>:"|?*]/.test(path.replace(/^[a-zA-Z]:/, '')) ? insideRoot(root, path) : undefined;
