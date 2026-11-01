import type { Component, KindInput } from '@duyo/core';
import type { BindingProps, PackEntry } from '@duyo/react';
import { useLayoutEffect, useRef, useState, type PointerEvent } from 'react';

import { SlidingEngine, type SlidingHost } from './sliding-engine.js';
import { cx, defaultKind, entry, flexLayout, host, inner, isKind } from './support.js';

/**
 * `SlidingPane`, `SlidingView` and `GrabButton`, from the Onyx theme of webOS's Enyo 1.0.
 *
 * A sliding pane is a row of views that slide over one another. The user drags a view left and right and
 * the views stay connected; a view moved to the far left covers the views before it, with `peekWidth` of
 * the one under it left showing. A control with the class `onyx-sliding-handler` (a `GrabButton` is one)
 * drags a view and, when tapped, selects it, or the view before it if it is already selected.
 *
 * The maths is in `sliding-engine.ts`, a port of Enyo's; this file draws the views and turns pointer
 * events into the drag events that engine expects.
 */

const num = (value: unknown, fallback: number): number => (typeof value === 'number' && !Number.isNaN(value) ? value : fallback);
const isView = (component: Component): boolean => isKind(component, 'onyx.SlidingView');

/** The views of a pane, in order. */
const viewsOf = (pane: Component): Component[] => pane.children.filter(isView);

// ---------------------------------------------------------------------------
// Kinds
// ---------------------------------------------------------------------------

const slidingPane: KindInput = {
  name: 'onyx.SlidingPane',
  kind: 'duyo.Control',
  published: {
    /** The index of the selected view: the one shown at the far left. */
    selected: 0,
    /** Whether views sit side by side; false stacks them, each the width of the pane. */
    multiView: true,
    /** The window width above which \`multiView\` is on, when \`resize()\` is called. 0 keeps it off. */
    multiViewMinWidth: 500,
    canAnimate: true,
    /** How far right a dismissible view is dragged before it goes. */
    dismissDistance: 100,
  },
  events: { onSelectView: '', onSlideComplete: '' },
  ...defaultKind('onyx.SlidingView'),

  // The selection methods of Enyo's Pane
  getViewList(this: Component): Component[] {
    return viewsOf(this);
  },
  getViewCount(this: Component): number {
    return viewsOf(this).length;
  },
  getView(this: Component): Component | undefined {
    return viewsOf(this)[this.get('selected') as number];
  },
  getViewIndex(this: Component): number {
    return this.get('selected') as number;
  },
  getViewName(this: Component): string | undefined {
    return this.getView()?.name;
  },
  viewByIndex(this: Component, index: number): Component | undefined {
    return viewsOf(this)[index];
  },
  viewByName(this: Component, name: string): Component | undefined {
    return viewsOf(this).find((view) => view.name === name);
  },
  indexOfView(this: Component, view: Component): number {
    return viewsOf(this).indexOf(view);
  },
  /** Selects a view, which slides into place. Asynchronous unless \`immediately\`. */
  selectView(this: Component, view: Component, immediately = false) {
    this.selectViewByIndex(this.indexOfView(view), immediately);
  },
  selectViewByName(this: Component, name: string, immediately = false) {
    const view = this.viewByName(name);
    if (view) this.selectView(view, immediately);
    return view;
  },
  selectViewByIndex(this: Component, index: number, immediately = false) {
    const view = viewsOf(this)[index];
    if (!view) return undefined;
    if (this.engine) this.engine.select(index, immediately);
    else this.props['selected'] = index;
    return view;
  },
  /** Selects the view that was selected before. */
  back(this: Component) {
    const index = (this.history as number[] | undefined)?.pop();
    if (index === undefined) return;
    this.backTo = index;
    this.engine?.select(index);
  },
  /** Call when the pane's size may have changed (it does so by itself for the window). */
  resize(this: Component, stopPropagation = false) {
    const min = this.get('multiViewMinWidth') as number;
    this.setMultiView(min > 0 && window.innerWidth > min);
    this.engine?.validateViews(stopPropagation);
  },
  selectedChanged(this: Component, _previous: number, index: number) {
    this.selectViewByIndex(index);
  },
  multiViewChanged(this: Component) {
    this.engine?.validateViews();
  },
  canAnimateChanged(this: Component, _previous: boolean, value: boolean) {
    if (this.engine) this.engine.canAnimate = value;
  },
  dismissDistanceChanged(this: Component, _previous: number, value: number) {
    if (this.engine) this.engine.dismissDistance = value;
  },
};

