import { KindRegistry } from './registry.js';
import type { KindDefinition, KindInput } from './types.js';

/** Registry used by module-level `kind()` calls. A runtime may bring its own. */
export const defaultKindRegistry = new KindRegistry();

export interface KindOptions {
  registry?: KindRegistry;
  /** Development hot-replacement only. */
  allowReplace?: boolean;
}

/**
 * Declares a kind, as `enyo.kind` does. Inheritance is resolved as data by the registry
 * rather than through prototype chains. Returns the definition so it can be used as a
 * base: `kind({ name: 'B', kind: A })`.
 */
export function kind(definition: KindInput, options: KindOptions = {}): KindDefinition {
  const registry = options.registry ?? defaultKindRegistry;
  registry.register(definition, { allowReplace: options.allowReplace === true });
  return definition;
}

/** Alias of `kind`. */
export const defineKind = kind;
