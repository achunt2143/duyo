import { writeFileSync } from 'node:fs';
import { remochiKindTypes } from './kind-types.js';

writeFileSync(new URL('../src/kinds.gen.ts', import.meta.url), remochiKindTypes());
