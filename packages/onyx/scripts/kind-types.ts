import { KindRegistry } from '@duyo/core';
import { installPack } from '@duyo/react';
import { generateKindTypes } from '@duyo/views';
import { onyxPack } from '../src/index.js';

/** Types for every onyx kind. Run: `npm run gen:kinds -w @duyo/onyx`. */
export function onyxKindTypes(): string {
  const registry = new KindRegistry();
  installPack(registry, onyxPack);
  return generateKindTypes(registry, onyxPack.kinds.map((kind) => kind.name), {
    source: '@duyo/onyx',
    bases: { 'duyo.Control': 'ControlMembers' },
  });
}
