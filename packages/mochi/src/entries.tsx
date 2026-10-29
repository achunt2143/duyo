import type { Component, KindDefinition } from '@duyo/core';
import { adapt, type AdaptContext, type BindingProps, type PackEntry } from '@duyo/react';
import { useEffect, type ReactNode } from 'react';
import * as R from 'remochi';

/**
 * Every Remochi component as a Duyo kind, each one `adapt()` over the component, using
 * only the public `@duyo/react` API: the same surface anyone porting another library has.
 *
 * Published defaults mirror Remochi's own, so an unconfigured kind looks exactly like the
 * plain component.
 *
 * Conventions, borrowed from Enyo's Onyx and Mochi widgets:
 *  - a control with a value raises `onChange` with `{ value }` (`doChange()`);
 *  - text fields raise the DOM-style `oninput` / `onchange`;
 *  - every control gets `ontap`;
 *  - Remochi props that would collide with Duyo's are renamed: `type` -> `variant`,
 *    a panel's `style` -> `look`, `isOpen` -> `open`, `isActive` -> `active`;
 *  - anything that is a React node or a ref in Remochi is expressed as Duyo children or
 *    as the name of another component, so definitions stay plain data.
 */

type Props = Record<string, unknown>;

/** The Duyo `content` if set, otherwise whatever child components the user nested. */
const label = (node: Component, ctx: AdaptContext) =>
  node.get('content') !== '' ? node.get('content') : ctx.childNodes.length > 0 ? ctx.children : undefined;

/** A component owned by the same kind instance, found by name: `anchor: 'moreButton'`. */
const sibling = (node: Component, name: unknown): Component | undefined =>
  typeof name === 'string' && name !== '' ? (node.owner ?? node).$[name] : undefined;

/** The DOM element a Duyo component was drawn as, for libraries that take refs. */
const elementOf = (target: Component | undefined) => ({
  get current(): HTMLElement | null {
    return target ? document.querySelector<HTMLElement>(`[data-duyo-id="${target.id}"]`) : null;
  },
});

const VARIANTS = ['normal', 'warning', 'affirmative', 'blue'] as const;
const LOOKS = ['default', 'shadow'] as const;
const ORIENTATIONS = ['horizontal', 'vertical'] as const;
const EDGES = ['left', 'right', 'top', 'bottom'] as const;

/** `{ label, action?, type? }` in Duyo data -> Remochi's `{ label, onClick, type }`. */
const withActions = (node: Component, actions: unknown) =>
  (Array.isArray(actions) ? actions : []).map((action: { label: string; action?: string; type?: string }) => ({
    label: action.label,
    type: action.type,
    onClick: () => node.doAction({ action: action.action ?? action.label, label: action.label }),
  }));

/** Raises `onChange` with `{ value }` after writing `property`. */
const change = (node: Component, property: string) => (value: unknown) => {
  node.set(property, value);
  node.doChange({ value });
};

// ---------------------------------------------------------------------------
// Buttons and toggles
// ---------------------------------------------------------------------------

