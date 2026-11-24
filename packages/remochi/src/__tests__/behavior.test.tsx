import { KindRegistry, createRuntime, kind, type Component, type ComponentDefinition } from '@duyo/core';
import { RuntimeView, basePack, createRenderer, installPack, renderInto, type KindPack } from '@duyo/react';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createRemochiPack, remochiPack } from '../index.js';

afterEach(cleanup);

function mount(definition: ComponentDefinition, pack: KindPack = remochiPack, setupKinds?: (registry: KindRegistry) => void) {
  const registry = new KindRegistry();
  const packs = [basePack, pack];
  for (const p of packs) installPack(registry, p);
  setupKinds?.(registry);
  const runtime = createRuntime({ registry });
  const root = runtime.create(definition);
  const view = render(<RuntimeView root={root} renderer={createRenderer(packs)} />);
  return { root, runtime, ...view };
}

/** An app kind that owns a component and records what it hears. */
function withHandlers(component: ComponentDefinition, heard: Record<string, ReturnType<typeof vi.fn>>) {
  return (registry: KindRegistry) =>
    registry.register({
      name: 'App.Screen',
      kind: 'duyo.Control',
      components: [{ name: 'subject', ...component }],
      ...heard,
    });
}

describe('buttons and toggles', () => {
  it('draws content as the label and taps through the wrapper', () => {
    const tapped = vi.fn();
    const { root } = mount({ kind: 'App.Screen' }, remochiPack, withHandlers({ kind: 'remochi.Button', content: 'Save', ontap: 'tapped' }, { tapped }));
    fireEvent.click(screen.getByRole('button', { name: /Save/ }));
    expect(tapped).toHaveBeenCalledTimes(1);
    expect(tapped.mock.calls[0]![0]).toBe(root.$.subject);
  });

  it('does not tap while disabled', () => {
    const tapped = vi.fn();
    mount({ kind: 'App.Screen' }, remochiPack, withHandlers({ kind: 'remochi.Button', content: 'Nope', disabled: true, ontap: 'tapped' }, { tapped }));
    fireEvent.click(screen.getByText('Nope'));
    expect(tapped).not.toHaveBeenCalled();
  });

  it('Toggle: a click writes the value and raises onChange; code can set it back', () => {
    const changed = vi.fn();
    const { root } = mount({ kind: 'App.Screen' }, remochiPack, withHandlers({ kind: 'remochi.Toggle', onChange: 'changed' }, { changed }));
    const toggle = screen.getByRole('switch');
    expect(toggle.getAttribute('aria-checked')).toBe('false');
    // Remochi's switch is pointer-driven: a press and release without a drag toggles.
    fireEvent.pointerDown(toggle);
    fireEvent.pointerUp(toggle);
    expect(root.$.subject!.value).toBe(true);
    expect(toggle.getAttribute('aria-checked')).toBe('true');
    expect(changed.mock.calls[0]![1]).toMatchObject({ value: true, originator: root.$.subject });
    act(() => root.$.subject!.setValue(false));
    expect(toggle.getAttribute('aria-checked')).toBe('false');
    fireEvent.keyDown(toggle, { key: ' ' });
    expect(root.$.subject!.value).toBe(true);
  });

  it('Checkbox: same two-way behaviour', () => {
    const changed = vi.fn();
    const { root } = mount({ kind: 'App.Screen' }, remochiPack, withHandlers({ kind: 'remochi.Checkbox', onChange: 'changed' }, { changed }));
    const box = screen.getByRole('checkbox');
    fireEvent.click(box);
    expect(root.$.subject!.checked).toBe(true);
    expect(box.getAttribute('aria-checked')).toBe('true');
    expect(changed.mock.calls[0]![1]).toMatchObject({ value: true });
    act(() => root.$.subject!.setChecked(false));
    expect(box.getAttribute('aria-checked')).toBe('false');
  });

  it('ViewSelectButton: selection is owned by the component', () => {
    const selected = vi.fn();
    const { root } = mount(
      { kind: 'App.Screen' },
      remochiPack,
      withHandlers({ kind: 'remochi.ViewSelectButton', items: [{ content: 'Grid', value: 'grid' }, { content: 'List', value: 'list' }], onSelect: 'selected' }, { selected }),
    );
    fireEvent.click(screen.getByText('List'));
    expect(root.$.subject!.selected).toBe(1);
    expect(selected.mock.calls[0]![1]).toMatchObject({ index: 1, value: 'list' });
  });

  it('ViewSelectButton: onSelect carries the direction of the choice', () => {
    const selected = vi.fn();
    mount(
      { kind: 'App.Screen' },
      remochiPack,
      withHandlers({ kind: 'remochi.ViewSelectButton', selected: 1, items: [{ content: 'Grid' }, { content: 'List' }, { content: 'Cards' }], onSelect: 'selected' }, { selected }),
    );
    fireEvent.click(screen.getByText('Cards'));
    expect(selected.mock.calls[0]![1]).toMatchObject({ index: 2, direction: 'forward', from: 1, to: 2 });
    fireEvent.click(screen.getByText('Grid'));
    expect(selected.mock.calls[1]![1]).toMatchObject({ index: 0, direction: 'back', from: 2, to: 0 });
  });

  it('Button forwards opt-in appearance ("drop" vs default "caps")', () => {
    const { root, container } = mount({
      kind: 'duyo.FittableRows',
      components: [
        { kind: 'remochi.Button', name: 'capsBtn', content: 'Caps' },
        { kind: 'remochi.Button', name: 'dropBtn', content: 'Drop', appearance: 'drop' },
      ],
    });
    const buttons = container.querySelectorAll('button');
    expect(buttons[0]!.getAttribute('data-appearance')).toBe('caps');
    expect(buttons[1]!.getAttribute('data-appearance')).toBe('drop');
    expect(buttons[1]!.className).toContain('mochi-button--drop');
    act(() => root.$.capsBtn!.setAppearance('drop'));
    expect(buttons[0]!.getAttribute('data-appearance')).toBe('drop');
  });
});

