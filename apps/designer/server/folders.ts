import { existsSync, readdirSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

/**
 * Lists folders on this computer, so the designer can offer a folder picker: a browser page
 * cannot be handed a real path by its own file chooser. Only folder names are listed, never
 * file contents; the route exists on the dev server alone and needs its session key.
 */

export interface FolderEntry {
  name: string;
  /** Absolute path. */
  path: string;
  /** Holds a package.json or duyo.config.json: it looks like a project. */
  project: boolean;
  /** Has a .git folder: a repository's top. */
  git: boolean;
}

export interface FolderListing {
  /** The folder listed; empty for the list of places to start from. */
  path: string;
  /** The folder above it; empty from a drive's top, which leads back to the places. */
  parent: string | undefined;
  entries: FolderEntry[];
  /** Set when the folder could not be read. */
  error?: string;
}

const MAX_ENTRIES = 500;
/** System folders nobody wants to open a project in. */
const HIDDEN = new Set(['$Recycle.Bin', 'System Volume Information', 'node_modules', '$WinREAgent']);

const looksLikeProject = (folder: string) => existsSync(join(folder, 'package.json')) || existsSync(join(folder, 'duyo.config.json'));

function describeFolder(name: string, path: string): FolderEntry {
  return { name, path, project: looksLikeProject(path), git: existsSync(join(path, '.git')) };
}

/** Places to start: the home folder, the designer's workspace, and each drive on Windows. */
export function places(workspace: string): FolderEntry[] {
  const found: FolderEntry[] = [];
  const add = (name: string, path: string) => {
    if (existsSync(path) && statSync(path).isDirectory() && !found.some((f) => f.path === path)) found.push(describeFolder(name, path));
  };
  add('Home', resolve(homedir()));
  add('Projects', join(homedir(), 'Projects'));
  add('DuyoProjects', workspace);
  if (process.platform === 'win32') {
    for (const letter of 'CDEFGHIJKLMNOPQRSTUVWXYZ') add(`${letter}:`, `${letter}:\\`);
  } else {
    add('/', '/');
  }
  return found;
}

export function listFolders(path: string, workspace: string): FolderListing {
  if (path.trim() === '') return { path: '', parent: undefined, entries: places(workspace) };

  const folder = resolve(path);
  if (!existsSync(folder) || !statSync(folder).isDirectory()) {
    return { path: folder, parent: dirname(folder) === folder ? '' : dirname(folder), entries: [], error: `${folder} is not a folder.` };
  }
  const above = dirname(folder);
  const parent = above === folder ? '' : above;

  try {
    const entries: FolderEntry[] = [];
    for (const name of readdirSync(folder).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))) {
      if (name.startsWith('.') || HIDDEN.has(name)) continue;
      const child = join(folder, name);
      try {
        if (!statSync(child).isDirectory()) continue;
      } catch {
        continue; // Broken links and folders we may not look at.
      }
      entries.push(describeFolder(name, child));
      if (entries.length >= MAX_ENTRIES) break;
    }
    return { path: folder, parent, entries };
  } catch (error) {
    return { path: folder, parent, entries: [], error: `Cannot read ${folder}: ${error instanceof Error ? error.message : String(error)}` };
  }
}
