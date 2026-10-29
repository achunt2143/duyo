#!/usr/bin/env node
// @ts-check
/**
 * duyo-views [dir ...] [--check]
 *
 * Validates every `*.view.json` under each dir (default `src`) and writes its `.view.gen.ts`.
 * With --check, writes nothing and fails if a spec is invalid or a types file is stale: run
 * it before `tsc` in CI so the code-behinds are checked against their current specs.
 */
import { relative, resolve } from 'node:path';

import { findViews, formatDiagnostic, syncViewTypes } from '../src/index.js';

const args = process.argv.slice(2);
const check = args.includes('--check');
const dirs = args.filter((arg) => !arg.startsWith('--'));

let failed = false;
let count = 0;

for (const dir of dirs.length > 0 ? dirs : ['src']) {
  for (const file of findViews(resolve(dir))) {
    count++;
    const result = syncViewTypes(file, { check });
    const shown = relative(process.cwd(), file);
    for (const diagnostic of result.diagnostics) {
      console.error(formatDiagnostic(diagnostic, shown));
      if (diagnostic.severity === 'error') failed = true;
    }
    if (result.changed) {
      const types = relative(process.cwd(), result.typesFile);
      if (check) {
        console.error(`${types} is out of date with ${shown}. Run duyo-views to regenerate it.`);
        failed = true;
      } else {
        console.log(`updated ${types}`);
      }
    }
  }
}

console.log(`duyo-views: ${count} view${count === 1 ? '' : 's'} ${check ? 'checked' : 'synced'}${failed ? ', with problems' : ''}.`);
process.exit(failed ? 1 : 0);