export const buttons: PackEntry[] = [
  adapt({
    name: 'mochi.Button',
    component: R.Button,
    published: {
      variant: { default: 'normal', allowed: [...VARIANTS, 'dropdown'] },
      htmlType: { default: 'button', allowed: ['button', 'submit', 'reset'] },
      disabled: false,
    },
    hostStyle: { display: 'inline-block' },
    props: (node, ctx): Props => ({
      type: node.variant,
      htmlType: node.htmlType,
      disabled: node.disabled,
      children: label(node, ctx),
    }),
  }),

  adapt({
    name: 'mochi.ViewSelectButton',
    component: R.ViewSelectButton,
    published: {
      items: [],
      selected: 0,
      variant: { default: 'normal', allowed: VARIANTS },
      decoratorLeft: '(',
      decoratorRight: ')',
      barClasses: '',
      decoratorClasses: '',
    },
    events: { onSelect: '' },
    hostStyle: { display: 'inline-block' },
    props: (node): Props => ({
      variant: node.variant,
      decoratorLeft: node.decoratorLeft,
      decoratorRight: node.decoratorRight,
      barClasses: node.barClasses,
      decoratorClasses: node.decoratorClasses,
      items: (node.items as Array<{ content: string; disabled?: boolean }>).map((item, index) => ({
        ...item,
        active: index === node.selected,
      })),
      onSelect: (item: { value?: unknown }, index: number) => {
        node.setSelected(index);
        node.doSelect({ index, item, value: item.value });
      },
    }),
  }),

  adapt({
    name: 'mochi.Toggle',
    component: R.Toggle,
    published: {
      value: false,
      disabled: false,
      canAnimate: true,
      colorActive: undefined,
      colorInactive: undefined,
      // Remochi's onContent / offContent: an `on…` property is an event delegate in Duyo.
      labelOn: 'On',
      labelOff: 'Off',
    },
    events: { onChange: '' },
    hostStyle: { display: 'inline-block' },
    props: (node): Props => ({
      value: node.value,
      disabled: node.disabled,
      canAnimate: node.canAnimate,
      colorActive: node.colorActive,
      colorInactive: node.colorInactive,
      onContent: node.labelOn,
      offContent: node.labelOff,
      onChange: (event: { value: boolean }) => change(node, 'value')(event.value),
    }),
  }),

  adapt({
    name: 'mochi.Checkbox',
    component: R.Checkbox,
    published: {
      checked: false,
      disabled: false,
      canAnimate: true,
      colorActive: undefined,
      colorInactive: undefined,
      colorActiveDisabled: undefined,
      colorInactiveDisabled: undefined,
    },
    events: { onChange: '' },
    hostStyle: { display: 'inline-block' },
    props: (node): Props => ({
      checked: node.checked,
      disabled: node.disabled,
      canAnimate: node.canAnimate,
      colorActive: node.colorActive,
      colorInactive: node.colorInactive,
      colorActiveDisabled: node.colorActiveDisabled,
      colorInactiveDisabled: node.colorInactiveDisabled,
      onChange: (event: { checked: boolean }) => change(node, 'checked')(event.checked),
    }),
  }),

  adapt({
    name: 'mochi.Radio',
    component: R.Radio,
    // `name` is the Duyo component's own identity, so the radio group is `group`.
    published: { group: '', value: '', checked: false, disabled: false },
    events: { onChange: '' },
    hostStyle: { display: 'inline-block' },
    props: (node, ctx): Props => ({
      name: node.group || undefined,
      value: node.value,
      checked: node.checked,
      disabled: node.disabled,
      children: label(node, ctx),
      onChange: () => {
        node.setChecked(true);
        node.doChange({ value: node.value, checked: true });
      },
    }),
  }),
];

// ---------------------------------------------------------------------------
// Fields
// ---------------------------------------------------------------------------

/** Text fields: `oninput` per keystroke, `onchange` when the user is done. */
const textEvents = (node: Component, read: (event: any) => string): Props => ({
  onChange: (event: unknown) => {
    const value = read(event);
    node.setValue(value);
    node.bubble('oninput', { type: 'input', value });
  },
  onFocus: () => node.bubble('onfocus', { type: 'focus' }),
  onBlur: () => node.bubble('onchange', { type: 'change', value: node.value }),
});

