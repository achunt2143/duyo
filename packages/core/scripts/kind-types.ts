import { generateKindTypes } from '@duyo/views';
import { KindRegistry } from '../src/index.js';

/** Types for the kinds core registers itself. Run: `npm run gen:kinds -w @duyo/core`. */
export const coreKindTypes = () =>
  generateKindTypes(new KindRegistry(), ['duyo.Control'], { source: '@duyo/core', module: './index.js', augment: false, names: { 'duyo.Control': 'ControlMembers' } });

