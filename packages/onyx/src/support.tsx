/** @jsxRuntime automatic @jsxImportSource react */
import type { Component, ComponentDefinition, KindInput } from '@duyo/core';
import type { BindingProps, HostProps, PackEntry, RendererBinding } from '@duyo/react';
import type { ComponentType, ReactNode } from 'react';

/** Helpers every Onyx kind uses. Only public `@duyo/core` and `@duyo/react` API. */

export type ClassValue = string | false | null | undefined;

/** Joins class names, skipping the falsy ones. */
export const cx = (...parts: ClassValue[]): string => parts.filter(Boolean).join(' ');

/** Methods and defaults for a kind, with `this` as the component. */
export type Members = Record<string, unknown> & ThisType<Component>;

/** One kind and the component that draws it. */
export function entry(
  kind: KindInput,
  component: ComponentType<BindingProps>,
  extra: Omit<RendererBinding, 'component'> = {},
): PackEntry {
  return { name: kind.name, kind, binding: { component, ...extra } };
}

/**
 * What a binding spreads onto its root element: Duyo's identity, style and tap, with the
 * kind's own classes first and the user's `classes` last. A disabled control does not tap.
 */
export function host(props: BindingProps, classes: ClassValue[], disabled = false): HostProps {
  const { hostProps } = props;
  return {
    ...hostProps,
    className: cx(...classes, hostProps.className) || undefined,
    ...(disabled ? { onClick: undefined } : {}),
  };
}

/**
 * Enyo 1.0's `HFlexLayout` and `VFlexLayout`: a child with `fit` (Enyo's `flex: 1`) takes the room the others leave,
 * and the rest keep their own size. The container is a flexbox in the kind's CSS; this styles the children.
 */
export const flexLayout: NonNullable<RendererBinding['layout']> = (_node, children) => ({
  container: {},
  children: children.map((child): Record<string, string | number> => {
    if (child.get('showing') === false) return {};
    return child.get('fit') === true ? { flex: '1 1 0%', minWidth: 0, minHeight: 0 } : { flex: '0 0 auto' };
  }),
});

/** `content`, then the rendered children, as a plain Duyo control draws them. */
export function inner({ node, children }: Pick<BindingProps, 'node' | 'children'>): ReactNode {
  const content = node.get('content');
  return (
    <>
      {typeof content === 'string' && content !== '' ? content : null}
      {children}
    </>
  );
}

/** The element a Duyo component was drawn as. */
export function elementOf(target: Component | undefined | null): HTMLElement | null {
  return target ? document.querySelector<HTMLElement>(`[data-duyo-id="${target.id}"]`) : null;
}

/**
 * Enyo's `defaultKind`: a child written without a `kind` becomes this one. Spread it into a
 * kind that expects a certain sort of child, as `onyx.Menu` expects `onyx.MenuItem`s.
 */
export const defaultKind = (name: string): Members => ({
  defaultKind: name,
  createClientComponents(definitions: ComponentDefinition[]) {
    const fallback = this.get('defaultKind');
    const resolved =
      typeof fallback === 'string' && fallback !== ''
        ? definitions.map((definition) => (definition.kind === undefined ? { ...definition, kind: fallback } : definition))
        : definitions;
    return this.inherited(resolved);
  },
});

/** Does this component's kind, or any kind it extends, have this name? */
export const isKind = (component: Component, name: string): boolean => component.resolved.ancestry.includes(name);

export const clamp = (min: number, max: number, value: number): number => Math.max(min, Math.min(value, max));

/**
 * Runs `step` with values from `from` to `to` over `duration` ms, then `end`. Returns a
 * function that stops it. Stands in for `enyo.Animator`.
 */
export function animate(
  from: number,
  to: number,
  step: (value: number) => void,
  end: () => void,
  duration = 350,
): () => void {
  const start = performance.now();
  let frame = 0;
  const tick = (now: number) => {
    const t = Math.min(1, (now - start) / duration);
    // ease-in-out, as Enyo's default
    const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    step(from + (to - from) * eased);
    if (t < 1) frame = requestAnimationFrame(tick);
    else end();
  };
  frame = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(frame);
}