export const fields: PackEntry[] = [
  adapt({
    name: 'mochi.Input',
    component: R.Input,
    published: { value: '', placeholder: '', type: 'text', disabled: false, readOnly: false, maxLength: undefined },
    hostStyle: { display: 'inline-block' },
    props: (node): Props => ({
      value: node.value,
      placeholder: node.placeholder,
      type: node.type,
      disabled: node.disabled,
      readOnly: node.readOnly,
      maxLength: node.maxLength,
      ...textEvents(node, (event) => event.target.value),
      onKeyDown: (event: { key: string }) => {
        if (event.key === 'Enter') node.bubble('onchange', { type: 'change', value: node.value });
      },
    }),
  }),

  adapt({
    name: 'mochi.TextArea',
    component: R.TextArea,
    published: { value: '', placeholder: '', disabled: false, defaultFocus: false, minHeight: 50, rows: 4 },
    props: (node): Props => ({
      value: node.value,
      placeholder: node.placeholder,
      disabled: node.disabled,
      defaultFocus: node.defaultFocus,
      minHeight: node.minHeight,
      rows: node.rows,
      ...textEvents(node, (event) => event.target.value),
    }),
  }),

  adapt({
    name: 'mochi.RichText',
    component: R.RichText,
    published: {
      value: '',
      placeholder: '',
      disabled: false,
      defaultFocus: false,
      width: '100%',
      minHeight: 50,
      allowFormatting: true,
    },
    props: (node): Props => ({
      value: node.value,
      placeholder: node.placeholder,
      disabled: node.disabled,
      defaultFocus: node.defaultFocus,
      width: node.width,
      minHeight: node.minHeight,
      allowFormatting: node.allowFormatting,
      // RichText reports its HTML directly rather than an event.
      ...textEvents(node, (html) => html),
    }),
  }),

  adapt({
    name: 'mochi.Dropdown',
    component: R.Dropdown,
    published: {
      options: [],
      value: undefined,
      label: undefined,
      placeholder: 'Select an option',
      disabled: false,
      maxHeight: 200,
    },
    events: { onChange: '' },
    hostStyle: { display: 'inline-block' },
    props: (node): Props => ({
      options: node.options,
      value: node.value,
      label: node.label,
      placeholder: node.placeholder,
      disabled: node.disabled,
      maxHeight: node.maxHeight,
      onChange: change(node, 'value'),
    }),
  }),

  adapt({
    name: 'mochi.NumberInput',
    component: R.NumberInput,
    published: {
      value: 0,
      min: undefined,
      max: undefined,
      step: 1,
      label: undefined,
      unit: undefined,
      disabled: false,
      showControls: true,
    },
    events: { onChange: '' },
    hostStyle: { display: 'inline-block' },
    props: (node): Props => ({
      value: node.value,
      min: node.min,
      max: node.max,
      step: node.step,
      label: node.label,
      unit: node.unit,
      disabled: node.disabled,
      showControls: node.showControls,
      onChange: change(node, 'value'),
    }),
  }),

  adapt({
    name: 'mochi.Slider',
    component: R.Slider,
    published: { value: 50, min: 0, max: 100, step: 1, color: undefined, width: '320px' },
    events: { onChange: '' },
    props: (node): Props => ({
      value: node.value,
      min: node.min,
      max: node.max,
      step: node.step,
      color: node.color,
      width: node.width,
      onChange: change(node, 'value'),
    }),
  }),

  adapt({
    name: 'mochi.DateInput',
    component: R.DateInput,
    published: {
      value: undefined,
      label: undefined,
      placeholder: 'Select date…',
      minDate: undefined,
      maxDate: undefined,
      disabled: false,
    },
    events: { onChange: '' },
    hostStyle: { display: 'inline-block' },
    // DateInput reads `value` at mount, so a value set from code needs a fresh instance.
    key: (node) => String(node.get('value')),
    props: (node): Props => ({
      value: node.value,
      label: node.label,
      placeholder: node.placeholder,
      minDate: node.minDate,
      maxDate: node.maxDate,
      disabled: node.disabled,
      onChange: change(node, 'value'),
    }),
  }),
];

// ---------------------------------------------------------------------------
// Display
// ---------------------------------------------------------------------------

