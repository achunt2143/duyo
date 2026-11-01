#!/usr/bin/env node
// Assembles `duyo`, the one package, from the libraries of this repository.
//
//   node scripts/assemble.mjs          copies them into lib/ and checks package.json against them (this is `prepack`)
//   node scripts/assemble.mjs --sync   also rewrites the exports, bin and peerDependencies in package.json
//
// Each library keeps its own folder, tests and name (@duyo/core, @duyo/react, ...) here, where the apps use
// them as workspaces. What is published is the one package `duyo`: their `src` (and `bin`) copied into lib/<name>/,
// with every `@duyo/core` written as `duyo` and every `@duyo/<name>` as `duyo/<name>`. The package is installed
// as node_modules/duyo, so a file inside it that imports `duyo` finds itself, and an app and the packs share one copy.
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const packages = resolve(root, '..');

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));
export const manifest = () => readJson(join(root, 'package.json'));
/** The libraries that make up the package, by their folder in packages/. */
export const includes = () => manifest().duyo.includes;

const REWRITTEN = /\.(ts|tsx|js|mjs)$/;
const SKIPPED = new Set(['__tests__', 'node_modules']);

/** `@duyo/core` is `duyo`; `@duyo/react` is `duyo/react`. */
export function rewrite(text, names = includes()) {
  return text.replace(new RegExp(`@duyo/(${names.join('|')})\\b`, 'g'), (_, name) => (name === 'core' ? 'duyo' : `duyo/${name}`));
}

function copyTree(from, to, names) {
  mkdirSync(to, { recursive: true });
  for (const entry of readdirSync(from)) {
    if (SKIPPED.has(entry) || /\.test\.[cm]?[jt]sx?$/.test(entry)) continue;
    const source = join(from, entry);
    const target = join(to, entry);
    if (statSync(source).isDirectory()) copyTree(source, target, names);
    else if (REWRITTEN.test(entry)) writeFileSync(target, rewrite(readFileSync(source, 'utf8'), names));
    else cpSync(source, target);
  }
}

/** Copies the libraries into `outDir` (lib/ by default), rewritten. Returns the folder. */
export function assemble(outDir = join(root, 'lib')) {
  const names = includes();
  rmSync(outDir, { recursive: true, force: true });
  for (const name of names) {
    for (const dir of ['src', 'bin']) {
      const from = join(packages, name, dir);
      if (existsSync(from)) copyTree(from, join(outDir, name, dir), names);
    }
  }
  return outDir;
}

/** Every file under `dir`. */
export function filesUnder(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? filesUnder(path) : [path];
  });
}

const target = (name, value) =>
  typeof value === 'string'
    ? `./lib/${name}/${value.replace(/^\.\//, '')}`
    : Object.fromEntries(Object.entries(value).map(([condition, path]) => [condition, target(name, path)]));

/** The package's exports, from the exports of each library: `@duyo/core` is `duyo`, `@duyo/react/x` is `duyo/react/x`. */
export function derivedExports() {
  const exported = {};
  for (const name of includes()) {
    for (const [subpath, value] of Object.entries(readJson(join(packages, name, 'package.json')).exports ?? {})) {
      const key = name === 'core' ? subpath : subpath === '.' ? `./${name}` : `./${name}/${subpath.slice(2)}`;
      exported[key] = target(name, value);
    }
  }
  exported['./package.json'] = './package.json';
  return exported;
}

/** The commands of the libraries. */
export function derivedBin() {
  const bin = {};
  for (const name of includes()) {
    // written the way npm normalises it, so publishing has nothing to correct
    for (const [command, path] of Object.entries(readJson(join(packages, name, 'package.json')).bin ?? {})) bin[command] = `lib/${name}/${path.replace(/^\.\//, '')}`;
  }
  return bin;
}

/** What the libraries ask the app to bring, as one set. A range they disagree on is an error. */
export function derivedPeers() {
  const peers = {};
  for (const name of includes()) {
    for (const [dependency, range] of Object.entries(readJson(join(packages, name, 'package.json')).peerDependencies ?? {})) {
      if (peers[dependency] !== undefined && peers[dependency] !== range) throw new Error(`${name} wants ${dependency} ${range}, and another library ${peers[dependency]}.`);
      peers[dependency] = range;
    }
  }
  return Object.fromEntries(Object.entries(peers).sort(([a], [b]) => a.localeCompare(b)));
}

/** Packages the libraries need that the package must list: none, so that installing it brings nothing else. */
export function derivedDependencies() {
  const found = {};
  for (const name of includes()) {
    for (const [dependency, range] of Object.entries(readJson(join(packages, name, 'package.json')).dependencies ?? {})) {
      if (!dependency.startsWith('@duyo/')) found[dependency] = range;
    }
  }
  return found;
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function main() {
  const sync = process.argv.includes('--sync');
  const current = manifest();
  const wanted = { exports: derivedExports(), bin: derivedBin(), peerDependencies: derivedPeers() };
  const stale = Object.entries(wanted).filter(([field, value]) => !same(current[field], value));
  const dependencies = derivedDependencies();
  if (Object.keys(dependencies).length > 0 && !same(current.dependencies, dependencies)) stale.push(['dependencies', dependencies]);

  if (stale.length > 0) {
    if (!sync) {
      throw new Error(`package.json is out of date for: ${stale.map(([field]) => field).join(', ')}. Run: node scripts/assemble.mjs --sync`);
    }
    for (const [field, value] of stale) current[field] = value;
    writeFileSync(join(root, 'package.json'), `${JSON.stringify(current, null, 2)}\n`);
    console.log(`duyo: updated ${stale.map(([field]) => field).join(', ')} in package.json`);
  }

  const out = assemble();
  const left = filesUnder(out).filter((file) => REWRITTEN.test(file) && /@duyo\//.test(readFileSync(file, 'utf8')));
  if (left.length > 0) throw new Error(`Names of the old packages are left in: ${left.join(', ')}`);
  console.log(`duyo: assembled ${includes().join(', ')} into ${out}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
