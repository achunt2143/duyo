/** @jsxRuntime automatic @jsxImportSource react */
import type { Component, KindInput } from '@duyo/core';
import type { BindingProps, PackEntry } from '@duyo/react';
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

import { cx, defaultKind, elementOf, entry, host, inner, isKind, type ClassValue, type Members } from './support.js';

/**
 * Popups and everything built on them: `Popup`, `Menu`, `MenuItem`, `MenuDecorator`,
 * `Submenu`, `Drawer`, `Picker`, `PickerButton`, `PickerDecorator`, `Tooltip` and
 * `TooltipDecorator`.
 *
 * Enyo's popups were placed by measuring their node after they were shown. `PopupFrame` does
 * the same in a layout effect, before the browser paints, and keeps the result as data (a few
 * classes and some style) so React and the measurement never disagree.
 */

const num = (value: unknown, fallback: number): number => (typeof value === 'number' && !Number.isNaN(value) ? value : fallback);
const flag = (node: Component, property: string): boolean => node.get(property) === true;

/** Where a popup ended up: classes and style to draw it with, measured after it was shown. */
export interface Placement {
  classes?: string[];
  style?: CSSProperties;
  /** Menus: the room the scroller has, so a menu never runs off the window. */
  scrollerMaxHeight?: number;
}

export type Place = (element: HTMLElement, node: Component) => Placement;

