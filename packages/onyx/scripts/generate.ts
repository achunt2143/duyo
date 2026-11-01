import { writeFileSync } from 'node:fs';
import { onyxKindTypes } from './kind-types.js';

writeFileSync(new URL('../src/kinds.gen.ts', import.meta.url), onyxKindTypes());
