import type { Component, ComponentEvent } from '@duyo/core';
import type { HTMLAttributes, SyntheticEvent } from 'react';

interface DomEventSpec {
  reactProp: keyof HTMLAttributes<HTMLElement>;
  duyoEvent: string;
  type: string;
  bubble: boolean;
}

const DOM_EVENTS: readonly DomEventSpec[] = [
  { reactProp: 'onKeyDown', duyoEvent: 'onkeydown', type: 'keydown', bubble: true },
  { reactProp: 'onKeyUp', duyoEvent: 'onkeyup', type: 'keyup', bubble: true },
  { reactProp: 'onPointerDown', duyoEvent: 'onpointerdown', type: 'pointerdown', bubble: true },
  { reactProp: 'onMouseDown', duyoEvent: 'onmousedown', type: 'mousedown', bubble: true },
  { reactProp: 'onPointerMove', duyoEvent: 'onpointermove', type: 'pointermove', bubble: true },
  { reactProp: 'onPointerUp', duyoEvent: 'onpointerup', type: 'pointerup', bubble: true },
  { reactProp: 'onPointerEnter', duyoEvent: 'onpointerenter', type: 'pointerenter', bubble: false },
  { reactProp: 'onPointerLeave', duyoEvent: 'onpointerleave', type: 'pointerleave', bubble: false },
  { reactProp: 'onFocus', duyoEvent: 'onfocus', type: 'focus', bubble: true },
  { reactProp: 'onBlur', duyoEvent: 'onblur', type: 'blur', bubble: true },
  { reactProp: 'onContextMenu', duyoEvent: 'oncontextmenu', type: 'contextmenu', bubble: true },
  { reactProp: 'onDoubleClick', duyoEvent: 'ondblclick', type: 'dblclick', bubble: true },
  { reactProp: 'onWheel', duyoEvent: 'onwheel', type: 'wheel', bubble: true },
];

const COPIED_FIELDS = [
  'key',
  'code',
  'altKey',
  'ctrlKey',
  'metaKey',
  'shiftKey',
  'repeat',
  'clientX',
  'clientY',
  'pageX',
  'pageY',
  'button',
  'buttons',
  'pointerId',
  'pointerType',
  'deltaX',
  'deltaY',
  'deltaZ',
  'deltaMode',
  'relatedTarget',
  'target',
  'currentTarget',
] as const;

const claimedByEvent = new Map<string, WeakSet<object>>();

function claimedSetFor(duyoEvent: string): WeakSet<object> {
  let set = claimedByEvent.get(duyoEvent);
  if (!set) {
    set = new WeakSet<object>();
    claimedByEvent.set(duyoEvent, set);
  }
  return set;
}

/**
 * Claims `nativeEvent` for `duyoEvent` so DOM native bubbling does not trigger
 * duplicate Duyo event bubbling. Returns `true` if unclaimed, `false` if already claimed.
 */
export function claimDomEvent(duyoEvent: string, nativeEvent: object): boolean {
  const set = claimedSetFor(duyoEvent);
  if (set.has(nativeEvent)) return false;
  set.add(nativeEvent);
  return true;
}

/** Returns whether `nativeEvent` has already been claimed for `duyoEvent`. */
export function isDomEventClaimed(duyoEvent: string, nativeEvent: object): boolean {
  return claimedByEvent.get(duyoEvent)?.has(nativeEvent) === true;
}

/** Builds a portable Duyo event payload from a React synthetic DOM event. */
export function buildDomEventPayload(
  type: string,
  originator: Component,
  event: SyntheticEvent<HTMLElement>,
): ComponentEvent {
  const payload: ComponentEvent = {
    type,
    originator,
    nativeEvent: event.nativeEvent,
    preventDefault: () => event.preventDefault(),
    stopPropagation: () => event.stopPropagation(),
  };
  const record = event as unknown as Record<string, unknown>;
  for (const field of COPIED_FIELDS) {
    if (record[field] !== undefined) payload[field] = record[field];
  }
  return payload;
}

type EventHandler = (event: SyntheticEvent<HTMLElement>) => void;
const cachedHandlers = new WeakMap<Component, Map<string, EventHandler>>();

function handlerCacheFor(node: Component): Map<string, EventHandler> {
  let map = cachedHandlers.get(node);
  if (!map) {
    map = new Map<string, EventHandler>();
    cachedHandlers.set(node, map);
  }
  return map;
}

/** Returns the cached `onClick` handler dispatching Duyo `ontap` with bubbling dedup. */
export function tapHandlerFor(node: Component): NonNullable<HTMLAttributes<HTMLElement>['onClick']> {
  const cache = handlerCacheFor(node);
  let handler = cache.get('onClick');
  if (!handler) {
    handler = (event: SyntheticEvent<HTMLElement>) => {
      if (!claimDomEvent('ontap', event.nativeEvent)) return;
      node.bubble('ontap', buildDomEventPayload('tap', node, event));
    };
    cache.set('onClick', handler);
  }
  return handler as NonNullable<HTMLAttributes<HTMLElement>['onClick']>;
}

function domHandlerFor(node: Component, spec: DomEventSpec): EventHandler {
  const cache = handlerCacheFor(node);
  const key = spec.reactProp as string;
  let handler = cache.get(key);
  if (!handler) {
    handler = (event: SyntheticEvent<HTMLElement>) => {
      if (spec.bubble) {
        if (!claimDomEvent(spec.duyoEvent, event.nativeEvent)) return;
        node.bubble(spec.duyoEvent, buildDomEventPayload(spec.type, node, event));
      } else {
        node.dispatchEvent(spec.duyoEvent, buildDomEventPayload(spec.type, node, event), node);
      }
    };
    cache.set(key, handler);
  }
  return handler;
}

/**
 * Returns cached React DOM event handlers gated by `node.handles(...)` so unused
 * listeners are not attached to every element in the tree.
 */
export function domEventHandlersFor(node: Component): Partial<HTMLAttributes<HTMLElement>> {
  const handlers: Record<string, EventHandler> = {};
  for (const spec of DOM_EVENTS) {
    const active = spec.bubble ? node.handles(spec.duyoEvent) : node.handles(spec.duyoEvent, { bubble: false });
    if (active) handlers[spec.reactProp as string] = domHandlerFor(node, spec);
  }
  return handlers as Partial<HTMLAttributes<HTMLElement>>;
}