describe('fields', () => {
  it('Input: typing writes the value and bubbles oninput; blur bubbles onchange', () => {
    const typed = vi.fn();
    const committed = vi.fn();
    const { root } = mount(
      { kind: 'App.Screen' },
      remochiPack,
      withHandlers({ kind: 'remochi.Input', placeholder: 'Name', oninput: 'typed', onchange: 'committed' }, { typed, committed }),
    );
    const input = screen.getByPlaceholderText('Name') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Ada' } });
    expect(root.$.subject!.value).toBe('Ada');
    expect(typed.mock.calls[0]![1]).toMatchObject({ value: 'Ada', originator: root.$.subject });
    fireEvent.blur(input);
    expect(committed).toHaveBeenCalledTimes(1);
    act(() => root.$.subject!.setValue('Grace'));
    expect(input.value).toBe('Grace');
  });

  it('Input: renders directly onto <input> via host: props without an extra wrapper', () => {
    const keyDown = vi.fn();
    const { root } = mount(
      { kind: 'App.Screen' },
      remochiPack,
      (registry) =>
        registry.register({
          name: 'App.Screen',
          kind: 'duyo.FittableColumns',
          components: [{ name: 'subject', kind: 'remochi.Input', placeholder: 'Search', fit: true, attributes: { 'data-role': 'search' }, onkeydown: 'keyDown' }],
          keyDown,
        }),
    );
    const input = screen.getByPlaceholderText('Search') as HTMLInputElement;
    expect(input.getAttribute('data-duyo-kind')).toBe('remochi.Input');
    expect(input.getAttribute('data-role')).toBe('search');
    expect(input.style.flex).toBe('1 1 0%');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(keyDown).toHaveBeenCalledTimes(1);
    expect(keyDown.mock.calls[0]![1]).toMatchObject({ key: 'Enter', originator: root.$.subject });
  });

  it('Input: Enter bubbles onenter without blur firing onenter', () => {
    const committed = vi.fn();
    const submitted = vi.fn();
    const { root } = mount(
      { kind: 'App.Screen' },
      remochiPack,
      withHandlers({ kind: 'remochi.Input', placeholder: 'Password', onchange: 'committed', onenter: 'submitted' }, { committed, submitted }),
    );
    const input = screen.getByPlaceholderText('Password') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'secret' } });
    fireEvent.blur(input);
    expect(committed).toHaveBeenCalledTimes(1);
    expect(submitted).not.toHaveBeenCalled();

    fireEvent.keyDown(input, { key: 'Enter' });
    expect(committed).toHaveBeenCalledTimes(2);
    expect(submitted).toHaveBeenCalledTimes(1);
    expect(submitted.mock.calls[0]![1]).toMatchObject({ type: 'enter', value: 'secret', originator: root.$.subject });
  });

  it('Dropdown: choosing an option writes the value and raises onChange', () => {
    const changed = vi.fn();
    const { root } = mount(
      { kind: 'App.Screen' },
      remochiPack,
      withHandlers(
        { kind: 'remochi.Dropdown', options: [{ value: 'a', label: 'Alpha' }, { value: 'b', label: 'Beta' }], value: 'a', onChange: 'changed' },
        { changed },
      ),
    );
    fireEvent.click(screen.getByText('Alpha'));
    fireEvent.click(screen.getByText('Beta'));
    expect(root.$.subject!.value).toBe('b');
    expect(changed.mock.calls[0]![1]).toMatchObject({ value: 'b' });
  });
});