export const display: PackEntry[] = [
  adapt({
    name: 'mochi.ProgressBar',
    component: R.ProgressBar,
    published: { value: 0, color: 'blue', width: undefined, height: undefined },
    props: (node): Props => ({ value: node.value, color: node.color, width: node.width, height: node.height }),
  }),

  adapt({
    name: 'mochi.Spinner',
    component: R.Spinner,
    published: {
      active: true,
      styleType: { default: 'light', allowed: ['light', 'dark'] },
      size: { default: 'normal', allowed: ['normal', 'large'] },
      alt: 'Loading...',
    },
    hostStyle: { display: 'inline-block' },
    props: (node): Props => ({ active: node.active, styleType: node.styleType, size: node.size, alt: node.alt }),
  }),

  adapt({
    name: 'mochi.Badge',
    component: R.Badge,
    published: {
      variant: { default: 'default', allowed: ['default', 'success', 'warning', 'error', 'danger', 'info'] },
      count: undefined,
      background: undefined,
      color: '#ffffff',
    },
    hostStyle: { display: 'inline-block' },
    props: (node, ctx): Props => ({
      content: node.content !== '' ? node.content : undefined,
      children: ctx.childNodes.length > 0 ? ctx.children : undefined,
      variant: node.variant,
      count: node.count,
      background: node.background,
      color: node.color,
    }),
  }),

  adapt({
    name: 'mochi.Header',
    component: R.Header,
    props: (node): Props => ({ content: node.content }),
  }),

  adapt({
    name: 'mochi.Subheader',
    component: R.Subheader,
    props: (node): Props => ({ content: node.content }),
  }),

  adapt({
    name: 'mochi.Divider',
    component: R.Divider,
    published: { orientation: { default: 'horizontal', allowed: ORIENTATIONS }, thickness: 4 },
    host: 'props',
    props: (node): Props => ({ orientation: node.orientation, thickness: node.thickness }),
  }),

  adapt({
    name: 'mochi.NubbinDivider',
    component: R.NubbinDivider,
    published: {
      nubbin: {
        default: 'up',
        allowed: [
          'up', 'down', 'left', 'right',
          'top-left-up', 'top-right-up', 'top-left-left', 'top-right-right',
          'bottom-left-down', 'bottom-right-down', 'bottom-left-left', 'bottom-right-right',
        ],
      },
      nubbinOffset: '50%',
      orientation: { default: 'horizontal', allowed: ORIENTATIONS },
      thickness: 2,
    },
    host: 'props',
    props: (node): Props => ({
      nubbin: node.nubbin,
      nubbinOffset: node.nubbinOffset,
      orientation: node.orientation,
      thickness: node.thickness,
    }),
  }),
];

// ---------------------------------------------------------------------------
// Lists and data
// ---------------------------------------------------------------------------

export const lists: PackEntry[] = [
  adapt({
    name: 'mochi.Item',
    component: R.Item,
    published: {
      title: undefined,
      subtitle: undefined,
      icon: undefined,
      rightContent: undefined,
      selected: false,
      disabled: false,
      hoverable: true,
      variant: { default: 'default', allowed: ['default', 'compact', 'detailed'] },
    },
    events: { onIconTap: '' },
    props: (node, ctx): Props => ({
      children: label(node, ctx),
      title: node.title,
      subtitle: node.subtitle,
      icon: node.icon,
      rightContent: node.rightContent,
      selected: node.selected,
      disabled: node.disabled,
      hoverable: node.hoverable,
      variant: node.variant,
      onIconClick: (event: { stopPropagation?: () => void }) => {
        // The icon has its own event; it is not also a tap on the item.
        event.stopPropagation?.();
        node.doIconTap({});
      },
    }),
  }),

  adapt({
    name: 'mochi.List',
    component: R.List,
    events: { onScrollStart: '', onScrollStop: '' },
    props: (node): Props => ({
      onScrollStart: () => node.doScrollStart({}),
      onScrollStop: () => node.doScrollStop({}),
    }),
  }),

  adapt({
    name: 'mochi.ListHeader',
    component: R.ListHeader,
    props: (node): Props => ({ content: node.content }),
  }),

  adapt({
    name: 'mochi.ListItem',
    component: R.ListItem,
    published: { tapHighlight: true },
    events: { onSelect: '' },
    host: 'props',
    props: (node, ctx): Props => ({
      children: label(node, ctx),
      tapHighlight: node.tapHighlight,
      onSelect: (highlighted: boolean) => node.doSelect({ highlighted }),
    }),
  }),

  adapt({
    name: 'mochi.GridList',
    component: R.GridList,
    published: { columns: 3, gap: 12 },
    props: (node): Props => ({ columns: node.columns, gap: node.gap }),
  }),

  adapt({
    name: 'mochi.GridListImageItem',
    component: R.GridListImageItem,
    published: { src: undefined, caption: undefined, selected: false },
    events: { onSelect: '' },
    props: (node): Props => ({
      src: node.src,
      caption: node.caption,
      selected: node.selected,
      onSelect: (selected: boolean) => {
        node.setSelected(selected);
        node.doSelect({ value: selected });
      },
    }),
  }),

  adapt({
    name: 'mochi.Table',
    component: R.Table,
    published: {
      columns: [],
      rows: undefined,
      data: undefined,
      sortable: true,
      hoverable: true,
      striped: false,
    },
    events: { onRowTap: '' },
    props: (node): Props => ({
      columns: node.columns,
      rows: node.rows,
      data: node.data,
      sortable: node.sortable,
      hoverable: node.hoverable,
      striped: node.striped,
      onRowClick: (row: unknown) => node.doRowTap({ row }),
    }),
  }),

  adapt({
    name: 'mochi.Pagination',
    component: R.Pagination,
    published: { currentPage: 1, totalPages: 1, showFirstLast: true, showPrevNext: true, maxVisible: 7 },
    events: { onChange: '' },
    props: (node): Props => ({
      currentPage: node.currentPage,
      totalPages: node.totalPages,
      showFirstLast: node.showFirstLast,
      showPrevNext: node.showPrevNext,
      maxVisible: node.maxVisible,
      onPageChange: change(node, 'currentPage'),
    }),
  }),
];

