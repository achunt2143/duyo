import type { Component } from '@duyo/core';
import { createRoot } from 'react-dom/client';

import type { Renderer } from './renderer.js';
import { RuntimeView } from './RuntimeView.js';

/**
 * Draws `root` into a DOM element, as Enyo's `renderInto(node)` does. Returns a handle
 * to stop drawing.
 */
export function renderInto(root: Component, renderer: Renderer, element: Element): { unmount(): void } {
  const reactRoot = createRoot(element);
  reactRoot.render(<RuntimeView root={root} renderer={renderer} />);
  return { unmount: () => reactRoot.unmount() };
}
