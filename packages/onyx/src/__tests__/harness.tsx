import { KindRegistry, createRuntime, type Component, type ComponentDefinition } from '@duyo/core';
import { RuntimeView, basePack, createRenderer, installPack } from '@duyo/react';
import { render } from '@testing-library/react';

import { onyxPack } from '../index.js';

/** Draws one definition with the base and Onyx packs; returns the runtime, root and DOM. */
export function draw(definition: ComponentDefinition) {
  // A definition with methods in it is a kind, so its handlers exist from the start.
  const registry = new KindRegistry();
  const packs = [basePack, onyxPack];
  for (const pack of packs) installPack(registry, pack);
  const runtime = createRuntime({ registry });
  const renderer = createRenderer(packs);
  const hasMethods = Object.values(definition).some((value) => typeof value === 'function');
  if (hasMethods) registry.register({ ...definition, name: 'Test.Root' });
  const root: Component = runtime.create(hasMethods ? { kind: 'Test.Root' } : definition);
  const result = render(<RuntimeView root={root} renderer={renderer} />);
  return { runtime, root, ...result };
}
