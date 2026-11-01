import type { Component, KindInput } from '@duyo/core';
import type { BindingProps, PackEntry } from '@duyo/react';

import { PopupFrame, apply, type Place, type Placement } from './overlays.js';
import { cx, elementOf, entry } from './support.js';

/**
 * `ContextualPopup`: a popup with a pointer (a "nub") aimed at the control that opened it.
 *
 * Enyo chose its side, its corner and the nub's position by trying each in turn and
 * measuring the result. `placeContextual` does the same, with the same rules, then reports
 * the classes it settled on so the popup is drawn with them.
 *
 * `actionButtons` is a list of `{ content, action?, classes? }`; tapping one raises `onAction`
 * with `{ action, index, content }`.
 */

const VERTICAL_FLUSH_MARGIN = 60;
const HORIZONTAL_FLUSH_MARGIN = 50;
const WIDE_POPUP = 200;
const LONG_POPUP = 200;
const HORIZONTAL_BUFFER = 16;
const POSITIONING_CLASSES = ['right', 'left', 'high', 'low', 'corner', 'below', 'above', 'vertical', 'horizontal'];

export const placeContextual: Place = (element, node) => {
  const activator = elementOf(node.activator);
  if (!activator) return {};
  const floating = node.get('floating') === true;
  const style: Record<string, string | number> = {};
  const classes = new Set<string>();

  const rect = (target: Element) => target.getBoundingClientRect();
  const add = (...names: string[]) => names.forEach((name) => (classes.add(name), element.classList.add(name)));
  const position = (next: Record<string, string | number>) => {
    Object.assign(style, next);
    apply(element, next);
  };
  const reset = () => {
    for (const name of POSITIONING_CLASSES) {
      classes.delete(name);
      element.classList.remove(name);
    }
    position({ left: 'auto', top: 'auto' });
  };

  const a = rect(activator);
  const width = window.innerWidth;
  const height = window.innerHeight;

  /** Above or below the activator. False if that puts the popup off the window. */
  const initVertical = (): boolean => {
    reset();
    add('vertical');
    let c = rect(element);
    if (floating) {
      if (a.top < height / 2) {
        position({ top: a.top + a.height, bottom: 'auto' });
        add('below');
      } else {
        position({ top: a.top - c.height, bottom: 'auto' });
        add('above');
      }
    } else if (c.top + c.height > height && height - c.bottom < c.top - c.height) {
      add('above');
    } else {
      add('below');
    }
    c = rect(element);
    return !(c.top + c.height > height || c.top < 0);
  };

  const applyVertical = (): boolean => {
    if (!initVertical()) return false;
    const c = rect(element);
    if (floating) {
      const centered = a.left + a.width / 2 - c.width / 2;
      if (centered + c.width > width) {
        position({ left: a.left + a.width - c.width });
        add('left');
      } else if (centered < 0) {
        position({ left: a.left });
        add('right');
      } else {
        position({ left: centered });
      }
    } else {
      const delta = a.left + a.width / 2 - c.left - c.width / 2;
      if (c.right + delta > width) {
        position({ left: a.left + a.width - c.right });
        add('left');
      } else if (c.left + delta < 0) {
        add('right');
      } else {
        position({ left: delta });
      }
    }
    return true;
  };

  /** Above or below, with the popup's corner at the activator, near the window's left or right edge. */
  const applyVerticalFlush = (leftFlush: number, rightFlush: number): boolean => {
    if (!initVertical()) return false;
    const c = rect(element);
    const middle = a.left + a.width / 2;
    if (middle < leftFlush) {
      if (middle < HORIZONTAL_BUFFER) position({ left: HORIZONTAL_BUFFER + (floating ? 0 : -c.left) });
      else position({ left: a.width / 2 + (floating ? a.left : 0) });
      add('right', 'corner');
      return true;
    }
    if (middle > rightFlush) {
      if (middle > width - HORIZONTAL_BUFFER) position({ left: width - HORIZONTAL_BUFFER - c.right });
      else position({ left: middle - c.right });
      add('left', 'corner');
      return true;
    }
    return false;
  };

  /** Left or right of the activator. False if that puts the popup off the window. */
  const initHorizontal = (): boolean => {
    reset();
    const c = rect(element);
    if (floating) {
      if (a.left + a.width < width / 2) {
        position({ left: a.left + a.width });
        add('left');
      } else {
        position({ left: a.left - c.width });
        add('right');
      }
    } else if (a.left - c.width > 0) {
      position({ left: a.left - c.left - c.width });
      add('right');
    } else {
      position({ left: a.width });
      add('left');
    }
    add('horizontal');
    const after = rect(element);
    return !(after.left < 0 || after.left + after.width > width);
  };

  const applyHorizontal = (): boolean => {
    if (!initHorizontal()) return false;
    const c = rect(element);
    const center = a.top + a.height / 2;
    const nearMiddle = center >= height / 2 - 0.05 * height && center <= height / 2 + 0.05 * height;
    const inTopHalf = a.top + a.height < height / 2;
    if (floating) {
      if (nearMiddle) position({ top: a.top + a.height / 2 - c.height / 2, bottom: 'auto' });
      else if (inTopHalf) {
        position({ top: a.top - a.height, bottom: 'auto' });
        add('high');
      } else {
        position({ top: a.top - c.height + a.height * 2, bottom: 'auto' });
        add('low');
      }
    } else if (nearMiddle) {
      position({ top: (a.height - c.height) / 2 });
    } else if (inTopHalf) {
      position({ top: -a.height });
      add('high');
    } else {
      position({ top: c.top - c.height - a.top + a.height });
      add('low');
    }
    return true;
  };

  const applyHorizontalFlush = (leftFlush: number, rightFlush: number): boolean => {
    if (!initHorizontal()) return false;
    const c = rect(element);
    if (floating) {
      if (a.top < height / 2) {
        position({ top: a.top + a.height / 2 });
        add('high');
      } else {
        position({ top: a.top + a.height / 2 - c.height });
        add('low');
      }
    } else if (c.top + c.height > height && height - c.bottom < c.top - c.height) {
      position({ top: c.top - c.height - a.top - a.height / 2 });
      add('low');
    } else {
      position({ top: a.height / 2 });
      add('high');
    }
    if (a.left + a.width < leftFlush) {
      add('left', 'corner');
      return true;
    }
    if (a.left > rightFlush) {
      add('right', 'corner');
      return true;
    }
    return false;
  };

  const adjust = () => {
    const leftFlush = HORIZONTAL_FLUSH_MARGIN;
    const rightFlush = width - HORIZONTAL_FLUSH_MARGIN;
    // Rule 1: an activator near an edge of the window wants flush positioning
    if (a.top + a.height < VERTICAL_FLUSH_MARGIN || a.top > height - VERTICAL_FLUSH_MARGIN) {
      if (applyVerticalFlush(leftFlush, rightFlush)) return;
      if (applyHorizontalFlush(leftFlush, rightFlush)) return;
      if (applyVertical()) return;
    } else if (a.left + a.width < leftFlush || a.left > rightFlush) {
      if (applyHorizontal()) return;
    }
    // Rule 3: a wide popup goes above or below, a long one to the side
    const c = rect(element);
    if (c.width > WIDE_POPUP) {
      if (applyVertical()) return;
    } else if (c.height > LONG_POPUP) {
      if (applyHorizontal()) return;
    }
    // Rule 4: favour above or below, and fall back to the side
    if (applyVertical()) return;
    applyHorizontal();
  };

  adjust();
  return { classes: [...classes], style } as Placement;
};

