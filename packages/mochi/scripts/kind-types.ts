import { KindRegistry } from '@duyo/core';
import { installPack } from '@duyo/react';
import { generateKindTypes } from '@duyo/views';
import { mochiPack } from '../src/index.js';

/** Types for every mochi kind. Run: `npm run gen:kinds -w @duyo/mochi`. */
export function mochiKindTypes(): string {
  const registry = new KindRegistry();
  installPack(registry, mochiPack);
  return generateKindTypes(registry, mochiPack.kinds.map((kind) => kind.name), {
    source: '@duyo/mochi',
    bases: { 'duyo.Control': 'ControlMembers' },
  });
}

