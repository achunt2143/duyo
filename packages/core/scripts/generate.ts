import { writeFileSync } from 'node:fs';
import { coreKindTypes } from './kind-types.js';

writeFileSync(new URL('../src/control.gen.ts', import.meta.url), coreKindTypes());