const contextualPopup: KindInput = {
  name: 'onyx.ContextualPopup',
  kind: 'onyx.Popup',
  published: {
    modal: true,
    autoDismiss: true,
    floating: false,
    maxHeight: 100,
    scrolling: true,
    title: '',
    actionButtons: [],
  },
  events: { onAction: '' },
  handlers: { onActivate: 'childControlActivated', onRequestShowMenu: 'requestMenuShow', onRequestHideMenu: 'requestHide' },
  // a button inside a popup is not the popup's activator
  childControlActivated() {
    return true;
  },
  requestMenuShow(this: Component, _sender: Component, event: { activator?: Component }) {
    this.activator = event.activator;
    this.show();
    return true;
  },
};

type ActionButton = { content?: string; action?: string; classes?: string };

function ContextualPopupView(binding: BindingProps) {
  const { node } = binding;
  const title = String(node.get('title') ?? '');
  const buttons = (Array.isArray(node.get('actionButtons')) ? node.get('actionButtons') : []) as ActionButton[];
  const scrolling = node.get('scrolling') !== false;
  const maxHeight = Number(node.get('maxHeight')) || 100;
  return (
    <PopupFrame
      binding={binding}
      classes={['onyx-contextual-popup']}
      place={placeContextual}
      render={(children) => (
        <>
          {title ? <div className="onyx-contextual-popup-title">{title}</div> : null}
          <div className="onyx-contextual-popup-scroller">
            <div className={scrolling ? 'onyx-scroller' : undefined} style={scrolling ? { maxHeight } : undefined}>
              {children}
            </div>
          </div>
          {buttons.length > 0 ? (
            <div className="onyx-contextual-popup-action-buttons">
              {buttons.map((button, index) => (
                <button
                  key={index}
                  type="button"
                  className={cx('onyx-button', 'onyx-contextual-popup-action-button', button.classes)}
                  onClick={() => node.doAction({ action: button.action ?? button.content, index, content: button.content })}
                >
                  {button.content}
                </button>
              ))}
            </div>
          ) : null}
        </>
      )}
    />
  );
}

export const contextual: PackEntry[] = [entry(contextualPopup, ContextualPopupView)];