const slidingView: KindInput = {
  name: 'onyx.SlidingView',
  kind: 'duyo.Control',
  published: {
    /** The view can be dragged from anywhere in it that is not itself a drag surface. */
    dragAnywhere: true,
    /** The view can be dragged by its left edge. */
    edgeDragging: false,
    /** Its content keeps its width when the pane is resized. */
    fixedWidth: false,
    /** The content is at least this wide. */
    minWidth: 0,
    /** How far the view under this one shows, when this one is selected. */
    peekWidth: 0,
    /** Dragged far enough to the right, the view goes. */
    dismissible: false,
    /** The soft shadow on its left edge. */
    shadow: true,
  },
  events: { onResize: '', onShow: '', onHide: '' },
  paneOf(this: Component): Component | undefined {
    return this.parent && isKind(this.parent, 'onyx.SlidingPane') ? this.parent : undefined;
  },
  select(this: Component) {
    this.paneOf()?.selectView(this);
  },
  selectPrevious(this: Component) {
    const pane = this.paneOf();
    const index = pane?.indexOfView(this) ?? -1;
    if (index > 0) pane!.selectViewByIndex(index - 1);
  },
  selectNext(this: Component) {
    const pane = this.paneOf();
    const index = pane?.indexOfView(this) ?? -1;
    if (pane && index >= 0 && index + 1 < pane.getViewCount()) pane.selectViewByIndex(index + 1);
  },
  /** Selects this view, or, if it is already selected, the one before it. */
  toggleSelected(this: Component) {
    const pane = this.paneOf();
    if (pane?.getView() === this) this.selectPrevious();
    else this.select();
  },
  showingChanged(this: Component, _previous: boolean, showing: boolean) {
    const pane = this.paneOf();
    // a view that is hidden slides out to the right, and one that is shown slides in
    pane?.engine?.viewShowingChanged(pane.indexOfView(this), showing);
    if (showing) this.doShow();
    else this.doHide();
  },
  fixedWidthChanged(this: Component) {
    this.paneOf()?.engine?.validateViews();
  },
  peekWidthChanged(this: Component) {
    this.paneOf()?.engine?.validateViews();
  },
};

// ---------------------------------------------------------------------------
// Drawing
// ---------------------------------------------------------------------------

const HANDLER = 'onyx-sliding-handler';

/** The drag handler under `target`, within `view`: a control with the \`onyx-sliding-handler\` class. */
function findHandler(target: EventTarget | null, view: Element): Element | undefined {
  for (let element = target as Element | null; element && view.contains(element); element = element.parentElement) {
    if (element.classList?.contains(HANDLER)) return element;
  }
  return undefined;
}

const HYSTERESIS = 4;

