import type { Component, ComponentEvent, KindDefinition, KindRegistry } from '@duyo/core';
import type { ResolvedLayout } from '@duyo/layout';
import type { ComponentType, CSSProperties, HTMLAttributes, ReactNode } from 'react';

/** Bubbles an event from the component being drawn. `true` means a handler stopped it. */
export type BubbleFn = (name: string, event?: ComponentEvent) => boolean;

/** Everything a binding should spread onto the element it renders. */
export type HostProps = HTMLAttributes<HTMLElement> & {
  className?: string;
  style: CSSProperties;
  'data-duyo-kind': string;
  'data-duyo-id': string;
};

export interface BindingProps {
  node: Component;
  hostProps: HostProps;
  /** Rendered children of `node`. */
  children: ReactNode;
  bubble: BubbleFn;
  /** The component's children, for bindings that arrange them themselves. */
  childNodes: readonly Component[];
  /**
   * Renders the children of `of` (default: this node), laid out by its binding. Use it when
   * the library component must build its own child elements, as stacked panels do.
   */
  renderChildren: (of?: Component) => ReactNode;
  /** Renders one component through its own binding. */
  renderNode: (node: Component, style?: CSSProperties) => ReactNode;
}

export interface RendererBinding {
  component: ComponentType<BindingProps>;
  /**
   * Containers decide how their children are laid out. The result's `container` merges
   * into the container's own style and `children[i]` into the i-th child's.
   */
  layout?: (node: Component, children: readonly Component[]) => ResolvedLayout;
}

/**
 * A design system's contribution to Duyo: the kinds it understands and how to draw them.
 * Any UI library is wrapped as one of these; the framework has no favourites.
 */
export interface KindPack {
  name: string;
  kinds: readonly KindDefinition[];
  /** Keyed by kind name. A node uses its nearest ancestor kind that has a binding. */
  bindings: Readonly<Record<string, RendererBinding>>;
  /** For things like theme providers. */
  wrapper?: ComponentType<{ children: ReactNode }>;
}

/** Registers a pack's kinds. Throws on a name clash unless `allowReplace` is set. */
export function installPack(
  registry: KindRegistry,
  pack: KindPack,
  options: { allowReplace?: boolean } = {},
): void {
  for (const kind of pack.kinds) registry.register(kind, options);
}

export class Renderer {
  readonly packs: readonly KindPack[];
  readonly #bindings = new Map<string, RendererBinding>();

  /** Later packs override earlier ones for the same kind name. */
  constructor(packs: readonly KindPack[]) {
    this.packs = packs;
    for (const pack of packs) {
      for (const [kind, binding] of Object.entries(pack.bindings)) this.#bindings.set(kind, binding);
    }
  }

  /**
   * Most-derived binding for a node. `App.Counter` extending `duyo.Control` draws as a
   * Control until a pack binds something more specific.
   */
  resolve(node: Component): RendererBinding | undefined {
    for (let i = node.resolved.ancestry.length - 1; i >= 0; i--) {
      const binding = this.#bindings.get(node.resolved.ancestry[i]!);
      if (binding) return binding;
    }
    return undefined;
  }

  kinds(): string[] {
    return [...this.#bindings.keys()].sort();
  }
}

export function createRenderer(packs: readonly KindPack[]): Renderer {
  return new Renderer(packs);
}
