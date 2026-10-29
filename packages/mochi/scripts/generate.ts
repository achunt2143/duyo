import { writeFileSync } from 'node:fs';
import { mochiKindTypes } from './kind-types.js';

writeFileSync(new URL('../src/kinds.gen.ts', import.meta.url), mochiKindTypes());
