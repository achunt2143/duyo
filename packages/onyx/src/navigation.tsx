/** @jsxRuntime automatic @jsxImportSource react */
import type { Component, KindInput } from '@duyo/core';
import type { BindingProps, PackEntry } from '@duyo/react';
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';

import { cx, entry, host, inner, type Members } from './support.js';

/**
 * `MoreToolbar`, `TabBar` and `TabPanels`.
 *
 * Enyo built these on Panels, Scroller and direct DOM moves. Here a tab bar is driven by data:
 * its `tabs` (a `TabBar`), or the children of a `TabPanels` (each an `onyx.TabPanel`). The tab
 * items Enyo exposed as `onyx.TabBarItem` are drawn by the bar and are not kinds of their own.
 */

// ---------------------------------------------------------------------------
// The overflow button and its menu
// ---------------------------------------------------------------------------

/** The "more" button of Enyo's toolbars and tab bars, and the menu it opens. */
function MoreMenu({ children, maxHeight, label }: { children: ReactNode; maxHeight?: number; label: string }) {
  const [open, setOpen] = useState(false);
  const decorator = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!decorator.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', outside, true);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', outside, true);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);

  return (
    <div className="onyx-popup-decorator" ref={decorator}>
      <div
        className={cx('onyx-icon', 'onyx-icon-button', 'onyx-more-button', open && 'active')}
        role="button"
        aria-label={label}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      />
      {open ? (
        <div
          className="onyx-popup onyx-menu onyx-more-menu"
          style={maxHeight ? { maxHeight, overflowY: 'auto' } : undefined}
          onClick={() => setOpen(false)}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// MoreToolbar
// ---------------------------------------------------------------------------

/** The width of an element with its margins. */
function outerWidth(element: Element): number {
  const style = getComputedStyle(element);
  return (element as HTMLElement).offsetWidth + (parseFloat(style.marginLeft) || 0) + (parseFloat(style.marginRight) || 0);
}

/**
 * Children that do not fit move into a menu, last first, and move back when there is room
 * again. Widths are remembered while a child is in the row so it can be moved back.
 */
function MoreToolbarView(binding: BindingProps) {
  const { childNodes, renderNode } = binding;
  const toolbar = useRef<HTMLDivElement>(null);
  const row = useRef<HTMLDivElement>(null);
  const widths = useRef(new Map<string, number>());
  const [hidden, setHidden] = useState(0);
  const [, setTick] = useState(0);

  const visible = childNodes.filter((child) => child.get('showing') !== false);

  useLayoutEffect(() => {
    const element = toolbar.current;
    const strip = row.current;
    if (!element || !strip) return;
    for (const child of Array.from(strip.children)) {
      const id = (child as HTMLElement).dataset['duyoId'];
      if (id) widths.current.set(id, outerWidth(child));
    }
    const style = getComputedStyle(element);
    const available = element.clientWidth - (parseFloat(style.paddingLeft) || 0) - (parseFloat(style.paddingRight) || 0);
    const sizes = visible.map((child) => widths.current.get(child.id) ?? 0);
    const MORE_BUTTON = 44;
    let count = 0;
    if (sizes.reduce((a, b) => a + b, 0) > available) {
      count = 1;
      while (count < sizes.length && sizes.slice(0, sizes.length - count).reduce((a, b) => a + b, 0) > available - MORE_BUTTON) count++;
    }
    if (count !== hidden) setHidden(count);
  });

  useEffect(() => {
    const element = toolbar.current;
    if (!element || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => setTick((t) => t + 1));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const split = visible.length - hidden;
  return (
    <div {...host(binding, ['onyx-toolbar', 'onyx-more-toolbar'])} ref={toolbar} style={{ ...binding.hostProps.style, display: 'flex', alignItems: 'center' }}>
      <div className="onyx-more-toolbar-client onyx-toolbar-inline" ref={row}>
        {visible.slice(0, split).map((child) => renderNode(child))}
      </div>
      {hidden > 0 ? <MoreMenu label="More">{visible.slice(split).map((child) => renderNode(child))}</MoreMenu> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------------

interface Tab {
  caption: string;
  tooltipMsg?: string;
  userId?: string;
  data?: unknown;
}

/**
 * What a tab bar and a tab-panel set have in common. The kind supplies `tabList()` (the tabs
 * to show) and `removeAt(index)` (what closing one does).
 */
const tabbing: Members = {
  /** The event payload for the tab at `index`, as Enyo's was. */
  tabData(index: number) {
    const tab: Tab | undefined = this.tabList()[index];
    return { index, caption: tab?.caption, tooltipMsg: tab?.tooltipMsg, userId: tab?.userId, data: tab?.data };
  },
  /** The index of a tab named by `{ userId }`, `{ caption }`, `{ index }` or a number. */
  resolveTab(target: number | { userId?: string; caption?: string; index?: number }) {
    const tabs: Tab[] = this.tabList();
    if (typeof target === 'number') return target < tabs.length ? target : -1;
    if (target.userId) return tabs.findIndex((tab) => tab.userId === target.userId);
    if (target.caption) return tabs.findIndex((tab) => tab.caption === target.caption);
    if (typeof target.index === 'number') return target.index < tabs.length ? target.index : -1;
    return -1;
  },
  /** Makes a tab the current one. */
  activate(target: number | { userId?: string; caption?: string; index?: number }) {
    const index = this.resolveTab(target);
    if (index >= 0) this.setSelected(index);
  },
  /** A tap on a tab: asks first when `checkBeforeChanging` is set. */
  requestSwitch(index: number) {
    if (this.get('checkBeforeChanging') === true) {
      this.doTabChangeRequested({
        ...this.tabData(index),
        next: (error?: string) => {
          if (error) throw new Error(error);
          this.setSelected(index);
        },
      });
    } else {
      this.setSelected(index);
    }
  },
  /** A tap on a tab's close button: asks first when `checkBeforeClosing` is set. */
  requestClose(index: number) {
    if (this.get('checkBeforeClosing') === true) {
      this.doTabRemoveRequested({
        ...this.tabData(index),
        next: (error?: string) => {
          if (error) throw new Error(error);
          this.removeTab(index);
        },
      });
    } else {
      this.removeTab(index);
    }
  },
  /** Removes a tab. The current one stays current unless it was the one removed. */
  removeTab(target: number | { userId?: string; caption?: string; index?: number }) {
    const index = this.resolveTab(target);
    if (index < 0) return;
    const data = this.tabData(index);
    const selected = this.get('selected') as number;
    this.removeAt(index);
    const count = this.tabList().length;
    if (index === selected) {
      // the tab that took its place, or the last one
      const next = Math.min(index, count - 1);
      this.props['selected'] = next;
      this.runtime.invalidate();
      if (next >= 0) this.doTabChanged(this.tabData(next));
    } else if (index < selected) {
      this.props['selected'] = selected - 1;
    }
    this.doTabRemoved(data);
  },
  selectedChanged(_previous: number, index: number) {
    if (index >= 0 && index < this.tabList().length) this.doTabChanged(this.tabData(index));
  },
};

const tabEvents = { onTabChanged: '', onTabChangeRequested: '', onTabRemoveRequested: '', onTabRemoved: '' };
const tabSettings = { selected: 0, maxMenuHeight: 600, checkBeforeClosing: false, checkBeforeChanging: false };

const tabBar: KindInput = {
  name: 'onyx.TabBar',
  kind: 'duyo.Control',
  /** `tabs` is a list of `{ caption, tooltipMsg?, userId?, data? }`. */
  published: { tabs: [], ...tabSettings },
  events: tabEvents,
  ...tabbing,
  tabList() {
    return this.get('tabs');
  },
  removeAt(index: number) {
    this.setTabs((this.tabs as Tab[]).filter((_, i) => i !== index));
  },
  /** Adds a tab and makes it current. */
  addTab(tab: Partial<Tab>) {
    const tabs = this.tabs as Tab[];
    this.setTabs([...tabs, { ...tab, caption: tab.caption ?? `Tab ${tabs.length}` }]);
    this.setSelected(tabs.length);
  },
};

const tabPanel: KindInput = {
  name: 'onyx.TabPanel',
  kind: 'duyo.Control',
  published: { caption: '', tooltipMsg: '', userId: '' },
};

const tabPanels: KindInput = {
  name: 'onyx.TabPanels',
  kind: 'duyo.Control',
  published: { ...tabSettings, animate: true },
  events: tabEvents,
  ...tabbing,
  tabList(): Tab[] {
    return this.children.map((panel: Component, index: number) => ({
      caption: String(panel.get('caption') || panel.name || `Tab ${index}`),
      tooltipMsg: String(panel.get('tooltipMsg') ?? ''),
      userId: String(panel.get('userId') ?? ''),
    }));
  },
  removeAt(index: number) {
    this.children[index]?.destroy();
  },
  /** Adds a panel (an `onyx.TabPanel` unless `kind` says otherwise) and makes it current. */
  addTab(definition: Record<string, unknown>) {
    this.createComponent({ kind: 'onyx.TabPanel', ...definition });
    this.setSelected(this.children.length - 1);
  },
};

/** The tabs, a scroller for them, and a menu to pick one when they do not all fit. */
function TabStrip({ node, tabs, selected }: { node: Component; tabs: Tab[]; selected: number }) {
  const current = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);

  // Bring the current tab into view by scrolling the strip only, never the page.
  useEffect(() => {
    const tab = current.current;
    const strip = scroller.current;
    if (!tab || !strip) return;
    if (tab.offsetLeft < strip.scrollLeft) strip.scrollLeft = tab.offsetLeft;
    else if (tab.offsetLeft + tab.offsetWidth > strip.scrollLeft + strip.clientWidth) {
      strip.scrollLeft = tab.offsetLeft + tab.offsetWidth - strip.clientWidth;
    }
  }, [selected, tabs.length]);

  return (
    <>
      <div className="onyx-tab-bar-fit">
        <div className="onyx-tab-bar-scroller" ref={scroller}>
          <div className="onyx-tab-wrapper">
            <div>
              <div className="onyx-tab-holder" role="tablist">
                {tabs.map((tab, index) => (
                  <div
                    key={index}
                    ref={index === selected ? current : undefined}
                    className={cx('onyx-tab-item', index === selected && 'active')}
                    title={tab.tooltipMsg || undefined}
                  >
                    <button type="button" role="tab" aria-selected={index === selected} onClick={() => node.requestSwitch(index)}>
                      {tab.caption}
                    </button>
                    <div className="onyx-tab-item-close" role="button" aria-label={`Close ${tab.caption}`} onClick={() => node.requestClose(index)} />
                  </div>
                ))}
              </div>
              <div className="onyx-tab-line" />
              <div className="onyx-tab-rug" />
            </div>
          </div>
        </div>
      </div>
      <MoreMenu label="Tabs" maxHeight={Number(node.get('maxMenuHeight')) || 600}>
        {tabs.map((tab, index) => (
          <div key={index} className={cx('onyx-menu-item', index === selected && 'selected')} role="menuitem" onClick={() => node.requestSwitch(index)}>
            {tab.caption}
          </div>
        ))}
      </MoreMenu>
    </>
  );
}

function TabBarView(binding: BindingProps) {
  const { node } = binding;
  const tabs = (Array.isArray(node.get('tabs')) ? node.get('tabs') : []) as Tab[];
  return (
    <div {...host(binding, ['onyx-tab-bar'])}>
      <TabStrip node={node} tabs={tabs} selected={Number(node.get('selected')) || 0} />
    </div>
  );
}

/** How long Enyo's CardArranger takes to fade one panel into the next. */
const PANEL_FADE_MS = 350;
const PANEL_EASING = 'cubic-bezier(0.215, 0.61, 0.355, 1)'; // cubic ease-out, Enyo's default

function TabPanelsView(binding: BindingProps) {
  const { node, childNodes, renderNode } = binding;
  const tabs: Tab[] = node.tabList();
  const selected = Number(node.get('selected')) || 0;
  const current: Component | undefined = childNodes[selected];

  // When the current panel changes, the one it replaces stays on screen while the two cross-fade.
  const shown = useRef<Component | undefined>(current);
  const [leaving, setLeaving] = useState<Component | undefined>(undefined);
  useLayoutEffect(() => {
    const before = shown.current;
    shown.current = current;
    if (!before || before === current || before.destroyed || node.get('animate') === false) return;
    setLeaving(before);
    const timer = setTimeout(() => setLeaving(undefined), PANEL_FADE_MS);
    return () => clearTimeout(timer);
  }, [current, node]);

  const fade = (name: 'in' | 'out') => ({ animation: `onyx-panel-${name} ${PANEL_FADE_MS}ms ${PANEL_EASING} both` });
  return (
    <div {...host(binding, ['onyx-tab-panels'])}>
      <div className="onyx-tab-bar">
        <TabStrip node={node} tabs={tabs} selected={selected} />
      </div>
      <div className="onyx-tab-panels-client">
        {childNodes.map((panel) =>
          renderNode(panel, panel === current ? (leaving ? fade('in') : undefined) : panel === leaving ? fade('out') : { display: 'none' }),
        )}
      </div>
    </div>
  );
}

export const navigation: PackEntry[] = [
  entry({ name: 'onyx.MoreToolbar', kind: 'duyo.Control', published: { menuClass: '', movedClass: '' } }, MoreToolbarView),
  entry(tabBar, TabBarView),
  entry(tabPanel, (binding) => <div {...host(binding, [])}>{inner(binding)}</div>),
  entry(tabPanels, TabPanelsView),
];
