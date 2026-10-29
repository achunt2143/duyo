import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { coreKindTypes } from '../../scripts/kind-types.js';

it('control.gen.ts is current', () => {
  const committed = readFileSync(join(process.cwd(), 'src', 'control.gen.ts'), 'utf8').replace(/\r\n/g, '\n');
  expect(committed, 'run: npm run gen:kinds -w @duyo/core').toBe(coreKindTypes());
});
