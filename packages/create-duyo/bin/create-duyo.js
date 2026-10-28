#!/usr/bin/env node
/**
 * create-duyo
 * Usage: npm create duyo@latest [project-name]
 *        npx create-duyo [project-name]
 */

import { mkdir, copyFile, readFile, writeFile, readdir } from 'fs/promises';
import { existsSync } from 'fs';
import { resolve, join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = resolve(__dirname, '../templates/default');

// ----------------------------------------------------------------
// Minimal color helpers (no dependencies)
// ----------------------------------------------------------------
const c = {
  bold:  (s) => `\x1b[1m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  cyan:  (s) => `\x1b[36m${s}\x1b[0m`,
  gray:  (s) => `\x1b[90m${s}\x1b[0m`,
  red:   (s) => `\x1b[31m${s}\x1b[0m`,
};

// ----------------------------------------------------------------
// Resolve project name from args
// ----------------------------------------------------------------
const args = process.argv.slice(2).filter(a => !a.startsWith('--'));
let projectName = args[0];

if (!projectName) {
  // npm create passes the name as the first non-flag arg;
  // if still missing, use a default.
  projectName = 'my-duyo-app';
}

const projectDir = resolve(process.cwd(), projectName);

// ----------------------------------------------------------------
// Guard: don't overwrite an existing non-empty directory
// ----------------------------------------------------------------
if (existsSync(projectDir)) {
  const entries = await readdir(projectDir);
  if (entries.length > 0) {
    console.error(c.red(`\nError: Directory "${projectName}" already exists and is not empty.`));
    process.exit(1);
  }
}

console.log();
console.log(c.bold(`  Duyo`) + c.gray(' — Enyo-style apps, modern tooling'));
console.log();
console.log(`  Scaffolding project in ${c.cyan(projectDir)}`);
console.log();

// ----------------------------------------------------------------
// Recursively copy template, substituting {{PROJECT_NAME}}
// ----------------------------------------------------------------
async function copyTemplate(srcDir, destDir, name) {
  await mkdir(destDir, { recursive: true });
  const entries = await readdir(srcDir, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath  = join(srcDir, entry.name);
    // Template gitignore is stored as _gitignore to avoid npm ignoring it
    const destName = entry.name === '_gitignore' ? '.gitignore' : entry.name;
    const destPath = join(destDir, destName);

    if (entry.isDirectory()) {
      await copyTemplate(srcPath, destPath, name);
    } else {
      let content = await readFile(srcPath, 'utf-8');
      // Token substitution
      content = content
        .replaceAll('{{PROJECT_NAME}}', name)
        .replaceAll('{{PROJECT_NAME_PASCAL}}', toPascal(name));
      await writeFile(destPath, content, 'utf-8');
    }
  }
}

function toPascal(str) {
  return str
    .split(/[-_\s]+/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join('');
}

await copyTemplate(TEMPLATES_DIR, projectDir, projectName);

// ----------------------------------------------------------------
// Done — print next steps
// ----------------------------------------------------------------
console.log(c.green('  ✓ Done!'));
console.log();
console.log('  Next steps:');
console.log();
console.log(c.gray('  $ ') + c.bold(`cd ${projectName}`));
console.log(c.gray('  $ ') + c.bold('npm install'));
console.log(c.gray('  $ ') + c.bold('npm run dev'));
console.log();
console.log(c.gray('  Then open: ') + c.cyan('http://localhost:5173'));
console.log();
