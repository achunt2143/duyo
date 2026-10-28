import type { Component } from './component.js';

export interface PublishedDefinition {
  default?: unknown;
  /** Closed set of legal values. Violations are reported, not thrown. */
  allowed?: readonly unknown[];
  required?: boolean;
}

/** A kind named by string, or by the definition `kind()` returned, as `kind: Counter`. */
export type KindReference = string | { readonly name: string };

export function kindName(reference: KindReference): string {
  return typeof reference === 'string' ? reference : reference.name;
}

/**
 * Declared as in `enyo.kind`: reserved keys below, then everything else is either a
 * method (a function) or an instance property with a default (anything else).
 *
 *     kind({
 *       name: 'App.Counter',
 *       kind: 'duyo.Control',
 *       published: { step: 1 },
 *       events: { onChange: '' },
 *       components: [{ name: 'label' }],
 *       create() { this.inherited(arguments); },
 *       increment() { this.doChange({ value: 1 }); },
 *     });
 */
export interface KindDefinition {
  /** Dotted name, e.g. `App.Counter`. */
  name: string;
  /** Base kind. Defaults to `duyo.Component`. */
  kind?: KindReference;
  /**
   * Public properties. A bare value is the default (`{ label: 'Hi' }`); an object with
   * `default` / `allowed` / `required` is a full declaration. Each becomes an instance
   * property with `getX()`, `setX()` and an `xChanged()` observer hook.
   */
  published?: Record<string, unknown>;
  /** `{ onChange: '' }` creates a `doChange(event)` method that bubbles `onChange`. */
  events?: Record<string, unknown>;
  /** Event name -> method name on this kind, handled by the component itself. */
  handlers?: Record<string, string>;
  /** Components this kind creates for itself. A subkind's block replaces its base's. */
  components?: ComponentDefinition[];
  /** Immutable metadata. */
  statics?: Record<string, unknown>;
  [member: string]: unknown;
}

/** Accepts methods whose `this` is the component, wherever a kind is declared. */
export type KindInput = KindDefinition & ThisType<Component>;

/**
 * A component usage. A string-valued `on<Event>` names a handler on the owner (a
 * method first, a registered action second). Everything else is a property.
 */
export interface ComponentDefinition {
  kind?: KindReference;
  name?: string;
  components?: ComponentDefinition[];
  [property: string]: unknown;
}

/** The object handed to handlers. `originator` is the component that first bubbled it. */
export interface ComponentEvent {
  originator?: Component;
  type?: string;
  [field: string]: any;
}
