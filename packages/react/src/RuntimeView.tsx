import { warningDiagnostic, type Component, type RuntimeInternals } from '@duyo/core';
import type { ResolvedLayout } from '@duyo/layout';
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type CSSProperties,
  type MouseEvent,
  type ReactNode,
} from 'react';

import type { HostProps, Renderer } from './renderer.js';
import { parseStyle } from './style.js';

export const RenderCodes = Object.freeze({
  NO_BINDING: 'DUYO_RENDER_001',
} as const);

interface ViewContext {
  renderer: Renderer;
  runtime: RuntimeInternals;
  /** Component ids already reported, so a re-render does not repeat a diagnostic. */
  reported: Set<string>;
}

const Context = createContext<ViewContext | null>(null);

/** DOM clicks bubble natively; Duyo bubbles its own events, so each click is bubbled once. */
const handledClicks = new WeakSet<object>();

function hostPropsFor(node: Component, style: CSSProperties): HostProps {
  const classes = node.get('classes');
  return {
    className: typeof classes === 'string' && classes !== '' ? classes : undefined,
    style,
    'data-duyo-kind': node.kind,
    'data-duyo-id': node.id,
    onClick: (event: MouseEvent<HTMLElement>) => {
      if (handledClicks.has(event.nativeEvent)) return;
      handledClicks.add(event.nativeEvent);
      node.bubble('ontap', { type: 'tap', nativeEvent: event.nativeEvent });
    },
  };
}

/** Renders the children of `of`, using `layout` if the caller already resolved it. */
function renderChildren(context: ViewContext, of: Component, layout?: ResolvedLayout): ReactNode {
  const children = of.children;
  const resolved = layout ?? context.renderer.resolve(of)?.layout?.(of, children);
  return children.map((child, index) => (
    <NodeView key={child.id} node={child} childStyle={resolved?.children[index] as CSSProperties | undefined} />
  ));
}

function NodeView({ node, childStyle }: { node: Component; childStyle?: CSSProperties | undefined }): ReactNode {
  const context = useContext(Context)!;
  const binding = context.renderer.resolve(node);

  // As in Enyo, `rendered` fires once the component is on screen, children first.
  useEffect(() => {
    if (binding && !node.destroyed) node.rendered();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node]);

  if (!binding) {
    if (!context.reported.has(node.id)) {
      context.reported.add(node.id);
      context.runtime.report(
        warningDiagnostic(
          RenderCodes.NO_BINDING,
          `No renderer binding for ${node.kind} or any of its base kinds (${node.resolved.ancestry.join(' > ')}).`,
          { hint: 'Add a binding for this kind, or have it extend a kind that has one, such as duyo.Control.', path: node.path },
        ),
      );
    }
    return null;
  }

  const children = node.children;
  const layout = binding.layout?.(node, children);
  const style: CSSProperties = {
    ...parseStyle(node.get('style')),
    ...(layout?.container as CSSProperties | undefined),
    ...childStyle,
    ...(node.get('showing') === false ? { display: 'none' } : {}),
  };

  const Bound = binding.component;
  return (
    <Bound
      node={node}
      hostProps={hostPropsFor(node, style)}
      bubble={(name, event) => node.bubble(name, event)}
      childNodes={children}
      renderChildren={(of = node) => renderChildren(context, of, of === node ? layout : undefined)}
      renderNode={(target, targetStyle) => <NodeView key={target.id} node={target} childStyle={targetStyle} />}
    >
      {renderChildren(context, node, layout)}
    </Bound>
  );
}

export interface RuntimeViewProps {
  /** The component to draw, usually the result of `runtime.create(...)`. */
  root: Component;
  renderer: Renderer;
}

/** Draws `root` and everything under it, and re-draws whenever its runtime changes. */
export function RuntimeView({ root, renderer }: RuntimeViewProps): ReactNode {
  const runtime = root.runtime;
  useSyncExternalStore(
    (listener) => runtime.subscribe(listener),
    () => runtime.version,
  );

  const context = useMemo<ViewContext>(
    () => ({ renderer, runtime, reported: new Set() }),
    [renderer, runtime],
  );

  let tree: ReactNode = (
    <Context.Provider value={context}>
      <NodeView node={root} />
    </Context.Provider>
  );
  // Innermost pack wraps first, so earlier packs are the outer providers.
  for (const pack of [...renderer.packs].reverse()) {
    const Wrapper = pack.wrapper;
    if (Wrapper) tree = <Wrapper>{tree}</Wrapper>;
  }
  return tree;
}