describe('panels', () => {
  const panels = (n: number): ComponentDefinition[] =>
    Array.from({ length: n }, (_, i) => ({ kind: 'remochi.Repanel', name: `p${i}`, components: [{ content: `Panel ${i}` }] }));

  it('RepanelStack draws its Duyo panels as real Repanels, in order', () => {
    mount({ kind: 'remochi.RepanelStack', activeIndex: 0, components: panels(3) });
    expect(screen.getByText('Panel 0')).toBeTruthy();
  });

  it('RepanelStack: activeIndex is controlled, and next()/previous() move it', () => {
    const { root } = mount({ kind: 'remochi.RepanelStack', activeIndex: 0, components: panels(3) });
    act(() => root.next());
    expect(root.activeIndex).toBe(1);
    expect(screen.getByText('Panel 1')).toBeTruthy();
    act(() => root.next());
    act(() => root.next());
    expect(root.activeIndex).toBe(2);
    act(() => root.previous());
    expect(root.activeIndex).toBe(1);
  });

  it('RepanelStack omits showing: false panels and clamps next()/previous() to visible panels', () => {
    const { root } = mount({
      kind: 'remochi.RepanelStack',
      activeIndex: 0,
      components: [
        { kind: 'remochi.Repanel', name: 'p0', components: [{ content: 'Panel 0' }] },
        { kind: 'remochi.Repanel', name: 'p1', showing: false, components: [{ content: 'Hidden Panel' }] },
        { kind: 'remochi.Repanel', name: 'p2', components: [{ content: 'Panel 2' }] },
      ],
    });
    expect(screen.queryByText('Hidden Panel')).toBeNull();
    expect(screen.getByText('Panel 2')).toBeTruthy();

    act(() => root.next());
    expect(root.activeIndex).toBe(1);
    act(() => root.next());
    expect(root.activeIndex).toBe(1);
    act(() => root.previous());
    expect(root.activeIndex).toBe(0);

    act(() => root.$.p1!.setShowing(true));
    expect(screen.getByText('Hidden Panel')).toBeTruthy();
    act(() => root.next());
    act(() => root.next());
    expect(root.activeIndex).toBe(2);
  });

  it('Repanel and RepanelStack wrap panel children inside .mochi-panel-body', () => {
    const { container } = mount({
      kind: 'duyo.FittableRows',
      components: [
        { kind: 'remochi.Repanel', name: 'solo', components: [{ content: 'Solo body' }] },
        {
          kind: 'remochi.RepanelStack',
          activeIndex: 0,
          components: [{ kind: 'remochi.Repanel', name: 'stacked', classes: 'custom-panel', components: [{ content: 'Stacked body' }] }],
        },
      ],
    });
    const soloPanel = container.querySelector('[data-duyo-kind="remochi.Repanel"] .mochi-panel')!;
    expect(soloPanel.querySelector(':scope > .mochi-panel-body')?.textContent).toContain('Solo body');

    const stackedPanel = container.querySelector('.custom-panel.mochi-panel')!;
    expect(stackedPanel.getAttribute('data-duyo-id')).toBeTruthy();
    expect(stackedPanel.querySelector(':scope > .mochi-panel-body')?.textContent).toContain('Stacked body');
  });

  it('RepanelStack forwards keepPast and controls, and raises onControlsAction', () => {
    const controlled = vi.fn();
    const { root, container } = mount(
      { kind: 'App.Screen' },
      remochiPack,
      withHandlers(
        { kind: 'remochi.RepanelStack', activeIndex: 1, controls: 'always', keepPast: false, onControlsAction: 'controlled', components: panels(3) },
        { controlled },
      ),
    );
    expect(container.querySelector('[data-keep-past="true"]')).toBeNull();
    const forward = screen.getByRole('button', { name: /forward|next/i });
    fireEvent.click(forward);
    expect(controlled.mock.calls[0]![1]).toMatchObject({ action: 'forward' });
    expect(root.$.subject!.controls).toBe('always');
    expect(mount({ kind: 'remochi.RepanelStack', controls: 'sometimes' }).runtime.diagnostics.map((d) => d.code)).toContain('DUYO_PROP_002');
  });

  it('RepanelStack: upcoming names a child panel that waits as a peek until it is opened', () => {
    const opened = vi.fn();
    const { root } = mount(
      { kind: 'App.Screen' },
      remochiPack,
      withHandlers(
        {
          kind: 'remochi.RepanelStack',
          activeIndex: 0,
          upcoming: 'p1',
          onUpcomingOpen: 'opened',
          components: [
            { kind: 'remochi.Repanel', name: 'p0', components: [{ content: 'Panel 0' }] },
            { kind: 'remochi.Repanel', name: 'p1', hint: 'Next', peekLabel: 'Folders', components: [{ content: 'Panel 1' }] },
          ],
        },
        { opened },
      ),
    );
    const peek = screen.getByRole('button', { name: 'Open Folders, Next' });
    expect(root.$.subject!.children.length).toBe(2);

    fireEvent.click(peek);
    expect(opened).toHaveBeenCalledTimes(1);
    expect(opened.mock.calls[0]![1]).toMatchObject({ upcoming: 'p1', reason: 'tap', panelCount: 1 });
    expect(root.$.subject!.upcoming).toBe('');
    expect(root.$.subject!.activeIndex).toBe(1);
    expect(root.$.p1!.showing).toBe(true);
    expect(screen.getByText('Panel 1')).toBeTruthy();
  });

  it('Repanel forwards hint, sequence and peekLabel for the peek', () => {
    mount({
      kind: 'remochi.RepanelStack',
      activeIndex: 0,
      upcoming: 'p1',
      components: [
        { kind: 'remochi.Repanel', name: 'p0', components: [{ content: 'Panel 0' }] },
        {
          kind: 'remochi.Repanel',
          name: 'p1',
          sequence: { index: 2, label: 'Messages' },
          components: [{ kind: 'remochi.Header', content: 'Messages' }, { content: 'Panel 1' }],
        },
      ],
    });
    // With no peekLabel the peek is named after the panel's Header.
    expect(screen.getByRole('button', { name: 'Open Messages' })).toBeTruthy();
    expect(document.body.textContent).toContain('02');
  });

  it('Collapsable draws its title and reveals Duyo children', () => {
    const toggled = vi.fn();
    const { root } = mount(
      { kind: 'App.Screen' },
      remochiPack,
      (registry) =>
        registry.register({
          name: 'App.Screen',
          kind: 'duyo.Control',
          components: [{ name: 'subject', kind: 'remochi.Collapsable', title: 'More', onToggle: 'toggled', components: [{ content: 'details' }] }],
          toggled,
        }),
    );
    fireEvent.click(screen.getByText('More'));
    expect(toggled).toHaveBeenCalledTimes(1);
    expect(root.$.subject!.expanded).toBe(true);
  });
});

