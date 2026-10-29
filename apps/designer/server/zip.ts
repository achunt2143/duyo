import { strFromU8, unzipSync, zipSync, type Zippable } from 'fflate';
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';

import { insideRoot } from './paths.js';

/**
 * Projects in and out as zip files: what you download to hand work off without git, and what
 * you upload to start from someone else's.
 */

/** Never packed, never unpacked: dependencies, build output and version control. */
const SKIP = new Set(['node_modules', 'dist', 'build', '.git', '.vite', '.DS_Store']);

export const LIMITS = Object.freeze({ files: 10_000, bytes: 200 * 1024 * 1024 });

/** Every file of a project, as zip-relative paths. */
function filesOf(root: string): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      if (SKIP.has(name)) continue;
      const file = join(dir, name);
      if (statSync(file).isDirectory()) walk(file);
      else out.push(relative(root, file).split(sep).join('/'));
    }
  };
  walk(root);
  return out.sort();
}

/** The project as a zip, under a folder named after it, as GitHub's downloads are. */
export function zipProject(root: string, name: string): Uint8Array {
  const files: Zippable = {};
  for (const path of filesOf(root)) files[`${name}/${path}`] = readFileSync(join(root, path));
  return zipSync(files, { level: 6 });
}

export interface Unpacked {
  files: number;
  /** Entries that were not written: outside the folder, or dependencies and build output. */
  skipped: string[];
}

/**
 * Unpacks a zip into `dest`. A single top folder (as in GitHub's "Download ZIP") is removed.
 * Entries that would land outside `dest`, absolute paths, and anything over the limits are
 * refused: a zip is untrusted input.
 */
export function unzipProject(zip: Uint8Array, dest: string): Unpacked {
  let total = 0;
  let count = 0;
  const entries = unzipSync(zip, {
    filter: (file) => {
      count++;
      total += file.originalSize;
      if (count > LIMITS.files) throw new Error(`The zip has more than ${LIMITS.files} files.`);
      if (total > LIMITS.bytes) throw new Error(`The zip unpacks to more than ${LIMITS.bytes / 1024 / 1024} MB.`);
      return !file.name.endsWith('/');
    },
  });

  const names = Object.keys(entries).map((name) => name.replace(/\\/g, '/'));
  const tops = new Set(names.map((name) => name.split('/')[0]));
  const strip = tops.size === 1 && names.every((name) => name.includes('/')) ? `${[...tops][0]}/` : '';

  const skipped: string[] = [];
  let files = 0;
  for (const [raw, data] of Object.entries(entries)) {
    const name = raw.replace(/\\/g, '/').slice(strip.length);
    const target = insideRoot(dest, name);
    if (!target || name.split('/').some((part) => SKIP.has(part))) {
      skipped.push(raw);
      continue;
    }
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, data);
    files++;
  }
  return { files, skipped };
}

/** The `name` of the zip's package.json, if it has one at its top: a good folder name. */
export function nameInZip(zip: Uint8Array): string | undefined {
  try {
    const entries = unzipSync(zip, { filter: (file) => /^([^/]+\/)?package\.json$/.test(file.name) });
    const first = Object.values(entries)[0];
    const name = first ? (JSON.parse(strFromU8(first)) as { name?: unknown }).name : undefined;
    return typeof name === 'string' ? name.replace(/^@[^/]+\//, '') : undefined;
  } catch {
    return undefined;
  }
}