// ---------------------------------------------------------------------------
// Panels and disclosure
// ---------------------------------------------------------------------------

export const panels: PackEntry[] = [
  adapt({
    name: 'mochi.Repanel',
    component: R.Repanel,
    published: { width: 100, look: { default: 'default', allowed: LOOKS }, handle: false },
    // Remochi's `style` is the variant, so Duyo's style goes on a wrapper.
    hostStyle: { height: '100%' },
    props: (node, ctx): Props => ({ width: node.width, style: node.look, handle: node.handle, children: label(node, ctx) }),
  }),

  adapt({
    name: 'mochi.FloatingPanel',
    component: R.FloatingPanel,
    published: { look: { default: 'default', allowed: LOOKS } },
    props: (node, ctx): Props => ({ style: node.look, children: label(node, ctx) }),
  }),

  adapt({
    name: 'mochi.RepanelStack',
    component: R.RepanelStack,
    published: {
      activeIndex: undefined,
      reveal: undefined,
      snapPoints: [1, 2, 3],
      maxVisiblePanels: 3,
      overlap: 1,
      peek: 320,
      grabber: true,
      wrap: false,
      animate: true,
      narrowFit: true,
      narrowFitWidth: 768,
      narrowBehavior: { default: 'single', allowed: ['single', 'stack', 'overlay'] },
    },
    events: { onActiveIndexChange: '', onRevealChange: '' },
    hostStyle: { height: '100%' },
    members: {
      /** Moves the front panel forward one, as Enyo's Panels `next()`. */
      next() {
        const last = this.children.length - 1;
        this.setActiveIndex(Math.min((this.activeIndex ?? last) + 1, last));
      },
      previous() {
        const last = this.children.length - 1;
        this.setActiveIndex(Math.max((this.activeIndex ?? last) - 1, 0));
      },
    },
    props: (node, ctx): Props => ({
      activeIndex: node.activeIndex,
      reveal: node.reveal,
      snapPoints: node.snapPoints,
      maxVisiblePanels: node.maxVisiblePanels,
      overlap: node.overlap,
      peek: node.peek,
      grabber: node.grabber,
      wrap: node.wrap,
      animate: node.animate,
      narrowFit: node.narrowFit,
      narrowFitWidth: node.narrowFitWidth,
      narrowBehavior: node.narrowBehavior,
      onActiveIndexChange: (index: number, detail: object) => {
        node.setActiveIndex(index);
        node.doActiveIndexChange({ index, ...detail });
      },
      onRevealChange: (reveal: number, detail: object) => {
        node.setReveal(reveal);
        node.doRevealChange({ reveal, ...detail });
      },
      // The stack inspects its children and decorates `Repanel`s, so it must receive
      // real `Repanel` elements rather than Duyo's per-component wrappers.
      children: ctx.childNodes.map((panel) => (
        <R.Repanel
          key={panel.id}
          data-duyo-id={panel.id}
          width={panel.get('width') as number | undefined}
          style={panel.get('look') as 'default' | 'shadow'}
          className={String(panel.get('classes') ?? '') || undefined}
        >
          {ctx.renderChildren(panel)}
        </R.Repanel>
      )),
    }),
  }),

  adapt({
    name: 'mochi.Collapsable',
    component: R.Collapsable,
    published: { title: undefined, expanded: false },
    events: { onToggle: '' },
    props: (node): Props => ({
      title: node.title,
      isOpen: node.expanded,
      onToggle: (expanded: boolean) => {
        node.setExpanded(expanded);
        node.doToggle({ expanded });
      },
    }),
  }),

  adapt({
    name: 'mochi.CollapsableHeader',
    component: R.CollapsableHeader,
    props: (node, ctx): Props => ({ children: label(node, ctx) }),
  }),
  adapt({
    name: 'mochi.CollapsableItem',
    component: R.CollapsableItem,
    props: (node, ctx): Props => ({ children: label(node, ctx) }),
  }),
  adapt({ name: 'mochi.CollapsableFooter', component: R.CollapsableFooter }),
];