describe('dialogs', () => {
  it('Dialog is closed until opened, then confirms and closes itself', () => {
    const confirmed = vi.fn();
    const { root } = mount(
      { kind: 'App.Screen' },
      remochiPack,
      withHandlers(
        { kind: 'remochi.Dialog', title: 'Delete it?', dialogType: 'confirm', confirmText: 'Yes, delete', onConfirm: 'confirmed', components: [{ content: 'This cannot be undone.' }] },
        { confirmed },
      ),
    );
    expect(screen.queryByRole('dialog')).toBeNull();
    act(() => root.$.subject!.setOpen(true));
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText('Delete it?')).toBeTruthy();
    expect(screen.getByText('This cannot be undone.')).toBeTruthy();
    fireEvent.click(screen.getByText('Yes, delete'));
    expect(confirmed.mock.calls[0]![1]).toMatchObject({ value: true });
    expect(root.$.subject!.open).toBe(false);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('Dialog action buttons are plain data and raise onAction', () => {
    const acted = vi.fn();
    mount(
      { kind: 'App.Screen' },
      remochiPack,
      withHandlers(
        { kind: 'remochi.Dialog', open: true, title: 'Pick', actions: [{ label: 'Retry', action: 'retry' }], onAction: 'acted' },
        { acted },
      ),
    );
    fireEvent.click(screen.getByText('Retry'));
    expect(acted.mock.calls[0]![1]).toMatchObject({ action: 'retry', label: 'Retry' });
  });

  it('Dialog and PopupPanel bubble onDismiss without bubbling onClose to root handlers', () => {
    const dialogClosed = vi.fn();
    const dismissed = vi.fn();
    const rootClosed = vi.fn();
    const { root, runtime } = mount(
      { kind: 'App.Screen' },
      remochiPack,
      (registry) =>
        registry.register({
          name: 'App.Screen',
          kind: 'duyo.Control',
          handlers: { onDismiss: 'dismissed', onClose: 'rootClosed' },
          components: [
            { name: 'dialog', kind: 'remochi.Dialog', open: true, title: 'Confirm', showCloseButton: true, onClose: 'dialogClosed' },
            { name: 'popup', kind: 'remochi.PopupPanel', title: 'Menu' },
          ],
          dialogClosed,
          dismissed,
          rootClosed,
        }),
    );
    const unhandledClose = vi.fn();
    runtime.onUnhandled('onClose', unhandledClose);

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(root.$.dialog!.open).toBe(false);
    expect(dialogClosed).toHaveBeenCalledTimes(1);
    expect(dismissed).toHaveBeenCalledTimes(1);
    expect(dismissed.mock.calls[0]![1]).toMatchObject({ originator: root.$.dialog });
    expect(rootClosed).not.toHaveBeenCalled();
    expect(unhandledClose).not.toHaveBeenCalled();

    act(() => root.$.popup!.setOpen(true));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(root.$.popup!.open).toBe(false);
    expect(dismissed).toHaveBeenCalledTimes(2);
    expect(dismissed.mock.calls[1]![1]).toMatchObject({ originator: root.$.popup });
    expect(rootClosed).not.toHaveBeenCalled();
    expect(unhandledClose).not.toHaveBeenCalled();
  });

  it('Dialog forwards tone ("normal", "warning", "error") and rejects unknown tones', () => {
    const { root } = mount(
      { kind: 'App.Screen' },
      remochiPack,
      withHandlers({ kind: 'remochi.Dialog', open: true, title: 'Alert', tone: 'warning' }, {}),
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog.getAttribute('data-tone')).toBe('warning');
    expect(dialog.className).toContain('mochi-dialog--warning');

    act(() => root.$.subject!.setTone('error'));
    expect(dialog.getAttribute('data-tone')).toBe('error');
    expect(dialog.className).toContain('mochi-dialog--error');

    act(() => root.$.subject!.setTone('normal'));
    expect(dialog.getAttribute('data-tone')).toBe('normal');
    expect(dialog.className).not.toContain('mochi-dialog--error');
    expect(dialog.className).not.toContain('mochi-dialog--warning');

    const invalid = mount({ kind: 'remochi.Dialog', tone: 'urgent' });
    expect(invalid.runtime.diagnostics.map((d) => d.code)).toContain('DUYO_PROP_002');
  });
});

describe('theming and layout', () => {
  it('ThemeWrapper forwards motion, contrast, transparency and ground', () => {
    const { root, container } = mount(
      { kind: 'remochi.ThemeWrapper', syncHtml: true, motion: 'reduced', contrast: 'more', transparency: 'reduced', ground: 'vignette' },
      createRemochiPack({ theme: false }),
    );
    const html = document.documentElement;
    expect(html.getAttribute('data-motion')).toBe('reduced');
    expect(html.getAttribute('data-mochi-contrast')).toBe('more');
    expect(html.getAttribute('data-mochi-transparency')).toBe('reduced');
    expect(container.querySelector('.mochi-ground--vignette')).toBeTruthy();

    act(() => root.setMotion('off'));
    act(() => root.setGround('plain'));
    expect(html.getAttribute('data-motion')).toBe('off');
    expect(container.querySelector('.mochi-ground--vignette')).toBeNull();
    expect(mount({ kind: 'remochi.ThemeWrapper', motion: 'fast' }, createRemochiPack({ theme: false })).runtime.diagnostics.map((d) => d.code)).toContain('DUYO_PROP_002');
  });

  it('FloatingPanel forwards fullBleed', () => {
    const { root, container } = mount({ kind: 'remochi.FloatingPanel', fullBleed: true, components: [{ content: 'Body' }] });
    expect(container.querySelector('[class*="full-bleed"], [data-full-bleed]')).toBeTruthy();
    act(() => root.setFullBleed(false));
    expect(container.querySelector('[class*="full-bleed"], [data-full-bleed]')).toBeNull();
  });

  it('mounts Remochi ThemeWrapper from the pack, with options', () => {
    const light = createRemochiPack({
      theme: {
        defaultTheme: 'light',
        tokens: { '--mochi-accent': '#ff5500' },
        style: { padding: '6px' },
      },
    });
    const { container } = mount({ kind: 'remochi.Badge', content: '3' }, light);
    expect(document.documentElement.getAttribute('data-mochi-theme')).toBe('light');
    expect(document.documentElement.style.getPropertyValue('--mochi-accent')).toBe('#ff5500');
    const wrapper = container.querySelector<HTMLElement>('.mochi-theme-wrapper')!;
    expect(wrapper.style.getPropertyValue('--mochi-accent')).toBe('#ff5500');
    expect(wrapper.style.padding).toBe('6px');
  });

  it('Remochi kinds take part in Duyo layout like any other kind', () => {
    const { container } = mount({
      kind: 'duyo.FittableColumns',
      components: [{ kind: 'remochi.Button', content: 'A' }, { kind: 'remochi.Slider', fit: true }],
    });
    const columns = container.querySelector<HTMLElement>('[data-duyo-kind="duyo.FittableColumns"]')!;
    const [first, second] = Array.from(columns.children) as HTMLElement[];
    expect(columns.style.flexDirection).toBe('row');
    expect(first!.style.flex).toBe('0 0 auto');
    expect(second!.style.flex).toBe('1 1 0%');
  });

  it('keeps unknown values out: variant is validated by Duyo before Remochi sees it', () => {
    const { runtime } = mount({ kind: 'remochi.Button', variant: 'neon' });
    expect(runtime.diagnostics.map((d) => d.code)).toContain('DUYO_PROP_002');
  });

  it('Header forwards size ("header" or "display") and rejects unknown sizes', () => {
    const { root, container } = mount({ kind: 'remochi.Header', content: 'Settings', size: 'display' });
    const header = container.querySelector('.mochi-header')!;
    expect(header.className).toContain('display');
    act(() => root.setSize('header'));
    expect(header.className).not.toContain('display');
    expect(mount({ kind: 'remochi.Header', size: 'huge' }).runtime.diagnostics.map((d) => d.code)).toContain('DUYO_PROP_002');
  });

  it('Label draws its content as a heading', () => {
    mount({ kind: 'remochi.Label', content: 'Section' });
    expect(screen.getByRole('heading', { name: 'Section' })).toBeTruthy();
  });

  it('Header forwards customClasses onto the Remochi header', () => {
    const { container } = mount({ kind: 'remochi.Header', content: 'Settings', customClasses: 'banner-header' });
    expect(container.querySelector('.banner-header')?.textContent).toContain('Settings');
  });
});

describe('within the sampler idea: Remochi and base kinds side by side', () => {
  it('mixes duyo.* and remochi.* freely in one tree', () => {
    const { container } = mount({
      kind: 'duyo.FittableRows',
      components: [{ tag: 'h1', content: 'Settings' }, { kind: 'remochi.Toggle' }, { kind: 'duyo.Button', content: 'Plain' }],
    });
    expect(within(container).getByText('Settings')).toBeTruthy();
    expect(within(container).getByRole('switch')).toBeTruthy();
    expect(within(container).getByText('Plain')).toBeTruthy();
  });
});


describe('README example', () => {
  it('runs as documented', async () => {
    const heard: unknown[] = [];
    const mochi = createRemochiPack({ theme: { defaultTheme: 'dark' } });
    const packs = [basePack, mochi];
    const registry = new KindRegistry();
    packs.forEach((pack) => installPack(registry, pack));

    kind(
      {
        name: 'App.Settings',
        kind: 'duyo.FittableRows',
        components: [
          { kind: 'remochi.Header', content: 'Settings' },
          { kind: 'remochi.Toggle', name: 'wifi', onChange: 'wifiChanged' },
          { kind: 'remochi.Button', content: 'Save', variant: 'affirmative', ontap: 'save' },
        ],
        wifiChanged(_sender: Component, event: { value: boolean }) {
          heard.push(event.value);
        },
        save() {
          heard.push('saved');
        },
      },
      { registry },
    );

    const runtime = createRuntime({ registry });
    const target = document.createElement('div');
    document.body.appendChild(target);
    const handle = renderInto(runtime.create({ kind: 'App.Settings' }), createRenderer(packs), target);

    const toggle = await screen.findByRole('switch');
    fireEvent.keyDown(toggle, { key: ' ' });
    fireEvent.click(screen.getByRole('button', { name: /Save/ }));
    expect(heard).toEqual([true, 'saved']);
    expect(runtime.diagnostics).toEqual([]);

    handle.unmount();
    target.remove();
  });
});
