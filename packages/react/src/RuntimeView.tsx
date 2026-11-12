/** @jsxRuntime automatic @jsxImportSource react */
import { Runtime, warningDiagnostic, type Component, type RuntimeInternals } from '@duyo/core';
import type { ResolvedLayout } from '@duyo/layout';
import {
  createContext,
  memo,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
  type ComponentType,
  type CSSProperties,
  type ReactNode,
} from 'react';

import { filterAttributes } from './attributes.js';
import { domEventHandlersFor, tapHandlerFor } from './events.js';
import type { BindingProps, BubbleFn, HostProps, Renderer, WrapperProps } from './renderer.js';
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

const bubbleFns = new WeakMap<Component, BubbleFn>();

function bubbleFnFor(node: Component): BubbleFn {
  let fn = bubbleFns.get(node);
  if (!fn) {
    fn = (name, event) => node.bubble(name, event);
    bubbleFns.set(node, fn);
  }
  return fn;
}

function hostPropsFor(node: Component, style: CSSProperties): HostProps {
  const classes = node.get('classes');
  return {
    ...filterAttributes(node.get('attributes')),
    ...domEventHandlersFor(node),
    className: typeof classes === 'string' && classes !== '' ? classes : undefined,
    style,
    'data-duyo-kind': node.kind,
    'data-duyo-id': node.id,
    onClick: tapHandlerFor(node),
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

function renderNode(target: Component, targetStyle?: CSSProperties): ReactNode {
  return <NodeView key={target.id} node={target} childStyle={targetStyle} />;
}

function areStylesEqual(a: CSSProperties | undefined, b: CSSProperties | undefined): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  const keysA = Object.keys(a) as Array<keyof CSSProperties>;
  if (keysA.length !== Object.keys(b).length) return false;
  for (const key of keysA) {
    if (a[key] !== b[key]) return false;
  }
  return true;
}

interface NodeViewProps {
  node: Component;
  childStyle?: CSSProperties | undefined;
}

interface TrackedSnapshot {
  reads: Map<Component, Set<string>>;
  globalVersion: number;
  nodeVersion: number;
  props: Array<readonly [Component, string, number]>;
}

interface SubState {
  version: number;
  reads: Map<Component, Set<string>>;
  pending: TrackedSnapshot | null;
}

function mergeReads(into: Map<Component, Set<string>>, from: Map<Component, Set<string>>): void {
  for (const [target, keys] of from) {
    let dest = into.get(target);
    if (!dest) {
      dest = new Set<string>();
      into.set(target, dest);
    }
    for (const key of keys) dest.add(key);
  }
}

function captureSnapshot(runtime: Runtime, node: Component, reads: Map<Component, Set<string>>): TrackedSnapshot {
  const props: Array<readonly [Component, string, number]> = [];
  for (const [target, keys] of reads) {
    if (target === node) continue;
    for (const key of keys) props.push([target, key, runtime.propVersion(target, key)]);
  }
  return {
    reads,
    globalVersion: runtime.globalVersion,
    nodeVersion: runtime.nodeVersion(node),
    props,
  };
}

function hasSnapshotDrifted(runtime: Runtime, node: Component, snapshot: TrackedSnapshot | null): boolean {
  if (!snapshot) return false;
  if (runtime.globalVersion !== snapshot.globalVersion) return true;
  if (runtime.nodeVersion(node) !== snapshot.nodeVersion) return true;
  for (const [target, key, ver] of snapshot.props) {
    if (runtime.propVersion(target, key) !== ver) return true;
  }
  return false;
}

interface TrackedProps {
  bindingProps: BindingProps;
  onReads: (reads: Map<Component, Set<string>>) => void;
}

const trackedComponents = new WeakMap<ComponentType<BindingProps>, ComponentType<TrackedProps>>();

function getTrackedComponent(Bound: ComponentType<BindingProps>): ComponentType<TrackedProps> {
  let Tracked = trackedComponents.get(Bound);
  if (!Tracked) {
    const fn = Bound as (props: BindingProps) => ReactNode;
    Tracked = function TrackedBinding({ bindingProps, onReads }: TrackedProps): ReactNode {
      const runtime = bindingProps.node.runtime;
      if (!(runtime instanceof Runtime)) return fn(bindingProps);
      const { result, reads } = runtime.trackReads(() => fn(bindingProps));
      onReads(reads);
      return result;
    };
    Tracked.displayName = `Tracked(${Bound.displayName || Bound.name || 'Binding'})`;
    trackedComponents.set(Bound, Tracked);
  }
  return Tracked;
}

function isPlainFunctionComponent(component: ComponentType<BindingProps>): boolean {
  if (typeof component !== 'function') return false;
  const proto = component.prototype as { isReactComponent?: unknown } | undefined;
  return !proto?.isReactComponent;
}

const NodeView = memo(
  function NodeView({ node, childStyle }: NodeViewProps): ReactNode {
    const context = useContext(Context)!;
    const runtime = node.runtime;
    const scopedRuntime = runtime instanceof Runtime ? runtime : null;

    const subRef = useRef<SubState | null>(null);
    if (!subRef.current) {
      subRef.current = { version: 0, reads: new Map(), pending: null };
    }

    const subscribe = useCallback(
      (onStoreChange: () => void) => {
        if (!scopedRuntime) return runtime.subscribe(onStoreChange);
        if (hasSnapshotDrifted(scopedRuntime, node, subRef.current!.pending)) {
          subRef.current!.version++;
          onStoreChange();
        }
        return scopedRuntime.subscribeScoped(({ target, key }) => {
          const state = subRef.current!;
          if (!target || target === node) {
            state.version++;
            onStoreChange();
            return;
          }
          const keys = state.reads.get(target);
          if (keys && (!key || keys.has(key))) {
            state.version++;
            onStoreChange();
          }
        });
      },
      [runtime, scopedRuntime, node],
    );

    const getSnapshot = useCallback(
      () => (scopedRuntime ? subRef.current!.version : runtime.version),
      [scopedRuntime, runtime],
    );

    useSyncExternalStore(subscribe, getSnapshot);

    const binding = context.renderer.resolve(node);

    // As in Enyo, `rendered` fires once the component is on screen, children first.
    useEffect(() => {
      if (binding && !node.destroyed) node.rendered();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [node]);

    const onBoundReads = useCallback(
      (boundReads: Map<Component, Set<string>>) => {
        if (!scopedRuntime || boundReads.size === 0) return;
        const state = subRef.current!;
        mergeReads(state.reads, boundReads);
        state.pending = captureSnapshot(scopedRuntime, node, state.reads);
      },
      [scopedRuntime, node],
    );

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

    const prepare = (): BindingProps => {
      const children = node.children;
      const layout = binding.layout?.(node, children);
      const style: CSSProperties = {
        ...parseStyle(node.get('style')),
        ...(layout?.container as CSSProperties | undefined),
        ...childStyle,
        ...(node.get('showing') === false ? { display: 'none' } : {}),
      };
      return {
        node,
        hostProps: hostPropsFor(node, style),
        bubble: bubbleFnFor(node),
        childNodes: children,
        renderChildren: (of = node) => renderChildren(context, of, of === node ? layout : undefined),
        renderNode,
        children: renderChildren(context, node, layout),
      };
    };

    let bindingProps: BindingProps;
    if (scopedRuntime) {
      const tracked = scopedRuntime.trackReads(prepare);
      bindingProps = tracked.result;
      subRef.current.reads = tracked.reads;
      subRef.current.pending = captureSnapshot(scopedRuntime, node, tracked.reads);
    } else {
      bindingProps = prepare();
    }

    const Bound = binding.component;
    if (scopedRuntime && isPlainFunctionComponent(Bound)) {
      const Tracked = getTrackedComponent(Bound);
      return <Tracked bindingProps={bindingProps} onReads={onBoundReads} />;
    }
    return <Bound {...bindingProps} />;
  },
  (prev, next) => prev.node === next.node && areStylesEqual(prev.childStyle, next.childStyle),
);

export interface RuntimeViewProps {
  /** The component to draw, usually the result of `runtime.create(...)`. */
  root: Component;
  renderer: Renderer;
  /** Optional wrapper placed inside pack providers, receiving `{ children, runtime, root }`. */
  wrapper?: ComponentType<WrapperProps>;
}

/** Draws `root` and everything under it, subscribing each node to its own changes. */
export function RuntimeView({ root, renderer, wrapper: AppWrapper }: RuntimeViewProps): ReactNode {
  const runtime = root.runtime;

  const context = useMemo<ViewContext>(
    () => ({ renderer, runtime, reported: new Set() }),
    [renderer, runtime],
  );

  const runtimeInstance = runtime as Runtime;

  let tree: ReactNode = (
    <Context.Provider value={context}>
      <NodeView key={root.id} node={root} />
    </Context.Provider>
  );
  if (AppWrapper) {
    tree = (
      <AppWrapper runtime={runtimeInstance} root={root}>
        {tree}
      </AppWrapper>
    );
  }
  // Innermost pack wraps first, so earlier packs are the outer providers.
  for (const pack of [...renderer.packs].reverse()) {
    const Wrapper = pack.wrapper;
    if (Wrapper) {
      tree = (
        <Wrapper runtime={runtimeInstance} root={root}>
          {tree}
        </Wrapper>
      );
    }
  }
  return tree;
}