// ---------------------------------------------------------------------------
// Sliding menu
// ---------------------------------------------------------------------------

export const menus: PackEntry[] = [
  adapt({
    name: 'mochi.SlidingMenu',
    component: R.SlidingMenu,
    published: {
      open: false,
      position: { default: 'left', allowed: EDGES },
      duration: 300,
      closeOnEscape: true,
      closeOnBackdropClick: true,
      backdropColor: undefined,
      showBackdrop: true,
    },
    events: { onOpenChange: '' },
    host: 'props',
    members: {
      toggle() {
        this.setOpen(!this.open);
      },
    },
    props: (node): Props => ({
      isOpen: node.open,
      position: node.position,
      duration: node.duration,
      closeOnEscape: node.closeOnEscape,
      closeOnBackdropClick: node.closeOnBackdropClick,
      backdropColor: node.backdropColor,
      showBackdrop: node.showBackdrop,
      onOpenChange: (open: boolean) => {
        node.setOpen(open);
        node.doOpenChange({ value: open });
      },
    }),
  }),

  adapt({
    name: 'mochi.SlidingMenuContentShifter',
    component: R.SlidingMenuContentShifter,
    // `menu` names the mochi.SlidingMenu this content moves aside for. Its position and
    // timing are used unless set here.
    published: {
      menu: undefined,
      position: { default: undefined, allowed: [undefined, ...EDGES] },
      menuWidth: '280px',
      menuHeight: 'auto',
      duration: undefined,
    },
    host: 'props',
    props: (node): Props => {
      const menu = sibling(node, node.menu);
      return {
        isMenuOpen: menu?.get('open') === true,
        position: node.position ?? menu?.get('position') ?? 'left',
        duration: node.duration ?? menu?.get('duration') ?? 300,
        menuWidth: node.menuWidth,
        menuHeight: node.menuHeight,
      };
    },
  }),

  adapt({
    name: 'mochi.SlidingMenuItem',
    component: R.SlidingMenuItem,
    published: {
      icon: undefined,
      href: undefined,
      active: false,
      badge: undefined,
      disabled: false,
      variant: { default: 'default', allowed: ['default', 'danger', 'success'] },
    },
    host: 'props',
    props: (node, ctx): Props => ({
      icon: node.icon,
      href: node.href,
      isActive: node.active,
      badge: node.badge,
      disabled: node.disabled,
      variant: node.variant,
      children: label(node, ctx),
    }),
  }),

  adapt({
    name: 'mochi.SlidingMenuItemGroup',
    component: R.SlidingMenuItemGroup,
    published: { label: undefined, divider: false },
    host: 'props',
    props: (node): Props => ({ label: node.label, divider: node.divider }),
  }),
];

