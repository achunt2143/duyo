// Renames the published package, in package.json and in the docs:   node scripts/rename.mjs <new-name>
// For example @duyojs/duyo, or duyo if npm ever allows it (npm run rename -w <current-name> -- duyo).
//
// The docs write the name where an app uses it: imports ('<name>', '<name>/react'), install lines, the -w target of
// npm commands, and the name in backticks. Everything else keeps its name: the framework's name in prose, the duyo.*
// kinds, the duyo-views command, duyo.config.json and the private @duyo/* workspaces.
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { includes, manifest, root } from './assemble.mjs';

const TICK = String.fromCharCode(96);
const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const LF = (text) => text.split('\r\n').join('\n');

/** A valid npm package name, scoped or not. */
export const isPackageName = (name) => /^(@[a-z0-9][\w.-]*\/)?[a-z0-9][\w.-]*$/.test(name);

/** `text` with the package called `from` called `to` where an app uses the name. */
export function renameInText(text, from, to) {
  const old = escape(from);
  return (
    text
      // <name>/react, <name>/onyx/css, ...: not @duyo/react, packages/duyo/..., ../duyo/..., create-duyo/...
      .replace(new RegExp(`(?<![@\\w/.-])${old}/(layout|react|views|remochi|onyx)\\b`, 'g'), `${to}/$1`)
      // '<name>' and "<name>" as an import or a module name
      .replace(new RegExp(`(['"])${old}\\1`, 'g'), `$1${to}$1`)
      // <name> in backticks, as the package
      .replace(new RegExp(`${TICK}${old}${TICK}`, 'g'), `${TICK}${to}${TICK}`)
      .replace(new RegExp(`npm install ${old}(?![-\\w./])`, 'g'), `npm install ${to}`)
      .replace(new RegExp(`-w ${old}(?![-\\w./])`, 'g'), `-w ${to}`)
      // the title of the package's README
      .replace(new RegExp(`^# ${old}$`, 'gm'), `# ${to}`)
  );
}

/** The files that name the package. */
export function documentedFiles() {
  return [
    'README.md',
    'CHANGELOG.md',
    'docs/views.md',
    'docs/writing-a-pack.md',
    'docs/enyo-alignment.md',
    ...includes().flatMap((name) => [`packages/${name}/README.md`, `packages/${name}/CHANGELOG.md`]),
    'packages/duyo/README.md',
    'packages/duyo/CHANGELOG.md',
    'packages/duyo/NOTICE',
  ];
}

/** package.json with the new name; a scoped package is public by default (npm makes it private otherwise). */
export function renamedManifest(current, to) {
  const next = {};
  for (const [key, value] of Object.entries(current)) {
    if (key === 'publishConfig') continue;
    next[key] = key === 'name' ? to : value;
    if (key === 'engines' && to.startsWith('@')) next.publishConfig = { ...current.publishConfig, access: 'public' };
  }
  if (!to.startsWith('@') && current.publishConfig) {
    const { access: _access, ...rest } = current.publishConfig;
    if (Object.keys(rest).length > 0) next.publishConfig = rest;
  }
  return next;
}

function main(to) {
  if (!to || !isPackageName(to)) throw new Error('Usage: node scripts/rename.mjs <new-name>   (for example @duyojs/duyo)');
  const current = manifest();
  const from = current.name;
  if (from === to) return console.log(`The package is already called ${to}.`);

  const repository = resolve(root, '..', '..');
  let changed = 0;
  for (const file of documentedFiles()) {
    const path = join(repository, file);
    const before = LF(readFileSync(path, 'utf8'));
    let after = renameInText(before, from, to);
    if (file === 'packages/duyo/NOTICE') after = after.replace(new RegExp(`^${escape(from)}\\n`), `${to}\n`);
    if (after !== before) {
      writeFileSync(path, after);
      changed++;
    }
  }
  writeFileSync(join(root, 'package.json'), `${JSON.stringify(renamedManifest(current, to), null, 2)}\n`);
  console.log(`Renamed ${from} to ${to}: package.json and ${changed} documents.`);
  console.log(`Next: npm install, npm test -w ${to}, npm run smoke -w ${to}, npm publish --dry-run -w ${to}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main(process.argv[2]);
