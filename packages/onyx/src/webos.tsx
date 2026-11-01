import type { Component, KindInput } from '@duyo/core';
import type { BindingProps, PackEntry } from '@duyo/react';
import { useRef, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';

import { cx, entry, flexLayout, host, inner } from './support.js';

/**
 * `Header`, `Divider`, `AlphaDivider`, `DividerDrawer`, `ConfirmPrompt` and `SwipeableItem`, from webOS's Enyo 1.0
 * (`enyo.Header`, `enyo.Divider`, `enyo.AlphaDivider`, `enyo.DividerDrawer`, `enyo.ConfirmPrompt`, `enyo.SwipeableItem`).
 *
 * Enyo 2's Onyx has none of them, and they are what a webOS view is made of: a `Header` across the top, a `Divider`
 * between groups of rows (that can fold away what is under it), rows that can be swiped away, and (from the rest of
 * the pack) a `Toolbar` with a `GrabButton` along the bottom.
 */

const flag = (node: Component, property: string): boolean => node.get(property) === true;

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------

const header: KindInput = {
  name: 'onyx.Header',
  kind: 'duyo.Control',
  published: {
    /** The dark header of webOS's theme, the same as a toolbar, for a header that is not the top of a view. */
    dark: false,
  },
};

function HeaderView(binding: BindingProps) {
  // `content`, or children laid out in a row (a child with `fit` takes the room the others leave)
  return (
    <div {...host(binding, ['onyx-header', flag(binding.node, 'dark') && 'onyx-header-dark'])}>
      <div className="onyx-header-inner">{inner(binding)}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dividers
// ---------------------------------------------------------------------------

/** The parts of a divider: a rule that is no more than an edge, the icon and caption, the rule that runs on, and a place for controls. */
function dividerParts(node: Component, client: ReactNode) {
  const icon = String(node.get('icon') ?? '');
  const collapse = node.get('iconBorderCollapse') !== false;
  return (
    <>
      {icon && collapse ? null : <div className="onyx-divider-right-cap" />}
      {icon ? <img className={collapse ? 'onyx-divider-icon' : 'onyx-divider-icon-collapse'} src={icon} alt="" /> : null}
      <div className="onyx-divider-caption">{String(node.get('caption') ?? '')}</div>
      <div className="onyx-divider-left-cap" />
      <div className="onyx-divider-client">{client}</div>
    </>
  );
}

const dividerPublished = {
  caption: 'Divider',
  /** The URL of an image shown before the caption. */
  icon: '',
  /** With an `icon`, the rule starts at the icon, not before it. */
  iconBorderCollapse: true,
};

const divider: KindInput = {
  name: 'onyx.Divider',
  kind: 'duyo.Control',
  published: dividerPublished,
};

function DividerView(binding: BindingProps) {
  return <div {...host(binding, ['onyx-divider'])}>{dividerParts(binding.node, binding.children)}</div>;
}

/** A divider for one letter, as the heading of a run of names in an alphabetical list. */
const alphaDivider: KindInput = {
  name: 'onyx.AlphaDivider',
  kind: 'duyo.Control',
  published: { caption: '' },
};

function AlphaDividerView(binding: BindingProps) {
  return (
    <div {...host(binding, ['onyx-divider-alpha'])}>
      <div className="onyx-divider-alpha-caption">{String(binding.node.get('caption') ?? '')}</div>
    </div>
  );
}

/**
 * A drawer whose caption is a divider, with an arrow showing whether it is open. Tapping the divider opens or
 * closes the drawer. With no `caption` there is no divider, and so nothing to tap.
 */
const dividerDrawer: KindInput = {
  name: 'onyx.DividerDrawer',
  kind: 'duyo.Control',
  published: { ...dividerPublished, caption: '', open: true, animated: true },
  events: { onOpenChanged: '', onOpenAnimationComplete: '' },
  toggleOpen(this: Component) {
    this.setOpen(!this.get('open'));
  },
  openChanged(this: Component, previous: boolean, open: boolean) {
    this.doOpenChanged({ open });
  },
};

function DividerDrawerView(binding: BindingProps) {
  const { node } = binding;
  const open = node.get('open') !== false;
  const caption = String(node.get('caption') ?? '');
  return (
    <div {...host(binding, ['onyx-divider-drawer'])}>
      <div
        className="onyx-divider"
        style={caption ? undefined : { display: 'none' }}
        role="button"
        aria-expanded={open}
        onClick={() => node.toggleOpen()}
      >
        {dividerParts(node, <div className={cx('onyx-collapsible-arrow', !open && 'onyx-collapsible-arrow-switched')} />)}
      </div>
      <div
        className={cx('onyx-drawer', !open && 'onyx-drawer-closed', node.get('animated') === false && 'onyx-drawer-instant')}
        onTransitionEnd={(event) => {
          if (event.target === event.currentTarget) node.doOpenAnimationComplete({ open: node.get('open') !== false });
        }}
      >
        <div className="onyx-drawer-content" aria-hidden={!open}>
          {inner(binding)}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ConfirmPrompt and SwipeableItem
// ---------------------------------------------------------------------------

/** The two buttons of a confirm prompt, the second warning that what it does cannot be undone. */
function ConfirmButtons({ cancel, confirm, onCancel, onConfirm }: { cancel: string; confirm: string; onCancel: () => void; onConfirm: () => void }) {
  return (
    <>
      <button type="button" className="onyx-button" onClick={onCancel}>
        {cancel}
      </button>
      <div className="onyx-confirmprompt-spacer" />
      <button type="button" className="onyx-button onyx-negative" onClick={onConfirm}>
        {confirm}
      </button>
    </>
  );
}

/** A prompt with a confirm button and a cancel button. */
const confirmPrompt: KindInput = {
  name: 'onyx.ConfirmPrompt',
  kind: 'duyo.Control',
  published: { confirmCaption: 'Confirm', cancelCaption: 'Cancel' },
  events: { onConfirm: '', onCancel: '' },
};

function ConfirmPromptView(binding: BindingProps) {
  const { node } = binding;
  return (
    <div {...host(binding, ['onyx-confirmprompt'])}>
      <ConfirmButtons
        cancel={String(node.get('cancelCaption') ?? '')}
        confirm={String(node.get('confirmCaption') ?? '')}
        onCancel={() => node.doCancel()}
        onConfirm={() => node.doConfirm()}
      />
    </div>
  );
}

/** How far the pointer must go before a drag has started, as Enyo's gestures. */
const DRAG_THRESHOLD = 4;
/** A swipe has to go this far, as a share of the item's width, to count. */
const TRIGGER_RATIO = 0.35;

/**
 * An item that can be swiped aside, which then asks (with a confirm prompt over the item) whether to go on: swipe to
 * delete. `onConfirm` is raised when the prompt is confirmed, or at once when the item is swiped with
 * `confirmRequired` off. Its events carry the `index` of the item among those beside it.
 */
const swipeableItem: KindInput = {
  name: 'onyx.SwipeableItem',
  kind: 'onyx.Item',
  published: {
    /** Set to false to stop it being swiped. */
    swipeable: true,
    /** If false, no prompt is shown, and a swipe raises `onConfirm` at once. */
    confirmRequired: true,
    confirmCaption: 'Delete',
    cancelCaption: 'Cancel',
    confirmShowing: false,
    /** Whether it may be swiped to the left. */
    allowLeft: true,
  },
  events: { onConfirm: '', onCancel: '', onSwipe: '', onConfirmShowingChanged: '', onDrag: '' },
  confirmShowingChanged(this: Component, previous: boolean, showing: boolean) {
    this.doConfirmShowingChanged({ showing, index: this.itemIndex() });
  },
  /** Where this item is among those beside it. */
  itemIndex(this: Component): number {
    return this.parent ? this.parent.children.indexOf(this) : 0;
  },
  confirmSwipe(this: Component) {
    this.setConfirmShowing(false);
    this.doConfirm({ index: this.itemIndex() });
  },
  cancelSwipe(this: Component) {
    this.setConfirmShowing(false);
    this.doCancel({ index: this.itemIndex() });
  },
};

function SwipeableItemView(binding: BindingProps) {
  const { node } = binding;
  const element = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; id: number; dragging: boolean; refused: boolean; dx: number; trigger: number } | null>(null);
  const swallowClick = useRef(false);
  const showing = flag(node, 'confirmShowing');
  const attributes = host(binding, ['onyx-item', 'onyx-swipeableitem']);

  const dxOf = (raw: number) => (raw > 0 || node.get('allowLeft') !== false ? raw : 0);
  const place = (dx: number) => {
    if (element.current) element.current.style.transform = dx ? `translate3d(${dx}px, 0, 0)` : '';
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    attributes.onPointerDown?.(event);
    if (!flag(node, 'swipeable') || showing || (event.pointerType === 'mouse' && event.button !== 0)) return;
    drag.current = { x: event.clientX, y: event.clientY, id: event.pointerId, dragging: false, refused: false, dx: 0, trigger: 0 };
  };
  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.refused || event.pointerId !== d.id) return;
    const dx = event.clientX - d.x;
    if (!d.dragging) {
      if (Math.hypot(dx, event.clientY - d.y) < DRAG_THRESHOLD) return;
      // a drag that is more up and down than across is the list scrolling, not a swipe
      if (Math.abs(dx) <= Math.abs(event.clientY - d.y)) {
        d.refused = true;
        return;
      }
      d.dragging = true;
      d.trigger = Math.floor((element.current?.getBoundingClientRect().width ?? 0) * TRIGGER_RATIO);
      element.current?.setPointerCapture?.(event.pointerId);
      // the move that starts a drag only starts it (and puts the item where it was), as in Enyo; it follows from the next one
      node.doDrag({ dx: 0 });
      return;
    }
    d.dx = dxOf(dx);
    place(d.dx);
    node.doDrag({ dx: d.dx });
  };
  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    drag.current = null;
    if (!d || !d.dragging || event.pointerId !== d.id) return;
    // the click that ends a drag is not a tap
    swallowClick.current = true;
    setTimeout(() => (swallowClick.current = false), 0);
    place(0);
    node.doDrag({ dx: 0 });
    if (Math.abs(d.dx) > d.trigger) {
      const index = node.itemIndex();
      node.doSwipe({ index });
      if (node.get('confirmRequired') !== false) node.setConfirmShowing(true);
      else node.doConfirm({ index });
    }
  };

  return (
    <div
      {...attributes}
      ref={element}
      style={{ ...attributes.style, ...(showing ? { position: 'relative' } : {}) }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      // the item does not tap while it asks, or at the end of a drag; what is inside it, such as the prompt's buttons, still does
      onClick={(event) => {
        if (!swallowClick.current && !showing) attributes.onClick?.(event);
      }}
    >
      {inner(binding)}
      {showing ? (
        <div className="onyx-confirmprompt onyx-confirmprompt-fit">
          <div className="onyx-confirmprompt-fit onyx-confirmprompt-scrim" />
          <div className="onyx-confirmprompt onyx-confirmprompt-fit">
            <ConfirmButtons
              cancel={String(node.get('cancelCaption') ?? '')}
              confirm={String(node.get('confirmCaption') ?? '')}
              onCancel={() => node.cancelSwipe()}
              onConfirm={() => node.confirmSwipe()}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

export const webos: PackEntry[] = [
  entry(header, HeaderView, { layout: flexLayout }),
  entry(divider, DividerView),
  entry(alphaDivider, AlphaDividerView),
  entry(dividerDrawer, DividerDrawerView),
  entry(confirmPrompt, ConfirmPromptView),
  entry(swipeableItem, SwipeableItemView),
];