// ---------------------------------------------------------------------------
// Overlays
// ---------------------------------------------------------------------------

export const overlays: PackEntry[] = [
  adapt({
    name: 'mochi.Dialog',
    component: R.Dialog,
    published: {
      open: false,
      title: undefined,
      dialogType: { default: 'default', allowed: ['default', 'alert', 'confirm', 'prompt'] },
      confirmText: 'OK',
      cancelText: 'Cancel',
      confirmType: { default: 'affirmative', allowed: [...VARIANTS, 'dropdown'] },
      showCloseButton: false,
      size: { default: 'medium', allowed: ['small', 'medium', 'large'] },
      actions: undefined,
      promptValue: '',
    },
    events: { onClose: '', onConfirm: '', onCancel: '', onAction: '', onPromptChange: '' },
    host: 'none',
    props: (node): Props => ({
      isOpen: node.open,
      title: node.title,
      type: node.dialogType,
      confirmText: node.confirmText,
      cancelText: node.cancelText,
      confirmType: node.confirmType,
      showCloseButton: node.showCloseButton,
      size: node.size,
      actions: node.actions ? withActions(node, node.actions) : undefined,
      promptValue: node.promptValue,
      // Any way out of a dialog closes it; a handler can open it again.
      onClose: () => {
        node.setOpen(false);
        node.doClose({});
      },
      onConfirm: (value: boolean | string) => {
        node.setOpen(false);
        node.doConfirm({ value });
      },
      onCancel: () => {
        node.setOpen(false);
        node.doCancel({});
      },
      onPromptChange: (value: string) => {
        node.setPromptValue(value);
        node.doPromptChange({ value });
      },
    }),
  }),

  adapt({
    name: 'mochi.PopupPanel',
    component: R.PopupPanel,
    // `anchor` names the component the popup points at, e.g. the button that opened it.
    published: { open: false, title: undefined, actions: [], anchor: undefined, anchorRect: undefined },
    events: { onClose: '', onAction: '' },
    host: 'none',
    props: (node): Props => ({
      isOpen: node.open,
      title: node.title,
      anchorEl: node.anchor ? elementOf(sibling(node, node.anchor)) : undefined,
      anchorRect: node.anchorRect,
      actions: withActions(node, node.actions),
      onClose: () => {
        node.setOpen(false);
        node.doClose({});
      },
    }),
  }),
];

// ---------------------------------------------------------------------------
// Media
// ---------------------------------------------------------------------------

export const media: PackEntry[] = [
  adapt({
    name: 'mochi.Video',
    component: R.Video,
    published: { src: undefined, poster: undefined, autoPlay: false, loop: false, muted: false, controls: true },
    events: { onPlay: '', onPause: '', onEnded: '', onTimeUpdate: '' },
    props: (node): Props => ({
      src: node.src,
      poster: node.poster,
      autoPlay: node.autoPlay,
      loop: node.loop,
      muted: node.muted,
      controls: node.controls,
      onPlay: () => node.doPlay({ type: 'play' }),
      onPause: () => node.doPause({ type: 'pause' }),
      onEnded: () => node.doEnded({ type: 'ended' }),
      onTimeUpdate: (currentTime: number) => node.doTimeUpdate({ type: 'timeupdate', currentTime }),
    }),
  }),
];

// ---------------------------------------------------------------------------
// Wizard
// ---------------------------------------------------------------------------

/**
 * A wizard step. Its children are the step's content. `onNext` runs when the user presses
 * Next on this step; a handler that returns `true` stops the wizard moving on, as a truthy
 * return stops any Duyo event.
 */
export const wizardStepKind: KindDefinition = {
  name: 'mochi.WizardStep',
  kind: 'duyo.Control',
  published: { label: '', title: undefined, description: undefined, skippable: false },
  events: { onNext: '' },
};