function SlidingPaneView(binding: BindingProps) {
  const { node } = binding;
  const root = useRef<HTMLDivElement>(null);
  const row = useRef<HTMLDivElement>(null);
  const press = useRef<{ x: number; y: number; view: number; target: EventTarget | null; started: boolean } | null>(null);
  const swallowClick = useRef(false);
  const multiView = node.get('multiView') === true;

  const [engine] = useState(() => {
    const viewElement = (index: number): HTMLElement | null => {
      const view = viewsOf(node)[index];
      return view ? (row.current?.querySelector<HTMLElement>(`:scope > [data-duyo-id="${view.id}"]`) ?? null) : null;
    };
    const clientOf = (index: number) => viewElement(index)?.querySelector<HTMLElement>(':scope > .onyx-sliding-view-client') ?? null;
    const at = (index: number): Component => viewsOf(node)[index]!;
    const pane: SlidingHost = {
      count: () => viewsOf(node).length,
      // in a single column every view is as wide as the pane, with nothing peeking
      info: (index) => {
        const view = at(index);
        const multi = node.get('multiView') === true;
        return {
          showing: view.get('showing') !== false,
          peekWidth: multi ? num(view.get('peekWidth'), 0) : 0,
          fixedWidth: multi ? view.get('fixedWidth') === true : true,
          dismissible: view.get('dismissible') === true,
        };
      },
      leftOffset: (index) => viewElement(index)?.offsetLeft ?? 0,
      paneWidth: () => row.current?.offsetWidth ?? 0,
      setTransform: (index, x) => {
        const element = viewElement(index);
        if (element) element.style.transform = `translate3d(${x}px,0,0)`;
      },
      clientHasWidth: (index) => !!clientOf(index)?.style.width,
      setClientWidth: (index, pixels) => {
        const client = clientOf(index);
        if (client) client.style.width = pixels === null ? '' : `${pixels}px`;
      },
      resized: (index, width) => at(index).doResize({ width }),
      selectedView: (index, previous) => {
        const history = ((node.history ??= []) as number[]);
        if (node.backTo === index) node.backTo = undefined;
        else {
          history.push(previous);
          if (history.length > 40) history.shift();
        }
        node.props['selected'] = index;
        node.runtime.invalidate();
        node.doSelectView({ view: at(index), previous: viewsOf(node)[previous], index });
      },
      slideCompleted: (index) => node.doSlideComplete({ view: viewsOf(node)[index], index }),
      dismiss: (index) => at(index).hide(),
    };
    return new SlidingEngine(pane);
  });

  // Hand the engine to the component, size and position the views, and follow the window
  useLayoutEffect(() => {
    node.engine = engine;
    engine.canAnimate = node.get('canAnimate') !== false;
    engine.dismissDistance = num(node.get('dismissDistance'), 100);
    const initial = num(node.get('selected'), 0);
    engine.start(Math.min(initial, Math.max(0, viewsOf(node).length - 1)));
    node.resize();
    const onResize = () => node.resize(true);
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      engine.destroy();
      if (node.engine === engine) node.engine = undefined;
    };
  }, [engine, node]);

  // Views that come and go need placing again
  const signature = viewsOf(node).map((view) => view.id).join(',');
  const lastSignature = useRef(signature);
  useLayoutEffect(() => {
    if (lastSignature.current === signature) return;
    lastSignature.current = signature;
    engine.validateViews();
  }, [engine, signature]);

  const viewAt = (target: EventTarget | null): number => {
    const element = (target as Element | null)?.closest?.('.onyx-sliding-view');
    if (!element || element.parentElement !== row.current) return -1;
    return viewsOf(node).findIndex((view) => view.id === (element as HTMLElement).dataset['duyoId']);
  };

  const attributes = host(binding, ['onyx-sliding-pane', !multiView && 'onyx-sliding-pane-single']);
  return (
    <div
      {...attributes}
      ref={root}
      // the click that ends a drag is not a tap
      onClickCapture={(event) => {
        if (!swallowClick.current) return;
        swallowClick.current = false;
        event.stopPropagation();
        event.preventDefault();
      }}
      onPointerDown={(event: PointerEvent<HTMLElement>) => {
        const view = viewAt(event.target);
        press.current = view >= 0 ? { x: event.clientX, y: event.clientY, view, target: event.target, started: false } : null;
      }}
      onPointerMove={(event: PointerEvent<HTMLElement>) => {
        const state = press.current;
        if (!state) return;
        const dx = event.clientX - state.x;
        if (!state.started) {
          if (Math.hypot(dx, event.clientY - state.y) < HYSTERESIS) return;
          // the move that crosses the threshold only starts the drag, as in Enyo's gesture system
          state.started = true;
          const element = row.current?.children[state.view] as Element | undefined;
          const viewElement = (state.target as Element | null)?.closest?.('.onyx-sliding-view');
          const view = viewElement ?? element;
          const draggable = !!view && (!!findHandler(state.target, view) || at(state.view).get('dragAnywhere') !== false);
          if (!engine.dragStart(state.view, dx, draggable)) {
            press.current = null;
            return;
          }
          event.currentTarget.setPointerCapture?.(event.pointerId);
        } else {
          engine.drag(dx);
        }
      }}
      onPointerUp={() => {
        const state = press.current;
        press.current = null;
        if (state?.started && engine.dragFinish()) swallowClick.current = true;
        // a click event does not always follow, so do not keep swallowing
        if (swallowClick.current) setTimeout(() => (swallowClick.current = false), 50);
      }}
      onPointerCancel={() => {
        press.current = null;
        engine.dragFinish();
      }}
    >
      <div className="onyx-sliding-pane-client" ref={row}>
        {binding.children}
      </div>
    </div>
  );

  function at(index: number): Component {
    return viewsOf(node)[index]!;
  }
}

function SlidingViewView(binding: BindingProps) {
  const { node } = binding;
  const attributes = host(binding, ['onyx-sliding-view']);
  // A view that is hidden slides off to the right instead of disappearing, so it keeps its place in the row
  const { display, ...style } = attributes.style;
  const hiddenByRenderer = display === 'none';
  const fit = node.get('fit') === true;
  const minWidth = num(node.get('minWidth'), 0);
  return (
    <div
      {...attributes}
      style={{ ...style, ...(display && !hiddenByRenderer ? { display } : {}), ...(fit ? { flex: '1 1 0%', minWidth: 0 } : {}) }}
      onClick={(event) => {
        attributes.onClick?.(event);
        if (findHandler(event.target, event.currentTarget)) node.toggleSelected();
      }}
    >
      {node.get('shadow') !== false ? <div className="onyx-sliding-view-shadow" /> : null}
      <div className="onyx-sliding-view-client" style={minWidth ? { minWidth } : undefined}>
        {inner(binding)}
      </div>
      {node.get('edgeDragging') === true ? <div className={cx('onyx-sliding-view-nub', HANDLER)} /> : null}
    </div>
  );
}

export const sliding: PackEntry[] = [
  entry(slidingPane, SlidingPaneView),
  // a view is a vertical flex box: a Header, a child with `fit` and a Toolbar stack and fill it, as in Enyo 1.0
  entry(slidingView, SlidingViewView, { layout: flexLayout }),
  entry({ name: 'onyx.GrabButton', kind: 'duyo.Control' }, (binding) => (
    <div {...host(binding, ['onyx-grabbutton', HANDLER])} role="button" aria-label="Drag to slide" />
  )),
];
