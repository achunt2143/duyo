import type { Component, KindDefinition, KindReference } from '@duyo/core';
import { createElement, type CSSProperties, type ElementType, type MouseEvent, type ReactNode } from 'react';

import type { BindingProps, KindPack, RendererBinding } from './renderer.js';

/**
 * Everything a props mapper can use. It is the binding's own props, so a mapper can
 * bubble events, read the rendered children, or render children itself.
 */
export type AdaptContext = BindingProps;

export interface AdaptOptions {
  /** Name of the Duyo kind to create, e.g. `acme.Button`. */
  name: string;
  /** Base kind. Default `duyo.Control`, which brings content, classes, style, showing and fit. */
  kind?: KindReference;
  /** Any React component from any library. */
  component: ElementType;
  /** Properties a Duyo user can set, with defaults and optional `allowed` values. */
  published?: Record<string, unknown>;
  /** Events the kind raises, as `{ onChange: '' }`, which creates `doChange()`. */
  events?: Record<string, unknown>;
  /** Further kind members: methods and property defaults, exactly as in `kind()`. */
  members?: Record<string, unknown> & ThisType<Component>;
  /**
   * Turns the Duyo component into the library component's props. Read published values
   * with `node.get('x')` (or `node.x`) and wire the library's callbacks to Duyo with
   * `node.set(...)` and `node.doChange(...)` / `ctx.bubble(...)`.
   *
   * Duyo children arrive as React `children` unless the mapper returns its own.
   */
  props?: (node: BindingProps['node'], context: AdaptContext) => Record<string, unknown>;
  /**
   * How Duyo's class, style, identity, `fit` layout and `ontap` reach the DOM.
   *
   * - `wrap` (default): on a `<div>` around the library component. Works with any library.
   * - `props`: merged into the library component's `className` / `style`, and `ontap`
   *   into its `onClick`. Use when the component forwards them to its root element and a
   *   wrapper would get in the way.
   * - `none`: dropped.
   */
  host?: 'wrap' | 'props' | 'none';
  /** Base style for the wrapper, under the user's own style and layout. */
  hostStyle?: CSSProperties;
  /**
   * React `key` for the library element. Use it to remount a library component that only
   * reads a prop at mount, when the value changes from outside.
   */
  key?: (node: BindingProps['node']) => string | number | undefined;
  /** For container kinds that lay their children out. */
  layout?: RendererBinding['layout'];
}

/** One kind and how to draw it. Collect them with `createPack`. */
export interface PackEntry {
  name: string;
  kind: KindDefinition;
  binding: RendererBinding;
}

const joinClasses = (...classes: unknown[]) =>
  classes.filter((c): c is string => typeof c === 'string' && c !== '').join(' ') || undefined;

/**
 * Makes a React component from any library usable as a Duyo kind. This is the whole of
 * the porting story: a whole UI library can be packaged with nothing else.
 *
 *     adapt({
 *       name: 'acme.Button',
 *       component: AcmeButton,
 *       published: { label: 'OK', variant: { default: 'primary', allowed: ['primary', 'quiet'] } },
 *       props: (node) => ({ variant: node.variant, children: node.label }),
 *     })
 */
export function adapt(options: AdaptOptions): PackEntry {
  const { name, component: Library, host = 'wrap', hostStyle } = options;

  const kind: KindDefinition = {
    ...options.members,
    name,
    kind: options.kind ?? 'duyo.Control',
    ...(options.published ? { published: options.published } : {}),
    ...(options.events ? { events: options.events } : {}),
  };

  function Adapted(bindingProps: BindingProps): ReactNode {
    const { node, hostProps, children, childNodes } = bindingProps;
    const mapped = options.props ? options.props(node, bindingProps) : {};
    const key = options.key?.(node);
    // An empty array would defeat a library's own default children.
    const defaults = { children: childNodes.length > 0 ? children : undefined };
    // A disabled control does not tap.
    const tap = node.get('disabled') === true ? undefined : hostProps.onClick;

    if (host === 'props') {
      const style = mapped['style'] as CSSProperties | undefined;
      const own = mapped['onClick'] as ((event: MouseEvent<HTMLElement>) => void) | undefined;
      return createElement(Library, {
        key,
        ...defaults,
        ...mapped,
        className: joinClasses(mapped['className'], hostProps.className),
        style: { ...hostProps.style, ...style },
        // `ontap` too, for components that forward onClick to their root.
        onClick: own && tap ? (event: MouseEvent<HTMLElement>) => { own(event); tap(event); } : (own ?? tap),
        'data-duyo-kind': hostProps['data-duyo-kind'],
        'data-duyo-id': hostProps['data-duyo-id'],
      });
    }

    const inner = createElement(Library, { key, ...defaults, ...mapped });
    if (host === 'none') return inner;

    const { onClick: _onClick, ...rest } = hostProps;
    const wrapperProps = { ...rest, onClick: tap };
    return createElement('div', { ...wrapperProps, style: { ...hostStyle, ...hostProps.style } }, inner);
  }
  Adapted.displayName = `Adapted(${name})`;

  return {
    name,
    kind,
    binding: { component: Adapted, ...(options.layout ? { layout: options.layout } : {}) },
  };
}

export interface CreatePackOptions {
  /** For providers: themes, i18n, a design system's root component. */
  wrapper?: KindPack['wrapper'];
  /** Kinds that need no adapter, or whose binding you write by hand. */
  kinds?: KindPack['kinds'];
  bindings?: KindPack['bindings'];
}

/** Bundles adapted kinds into a pack ready for `installPack` and `createRenderer`. */
export function createPack(name: string, entries: readonly PackEntry[], options: CreatePackOptions = {}): KindPack {
  const pack: KindPack = {
    name,
    kinds: [...(options.kinds ?? []), ...entries.map((entry) => entry.kind)],
    bindings: {
      ...options.bindings,
      ...Object.fromEntries(entries.map((entry) => [entry.name, entry.binding])),
    },
  };
  return options.wrapper ? { ...pack, wrapper: options.wrapper } : pack;
}