/**
 * Remochi's Wizard reads `steps[0]` unconditionally, so it throws with no steps. Steps are
 * Duyo children and may arrive after creation, so draw nothing until there is one.
 */
function withSteps(entry: PackEntry): PackEntry {
  const Draw = entry.binding.component;
  const WhenStepped = (props: BindingProps) => (props.childNodes.length > 0 ? <Draw {...props} /> : null);
  WhenStepped.displayName = 'WhenStepped(mochi.Wizard)';
  return { ...entry, binding: { ...entry.binding, component: WhenStepped } };
}

export const flow: PackEntry[] = [
  withSteps(adapt({
    name: 'mochi.Wizard',
    component: R.Wizard,
    published: { showStepNumbers: true, allowSkip: false, completedSteps: undefined, step: 0 },
    events: { onComplete: '', onCancel: '', onStepChange: '', onCompletedStepsChange: '' },
    props: (node, ctx): Props => ({
      showStepNumbers: node.showStepNumbers,
      allowSkip: node.allowSkip,
      completedSteps: node.completedSteps,
      steps: ctx.childNodes.map((step, index) => ({
        label: step.get('label') || step.name || `Step ${index + 1}`,
        title: step.get('title'),
        description: step.get('description'),
        skippable: step.get('skippable'),
        content: ctx.renderNode(step),
        onNext: () => !step.bubble('onNext', { index }),
      })),
      onComplete: () => node.doComplete({}),
      onCancel: () => node.doCancel({}),
      onStepChange: (step: number, detail: object) => {
        node.setStep(step);
        node.doStepChange({ step, ...detail });
      },
      onCompletedStepsChange: (completedSteps: number[], detail: object) => {
        // Only a wizard whose completion is set from outside keeps it in step.
        if (node.completedSteps !== undefined) node.setCompletedSteps(completedSteps);
        node.doCompletedStepsChange({ completedSteps, ...detail });
      },
    }),
  })),
];

// ---------------------------------------------------------------------------
// Theme
// ---------------------------------------------------------------------------

/** Mirrors the theme Remochi resolved ('system' -> 'dark' or 'light') onto the component. */
function ThemeProbe({ node, children }: { node: Component; children: ReactNode }) {
  const { resolvedTheme } = R.useTheme();
  useEffect(() => {
    if (!node.destroyed && node.get('resolvedTheme') !== resolvedTheme) node.set('resolvedTheme', resolvedTheme);
  }, [node, resolvedTheme]);
  return <>{children}</>;
}

export const theme: PackEntry[] = [
  adapt({
    name: 'mochi.ThemeWrapper',
    component: R.ThemeWrapper,
    published: {
      theme: { default: undefined, allowed: [undefined, 'dark', 'light', 'system'] },
      defaultTheme: { default: undefined, allowed: [undefined, 'dark', 'light', 'system'] },
      storageKey: null,
      syncHtml: undefined,
      fontFamily: 'Prelude',
      /** Read-only: what `theme` resolved to. */
      resolvedTheme: undefined,
    },
    events: { onThemeChange: '' },
    host: 'props',
    members: {
      toggleTheme() {
        this.setTheme(this.resolvedTheme === 'dark' ? 'light' : 'dark');
      },
    },
    props: (node, ctx): Props => ({
      theme: node.theme,
      defaultTheme: node.defaultTheme,
      storageKey: node.storageKey,
      syncHtml: node.syncHtml,
      fontFamily: node.fontFamily,
      onThemeChange: (value: string, resolved: string) => {
        node.setTheme(value);
        node.set('resolvedTheme', resolved);
        node.doThemeChange({ value, resolvedTheme: resolved });
      },
      children: <ThemeProbe node={node}>{ctx.children}</ThemeProbe>,
    }),
  }),
];

export const mochiEntries: readonly PackEntry[] = [
  ...buttons,
  ...fields,
  ...display,
  ...lists,
  ...panels,
  ...menus,
  ...overlays,
  ...media,
  ...flow,
  ...theme,
];
