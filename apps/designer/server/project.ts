import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';

/**
 * The project the designer is working on, which the user can change while it runs. A project
 * is a folder; `duyo.config.json` in it says where its views are and which module registers
 * its own kinds:
 *
 *     { "views": "src", "kinds": "src/kinds.ts" }
 *
 * Without one, views are looked for in `src` (or the folder itself) and only the packs'
 * kinds are known.
 */

export interface ProjectConfig {
  /** Folder of views and code, relative to the project. */
  views: string;
  /** Module that registers the project's kinds, relative to the project. */
  kinds?: string;
}

export interface ProjectInfo {
  root: string;
  name: string;
  config: ProjectConfig;
  /** Absolute folder the file API works in. */
  source: string;
  /** Absolute path of the kinds module, if there is one and it exists. */
  kindsFile?: string;
  hasConfig: boolean;
}

/** Where the designer remembers projects. `DUYO_DESIGNER_HOME` moves it, for tests. */
const HOME = resolve(process.env['DUYO_DESIGNER_HOME'] ?? join(homedir(), '.duyo-designer'));
const STATE = join(HOME, 'state.json');
export const WORKSPACE = resolve(process.env['DUYO_DESIGNER_WORKSPACE'] ?? join(homedir(), 'DuyoProjects'));

/**
 * The project a folder belongs to: the folder itself if it has a `duyo.config.json` or a
 * `package.json`, otherwise the nearest folder up to three levels above it that does. Opening
 * `app/src` opens `app`, so its config, git and zip all mean the whole project. The search
 * never reaches the home folder or a drive's root, which can hold a stray package.json.
 */
export function projectRootFor(folder: string): string {
  const start = resolve(folder);
  const home = resolve(homedir());
  let dir = start;
  for (let level = 0; level <= 3; level++) {
    if (level > 0 && (dir === home || dirname(dir) === dir)) break;
    if (existsSync(join(dir, 'duyo.config.json')) || existsSync(join(dir, 'package.json'))) return dir;
    dir = dirname(dir);
  }
  return start;
}

export function describe(folder: string): ProjectInfo {
  const root = projectRootFor(folder);
  const file = join(root, 'duyo.config.json');
  let config: ProjectConfig = { views: existsSync(join(root, 'src')) ? 'src' : '.' };
  let hasConfig = false;
  if (existsSync(file)) {
    try {
      const read = JSON.parse(readFileSync(file, 'utf8')) as Partial<ProjectConfig>;
      config = { views: typeof read.views === 'string' ? read.views : config.views, ...(typeof read.kinds === 'string' ? { kinds: read.kinds } : {}) };
      hasConfig = true;
    } catch {
      // A broken config is reported by leaving the defaults in place.
    }
  }
  const source = resolve(root, config.views);
  const kindsFile = config.kinds ? resolve(root, config.kinds) : undefined;
  let name = basename(root);
  try {
    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as { name?: unknown };
    if (typeof pkg.name === 'string') name = pkg.name;
  } catch {
    // No package.json: the folder name will do.
  }
  return {
    root,
    name,
    config,
    source: source.startsWith(root) ? source : root,
    ...(kindsFile && kindsFile.startsWith(root) && existsSync(kindsFile) ? { kindsFile } : {}),
    hasConfig,
  };
}

export function writeConfig(root: string, config: ProjectConfig): void {
  writeFileSync(join(root, 'duyo.config.json'), `${JSON.stringify(config, null, 2)}\n`);
}

export const isFolder = (path: string) => existsSync(path) && statSync(path).isDirectory();

interface SavedState {
  current?: string;
  recent: string[];
}

function readState(): SavedState {
  try {
    const state = JSON.parse(readFileSync(STATE, 'utf8')) as Partial<SavedState>;
    return { ...(state.current ? { current: state.current } : {}), recent: Array.isArray(state.recent) ? state.recent.filter((p) => typeof p === 'string') : [] };
  } catch {
    return { recent: [] };
  }
}

/** Remembers the project as current and most recent. */
export function remember(root: string): string[] {
  const state = readState();
  const recent = [root, ...state.recent.filter((p) => p !== root)].filter(isFolder).slice(0, 10);
  mkdirSync(HOME, { recursive: true });
  writeFileSync(STATE, JSON.stringify({ current: root, recent }, null, 2));
  return recent;
}

export const recentProjects = () => readState().recent.filter(isFolder);

/** The project to start with: the one named by the environment, else the last one, else the fallback. */
export function startingProject(fallback: string): string {
  const fromEnv = process.env['DUYO_DESIGNER_ROOT'];
  if (fromEnv && isFolder(resolve(fromEnv))) return resolve(fromEnv);
  const last = readState().current;
  return last && isFolder(last) ? last : fallback;
}

/** A free folder in the workspace for a new project called `name`. */
export function freshFolder(name: string): string {
  const base = name.replace(/[^\w.-]/g, '-').replace(/^[.-]+/, '') || 'project';
  mkdirSync(WORKSPACE, { recursive: true });
  let folder = join(WORKSPACE, base);
  for (let n = 2; existsSync(folder); n++) folder = join(WORKSPACE, `${base}-${n}`);
  return folder;
}
