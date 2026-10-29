import type { KindRegistry } from '@duyo/core';

/**
 * What the designer knows about kinds, read from the registry: the same published
 * properties, `allowed` values and events the runtime checks. Nothing here is specific to a
 * pack, so any pack installed in the registry shows up in the palette and the inspector.
 */

export type ValueType = 'string' | 'number' | 'boolean' | 'choice' | 'json' | 'any';

export interface PropertyInfo {
  name: string;
  type: ValueType;
  default: unknown;
  allowed?: readonly unknown[];
  /** Declared by duyo.Control or duyo.Component rather than by the kind itself. */
  inherited: boolean;
}

export interface KindInfo {
  name: string;
  /** `mochi` for `mochi.Button`. */
  group: string;
  /** `Button` for `mochi.Button`. */
  label: string;
  properties: PropertyInfo[];
  /** Events a component of this kind can raise, each a place to name a handler. */
  events: string[];
  /** Can hold child components without the designer having to guess. */
  container: boolean;
}

const BASE_KINDS = new Set(['duyo.Component', 'duyo.Control']);
const CONTAINERS = new Set(['duyo.FittableRows', 'duyo.FittableColumns']);

export function typeOf(declaration: { default?: unknown; allowed?: readonly unknown[] }): ValueType {
  const { allowed, default: value } = declaration;
  if (allowed && allowed.length > 0 && allowed.every((v) => ['string', 'number', 'boolean'].includes(typeof v))) return 'choice';
  if (typeof value === 'string') return 'string';
  if (typeof value === 'number') return 'number';
  if (typeof value === 'boolean') return 'boolean';
  if (value !== null && typeof value === 'object') return 'json';
  return 'any';
}

export function kindInfo(registry: KindRegistry, name: string): KindInfo {
  const resolved = registry.resolve(name);
  const control = resolved.ancestry.includes('duyo.Control');
  const baseProperties = new Set(control ? registry.resolve('duyo.Control').published.keys() : []);

  const properties: PropertyInfo[] = [...resolved.published].map(([property, declaration]) => ({
    name: property,
    type: typeOf(declaration),
    default: declaration.default,
    ...(declaration.allowed ? { allowed: declaration.allowed } : {}),
    inherited: baseProperties.has(property) && !BASE_KINDS.has(name),
  }));
  // The kind's own properties first, then the ones every control has.
  properties.sort((a, b) => Number(a.inherited) - Number(b.inherited));

  const events = [...resolved.events];
  if (control && !events.includes('ontap')) events.unshift('ontap');

  const dot = name.lastIndexOf('.');
  return {
    name,
    group: dot > 0 ? name.slice(0, dot) : '',
    label: dot > 0 ? name.slice(dot + 1) : name,
    properties,
    events,
    container: resolved.ancestry.some((k) => CONTAINERS.has(k)) || name === 'duyo.Control',
  };
}

/**
 * Kinds worth offering in the palette: everything registered except the root kind and the
 * designer's own (`Designer.*`), grouped by their prefix.
 */
export function paletteKinds(registry: KindRegistry): KindInfo[] {
  return registry
    .names()
    .filter((name) => name !== 'duyo.Component' && !name.startsWith('Designer.'))
    .map((name) => kindInfo(registry, name))
    .sort((a, b) => a.group.localeCompare(b.group) || a.label.localeCompare(b.label));
}

/** A new component of `kind`, with enough content to be visible and selectable. */
export function newComponent(info: KindInfo): Record<string, unknown> {
  const hasContent = info.properties.some((p) => p.name === 'content');
  return hasContent && !info.container ? { kind: info.name, content: info.label } : { kind: info.name };
}