/** Puts a style on the element at once, so later measurements see it. */
export const apply = (element: HTMLElement, style: Record<string, string | number>) => {
  for (const [property, value] of Object.entries(style)) {
    element.style.setProperty(property.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`), typeof value === 'number' ? `${value}px` : value);
  }
};

// Once a modal popup has dismissed itself on a tap outside, that tap's click must not reach
// whatever was underneath, or tapping a menu's button to close it would open it again.
function swallowNextClick() {
  const stop = (event: Event) => {
    event.stopPropagation();
    event.preventDefault();
    document.removeEventListener('click', stop, true);
  };
  document.addEventListener('click', stop, true);
  setTimeout(() => document.removeEventListener('click', stop, true), 400);
}

interface FrameProps {
  binding: BindingProps;
  classes: ClassValue[];
  place?: Place;
  /** Wraps the children, as a menu's scroller does. */
  render?: (children: ReactNode, placement: Placement | null) => ReactNode;
  /** Replaces the children altogether. */
  content?: ReactNode;
  /** Classes to draw with until the popup has been measured. */
  fallbackClasses?: string[];
  /** Draws the scrim where the popup is, as webOS's dialogs did, and not only when it is `floating`. */
  inPlaceScrim?: boolean;
  /** Keeps the popup drawn for this many ms after it is hidden, with the class `onyx-leaving`, so it can animate out. */
  exitMs?: number;
}

/** Everything popups share: showing and hiding, a portal, a scrim, dismissal, and placement. */
export function PopupFrame({ binding, classes, place, render, content, fallbackClasses = [], inPlaceScrim = false, exitMs = 0 }: FrameProps) {
  const { node } = binding;
  const showing = flag(node, 'showing');
  const floating = flag(node, 'floating');
  const element = useRef<HTMLDivElement>(null);
  const [placement, setPlacement] = useState<Placement | null>(null);
  const [tick, setTick] = useState(0);

  const modal = flag(node, 'modal');
  const autoDismiss = node.get('autoDismiss') !== false;
  const scrim = flag(node, 'scrim');
  const scrimWhenModal = node.get('scrimWhenModal') !== false;
  const scrimmed = (floating || inPlaceScrim) && (scrim || (modal && scrimWhenModal));

  // For `exitMs` after it is hidden, a popup stays drawn (and out of the way of taps) so that it can animate out
  const [leaving, setLeaving] = useState(false);
  const wasShowing = useRef(showing);
  useEffect(() => {
    const hidden = wasShowing.current && !showing;
    wasShowing.current = showing;
    if (!hidden || !exitMs) return;
    setLeaving(true);
    const timer = setTimeout(() => setLeaving(false), exitMs);
    return () => clearTimeout(timer);
  }, [showing, exitMs]);

  // Measure after every show, and again after a resize.
  useLayoutEffect(() => {
    if (!showing) {
      setPlacement(null);
      return;
    }
    if (place && element.current) setPlacement(place(element.current, node));
  }, [showing, tick, place, node]);

  useEffect(() => {
    if (!showing) return;
    const onPointerDown = (event: PointerEvent) => {
      if (element.current?.contains(event.target as Node)) return;
      if (modal) swallowNextClick();
      if (autoDismiss || modal) node.hide();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && (autoDismiss || modal)) node.hide();
    };
    const onResize = () => {
      setPlacement(null);
      setTick((t) => t + 1);
    };
    if (!scrimmed && (autoDismiss || modal)) document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', onResize);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', onResize);
    };
  }, [showing, modal, autoDismiss, scrimmed, node]);

  if (!showing && !leaving) return null;

  const attributes = host(binding, [
    ...classes,
    !showing && 'onyx-leaving',
    floating && 'onyx-floating',
    flag(node, 'centered') && 'onyx-centered',
    ...(placement ? (placement.classes ?? []) : fallbackClasses),
  ]);
  const body = content ?? inner(binding);
  const popup = (
    <div {...attributes} ref={element} style={{ ...attributes.style, ...placement?.style }}>
      {render ? render(body, placement) : body}
    </div>
  );
  const tree = scrimmed ? (
    <>
      <div
        className={cx('onyx-scrim', scrim ? 'onyx-scrim-translucent' : 'onyx-scrim-transparent', String(node.get('scrimClassName') ?? ''), !showing && 'onyx-leaving')}
        onPointerDown={() => {
          if (autoDismiss) node.hide();
        }}
      />
      {popup}
    </>
  ) : (
    popup
  );
  return floating ? createPortal(tree, document.body) : tree;
}

// ---------------------------------------------------------------------------
// Placement
// ---------------------------------------------------------------------------

/** Keeps a menu inside the window: above its activator when there is no room below, and so on. */
export const placeMenu: Place = (element, node) => {
  const floating = flag(node, 'floating');
  const showOnTop = flag(node, 'showOnTop');
  const scrolling = node.get('scrolling') !== false;
  const maxHeight = num(node.get('maxHeight'), 200);
  const activator = elementOf(node.activator);
  const classes: string[] = [];
  const style: Record<string, string | number> = {};
  const set = (next: Record<string, string | number>) => {
    Object.assign(style, next);
    apply(element, next);
  };

  const anchor = floating && activator ? activator.getBoundingClientRect() : null;
  if (anchor) set({ top: anchor.top + (showOnTop ? 0 : anchor.height), left: anchor.left, width: anchor.width, bottom: 'auto' });

  const height = window.innerHeight;
  const width = window.innerWidth;
  let b = element.getBoundingClientRect();
  // above the activator if it is cut off below, but only if there is more room above than below
  const up = b.top + b.height > height && height - b.bottom < b.top - b.height;
  if (up) {
    classes.push('onyx-menu-up');
    element.classList.add('onyx-menu-up');
  }
  if (anchor) {
    if (up) set({ top: anchor.top - b.height + (showOnTop ? anchor.height : 0), bottom: 'auto' });
    else if (b.top < anchor.top && anchor.top + (showOnTop ? 0 : anchor.height) + b.height < height) {
      set({ top: anchor.top + (showOnTop ? 0 : anchor.height), bottom: 'auto' });
    }
  }
  b = element.getBoundingClientRect();
  if (b.right > width) set({ left: floating ? width - b.width : -(b.right - width) });
  b = element.getBoundingClientRect();
  if (b.left < 0) set({ left: floating ? 0 : (parseFloat(element.style.left) || 0) - b.left });

  let scrollerMaxHeight: number | undefined;
  if (scrolling && !showOnTop) {
    b = element.getBoundingClientRect();
    scrollerMaxHeight = up ? Math.min(maxHeight, b.bottom) : b.top + maxHeight < height ? maxHeight : height - b.top;
  }
  element.classList.remove('onyx-menu-up');
  return { classes, style: style as CSSProperties, ...(scrollerMaxHeight !== undefined ? { scrollerMaxHeight } : {}) };
};

/** A picker also brings its selected item into view. */
export const placePicker: Place = (element, node) => {
  const placement = placeMenu(element, node);
  element.querySelector('.selected')?.scrollIntoView?.({ block: 'nearest' });
  return placement;
};

/** Below its activator, unless that runs off the window; its arrow follows. */
const placeTooltip: Place = (element) => {
  const b = element.getBoundingClientRect();
  const classes = [b.top + b.height > window.innerHeight ? 'above' : 'below'];
  const style: CSSProperties = {};
  if (b.left + b.width > window.innerWidth) {
    // align its right edge with the decorator's left edge and use the other arrow
    style.marginLeft = -b.width;
    classes.push('right-arrow');
  } else {
    classes.push('left-arrow');
  }
  return { classes, style };
};

// ---------------------------------------------------------------------------
// Popup and Menu
// ---------------------------------------------------------------------------

const popup: KindInput = {
  name: 'onyx.Popup',
  kind: 'duyo.Control',
  published: {
    showing: false,
    modal: false,
    autoDismiss: true,
    floating: false,
    centered: false,
    scrim: false,
    scrimWhenModal: true,
    scrimClassName: '',
  },
  events: { onShow: '', onHide: '' },
  handlers: { onRequestShow: 'requestShow', onRequestHide: 'requestHide' },
  showingChanged(this: Component, _previous: boolean, showing: boolean) {
    if (showing) this.doShow();
    else this.doHide();
  },
  requestShow(this: Component) {
    this.show();
    return true;
  },
  requestHide(this: Component) {
    this.hide();
  },
};

export function menuBody(maxHeight: number, scrolling: boolean) {
  return (children: ReactNode, placement: Placement | null) =>
    scrolling ? (
      <div className="onyx-scroller" style={{ maxHeight: placement?.scrollerMaxHeight ?? maxHeight }}>
        {children}
      </div>
    ) : (
      children
    );
}

/** The binding of a menu; `extra` adds the classes of a kind built on it, as `onyx-picker`. */
export const menuView = (extra: ClassValue[], place: Place) =>
  function MenuView(binding: BindingProps) {
    const { node } = binding;
    return (
      <PopupFrame
        binding={binding}
        classes={['onyx-popup', 'onyx-menu', ...extra]}
        place={place}
        render={menuBody(num(node.get('maxHeight'), 200), node.get('scrolling') !== false)}
      />
    );
  };

const menu: KindInput = {
  name: 'onyx.Menu',
  kind: 'onyx.Popup',
  published: { modal: true, maxHeight: 200, scrolling: true, showOnTop: false },
  handlers: { onActivate: 'itemActivated', onRequestShowMenu: 'requestMenuShow', onRequestHideMenu: 'requestHide' },
  ...defaultKind('onyx.MenuItem'),
  /** A menu item is a button that does not stay pressed. */
  itemActivated(this: Component, _sender: Component, event: { originator: Component }) {
    event.originator.setActive(false);
    return true;
  },
  requestMenuShow(this: Component, _sender: Component, event: { activator?: Component }) {
    this.activator = event.activator;
    this.show();
    return true;
  },
};

const menuItem: KindInput = {
  name: 'onyx.MenuItem',
  kind: 'onyx.Button',
  events: { onSelect: '', onItemContentChange: '' },
  handlers: { ontap: 'itemTapped' },
  itemTapped(this: Component) {
    if (this.get('disabled') === true) return true;
    this.setActive(true);
    this.bubble('onRequestHideMenu');
    this.doSelect({ selected: this, content: this.get('content') });
    return false;
  },
  contentChanged(this: Component, _previous: string, content: string) {
    this.doItemContentChange({ content });
  },
};

function MenuItemView(binding: BindingProps) {
  const disabled = flag(binding.node, 'disabled');
  return (
    <div {...host(binding, ['onyx-menu-item'], disabled)} role="menuitem" aria-disabled={disabled}>
      {inner(binding)}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Decorators
// ---------------------------------------------------------------------------

const tooltipDecorator: Members = {
  ...defaultKind('onyx.Button'),
  handlers: { ontap: 'requestHideTooltip' },
  enter() {
    this.requestShowTooltip();
  },
  leave() {
    this.requestHideTooltip();
  },
  requestShowTooltip() {
    this.waterfallDown('onRequestShowTooltip');
  },
  requestHideTooltip() {
    this.waterfallDown('onRequestHideTooltip');
    return false;
  },
};

const menuDecorator: Members = {
  handlers: { onActivate: 'activated', onHide: 'menuHidden' },
  activated(_sender: Component, event: { originator: Component }) {
    this.requestHideTooltip();
    if (event.originator.get('active') === true) {
      this.menuActive = true;
      this.activator = event.originator;
      this.activator.addClass('active');
      this.requestShowMenu();
    }
  },
  requestShowMenu() {
    this.waterfallDown('onRequestShowMenu', { activator: this.activator });
  },
  requestHideMenu() {
    this.waterfallDown('onRequestHideMenu');
  },
  menuHidden() {
    this.menuActive = false;
    if (this.activator && !this.activator.destroyed) {
      this.activator.setActive(false);
      this.activator.removeClass('active');
    }
  },
  // a tooltip stays hidden while the menu is open
  enter() {
    if (!this.menuActive) this.inherited(arguments);
  },
  leave() {
    if (!this.menuActive) this.inherited(arguments);
  },
};

const pickerDecorator: Members = {
  ...defaultKind('onyx.PickerButton'),
  handlers: { onChange: 'pickerChanged' },
  create() {
    this.inherited(arguments);
    // the picker may have chosen before its button existed
    const picker = this.children.find((child: Component) => isKind(child, 'onyx.Picker'));
    const content = picker?.selectedItem
      ? picker.selectedItem.get('content')
      : picker && isKind(picker, 'onyx.FlyweightPicker') && (picker.get('selected') as number) >= 0
        ? picker.rowContent(picker.get('selected'))
        : undefined;
    if (content !== undefined) this.pickerChanged(this, { content });
  },
  /** The button shows what the picker chose. */
  pickerChanged(_sender: Component, event: { content?: string }) {
    if (event.content === undefined) return false;
    for (const child of this.children) if (isKind(child, 'onyx.PickerButton')) child.setContent(String(event.content));
    return false;
  },
};

function DecoratorView(...classes: ClassValue[]) {
  return function Decorator(binding: BindingProps) {
    const { node } = binding;
    return (
      <div {...host(binding, ['onyx-popup-decorator', ...classes])} onMouseEnter={() => node.enter()} onMouseLeave={() => node.leave()}>
        {inner(binding)}
      </div>
    );
  };
}

// ---------------------------------------------------------------------------
// Picker
// ---------------------------------------------------------------------------

const picker: KindInput = {
  name: 'onyx.Picker',
  kind: 'onyx.Menu',
  published: { selected: -1, floating: true, showOnTop: true },
  events: { onChange: '' },
  handlers: { onItemContentChange: 'itemContentChange' },
  create(this: Component) {
    this.inherited(arguments);
    // A hidden popup draws none of its items, so `active: true` cannot wait for them to render.
    const item = this.children.find((child: Component) => child.get('active') === true);
    if (item) {
      item.props['active'] = false;
      this.selectItem(item);
    }
  },
  itemActivated(this: Component, _sender: Component, event: { originator: Component }) {
    const item = event.originator;
    if (item.get('active') === true) this.selectItem(item);
    item.setActive(false);
    return true;
  },
  /** Marks `item` as chosen and says so. */
  selectItem(this: Component, item: Component) {
    const was: Component | undefined = this.selectedItem;
    if (was === item) return;
    if (was && !was.destroyed) was.removeClass('selected');
    this.selectedItem = item;
    item.addClass('selected');
    this.set('selected', this.children.indexOf(item));
    this.doChange({ selected: item, index: this.get('selected'), content: item.get('content') });
  },
  selectedChanged(this: Component, _previous: number, index: number) {
    const item = this.children[index];
    if (item && item !== this.selectedItem) this.selectItem(item);
  },
  itemContentChange(this: Component, _sender: Component, event: { originator: Component }) {
    if (event.originator === this.selectedItem) {
      this.doChange({ selected: this.selectedItem, index: this.get('selected'), content: this.selectedItem.get('content') });
    }
  },
};

// ---------------------------------------------------------------------------
// Tooltip
// ---------------------------------------------------------------------------

const tooltip: KindInput = {
  name: 'onyx.Tooltip',
  kind: 'onyx.Popup',
  published: { autoDismiss: false, showDelay: 500 },
  handlers: { onRequestShowTooltip: 'requestTooltipShow', onRequestHideTooltip: 'requestTooltipHide' },
  requestTooltipShow(this: Component) {
    this.cancelShow();
    this.showJob = setTimeout(() => !this.destroyed && this.show(), this.get('showDelay') as number);
    return true;
  },
  requestTooltipHide(this: Component) {
    this.cancelShow();
    this.hide();
    return true;
  },
  cancelShow(this: Component) {
    clearTimeout(this.showJob);
  },
  destroy(this: Component) {
    this.cancelShow();
    this.inherited(arguments);
  },
};

// ---------------------------------------------------------------------------
// Submenu and Drawer
// ---------------------------------------------------------------------------

function DrawerView(binding: BindingProps) {
  const { node } = binding;
  return (
    <div
      {...host(binding, [
        'onyx-drawer',
        node.get('orient') === 'h' && 'onyx-drawer-horizontal',
        !flag(node, 'open') && 'onyx-drawer-closed',
        node.get('animated') === false && 'onyx-drawer-instant',
      ])}
      onTransitionEnd={(event) => {
        if (event.target === event.currentTarget) node.doDrawerAnimationEnd({ open: flag(node, 'open') });
      }}
    >
      <div className="onyx-drawer-content" aria-hidden={!flag(node, 'open')}>
        {inner(binding)}
      </div>
    </div>
  );
}

function SubmenuView(binding: BindingProps) {
  const { node } = binding;
  const open = flag(node, 'open');
  return (
    <div {...host(binding, [])}>
      <div className="onyx-menu-item" role="menuitem" aria-expanded={open} onClick={() => node.toggleOpen()}>
        {String(node.get('content') ?? '')}
      </div>
      <div className={cx('onyx-drawer', 'onyx-submenu', !open && 'onyx-drawer-closed')}>
        <div className="onyx-drawer-content">{binding.children}</div>
      </div>
    </div>
  );
}

/** Kinds that are drawn by the binding of the kind they extend. */
export const overlayKinds: KindInput[] = [
  { name: 'onyx.MenuDecorator', kind: 'onyx.TooltipDecorator', ...menuDecorator },
  { name: 'onyx.PickerButton', kind: 'onyx.Button' },
];

export const overlays: PackEntry[] = [
  entry(popup, (binding) => <PopupFrame binding={binding} classes={['onyx-popup']} />),
  entry(menu, menuView([], placeMenu)),
  entry(menuItem, MenuItemView),
  entry({ name: 'onyx.TooltipDecorator', kind: 'duyo.Control', ...tooltipDecorator }, DecoratorView()),
  entry(picker, menuView(['onyx-picker'], placePicker)),
  entry({ name: 'onyx.PickerDecorator', kind: 'onyx.MenuDecorator', ...pickerDecorator }, DecoratorView('onyx-picker-decorator')),
  entry(tooltip, (binding) => (
    <PopupFrame binding={binding} classes={['onyx-popup', 'onyx-tooltip']} fallbackClasses={['below', 'left-arrow']} place={placeTooltip} />
  )),
  entry(
    {
      name: 'onyx.Drawer',
      kind: 'duyo.Control',
      published: { open: true, orient: { default: 'v', allowed: ['v', 'h'] }, animated: true },
      events: { onDrawerAnimationEnd: '' },
      toggleOpen() {
        this.setOpen(!this.get('open'));
      },
    },
    DrawerView,
  ),
  entry(
    {
      name: 'onyx.Submenu',
      kind: 'duyo.Control',
      published: { open: false },
      ...defaultKind('onyx.MenuItem'),
      toggleOpen() {
        this.setOpen(!this.get('open'));
      },
    },
    SubmenuView,
  ),
];
