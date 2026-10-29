import { KindRegistry } from '@duyo/core';
import { installPack } from '@duyo/react';
import { generateKindTypes } from '@duyo/views';
import { remochiPack } from '../src/index.js';

/** Types for every mochi kind. Run: `npm run gen:kinds -w @duyo/remochi`. */
export function remochiKindTypes(): string {
  const registry = new KindRegistry();
  installPack(registry, remochiPack);
  return generateKindTypes(registry, remochiPack.kinds.map((kind) => kind.name), {
    source: '@duyo/remochi',
    bases: { 'duyo.Control': 'ControlMembers' },
  });
}

